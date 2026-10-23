import {
  type CloudRecord,
  type Conflict,
  type Pending,
  stable,
  syncable,
} from "./model";

export interface LocalStore {
  read<T>(key: string, fallback: T): Promise<T>;
  write(key: string, value: unknown): Promise<void>;
  keys(): Promise<string[]>;
  prepare?(): Promise<void>;
  prepareRemote?(): Promise<void>;
  subscribe?(callback: (key: string, value: unknown) => void): () => void;
  setAccount?(uid: string | null): Promise<void>;
}
export interface CloudTransport {
  put(mutation: Pending, deviceId: string): Promise<CloudRecord>;
}
type State = {
  revisions: Record<string, number>;
  queue: Pending[];
  conflicts: Conflict[];
  lastSync: string;
  error: string;
};
export class SyncEngine {
  state: State = {
    revisions: {},
    queue: [],
    conflicts: [],
    lastSync: "",
    error: "",
  };
  private serial: Promise<unknown> = Promise.resolve();
  private stopped = false;
  private flushing = false;
  private inFlight = new Map<string, string>();
  private listeners = new Set<() => void>();
  constructor(
    readonly uid: string,
    readonly deviceId: string,
    private local: LocalStore,
    private transport: CloudTransport,
  ) {}
  private get stateKey() {
    return `community:sync:${this.uid}`;
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private async persist() {
    await this.local.write(this.stateKey, this.state);
    this.listeners.forEach((fn) => fn());
  }
  private schedule<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.serial.then(() => {
      if (this.stopped) throw Error("Sitzung beendet.");
      return fn();
    });
    this.serial = next.catch(() => {});
    return next;
  }
  async init() {
    this.state = await this.local.read(this.stateKey, this.state);
  }
  stop() {
    this.stopped = true;
  }
  capture(key: string, value: unknown, deleted = false) {
    return this.schedule(async () => {
      if (!syncable(key)) return;
      const payload = stable(value);
      if (new TextEncoder().encode(payload).length > 750000)
        throw Error(
          "Datensatz über 750 KB: vor dem Synchronisieren aufteilen.",
        );
      const existing = this.state.queue.find((m) => m.key === key);
      if (existing?.payload === payload && existing.deleted === deleted) return;
      if (
        !existing &&
        (await this.local.read(`community:ack:${this.uid}:${key}`, "")) ===
          stable({ payload, deleted })
      )
        return;
      const mutation: Pending = {
        key,
        payload,
        deleted,
        mutationId: crypto.randomUUID(),
        baseRevision: this.state.revisions[key] ?? 0,
      };
      this.state.queue = [
        ...this.state.queue.filter((m) => m.key !== key),
        mutation,
      ];
      this.state.conflicts = this.state.conflicts.map((conflict) =>
        conflict.remote.key === key
          ? { ...conflict, local: mutation }
          : conflict,
      );
      await this.persist();
    });
  }
  receive(records: CloudRecord[]) {
    return this.schedule(async () => {
      for (const remote of records) {
        if (this.stopped) return;
        if (
          !syncable(remote.key) ||
          remote.revision <= (this.state.revisions[remote.key] ?? 0)
        )
          continue;
        const pending = this.state.queue.find((m) => m.key === remote.key);
        if (
          pending &&
          pending.mutationId !== remote.mutationId &&
          this.inFlight.get(remote.key) === remote.mutationId
        ) {
          pending.baseRevision = remote.revision;
          this.state.revisions[remote.key] = remote.revision;
          continue;
        }
        if (
          pending &&
          pending.mutationId !== remote.mutationId &&
          (pending.payload !== remote.payload ||
            pending.deleted !== remote.deleted)
        ) {
          this.state.conflicts = [
            ...this.state.conflicts.filter((c) => c.remote.key !== remote.key),
            { local: pending, remote },
          ];
          continue;
        }
        await this.local.write(
          `community:backup:${this.uid}:${remote.key}`,
          await this.local.read(remote.key, null),
        );
        await this.local.write(
          remote.key,
          remote.deleted ? null : JSON.parse(remote.payload),
        );
        await this.local.write(
          `community:ack:${this.uid}:${remote.key}`,
          stable({ payload: remote.payload, deleted: remote.deleted }),
        );
        this.state.revisions[remote.key] = remote.revision;
        this.state.queue = this.state.queue.filter((m) => m.key !== remote.key);
      }
      await this.persist();
    });
  }
  resolve(key: string, choice: "local" | "remote") {
    return this.schedule(async () => {
      const conflict = this.state.conflicts.find((c) => c.remote.key === key);
      if (!conflict) return;
      // A backup of both versions is durable before any conflict decision is applied.
      await this.local.write(
        `community:conflict-backup:${this.uid}:${crypto.randomUUID()}`,
        conflict,
      );
      this.state.revisions[key] = conflict.remote.revision;
      this.state.queue = this.state.queue.filter((m) => m.key !== key);
      if (choice === "local")
        this.state.queue.push({
          ...conflict.local,
          mutationId: crypto.randomUUID(),
          baseRevision: conflict.remote.revision,
        });
      else
        await this.local.write(
          key,
          conflict.remote.deleted ? null : JSON.parse(conflict.remote.payload),
        );
      this.state.conflicts = this.state.conflicts.filter(
        (c) => c.remote.key !== key,
      );
      await this.persist();
    });
  }
  async flush() {
    if (this.flushing || this.stopped) return;
    this.flushing = true;
    try {
      for (const original of [...this.state.queue]) {
        const mutation = structuredClone(
          this.state.queue.find((m) => m.key === original.key) ?? original,
        );
        if (
          this.stopped ||
          this.state.conflicts.some((c) => c.remote.key === mutation.key)
        )
          continue;
        try {
          this.inFlight.set(mutation.key, mutation.mutationId);
          const remote = await this.transport.put(mutation, this.deviceId);
          if (this.stopped) return;
          await this.schedule(async () => {
            const current = this.state.queue.find(
              (m) => m.key === mutation.key,
            );
            if (remote.mutationId !== mutation.mutationId) {
              if (current)
                this.state.conflicts = [
                  ...this.state.conflicts.filter(
                    (c) => c.remote.key !== mutation.key,
                  ),
                  { local: current, remote },
                ];
            } else {
              this.state.revisions[mutation.key] = remote.revision;
              await this.local.write(
                `community:ack:${this.uid}:${mutation.key}`,
                stable({
                  payload: mutation.payload,
                  deleted: mutation.deleted,
                }),
              );
              this.state.queue = this.state.queue.filter(
                (m) => m.mutationId !== mutation.mutationId,
              );
              const newer = this.state.queue.find(
                (m) => m.key === mutation.key,
              );
              if (newer) newer.baseRevision = remote.revision;
              this.state.lastSync = new Date().toISOString();
            }
            this.state.error = "";
            await this.persist();
          });
        } catch (error) {
          if (this.stopped) return;
          await this.schedule(async () => {
            this.state.error = String(error);
            await this.persist();
          });
          break;
        } finally {
          this.inFlight.delete(mutation.key);
        }
      }
    } finally {
      this.flushing = false;
    }
  }
}

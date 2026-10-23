import { createCatalogSearch } from "@dofus/community/catalog-search";
import { setBackendObserver } from "./client";
import { useEffect, type ReactNode } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { CommunityProvider } from "@dofus/community/ui";
import type { LocalStore } from "@dofus/community";
import dungeons from "../../../packages/community/src/dungeons.json";
import {
  read,
  write,
  localAccount,
  onStorageWrite,
  storageKeys,
  setStorageAccount,
} from "./storage";
type Connection = { url: string; token: string };
const tables = [
  "characters",
  "character_quests",
  "builder_projects",
  "builder_target_profiles",
  "world_markers",
  "world_saved_routes",
  "dungeon_preparations",
  "character_professions",
  "profession_quest_progress",
];
async function connection(): Promise<Connection> {
  return isTauri()
    ? invoke("local_connection")
    : {
        ...(await read("config", { url: "http://127.0.0.1:4310", token: "" })),
        token: sessionStorage.getItem("companion-token") ?? "",
      };
}
async function request(
  path: string,
  body?: unknown,
  method = body ? "PUT" : "GET",
  uid = localAccount(),
) {
  if (uid !== localAccount()) throw Error("Account gewechselt.");
  const config = await connection();
  if (uid !== localAccount()) throw Error("Account gewechselt.");
  const response = await fetch(config.url + path, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...(uid ? { "X-Companion-Account": uid } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (uid !== localAccount()) throw Error("Account gewechselt.");
  if (!response.ok) throw Error("Lokale Datenreplikation: " + response.status);
  return (await response.json()).data;
}
async function captureBackend() {
  const uid = localAccount();
  const save = async (key: string, value: unknown) => {
    if (uid !== localAccount()) throw Error("Account gewechselt.");
    await write(key, value);
  };
  const snapshot = await request("/api/account/replica");
  if (uid !== localAccount()) return;
  for (const table of tables)
    if (
      ![
        "characters",
        "character_quests",
        "builder_projects",
        "builder_target_profiles",
      ].includes(table)
    )
      await save(`backend:${table}`, snapshot[table]);
  await save(
    "builder:saved",
    snapshot.builder_projects.map((row: Record<string, unknown>) => ({
      ...JSON.parse(String(row.content)),
      id: row.id,
      characterId: row.character_id,
      revision: row.revision,
      active: !!row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  );
  await save(
    "builder:targets",
    snapshot.builder_target_profiles.map((row: Record<string, unknown>) => ({
      ...JSON.parse(String(row.content)),
      id: row.id,
    })),
  );
  const ids = new Set(snapshot.characters.map((c: { id: string }) => c.id));
  for (const key of await storageKeys())
    if (key.startsWith("progress:") && !ids.has(key.slice(9)))
      await save(key, []);
  for (const ch of snapshot.characters) {
    await save(
      `progress:${ch.id}`,
      snapshot.character_quests
        .filter((row: Record<string, unknown>) => row.character_id === ch.id)
        .map((row: Record<string, unknown>) => ({
          characterId: row.character_id,
          questId: row.quest_id,
          step: row.step,
          status: row.status,
          version: row.version,
          updatedAt: row.updated_at,
        })),
    );
  }
  await save(
    "characters",
    snapshot.characters.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      classId: row.class_id,
      className: row.class_name,
      level: row.level,
      omegaLevel: row.omega_level ?? 0,
      server: row.server,
      version: row.version,
      updatedAt: row.updated_at,
    })),
  );
  if (uid !== localAccount()) throw Error("Account gewechselt.");
  await request(
    "/api/account/replica-ack",
    { revision: snapshot.__sync[0].dirty_revision },
    "POST",
  );
}
async function applyLocalReplica(account: string) {
  if (account !== localAccount()) return;
  const send = (path: string, body?: unknown) =>
    request(path, body, body ? "PUT" : "GET", account);
  // Apply only cloud-supported tables and use the existing SQLite store's transactional backup endpoint.
  const characters = await read<Record<string, unknown>[] | null>(
    "characters",
    null,
  );
  if (characters)
    await send("/api/account/replica", {
      table: "characters",
      rows: characters.map((c) => ({
        id: c.id,
        name: c.name,
        server: c.server,
        class_name: c.className,
        class_id: c.classId ?? null,
        level: c.level,
        omega_level: c.omegaLevel ?? null,
        version: c.version ?? 1,
        updated_at: c.updatedAt ?? new Date().toISOString(),
      })),
    });
  const progress: Record<string, unknown>[] = [];
  for (const key of await storageKeys())
    if (key.startsWith("progress:")) {
      const entries = await read<Record<string, unknown>[]>(key, []);
      for (const entry of entries)
        progress.push({
          character_id: key.slice(9),
          quest_id: entry.questId,
          step: entry.step,
          status: entry.status,
          version: entry.version ?? 1,
          updated_at: entry.updatedAt ?? new Date().toISOString(),
        });
    }
  await send("/api/account/replica", {
    table: "character_quests",
    rows: progress,
  });
  const builds = await read<Record<string, unknown>[] | null>(
    "builder:saved",
    null,
  );
  if (builds)
    await send("/api/account/replica", {
      table: "builder_projects",
      rows: builds.map((b) => ({
        id: b.id,
        character_id: b.characterId ?? null,
        revision: b.revision ?? 0,
        active: Number(!!b.active),
        content: JSON.stringify(b),
        created_at: b.createdAt ?? new Date().toISOString(),
        updated_at: b.updatedAt ?? new Date().toISOString(),
      })),
    });
  const targets = await read<Record<string, unknown>[] | null>(
    "builder:targets",
    null,
  );
  if (targets)
    await send("/api/account/replica", {
      table: "builder_target_profiles",
      rows: targets.map((t) => ({ id: t.id, content: JSON.stringify(t) })),
    });
  for (const table of tables.filter(
    (t) =>
      ![
        "characters",
        "character_quests",
        "builder_projects",
        "builder_target_profiles",
      ].includes(t),
  )) {
    if (account !== localAccount()) throw Error("Account gewechselt.");
    const rows = await read(`backend:${table}`, null);
    if (rows !== null) await send("/api/account/replica", { table, rows });
  }
  window.dispatchEvent(new Event("companion:replica-ready"));
}

let replicaSerial: Promise<unknown> = Promise.resolve();
function sequenceReplica(fn: () => Promise<void>) {
  const next = replicaSerial.then(fn);
  replicaSerial = next.catch(() => {});
  return next;
}
async function preparePendingNative() {
  const snapshot = await request("/api/account/replica");
  const state = snapshot.__sync[0];
  if (state.dirty_revision > state.mirrored_revision) await captureBackend();
}
const store: LocalStore = {
  read,
  write,
  subscribe: onStorageWrite,
  async setAccount(uid) {
    await setStorageAccount(uid);
    if (uid) {
      try {
        const snapshot = await request("/api/account/replica");
        const state = snapshot.__sync[0];
        if (state.dirty_revision > state.mirrored_revision)
          await sequenceReplica(captureBackend);
        else await sequenceReplica(() => applyLocalReplica(uid));
      } catch (error) {
        window.dispatchEvent(
          new CustomEvent("companion:replica-error", { detail: String(error) }),
        );
      }
    }
  },
  keys: storageKeys,
  prepareRemote: () => sequenceReplica(preparePendingNative),
  async prepare() {
    if (!localAccount()) await captureBackend().catch(() => {});
  },
};
const searchItems = createCatalogSearch();
function BackendBridge() {
  useEffect(() => {
    setBackendObserver(() => sequenceReplica(captureBackend));
    let serial = Promise.resolve(),
      stopped = false;
    const capture = () => {
      serial = serial
        .then(async () => {
          if (!stopped) await sequenceReplica(captureBackend);
        })
        .catch((error) => {
          window.dispatchEvent(
            new CustomEvent("companion:replica-error", {
              detail: String(error),
            }),
          );
        });
    };
    const apply = () => {
      const account = localAccount();
      serial = serial
        .then(async () => {
          if (!account || stopped || account !== localAccount()) return;
          await sequenceReplica(() => applyLocalReplica(account));
        })
        .catch((error) => {
          window.dispatchEvent(
            new CustomEvent("companion:replica-error", {
              detail: String(error),
            }),
          );
        });
    };
    window.addEventListener("companion:backend-changed", capture);
    window.addEventListener("companion:cloud-applied", apply);
    return () => {
      stopped = true;
      setBackendObserver(undefined);
      window.removeEventListener("companion:backend-changed", capture);
      window.removeEventListener("companion:cloud-applied", apply);
    };
  }, []);
  return null;
}
export default function DesktopCommunity({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CommunityProvider
      store={store}
      searchItems={searchItems}
      dungeons={dungeons}
      emulators={
        (import.meta.env.DEV || import.meta.env.MODE === "emulator-test") &&
        import.meta.env.VITE_COMMUNITY_EMULATORS === "true"
      }
    >
      <BackendBridge />
      {children}
    </CommunityProvider>
  );
}

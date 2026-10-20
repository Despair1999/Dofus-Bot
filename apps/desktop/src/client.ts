import { read, write } from "./storage";
export type { Character, Envelope } from "@dofus/core";
import type { Envelope } from "@dofus/core";
export type { ItemDetail as Item } from "@dofus/core";
export type { Quest } from "@dofus/game-data";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Config = { url: string; token: string };
export async function api<T>(
  path: string,
  config: Config,
  body?: unknown,
  method?: string,
): Promise<Envelope<T>> {
  const url = new URL(config.url);
  if (
    url.protocol !== "https:" &&
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  )
    throw new Error("Entfernte Backends benötigen HTTPS.");
  const response = await fetch(`${url.origin}${path}`, {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 204) return { data: undefined as T };
  const json = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      json.error?.message ??
        json.message ??
        String(json.error ?? "Anfrage fehlgeschlagen"),
    );
  if (!body) await write(`cache:${config.url}:${path}`, json);
  return json;
}
export async function cached<T>(
  path: string,
  config: Config,
): Promise<Envelope<T>> {
  try {
    return await api<T>(path, config);
  } catch (error) {
    const saved = await read<Envelope<T> | null>(
      `cache:${config.url}:${path}`,
      null,
    );
    if (
      saved &&
      !(error instanceof ApiError && [401, 403].includes(error.status))
    )
      return { ...saved, cached: true, stale: true };
    throw error;
  }
}
export type Mutation = {
  id: string;
  characterId: string;
  questId: number;
  step: number;
  status: string;
  expectedVersion: number;
};
export async function enqueue(mutation: Mutation) {
  const all = await read<Mutation[]>("outbox", []);
  if (
    all.some(
      (m) =>
        m.characterId === mutation.characterId &&
        m.questId === mutation.questId,
    )
  )
    throw new Error(
      "Für diese Quest wartet bereits eine Änderung auf Synchronisierung.",
    );
  await write("outbox", [...all, mutation]);
}
export async function flush(config: Config) {
  let all = await read<Mutation[]>("outbox", []);
  for (const m of all) {
    await api(
      `/api/characters/${encodeURIComponent(m.characterId)}/progress`,
      config,
      {
        questId: m.questId,
        step: m.step,
        status: m.status,
        expectedVersion: m.expectedVersion,
        mutationId: m.id,
      },
      "PUT",
    );
    all = all.filter((v) => v.id !== m.id);
    await write("outbox", all);
  }
  return all.length;
}
export { normalize, matchText } from "./matching";

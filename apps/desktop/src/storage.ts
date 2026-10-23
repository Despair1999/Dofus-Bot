import { openDB } from "idb";
import { isTauri } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

let account: string | null = null;
let remote = false;
const changes = new Set<(key: string, value: unknown) => void>();
const personalKey = (key: string) =>
  !/^(config$|community:|ui:|overlay|translator|appearance|preferences)/.test(
    key,
  ) ||
  key.startsWith("community:characters") ||
  key.startsWith("community:parts:");
const scoped = (key: string) =>
  account && personalKey(key) ? `account:${account}:${key}` : key;
export function localAccount() {
  return account;
}
export async function setStorageAccount(uid: string | null) {
  account = uid;
}
export function onStorageWrite(fn: (key: string, value: unknown) => void) {
  changes.add(fn);
  return () => {
    changes.delete(fn);
  };
}
export async function storageKeys() {
  const keys = isTauri()
    ? (
        await (await sql()).select<{ key: string }[]>("SELECT key FROM records")
      ).map((r) => r.key)
    : (await (await web).getAllKeys("records")).map(String);
  return account
    ? keys
        .filter((k) => k.startsWith(`account:${account}:`))
        .map((k) => k.slice(`account:${account}:`.length))
    : keys.filter((k) => !k.startsWith("account:"));
}
const web = openDB("dofus-companion", 1, {
  upgrade(db) {
    db.createObjectStore("records");
  },
});
let native: Promise<Database> | undefined;
async function sql() {
  native ??= Database.load("sqlite:companion.db").then(async (db) => {
    await db.execute(
      "CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    );
    return db;
  });
  return native;
}
export async function read<T>(key: string, fallback: T): Promise<T> {
  key = scoped(key);
  if (isTauri()) {
    const rows = await (
      await sql()
    ).select<{ value: string }[]>("SELECT value FROM records WHERE key=$1", [
      key,
    ]);
    return rows[0] ? JSON.parse(rows[0].value) : fallback;
  }
  return (await (await web).get("records", key)) ?? fallback;
}
export async function write(key: string, value: unknown) {
  const original = key;
  if (key === "community:applying") {
    remote = value === true;
    return;
  }
  key = scoped(key);
  if (isTauri())
    await (
      await sql()
    ).execute(
      "INSERT INTO records(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2",
      [key, JSON.stringify(value)],
    );
  else await (await web).put("records", value, key);
  if (!remote) changes.forEach((fn) => fn(original, value));
}
export async function erase() {
  if (isTauri()) await (await sql()).execute("DELETE FROM records");
  else await (await web).clear("records");
}

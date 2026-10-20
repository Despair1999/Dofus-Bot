import { openDB } from "idb";
import { isTauri } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

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
  if (isTauri())
    await (
      await sql()
    ).execute(
      "INSERT INTO records(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2",
      [key, JSON.stringify(value)],
    );
  else await (await web).put("records", value, key);
}
export async function erase() {
  if (isTauri()) await (await sql()).execute("DELETE FROM records");
  else await (await web).clear("records");
}

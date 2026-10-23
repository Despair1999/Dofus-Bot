import { openDB } from "idb";
import type { LocalStore } from "./sync";
import { syncable } from "./model";
const database = openDB("companion-community", 1, {
  upgrade(db) {
    db.createObjectStore("records");
  },
});
let account: string | null = null;
let remote = false;
const listeners = new Set<(key: string, value: unknown) => void>();
const scoped = (key: string) =>
  account && (syncable(key) || key.startsWith("community:parts:"))
    ? `account:${account}:${key}`
    : key;
export const browserStore: LocalStore = {
  async read<T>(key: string, fallback: T) {
    return (await (await database).get("records", scoped(key))) ?? fallback;
  },
  async write(key, value) {
    const writeAccount = account;
    if (key === "community:applying") {
      remote = value === true;
      return;
    }
    await (await database).put("records", value, scoped(key));
    if (!remote && writeAccount === account)
      listeners.forEach((fn) => fn(key, value));
  },
  async keys() {
    const keys = (await (await database).getAllKeys("records")).map(String);
    return account
      ? keys
          .filter((k) => k.startsWith(`account:${account}:`))
          .map((k) => k.slice(`account:${account}:`.length))
      : keys.filter((k) => !k.startsWith("account:"));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  async setAccount(uid) {
    account = uid;
  },
};

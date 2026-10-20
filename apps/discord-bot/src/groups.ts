import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
export interface Group {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  ownerId: string;
  title: string;
  startsAt: number;
  capacity: number;
  reminded: number;
  members: string[];
}
export class Groups {
  private db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS groups(id TEXT PRIMARY KEY,guildId TEXT NOT NULL,channelId TEXT NOT NULL,messageId TEXT,ownerId TEXT NOT NULL,title TEXT NOT NULL,startsAt INTEGER NOT NULL,capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 16),reminded INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS participants(groupId TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,userId TEXT NOT NULL,joined INTEGER PRIMARY KEY AUTOINCREMENT,UNIQUE(groupId,userId));`);
  }
  create(
    input: Omit<Group, "id" | "messageId" | "members" | "reminded">,
  ): Group {
    if (
      !Number.isInteger(input.capacity) ||
      input.capacity < 1 ||
      input.capacity > 16
    )
      throw Error("Gruppengröße muss 1–16 betragen.");
    if (!input.title.trim() || input.title.length > 100)
      throw Error("Titel muss 1–100 Zeichen enthalten.");
    if (!Number.isSafeInteger(input.startsAt) || input.startsAt <= Date.now())
      throw Error("Startzeit muss in der Zukunft liegen.");
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO groups(id,guildId,channelId,ownerId,title,startsAt,capacity) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        id,
        input.guildId,
        input.channelId,
        input.ownerId,
        input.title,
        input.startsAt,
        input.capacity,
      );
    this.join(id, input.guildId, input.ownerId);
    return this.get(id)!;
  }
  get(id: string): Group | undefined {
    const row = this.db
      .prepare("SELECT * FROM groups WHERE id=?")
      .get(id) as unknown as Omit<Group, "members"> | undefined;
    if (!row) return undefined;
    return {
      ...row,
      members: (
        this.db
          .prepare(
            "SELECT userId FROM participants WHERE groupId=? ORDER BY joined",
          )
          .all(id) as { userId: string }[]
      ).map((x) => x.userId),
    };
  }
  join(id: string, guildId: string, userId: string): Group {
    const group = this.get(id);
    if (!group || group.guildId !== guildId)
      throw Error("Gruppe nicht gefunden.");
    if (group.startsAt <= Date.now())
      throw Error("Diese Gruppe hat bereits begonnen.");
    if (group.members.length >= 100 && !group.members.includes(userId))
      throw Error("Warteliste ist voll.");
    this.db
      .prepare("INSERT OR IGNORE INTO participants(groupId,userId) VALUES(?,?)")
      .run(id, userId);
    return this.get(id)!;
  }
  leave(id: string, guildId: string, userId: string): Group {
    const group = this.get(id);
    if (!group || group.guildId !== guildId)
      throw Error("Gruppe nicht gefunden.");
    this.db
      .prepare("DELETE FROM participants WHERE groupId=? AND userId=?")
      .run(id, userId);
    return this.get(id)!;
  }
  attach(id: string, messageId: string) {
    this.db
      .prepare("UPDATE groups SET messageId=? WHERE id=?")
      .run(messageId, id);
  }
  due(now = Date.now()): Group[] {
    return (
      this.db
        .prepare(
          "SELECT id FROM groups WHERE reminded=0 AND startsAt>? AND startsAt<=? AND messageId IS NOT NULL",
        )
        .all(now, now + 15 * 60 * 1000) as { id: string }[]
    ).map((x) => this.get(x.id)!);
  }
  markReminded(id: string) {
    this.db.prepare("UPDATE groups SET reminded=1 WHERE id=?").run(id);
  }
  close() {
    this.db.close();
  }
}

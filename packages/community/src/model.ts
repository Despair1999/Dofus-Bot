import { z } from "zod";

export const profileSchema = z.object({
  dofusName: z.string().trim().min(2).max(60),
  discordName: z.string().trim().min(2).max(64),
  server: z.string().trim().min(2).max(60),
  mainCharacterId: z.string().max(100).default(""),
});
export type Profile = z.infer<typeof profileSchema>;
export const guildRankSchema = z.object({
  name: z.string().trim().min(1).max(60),
  order: z.number().int().min(0).max(1000),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  icon: z.enum(["crown", "shield", "star", "diamond", "sword"]),
  archived: z.boolean(),
});
export type GuildRank = z.infer<typeof guildRankSchema> & {
  id: string;
  revision: number;
  lastAudit: string;
};
export const characterSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(2).max(60),
    classId: z.number().int().min(1).max(22),
    className: z.string().max(60),
    level: z.number().int().min(1).max(200),
    omegaLevel: z.number().int().min(0).max(100000),
    server: z.string().min(2).max(60),
    professions: z
      .record(z.string(), z.number().int().min(0).max(200))
      .default({}),
  })
  .refine(
    (c) => c.level === 200 || c.omegaLevel === 0,
    "Omega ist erst ab Stufe 200 möglich.",
  );
export type CommunityCharacter = z.infer<typeof characterSchema>;
export type Visibility = "guild" | "global";
export type Listing = {
  id: string;
  ownerUid: string;
  itemId: number;
  itemName: string;
  iconUrl: string;
  itemLevel?: number;
  category?: string;
  createdAt?: unknown;
  quantity: number;
  available: number;
  price: number;
  server: string;
  type: "sell" | "buy" | "swap";
  visibility: Visibility;
  description: string;
  status: "open" | "paused" | "withdrawn";
  revision: number;
  lastReservation: string;
  lastAudit: string;
  updatedAt?: unknown;
};
export type ReservationState =
  "requested" | "accepted" | "rejected" | "completed" | "withdrawn";
export type Reservation = {
  id: string;
  buyerUid: string;
  sellerUid: string;
  listingId: string;
  quantity: number;
  state: ReservationState;
  revision: number;
  lastAudit: string;
};
export type Participant = {
  characterId: string;
  name: string;
  level: number;
  role: string;
  status: "joined" | "waiting";
};
export type Activity = {
  id: string;
  kind: "event" | "group";
  ownerUid: string;
  title: string;
  description: string;
  server: string;
  startsAt: string;
  timezone: string;
  meeting: string;
  dungeonId: number;
  minLevel: number;
  capacity: number;
  joined: number;
  participants: Record<string, Participant>;
  status: "open" | "cancelled" | "completed";
  revision: number;
  lastAudit: string;
  lastParticipantUid?: string;
  activityType?: string;
  wantedClasses?: number[];
  wantedRoles?: string[];
  resourceName?: string;
  targetQuantity?: number;
};
export const listingInput = z.object({
  itemLevel: z.number().int().min(0).max(200).default(0),
  category: z.string().max(80).default(""),
  itemId: z.number().int().positive(),
  itemName: z.string().min(1).max(160),
  iconUrl: z
    .string()
    .max(300)
    .refine(
      (s) => !s || /^https:\/\//.test(s) || s.startsWith("/game-assets/"),
    ),
  quantity: z.number().int().min(1).max(1000000),
  price: z.number().int().min(0).max(2000000000),
  server: z.string().min(2).max(60),
  type: z.enum(["sell", "buy", "swap"]),
  visibility: z.enum(["guild", "global"]),
  description: z.string().max(2000),
});
export function reservationDelta(
  before: ReservationState | undefined,
  after: ReservationState,
  quantity: number,
) {
  const held = (s: ReservationState | undefined) =>
    s === "accepted" || s === "completed";
  return (Number(held(after)) - Number(held(before))) * quantity;
}
export function transitionReservation(
  reservation: Reservation,
  state: ReservationState,
  actor: string,
  admin = false,
) {
  const allowed: Record<ReservationState, ReservationState[]> = {
    requested: ["accepted", "rejected", "withdrawn"],
    accepted: ["completed", "withdrawn"],
    rejected: [],
    completed: [],
    withdrawn: [],
  };
  if (!allowed[reservation.state].includes(state))
    throw Error("Ungültiger Reservierungsübergang.");
  if (
    !admin &&
    (state === "withdrawn"
      ? actor !== reservation.buyerUid && actor !== reservation.sellerUid
      : actor !== reservation.sellerUid)
  )
    throw Error("Keine Berechtigung für diese Reservierung.");
  return { ...reservation, state, revision: reservation.revision + 1 };
}

// Explicit allowlist: credentials, backend URLs, caches, pending API operations and window geometry never leave the device.
export function syncable(key: string) {
  if (key.includes("::")) return syncable(key.split("::")[0]);
  return (
    [
      "characters",
      "active",
      "favorites",
      "todos",
      "builder:saved",
      "builder:buffProfiles",
      "builder:targets",
      "market:journal-v1",
      "world:filter-presets",
      "world:markers",
      "world:routes",
      "world:resource-sightings",
      "community:characters",
    ].includes(key) ||
    /^(progress:|builder:draft:|world:sightings:)/.test(key) ||
    /^backend:(characters|character_quests|builder_projects|builder_target_profiles|world_markers|world_saved_routes|dungeon_preparations|character_professions|profession_quest_progress)$/.test(
      key,
    )
  );
}
export function stable(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  return (
    "{" +
    Object.keys(value)
      .sort()
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          stable((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}
export type CloudRecord = {
  key: string;
  payload: string;
  revision: number;
  mutationId: string;
  deviceId: string;
  deleted: boolean;
};
export type Pending = {
  key: string;
  payload: string;
  baseRevision: number;
  mutationId: string;
  deleted: boolean;
};
export type Conflict = { local: Pending; remote: CloudRecord };

// Row IDs preserve ledger identity. Independent rows merge; editing the same row requires a decision.
export function mergeRows(
  local: unknown,
  cloud: unknown,
): { value: unknown; conflicts: string[] } {
  if (stable(local) === stable(cloud)) return { value: local, conflicts: [] };
  if (
    Array.isArray(local) &&
    Array.isArray(cloud) &&
    [...local, ...cloud].every(
      (v) => v && typeof v === "object" && typeof v.id === "string",
    )
  ) {
    const rows = new Map<string, unknown>();
    const conflicts: string[] = [];
    for (const row of cloud) rows.set(row.id, row);
    for (const row of local) {
      if (rows.has(row.id) && stable(rows.get(row.id)) !== stable(row))
        conflicts.push(row.id);
      else rows.set(row.id, row);
    }
    return { value: [...rows.values()], conflicts };
  }
  return { value: local, conflicts: ["Datensatz"] };
}

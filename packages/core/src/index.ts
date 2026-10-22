import { z } from "zod";

export const characterInput = z
  .object({
    name: z.string().trim().min(1).max(64),
    server: z.string().trim().min(1).max(64),
    className: z.string().trim().min(1).max(64),
    classId: z.number().int().positive().nullable().optional(),
    level: z.number().int().min(1).max(200),
    omegaLevel: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .nullable()
      .optional(),
  })
  .refine((c) => !c.omegaLevel || c.level === 200, {
    message: "Omega-Level ist erst ab Charakterstufe 200 verfügbar.",
    path: ["omegaLevel"],
  });
export type CharacterInput = z.infer<typeof characterInput>;
export interface Character extends CharacterInput {
  id: string;
  version: number;
  updatedAt: string;
}
export const progressInput = z.object({
  questId: z.number().int().positive(),
  step: z.number().int().min(0).max(10000),
  status: z.enum(["active", "paused", "completed"]),
  expectedVersion: z.number().int().nonnegative(),
  mutationId: z.uuid(),
});
export interface Progress {
  characterId: string;
  questId: number;
  step: number;
  status: "active" | "paused" | "completed";
  version: number;
  updatedAt: string;
}
export interface Item {
  id: number;
  name: string;
  level: number;
  type: string;
  category: string;
  imageUrl?: string;
  nameFr?: string;
  nameEn?: string;
  typeId?: number;
  mainGroup?: "equipment" | "resources";
  iconId?: number;
}
export interface Ingredient {
  itemId: number;
  quantity: number;
  category?: string;
  name?: string;
  imageUrl?: string;
  level?: number;
  type?: string;
}
export interface ItemDetail extends Item {
  description: string;
  effects: string[];
  recipe: Ingredient[];
  source: string;
  requirements?: string;
  weight?: number;
  setId?: number | null;
  setName?: string;
  rawEffects?: unknown[];
  effectsAvailable?: boolean;
  version?: string;
}
export interface Envelope<T> {
  data: T;
  source?: string;
  fetchedAt?: string;
  cached?: boolean;
  stale?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  version?: string | null;
}
export interface GameClass {
  id: number;
  classId: number;
  name: string;
  nameDe: string;
  nameFr: string;
  nameEn: string;
  aliases: string[];
  icon: string;
  portrait: string;
  source: string;
  placeholder: boolean;
}

export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("de")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Token Dice similarity; a proposal score, never a claim about OCR confidence. */
export function similarity(a: string, b: string): number {
  const left = normalize(a),
    right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const tokens = (s: string) => new Set(s.split(" "));
  const l = tokens(left),
    r = tokens(right);
  let overlap = 0;
  for (const t of l) if (r.has(t)) overlap++;
  return (2 * overlap) / (l.size + r.size);
}

export function matchCandidates<T extends { name: string; aliases?: string[] }>(
  text: string,
  candidates: T[],
) {
  const lines = text
    .split(/[\r\n]+/)
    .map(normalize)
    .filter(Boolean);
  return candidates
    .map((candidate) => ({
      candidate,
      score: Math.max(
        0,
        ...[candidate.name, ...(candidate.aliases ?? [])].flatMap((name) =>
          lines.map((line) => similarity(line, name)),
        ),
      ),
    }))
    .filter((result) => result.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

/** Aggregate explicit recipe quantities. Does not invent nested recipes or prices. */
export function materials(
  recipes: { recipe: Ingredient[]; quantity: number }[],
  inventory: Record<number, number> = {},
) {
  const totals = new Map<number, number>();
  for (const entry of recipes) {
    if (!Number.isSafeInteger(entry.quantity) || entry.quantity < 1)
      throw new Error("Ungültige Herstellungsmenge");
    for (const ingredient of entry.recipe) {
      if (!Number.isSafeInteger(ingredient.quantity) || ingredient.quantity < 1)
        throw new Error("Ungültige Rezeptmenge");
      const total =
        (totals.get(ingredient.itemId) ?? 0) +
        ingredient.quantity * entry.quantity;
      if (!Number.isSafeInteger(total))
        throw new Error("Materialmenge zu groß");
      totals.set(ingredient.itemId, total);
    }
  }
  return [...totals].map(([itemId, required]) => ({
    itemId,
    required,
    missing: Math.max(0, required - Math.max(0, inventory[itemId] ?? 0)),
  }));
}

export function profit(cost: number, sale: number, feePercent = 2) {
  if (
    ![cost, sale, feePercent].every(Number.isFinite) ||
    cost < 0 ||
    sale < 0 ||
    feePercent < 0 ||
    feePercent > 100
  )
    throw new Error("Ungültige Preise");
  const fees = Math.ceil((sale * feePercent) / 100),
    net = sale - fees - cost;
  return {
    cost,
    sale,
    fees,
    profit: net,
    marginPercent: sale ? (net / sale) * 100 : 0,
  };
}

export function prerequisiteOrder(
  id: number,
  graph: Record<number, number[]>,
): number[] {
  const active = new Set<number>(),
    seen = new Set<number>(),
    result: number[] = [];
  function visit(node: number) {
    if (active.has(node)) throw new Error("Zyklus in Questvoraussetzungen");
    if (seen.has(node)) return;
    active.add(node);
    for (const dependency of graph[node] ?? []) visit(dependency);
    active.delete(node);
    seen.add(node);
    result.push(node);
  }
  visit(id);
  return result;
}

/** BFS only traverses supplied, verified map edges. No Manhattan fallback. */
export function route(
  start: string,
  end: string,
  edges: Record<string, string[]>,
): string[] | null {
  const queue = [start],
    previous = new Map<string, string | null>([[start, null]]);
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i]!;
    if (node === end) {
      const path: string[] = [];
      let cursor: string | null = node;
      while (cursor !== null) {
        path.push(cursor);
        cursor = previous.get(cursor) ?? null;
      }
      return path.reverse();
    }
    for (const next of edges[node] ?? [])
      if (!previous.has(next)) {
        previous.set(next, node);
        queue.push(next);
      }
  }
  return null;
}
export * from "./builder.js";
export * from "./optimizer.js";
export * from "./world.js";
export * from "./dungeons.js";

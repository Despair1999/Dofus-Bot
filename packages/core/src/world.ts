/** All geometry uses DOFUS coordinates; identity is always the map ID. */
export interface WorldMap {
  id: number;
  name: string;
  nameFr: string;
  minScale: number;
  maxScale: number;
}
export interface WorldPosition {
  sourceWorldId?: number;
  interior?: boolean;
  id: number;
  x: number;
  y: number;
  worldId: number;
  subAreaId: number;
  areaId: number;
  name: string;
  subAreaName: string;
  areaName: string;
}
export interface WorldRegion {
  id: number;
  name: string;
  areaId: number;
  areaName: string;
}
export interface GatherableResource {
  id: number;
  itemId: number;
  name: string;
  nameFr: string;
  nameEn: string;
  jobId: number;
  jobName: string;
  level: number;
  skillId: number;
  iconId: number;
  regions: WorldRegion[];
}
export interface WorldTransition {
  from: number;
  to: number;
  direction: string;
  cost: number;
  source: string;
}
export interface WorldInteraction {
  mapId: number;
  cellId: number;
  gfxId: number;
  interactionId: number;
  status: "unresolved";
}
export interface WorldMarker {
  id: string;
  mapId: number;
  name: string;
  kind: "waypoint" | "resource" | "observation";
  resourceId?: number;
  observedAt?: string;
  note?: string;
}
export interface WorldDataset {
  schemaVersion: 1;
  version: string;
  importedAt: string;
  source: string;
  sourceSha256: string;
  mapsSha256: string | null;
  worlds: WorldMap[];
  maps: WorldPosition[];
  resources: GatherableResource[];
  transitions: WorldTransition[];
  interactions: WorldInteraction[];
  report: Record<string, number | string>;
}
export interface WorldRoute {
  mapIds: number[];
  transitions: WorldTransition[];
  steps: number;
  unreachableMapIds: number[];
  complete: boolean;
  roundTrip: boolean;
  warning: string;
}

/** Dijkstra over explicit, directed source edges. Never infer edges from coordinates. */
export function shortestMapPath(
  edges: WorldTransition[],
  start: number,
  target: number,
  excluded: Set<number> = new Set(),
): { mapIds: number[]; transitions: WorldTransition[]; cost: number } | null {
  if (excluded.has(start) || excluded.has(target)) return null;
  if (start === target) return { mapIds: [start], transitions: [], cost: 0 };
  const adjacency = new Map<number, WorldTransition[]>();
  for (const edge of edges) {
    if (
      !Number.isFinite(edge.cost) ||
      edge.cost <= 0 ||
      excluded.has(edge.from) ||
      excluded.has(edge.to)
    )
      continue;
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge);
    adjacency.set(edge.from, list);
  }
  const distance = new Map<number, number>([[start, 0]]),
    previous = new Map<number, WorldTransition>();
  const open = new Set([start]);
  while (open.size) {
    let current = start,
      best = Infinity;
    for (const candidate of open) {
      const value = distance.get(candidate)!;
      if (value < best) {
        best = value;
        current = candidate;
      }
    }
    open.delete(current);
    if (current === target) {
      const result: WorldTransition[] = [];
      let cursor = target;
      while (cursor !== start) {
        const edge = previous.get(cursor)!;
        result.push(edge);
        cursor = edge.from;
      }
      result.reverse();
      return {
        mapIds: [start, ...result.map((e) => e.to)],
        transitions: result,
        cost: best,
      };
    }
    for (const edge of adjacency.get(current) ?? []) {
      const cost = best + edge.cost;
      if (cost < (distance.get(edge.to) ?? Infinity)) {
        distance.set(edge.to, cost);
        previous.set(edge.to, edge);
        open.add(edge.to);
      }
    }
  }
  return null;
}

/** Nearest reachable target heuristic, with shortest paths for each segment. */
export function planMapTour(
  edges: WorldTransition[],
  start: number,
  targets: number[],
  roundTrip = false,
  excludedIds: number[] = [],
): WorldRoute {
  const excluded = new Set(excludedIds),
    remaining = new Set(targets.filter((id) => id !== start));
  const result: WorldRoute = {
    mapIds: [start],
    transitions: [],
    steps: 0,
    unreachableMapIds: [],
    complete: true,
    roundTrip,
    warning:
      "Teilgraph aus expliziten Kartenwechseln. Zell-/Zonenbedingungen und Zugangsvoraussetzungen sind nicht vollständig enthalten; im Spiel prüfen.",
  };
  let current = start;
  while (remaining.size) {
    let chosen: number | null = null,
      best: ReturnType<typeof shortestMapPath> = null;
    for (const id of remaining) {
      const path = shortestMapPath(edges, current, id, excluded);
      if (path && (!best || path.cost < best.cost)) {
        chosen = id;
        best = path;
      }
    }
    if (!best || chosen === null) break;
    result.mapIds.push(...best.mapIds.slice(1));
    result.transitions.push(...best.transitions);
    remaining.delete(chosen);
    current = chosen;
  }
  result.unreachableMapIds.push(...remaining);
  if (roundTrip && current !== start) {
    const back = shortestMapPath(edges, current, start, excluded);
    if (back) {
      result.mapIds.push(...back.mapIds.slice(1));
      result.transitions.push(...back.transitions);
    } else result.unreachableMapIds.push(start);
  }
  result.steps = result.transitions.length;
  result.complete = !result.unreachableMapIds.length;
  return result;
}

export function estimateFarmValue(input: {
  nodeCount: number;
  yieldPerNode: number;
  availableFraction: number;
  gatherSeconds: number;
  transitionSeconds: number;
  transitions: number;
  unitPrice: number | null;
}) {
  const values = [
    input.nodeCount,
    input.yieldPerNode,
    input.availableFraction,
    input.gatherSeconds,
    input.transitionSeconds,
    input.transitions,
  ];
  if (
    values.some((n) => !Number.isFinite(n) || n < 0) ||
    input.availableFraction > 1 ||
    (input.unitPrice !== null &&
      (!Number.isFinite(input.unitPrice) || input.unitPrice < 0))
  )
    throw new Error("Ungültige Farmannahmen.");
  const quantity =
    input.nodeCount * input.availableFraction * input.yieldPerNode;
  const seconds =
    input.nodeCount * input.availableFraction * input.gatherSeconds +
    input.transitions * input.transitionSeconds;
  const value = input.unitPrice === null ? null : quantity * input.unitPrice;
  return {
    quantity,
    seconds,
    value,
    kamasPerHour:
      value === null || seconds === 0 ? null : (value / seconds) * 3600,
    assumptions: input,
  };
}

import { stable } from "./model";
type Row = Record<string, unknown>;
function identity(row: Row) {
  if (row.id !== undefined) return String(row.id);
  if (row.character_id !== undefined)
    return [
      row.character_id,
      row.quest_id,
      row.job_id,
      row.version,
      row.dungeon_id,
    ]
      .filter((v) => v !== undefined)
      .join("|");
  if (row.questId !== undefined) return String(row.questId);
  throw Error("Stabile Datensatz-ID fehlt.");
}
export function fragments(
  key: string,
  value: unknown,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const rows = (path: string, values: unknown[]) => {
    if (!values.every((row) => row && typeof row === "object"))
      throw Error("Ungültige Datensätze.");
    for (const row of values as Row[]) {
      const id = identity(row),
        recordKey = `${key}::${path}/${encodeURIComponent(id)}`;
      if (recordKey in result) throw Error("Doppelte Datensatz-ID: " + id);
      result[recordKey] = row;
    }
  };
  if (
    Array.isArray(value) &&
    (key === "characters" ||
      key === "community:characters" ||
      key.startsWith("backend:") ||
      key.startsWith("progress:") ||
      key === "builder:saved")
  ) {
    result[`${key}::base`] = [];
    rows("rows", value);
  } else if (
    key === "market:journal-v1" &&
    value &&
    typeof value === "object"
  ) {
    const journal = value as Record<string, unknown>;
    result[`${key}::base`] = {
      version: 1,
      observations: [],
      trades: [],
      notes: [],
      targets: {},
    };
    for (const field of ["observations", "trades", "notes"])
      rows(field, (journal[field] as unknown[]) ?? []);
    for (const [id, target] of Object.entries((journal.targets as Row) ?? {}))
      result[`${key}::targets/${encodeURIComponent(id)}`] = target;
  } else result[key] = value;
  return result;
}
export function applyFragment(
  current: unknown,
  fragmentKey: string,
  value: unknown,
) {
  const [, path] = fragmentKey.split("::");
  if (path === "base") return current ?? value;
  const [field, encodedId] = path.split("/"),
    id = decodeURIComponent(encodedId);
  if (field === "rows") {
    const rows = (Array.isArray(current) ? current : []) as Row[];
    return [
      ...rows.filter((row) => identity(row) !== id),
      ...(value == null ? [] : [value]),
    ];
  }
  const journal = {
    version: 1,
    observations: [],
    trades: [],
    notes: [],
    targets: {},
    ...((current as Row) ?? {}),
  };
  if (field === "targets") {
    const targets = { ...(journal.targets as Row) };
    if (value == null) delete targets[id];
    else targets[id] = value;
    return { ...journal, targets };
  }
  const rows = ((journal as Row)[field] as Row[]) ?? [];
  return {
    ...journal,
    [field]: [
      ...rows.filter((row) => identity(row) !== id),
      ...(value == null ? [] : [value]),
    ],
  };
}
export function changedFragments(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => stable(before[key]) !== stable(after[key]))
    .map((key) => ({
      key,
      value: after[key] ?? null,
      deleted: !(key in after),
    }));
}

import { statDefinitions, type NumericEffect, type Stats } from "@dofus/core";
import {
  Heart,
  Flame,
  Droplets,
  Wind,
  Mountain,
  Minus,
  Zap,
  Footprints,
  Eye,
  Sparkles,
  Swords,
  Shield,
  Target,
  Brain,
  Clover,
} from "lucide-react";
const percent = new Set([29, 93, 41, 71, 40, 34, 63, 37, 17, 16, 108, 65]);
const earth = new Set([45, 48, 63, 15]),
  fire = new Set([13, 61, 37, 14]),
  water = new Set([22, 27, 17, 82]),
  air = new Set([36, 47, 16, 60]),
  neutral = new Set([49, 34, 33]);
export const attributeDefinitions = statDefinitions.map(
  ([id, label, category], order) => ({
    id,
    label:
      (
        {
          8: "BP",
          22: "Glück",
          32: "Macht",
          26: "Blockieren",
          50: "BP-Entzug",
          39: "BP-Resistenz",
          62: "Rückstoßschaden",
          70: "Rückstoßresistenz",
          106: "Fallenmacht",
        } as Record<number, string>
      )[id] ?? label.replace(" %", ""),
    category:
      category === "Grundwerte"
        ? [12, 8].includes(id)
          ? "Kampfwerte"
          : "Hauptattribute"
        : category === "Weitere Werte"
          ? [24, 29, 31, 28, 25].includes(id)
            ? "Kampfwerte"
            : "Weitere Eigenschaften"
          : category,
    unit: percent.has(id) ? "%" : "",
    order,
    color: earth.has(id)
      ? "#d6ac7b"
      : fire.has(id)
        ? "#f29c7c"
        : water.has(id)
          ? "#8ebeff"
          : air.has(id)
            ? "#9bdaa0"
            : neutral.has(id)
              ? "#b6bfce"
              : id === 9
                ? "#ff9b9f"
                : id === 12
                  ? "#78baff"
                  : id === 8
                    ? "#93e69c"
                    : "#d2d9e1",
    icon: earth.has(id)
      ? Mountain
      : fire.has(id)
        ? Flame
        : water.has(id)
          ? Droplets
          : air.has(id)
            ? Wind
            : neutral.has(id)
              ? Minus
              : id === 9
                ? Heart
                : id === 12
                  ? Zap
                  : id === 8
                    ? Footprints
                    : id === 10
                      ? Brain
                      : id === 31
                        ? Eye
                        : id === 25
                          ? Clover
                          : category === "Resistenzen"
                            ? Shield
                            : category === "Schaden"
                              ? Swords
                              : id === 29
                                ? Target
                                : Sparkles,
  }),
);
export function attribute(id: number) {
  return attributeDefinitions.find((v) => v.id === id);
}
export function formatAttribute(value: number, unit = "", sign = false) {
  return `${sign && value > 0 ? "+" : ""}${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value)}${unit ? ` ${unit}` : ""}`;
}
export function AttributeName({ id }: { id: number }) {
  const d = attribute(id);
  return (
    <span className="attribute-name" style={{ color: d?.color }}>
      {d && <d.icon size={16} />}
      <span>{d?.label ?? `Attribut #${id}`}</span>
    </span>
  );
}
export function AttributeRow({
  id,
  value,
  max,
  previous,
  title,
}: {
  id: number;
  value: number;
  max?: number;
  previous?: number;
  title?: string;
}) {
  const d = attribute(id);
  return (
    <div className="attribute-row" data-attribute={id} title={title}>
      <AttributeName id={id} />
      <strong style={{ color: d?.color }}>
        {max !== undefined && max !== value
          ? `${formatAttribute(value)} – ${formatAttribute(max, d?.unit)}`
          : formatAttribute(value, d?.unit)}
        {previous !== undefined && (
          <small
            className={
              value > previous ? "positive" : value < previous ? "negative" : ""
            }
          >
            {" "}
            {formatAttribute(previous, d?.unit)} →{" "}
            {formatAttribute(value, d?.unit)} (
            {formatAttribute(value - previous, d?.unit, true)})
          </small>
        )}
      </strong>
    </div>
  );
}
export function AttributeGroups({
  stats,
  showZero = false,
  collapsible = false,
}: {
  stats: Stats;
  showZero?: boolean;
  collapsible?: boolean;
}) {
  return (
    <div className="attribute-groups">
      {[
        "Hauptattribute",
        "Kampfwerte",
        "Schaden",
        "Resistenzen",
        "Weitere Eigenschaften",
      ].map((group) => {
        const definitions = attributeDefinitions.filter(
          (v) => v.category === group && (showZero || stats[v.id]),
        );
        if (collapsible)
          return definitions.length ? (
            <details
              key={group}
              open={group === "Hauptattribute" || group === "Kampfwerte"}
            >
              <summary>{group}</summary>
              {definitions.map((d) => (
                <AttributeRow key={d.id} id={d.id} value={stats[d.id] ?? 0} />
              ))}
            </details>
          ) : null;
        return definitions.length ? (
          <section key={group}>
            <h3>{group}</h3>
            {definitions.map((d) => (
              <AttributeRow key={d.id} id={d.id} value={stats[d.id] ?? 0} />
            ))}
          </section>
        ) : null;
      })}
    </div>
  );
}
export function EffectRows({ effects }: { effects: NumericEffect[] }) {
  return (
    <div className="attribute-effects">
      {effects.map((e, i) =>
        !e.active && attribute(e.id) ? (
          <AttributeRow
            key={`${e.id}-${i}`}
            id={e.id}
            value={e.min}
            max={e.max}
          />
        ) : (
          <p key={`${e.id}-${i}`} className="attribute-unmapped">
            {e.label}
          </p>
        ),
      )}
    </div>
  );
}

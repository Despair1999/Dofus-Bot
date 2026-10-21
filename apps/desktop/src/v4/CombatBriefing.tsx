import type { DungeonMonster } from "@dofus/core";
import ItemImage from "../v2/shared/ItemImage";
import { useGameAssets } from "../gameAssets";

const elements: Record<string, string> = {
  neutral: "Neutral",
  earth: "Erde",
  fire: "Feuer",
  water: "Wasser",
  air: "Luft",
};
/** Original-grade facts, never guessed immunity triggers or a promised winning order. */
export default function CombatBriefing({
  monsters,
}: {
  monsters: DungeonMonster[];
}) {
  const assets = useGameAssets();
  return (
    <div className="combat-briefing">
      <h3>Kampfplan aus dem Bestiarium</h3>
      <p>
        Werte für Originalgrad 1. Vergleiche im Monster-Reiter die weiteren
        Grade. Spezielle Zustände und Erfolgsregeln stehen im Leitfaden
        darunter.
      </p>
      {monsters.map((monster) => {
        const g = monster.grades[0];
        const resistances = g
          ? Object.entries(g.resistances)
              .filter(
                ([key, value]) => key !== "neutral" && Number.isFinite(value),
              )
              .sort((a, b) => a[1] - b[1])
          : [];
        return (
          <article className="combat-boss-plan" key={monster.id}>
            <h4>{monster.name}</h4>
            {g && (
              <p>
                <strong>{g.lifePoints.toLocaleString("de-DE")} LP</strong> ·{" "}
                <span className="combat-ap">{g.actionPoints} AP</span> ·{" "}
                <span className="combat-bp">{g.movementPoints} BP</span>
              </p>
            )}
            {!!resistances.length && (
              <p>
                <strong>Elementwahl:</strong>{" "}
                {resistances
                  .map(([key, value]) => `${elements[key] || key} ${value} %`)
                  .join(" · ")}
                .{" "}
                {resistances[0][1] >= 100
                  ? "Alle Elemente sind stark geschützt: zuerst die Zustandsmechanik prüfen."
                  : `Für reine Resistenzen ist ${elements[resistances[0][0]] || resistances[0][0]} die günstigste Option. Die Werte setzen keine Unverwundbarkeit außer Kraft.`}
              </p>
            )}
            <div className="combat-spells">
              {monster.spells.map((spell) => {
                const rank =
                  spell.ranks.find((r) => r.grade === 1) ?? spell.ranks[0];
                return (
                  <div key={spell.id}>
                    <ItemImage
                      url={assets?.spells?.[String(spell.iconId)]}
                      name={spell.name}
                      size={32}
                    />
                    <strong>{spell.name}</strong>
                    {rank && (
                      <small>
                        {rank.apCost} AP · Reichweite {rank.minRange}–
                        {rank.range}
                        {rank.minCastInterval
                          ? ` · Intervall ${rank.minCastInterval} Runden`
                          : ""}
                        {rank.maxCastPerTurn
                          ? ` · max. ${rank.maxCastPerTurn}×/Runde`
                          : ""}
                      </small>
                    )}
                    {spell.description &&
                      spell.description !== monster.name && (
                        <p>{spell.description}</p>
                      )}
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
      {!monsters.length && (
        <p>
          Dieser Katalogeintrag hat keine bestätigte Bosszuordnung. Die
          Gebietsmonster findest du im Monster-Reiter.
        </p>
      )}
    </div>
  );
}

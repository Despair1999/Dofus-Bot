import type { Character } from "@dofus/core";
export default function OmegaBadge({
  character,
}: {
  character: Pick<Character, "level" | "omegaLevel">;
}) {
  return character.level === 200 && !!character.omegaLevel ? (
    <span
      className="omega-badge"
      title={`Omega-Level ${character.omegaLevel}`}
      aria-label={`Omega-Level ${character.omegaLevel}`}
    >
      Ω {character.omegaLevel.toLocaleString("de-DE")}
    </span>
  ) : null;
}

import { EffectRows } from "../../ui/attributes";
import { Clipboard, Star, Hammer, Package } from "lucide-react";
import { useState } from "react";
import ItemImage from "../shared/ItemImage";
import type { CatalogDetail } from "./types";
export default function ItemSummaryCard({
  item,
  onCraft,
  onFavorite,
  compact = false,
}: {
  item: CatalogDetail;
  onCraft?: (item: CatalogDetail) => void;
  onFavorite?: (item: CatalogDetail) => void;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <section className={`v2-item-summary ${compact ? "is-compact" : ""}`}>
      <div className="v2-item-summary-heading">
        <ItemImage
          url={item.imageUrl}
          name={item.name}
          size={compact ? 72 : 104}
        />
        <div>
          <span className="eyebrow">
            {item.type} · STUFE {item.level}
          </span>
          <h2>{item.name}</h2>
          {item.nameFr && item.nameFr !== item.name && (
            <small>{item.nameFr}</small>
          )}
        </div>
      </div>
      {item.description && <p>{item.description}</p>}
      <div className="v2-item-facts">
        {item.weight !== undefined && (
          <span>
            Gewicht <strong>{item.weight} Pods</strong>
          </span>
        )}
        {(item.setName || item.setId) && (
          <span>
            Set <strong>{item.setName || `Datensatz ${item.setId}`}</strong>
          </span>
        )}
      </div>
      <div className="v2-effect-grid">
        {item.numericEffects?.length ? (
          <EffectRows effects={item.numericEffects} />
        ) : (
          item.effects.map((effect, i) => (
            <div className="v2-effect" key={i}>
              <span>◆</span>
              {effect}
            </div>
          ))
        )}
      </div>
      {!item.effects.length && (
        <p className="v2-muted">Keine Effekte in der Datenquelle hinterlegt.</p>
      )}
      {(item.conditions || item.requirements) && (
        <div className="v2-requirements">
          <strong>Anforderungen</strong>
          <p>{item.conditions || item.requirements}</p>
        </div>
      )}
      <div className="toolbar">
        <button
          className="secondary"
          onClick={() =>
            void navigator.clipboard.writeText(item.name).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            })
          }
        >
          <Clipboard size={15} />
          {copied ? "Kopiert" : "Namen kopieren"}
        </button>
        {onFavorite && (
          <button className="secondary" onClick={() => onFavorite(item)}>
            <Star size={15} /> Favorit umschalten
          </button>
        )}
        {onCraft && (
          <button disabled={!item.recipe.length} onClick={() => onCraft(item)}>
            <Hammer size={15} /> Rezept planen
          </button>
        )}
      </div>
      <div className="v2-source">
        <Package size={13} />
        <small>
          {item.source} · {item.version ? `Version ${item.version} · ` : ""}
          Item-ID {item.id}
        </small>
      </div>
    </section>
  );
}

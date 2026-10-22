import { useRef, useState, type PointerEvent } from "react";
import {
  BookOpen,
  GripVertical,
  Search,
  ExternalLink,
  Save,
} from "lucide-react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import TranslatorCard from "../../v4/translator/TranslatorCard";
import { normalizeTranslator } from "../../v4/translator/model";
import {
  moduleLabels,
  type OverlayModule,
  type OverlayProfile,
  type OverlaySnapshot,
} from "./model";
export default function OverlayCanvas({
  profile,
  snapshot = {},
  editable = false,
  onChange,
}: {
  profile: OverlayProfile;
  snapshot?: OverlaySnapshot;
  editable?: boolean;
  onChange?: (profile: OverlayProfile) => void;
}) {
  const gesture = useRef<{
    id: string;
    startX: number;
    startY: number;
    original: OverlayModule;
    resize: boolean;
  } | null>(null);
  const [query, setQuery] = useState(""),
    [notes, setNotes] = useState("");
  function start(
    event: PointerEvent<HTMLElement>,
    module: OverlayModule,
    resize = false,
  ) {
    if (!editable) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      id: module.id,
      startX: event.clientX,
      startY: event.clientY,
      original: { ...module },
      resize,
    };
  }
  function move(event: PointerEvent<HTMLElement>) {
    const drag = gesture.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX,
      dy = event.clientY - drag.startY;
    const update = drag.resize
      ? {
          width: Math.max(150, Math.round(drag.original.width + dx)),
          height: Math.max(85, Math.round(drag.original.height + dy)),
        }
      : {
          x: Math.max(0, Math.round((drag.original.x + dx) / 4) * 4),
          y: Math.max(0, Math.round((drag.original.y + dy) / 4) * 4),
        };
    onChange?.({
      ...profile,
      modules: profile.modules.map((m) =>
        m.id === drag.id ? { ...m, ...update } : m,
      ),
    });
  }
  function finish() {
    gesture.current = null;
  }
  function navigate(action: string) {
    if (isTauri()) void invoke("overlay_navigate", { action });
    else
      window.dispatchEvent(
        new CustomEvent("companion:action", { detail: action }),
      );
  }
  function contents(id: string) {
    const quest = snapshot.quest;
    const step = quest?.steps?.[snapshot.step ?? 0];
    switch (id) {
      case "navigation": {
        const route = snapshot.navigation;
        return route ? (
          <>
            <strong>
              {route.coordinates
                ? `[${route.coordinates.x}, ${route.coordinates.y}]`
                : `Karte ${route.nextMapId}`}
            </strong>
            <small>
              Map-ID {route.nextMapId} · {route.direction}
            </small>
            <small>
              {route.resourceNames.join(", ") || "Gespeicherte Farmroute"}
            </small>
            <small>
              Schritt {route.step} / {route.total} · {route.remaining} Übergänge
              verbleiben
            </small>
          </>
        ) : (
          <small>
            Im Farmrouten-Planer eine Route berechnen und Schritte manuell
            abhaken.
          </small>
        );
      }
      case "translator-incoming":
      case "translator-outgoing": {
        const module = profile.modules.find((m) => m.id === id)!;
        return (
          <TranslatorCard
            preferences={normalizeTranslator(
              module.translator,
              id === "translator-outgoing",
            )}
            onChange={(translator) =>
              onChange?.({
                ...profile,
                modules: profile.modules.map((m) =>
                  m.id === id ? { ...m, translator } : m,
                ),
              })
            }
          />
        );
      }
      case "quest":
        return (
          <>
            <strong>{quest?.name || "Keine Quest ausgewählt"}</strong>
            <small>
              {quest
                ? `Schritt ${(snapshot.step ?? 0) + 1} von ${quest.steps?.length ?? "?"}`
                : "Quest im Hauptfenster auswählen."}
            </small>
          </>
        );
      case "step":
        return (
          <p>
            {step?.description ||
              step?.name ||
              "Kein bestätigter Questschritt verfügbar."}
          </p>
        );
      case "coordinates": {
        const points =
          step?.objectives?.flatMap((o) =>
            o.coordinates ? [o.coordinates] : [],
          ) ?? [];
        return points.length ? (
          points.map((p, i) => (
            <button
              className="text-button"
              key={i}
              onClick={() =>
                void navigator.clipboard.writeText(`[${p.x},${p.y}]`)
              }
            >
              [{p.x}, {p.y}] · kopieren
            </button>
          ))
        ) : (
          <small>Für dieses Ziel fehlen bestätigte Koordinaten.</small>
        );
      }
      case "materials":
        return snapshot.materials?.length ? (
          snapshot.materials.map((m, i) => (
            <div className="overlay-line" key={i}>
              <span>{m.name}</span>
              <b>× {m.quantity}</b>
            </div>
          ))
        ) : (
          <small>Keine Materialliste ausgewählt.</small>
        );
      case "items":
      case "quests":
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`${id}:${query}`);
            }}
          >
            <input
              aria-label={
                id === "items" ? "Overlay Itemsuche" : "Overlay Questsuche"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                id === "items" ? "Gegenstand suchen …" : "Quest suchen …"
              }
            />
            <button className="secondary" disabled={query.trim().length < 2}>
              <Search size={14} /> Suchen
            </button>
          </form>
        );
      case "treasure":
        return (
          <>
            <small>Nur verifizierte Schatzsuchdaten werden verwendet.</small>
            <button
              className="text-button"
              onClick={() => navigate("treasure")}
            >
              Assistent öffnen <ExternalLink size={12} />
            </button>
          </>
        );
      case "almanax":
        return (
          <>
            <strong>
              {snapshot.almanax?.tribute?.item?.name ||
                "Almanax im Hauptfenster laden"}
            </strong>
            <small>
              {snapshot.almanax?.tribute?.quantity
                ? `Opfergabe × ${snapshot.almanax.tribute.quantity}`
                : ""}
            </small>
            <p>{snapshot.almanax?.bonus?.description}</p>
          </>
        );
      case "notes":
        return (
          <textarea
            aria-label="Overlay-Notizen"
            placeholder="Deine persönlichen Notizen …"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              localStorage.setItem("companion-overlay-note", e.target.value);
            }}
            onFocus={() => {
              if (!notes)
                setNotes(localStorage.getItem("companion-overlay-note") ?? "");
            }}
          />
        );
      case "character":
        return (
          <>
            <strong>
              {snapshot.character?.name || "Kein aktiver Charakter"}
            </strong>
            <small>
              {snapshot.character
                ? `${snapshot.character.className ?? ""} · Stufe ${snapshot.character.level ?? "?"} · ${snapshot.character.server ?? ""}`
                : "Profil im Hauptfenster auswählen."}
            </small>
          </>
        );
      case "favorites":
        return (
          <div className="overlay-links">
            {snapshot.favorites?.slice(0, 8).map((f, i) => (
              <button
                className="text-button"
                key={i}
                onClick={() =>
                  navigate(
                    `${f.kind === "item" ? "items" : "quests"}:${f.name}`,
                  )
                }
              >
                {f.name}
              </button>
            ))}
            <button className="text-button" onClick={() => navigate("main")}>
              Hauptfenster öffnen <ExternalLink size={12} />
            </button>
          </div>
        );
      case "tasks":
        return snapshot.tasks?.length ? (
          snapshot.tasks.slice(0, 7).map((t) => (
            <div className="overlay-line" key={t.id}>
              <span>
                {t.done ? "✓" : "○"} {t.text}
              </span>
            </div>
          ))
        ) : (
          <small>Du hast noch keine Aufgaben angelegt.</small>
        );
      default:
        return null;
    }
  }
  const enabled = profile.modules.filter((m) => m.enabled);
  const height = Math.max(200, ...enabled.map((m) => m.y + m.height + 16));
  return (
    <div
      className={`overlay-canvas ${editable ? "editable" : ""} ${profile.compact ? "is-compact" : ""}`}
      style={{
        height,
        fontSize: profile.fontSize,
        background: profile.background,
        opacity: profile.opacity / 100,
      }}
    >
      {enabled.map((module) => (
        <section
          key={module.id}
          className="overlay-module"
          style={{
            left: module.x,
            top: module.y,
            width: module.width,
            height:
              module.id.startsWith("translator-") &&
              module.translator?.minimized
                ? 30
                : module.height,
          }}
        >
          <header
            className={editable ? "module-grip" : ""}
            onPointerDown={(e) => start(e, module)}
            onPointerMove={move}
            onPointerUp={finish}
            onPointerCancel={finish}
          >
            <span>
              {editable ? <GripVertical size={12} /> : <BookOpen size={12} />}{" "}
              {moduleLabels[module.id]}
            </span>
            {module.id.startsWith("translator-") && (
              <div
                className="translator-header-actions"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  title="Übersetzer minimieren/öffnen"
                  onClick={() =>
                    onChange?.({
                      ...profile,
                      modules: profile.modules.map((m) =>
                        m.id === module.id
                          ? {
                              ...m,
                              translator: {
                                ...normalizeTranslator(
                                  m.translator,
                                  m.id === "translator-outgoing",
                                ),
                                minimized: !m.translator?.minimized,
                              },
                            }
                          : m,
                      ),
                    })
                  }
                >
                  −
                </button>
                <button
                  title="Übersetzer entfernen"
                  onClick={() =>
                    onChange?.({
                      ...profile,
                      modules: profile.modules.map((m) =>
                        m.id === module.id ? { ...m, enabled: false } : m,
                      ),
                    })
                  }
                >
                  ×
                </button>
              </div>
            )}
          </header>
          <div className="overlay-module-body">{contents(module.id)}</div>
          {editable && (
            <button
              className="overlay-resize"
              aria-label={`${moduleLabels[module.id]} Größe ändern`}
              onPointerDown={(e) => start(e, module, true)}
              onPointerMove={move}
              onPointerUp={finish}
            >
              <Save size={8} />
            </button>
          )}
        </section>
      ))}
    </div>
  );
}

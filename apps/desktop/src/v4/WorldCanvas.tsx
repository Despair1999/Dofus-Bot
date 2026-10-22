import { useEffect, useRef, useState } from "react";
import type {
  WorldPosition,
  WorldPoint,
  WorldMarker,
} from "../../../../packages/core/src/world";

import { markerAppearance, glyphImage } from "../ui/GameGlyph";
import type { WorldArtwork } from "../gameAssets";

const markerSprites = new Map<string, HTMLImageElement>();
export interface Camera {
  x: number;
  y: number;
  scale: number;
}
export default function WorldCanvas({
  artwork,
  points = [],
  onPoint,
  maps,
  markers,
  selected,
  routeIds,
  highlightedRegions,
  camera,
  onCamera,
  onSelect,
  onCoordinate,
  onViewport,
}: {
  artwork?: WorldArtwork;
  points?: WorldPoint[];
  onPoint?: (point: WorldPoint) => void;
  maps: WorldPosition[];
  markers: WorldMarker[];
  selected?: number;
  routeIds: number[];
  highlightedRegions: number[];
  camera: Camera;
  onCamera: (value: Camera) => void;
  onSelect: (values: WorldPosition[]) => void;
  onCoordinate?: (x: number, y: number) => void;
  onViewport: (bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [spriteRevision, setSpriteRevision] = useState(0);
  useEffect(() => {
    const cleanup: (() => void)[] = [],
      seen = new Set<string>();
    for (const p of [
      ...points,
      { kind: "waypoint" },
      { kind: "resource" },
      { kind: "observation" },
      { kind: "route" },
      { kind: "quest" },
    ]) {
      const a = markerAppearance(p),
        key = a.glyph + a.color;
      if (seen.has(key)) continue;
      seen.add(key);
      let image = markerSprites.get(key);
      if (!image) {
        image = new Image();
        markerSprites.set(key, image);
        image.src = glyphImage(a.glyph, a.color);
      }
      if (!image.complete) {
        const update = () => setSpriteRevision((v) => v + 1);
        image.addEventListener("load", update);
        cleanup.push(() => image!.removeEventListener("load", update));
      }
    }
    return () => cleanup.forEach((fn) => fn());
  }, [points]);
  const [background, setBackground] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState(false);
  const aspect = artwork?.aspect ?? 1;
  const [showGrid, setShowGrid] = useState(false);
  useEffect(() => {
    setBackground(null);
    setImageError(false);
    if (!artwork) return;
    let active = true;
    const img = new Image();
    img.onload = () => {
      if (active) setBackground(img);
    };
    img.onerror = () => {
      if (active) setImageError(true);
    };
    img.src = artwork.url;
    return () => {
      active = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [artwork]);
  const drag = useRef<{
    x: number;
    y: number;
    original: Camera;
    moved: boolean;
  } | null>(null);
  const [size, setSize] = useState({ width: 800, height: 650 });
  const [hover, setHover] = useState("");
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    if (canvas.current) observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const timeout = setTimeout(
      () =>
        onViewport({
          minX: Math.floor(
            camera.x - size.width / (camera.scale * aspect) / 2 - 1,
          ),
          maxX: Math.ceil(
            camera.x + size.width / (camera.scale * aspect) / 2 + 1,
          ),
          minY: Math.floor(
            camera.y - size.height / (camera.scale * aspect) / 2 - 1,
          ),
          maxY: Math.ceil(
            camera.y + size.height / (camera.scale * aspect) / 2 + 1,
          ),
        }),
      160,
    );
    return () => clearTimeout(timeout);
  }, [camera, size, aspect, onViewport]);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const ratio = window.devicePixelRatio || 1;
    node.width = size.width * ratio;
    node.height = size.height * ratio;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    const { width: w, height: h } = size;
    const project = (x: number, y: number) => [
      (x - camera.x) * camera.scale + w / 2,
      (y - camera.y) * camera.scale * aspect + h / 2,
    ];
    ctx.fillStyle = "#101f1b";
    ctx.fillRect(0, 0, w, h);
    const gradient = ctx.createRadialGradient(
      w / 2,
      h / 2,
      0,
      w / 2,
      h / 2,
      w * 0.7,
    );
    gradient.addColorStop(0, "#203b2e");
    gradient.addColorStop(1, "#0c1815");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    if (background && artwork) {
      const [left, top] = project(artwork.x, artwork.y);
      ctx.drawImage(
        background,
        left,
        top,
        artwork.width * camera.scale,
        artwork.height * camera.scale * aspect,
      );
    }
    const grid = camera.scale < 10 ? 10 : camera.scale < 20 ? 5 : 1;
    ctx.font = "10px system-ui";
    if (showGrid)
      for (
        let x = Math.floor((camera.x - w / camera.scale / 2) / grid) * grid;
        x <= camera.x + w / camera.scale / 2;
        x += grid
      ) {
        const [px] = project(x, 0);
        ctx.strokeStyle = background ? "#15281733" : "#84ae7a15";
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
        ctx.fillStyle = background ? "#182b20cc" : "#94ad9370";
        ctx.fillText(String(x), px + 4, 18);
      }
    if (showGrid)
      for (
        let y =
          Math.floor((camera.y - h / (camera.scale * aspect) / 2) / grid) *
          grid;
        y <= camera.y + h / (camera.scale * aspect) / 2;
        y += grid
      ) {
        const [, py] = project(0, y);
        ctx.strokeStyle = background ? "#15281733" : "#84ae7a15";
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
        ctx.stroke();
        ctx.fillStyle = background ? "#182b20cc" : "#94ad9370";
        ctx.fillText(String(y), 7, py - 4);
      }
    const regions = new Set(highlightedRegions),
      cells = new Map<
        string,
        { x: number; y: number; count: number; highlighted: boolean }
      >();
    for (const map of maps) {
      const [x, y] = project(map.x, map.y);
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
      const key = `${Math.round(x / 8)}:${Math.round(y / 8)}`;
      const current = cells.get(key);
      if (current) {
        current.count++;
        current.highlighted ||= regions.has(map.subAreaId);
      } else
        cells.set(key, {
          x,
          y,
          count: 1,
          highlighted: regions.has(map.subAreaId),
        });
    }
    for (const cell of cells.values()) {
      ctx.fillStyle = cell.highlighted
        ? "#9cc65b48"
        : background
          ? "#ffffff00"
          : "#6585752c";
      const side = Math.max(4, Math.min(22, camera.scale * 0.8));
      ctx.fillRect(cell.x - side / 2, cell.y - side / 2, side, side);
      if (camera.scale > 32 && !background) {
        ctx.fillStyle = cell.highlighted ? "#bce779" : "#91ab8f80";
        ctx.beginPath();
        ctx.arc(cell.x, cell.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const byId = new Map(maps.map((m) => [m.id, m]));
    ctx.strokeStyle = "#e8cc77";
    ctx.lineWidth = 3;
    ctx.beginPath();
    let drawing = false;
    for (const id of routeIds) {
      const map = byId.get(id);
      if (!map) {
        drawing = false;
        continue;
      }
      const [x, y] = project(map.x, map.y);
      if (drawing) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      drawing = true;
    }
    ctx.stroke();
    for (const point of points) {
      const [x, y] = project(point.x, point.y);
      if (x < 0 || y < 0 || x > size.width || y > size.height) continue;
      const a = markerAppearance(point),
        sprite = markerSprites.get(a.glyph + a.color);
      if (sprite?.complete && sprite.naturalWidth)
        ctx.drawImage(sprite, x - 13, y - 13, 26, 26);
    }
    for (const marker of markers) {
      const map = byId.get(marker.mapId);
      if (!map) continue;
      const [x, y] = project(map.x, map.y);
      const a = markerAppearance(marker),
        sprite = markerSprites.get(a.glyph + a.color);
      if (sprite?.complete && sprite.naturalWidth)
        ctx.drawImage(sprite, x - 13, y - 13, 26, 26);
    }
    if (selected !== undefined) {
      const map = byId.get(selected);
      if (map) {
        const [x, y] = project(map.x, map.y);
        ctx.fillStyle = "#13201b";
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "#ef7869";
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        const label = `[${map.x}, ${map.y}]`;
        ctx.font = "bold 13px system-ui";
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = "#13201bf0";
        ctx.fillRect(x + 16, y - 27, textWidth + 14, 25);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, x + 23, y - 10);
      }
    }
  }, [
    points,
    spriteRevision,
    maps,
    markers,
    selected,
    routeIds,
    highlightedRegions,
    camera,
    size,
    background,
    showGrid,
    artwork,
    aspect,
  ]);
  function position(clientX: number, clientY: number) {
    const rect = canvas.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - size.width / 2) / camera.scale + camera.x,
      y:
        (clientY - rect.top - size.height / 2) / (camera.scale * aspect) +
        camera.y,
    };
  }
  function zoom(factor: number, px?: number, py?: number) {
    const scale = Math.max(3, Math.min(90, camera.scale * factor));
    if (px === undefined || py === undefined) {
      onCamera({ ...camera, scale });
      return;
    }
    const old = position(px, py),
      rect = canvas.current!.getBoundingClientRect();
    onCamera({
      x: old.x - (px - rect.left - size.width / 2) / scale,
      y: old.y - (py - rect.top - size.height / 2) / (scale * aspect),
      scale,
    });
  }
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const handle = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      zoom(e.deltaY > 0 ? 0.85 : 1.18, e.clientX, e.clientY);
    };
    node.addEventListener("wheel", handle, { passive: false });
    return () => node.removeEventListener("wheel", handle);
  }, [camera, size, aspect, onCamera]);
  return (
    <div className="world-stage">
      <canvas
        ref={canvas}
        aria-label="Interaktive DOFUS-Weltkarte mit Originalkarten"
        data-background={
          background ? "loaded" : imageError ? "error" : "loading"
        }
        tabIndex={0}
        onKeyDown={(e) => {
          const step = 100 / camera.scale;
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
          ) {
            e.preventDefault();
            onCamera({
              ...camera,
              x:
                camera.x +
                (e.key === "ArrowLeft"
                  ? -step
                  : e.key === "ArrowRight"
                    ? step
                    : 0),
              y:
                camera.y +
                (e.key === "ArrowUp"
                  ? -step
                  : e.key === "ArrowDown"
                    ? step
                    : 0),
            });
          }
          if (e.key === "+") zoom(1.3);
          if (e.key === "-") zoom(1 / 1.3);
        }}
        onDoubleClick={(e) => zoom(1.5, e.clientX, e.clientY)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            original: camera,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const p = position(e.clientX, e.clientY);
          const hint = points.find(
            (v) =>
              Math.hypot(
                (v.x - p.x) * camera.scale,
                (v.y - p.y) * camera.scale * aspect,
              ) < 13,
          );
          const label = hint
            ? `${hint.name} · ${markerAppearance(hint).label} · [${hint.x}, ${hint.y}] · Karte ${hint.mapId}`
            : `[${Math.round(p.x)}, ${Math.round(p.y)}]`;
          setHover(label);
          e.currentTarget.title = hint
            ? label
            : "Karte verschieben · Mausrad zum Zoomen";
          const d = drag.current;
          if (!d) return;
          if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
          if (d.moved)
            onCamera({
              ...d.original,
              x: d.original.x - (e.clientX - d.x) / d.original.scale,
              y: d.original.y - (e.clientY - d.y) / (d.original.scale * aspect),
            });
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onPointerUp={(e) => {
          if (drag.current && !drag.current.moved) {
            const p = position(e.clientX, e.clientY);
            const hit = points.find(
              (v) =>
                Math.round(v.x) === Math.round(p.x) &&
                Math.round(v.y) === Math.round(p.y) &&
                Math.hypot(
                  (v.x - p.x) * camera.scale,
                  (v.y - p.y) * camera.scale * aspect,
                ) < 10,
            );
            if (hit && onPoint) {
              onPoint(hit);
              drag.current = null;
              return;
            }
            const found = maps.filter(
              (m) =>
                Math.abs(m.x - p.x) < Math.max(0.5, 8 / camera.scale) &&
                Math.abs(m.y - p.y) < Math.max(0.5, 8 / camera.scale),
            );
            if (onCoordinate) onCoordinate(Math.round(p.x), Math.round(p.y));
            else if (found.length) onSelect(found);
          }
          drag.current = null;
        }}
      />
      <div className="world-map-label">
        <span className="eyebrow">ATLAS DER ZWÖLF</span>
        <strong>Jede Karte. Ein neues Ziel.</strong>
        <small>
          {background
            ? "Originalkarte · lokal verfügbar"
            : imageError
              ? "Kartenbild konnte nicht geladen werden"
              : artwork
                ? "Originalkarte wird geladen …"
                : "Für diese Ebene liegt kein Kartenbild vor"}
        </small>
      </div>
      <div className="world-map-controls">
        <button
          aria-label="Koordinatenraster"
          aria-pressed={showGrid}
          onClick={() => setShowGrid((v) => !v)}
        >
          ▦
        </button>
        <button aria-label="Vergrößern" onClick={() => zoom(1.4)}>
          ＋
        </button>
        <button aria-label="Verkleinern" onClick={() => zoom(1 / 1.4)}>
          −
        </button>
        <button
          aria-label="Ansicht zurücksetzen"
          onClick={() =>
            onCamera(
              artwork
                ? {
                    x: artwork.x + artwork.width / 2,
                    y: artwork.y + artwork.height / 2,
                    scale: Math.max(
                      3,
                      Math.min(
                        size.width / artwork.width,
                        size.height / (artwork.height * aspect),
                      ) * 0.92,
                    ),
                  }
                : { x: 0, y: 0, scale: 20 },
            )
          }
        >
          ⌖
        </button>
      </div>
      <div className="world-map-footer">
        <span>{hover || "Karte auswählen oder verschieben"}</span>
        <span>
          {maps.length.toLocaleString("de-DE")} geladene Karten ·{" "}
          {Math.round(camera.scale * 5)} %
        </span>
      </div>
    </div>
  );
}

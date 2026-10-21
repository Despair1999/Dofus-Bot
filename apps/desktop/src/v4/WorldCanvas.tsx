import { useEffect, useRef, useState } from "react";
import type {
  WorldPosition,
  WorldMarker,
} from "../../../../packages/core/src/world";

export interface Camera {
  x: number;
  y: number;
  scale: number;
}
export default function WorldCanvas({
  maps,
  markers,
  selected,
  routeIds,
  highlightedRegions,
  camera,
  onCamera,
  onSelect,
  onViewport,
}: {
  maps: WorldPosition[];
  markers: WorldMarker[];
  selected?: number;
  routeIds: number[];
  highlightedRegions: number[];
  camera: Camera;
  onCamera: (value: Camera) => void;
  onSelect: (values: WorldPosition[]) => void;
  onViewport: (bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
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
          minX: Math.floor(camera.x - size.width / camera.scale / 2 - 1),
          maxX: Math.ceil(camera.x + size.width / camera.scale / 2 + 1),
          minY: Math.floor(camera.y - size.height / camera.scale / 2 - 1),
          maxY: Math.ceil(camera.y + size.height / camera.scale / 2 + 1),
        }),
      160,
    );
    return () => clearTimeout(timeout);
  }, [camera, size, onViewport]);
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
      (y - camera.y) * camera.scale + h / 2,
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
    const grid = camera.scale < 10 ? 10 : camera.scale < 20 ? 5 : 1;
    ctx.font = "10px system-ui";
    for (
      let x = Math.floor((camera.x - w / camera.scale / 2) / grid) * grid;
      x <= camera.x + w / camera.scale / 2;
      x += grid
    ) {
      const [px] = project(x, 0);
      ctx.strokeStyle = "#84ae7a15";
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      ctx.fillStyle = "#94ad9370";
      ctx.fillText(String(x), px + 4, 18);
    }
    for (
      let y = Math.floor((camera.y - h / camera.scale / 2) / grid) * grid;
      y <= camera.y + h / camera.scale / 2;
      y += grid
    ) {
      const [, py] = project(0, y);
      ctx.strokeStyle = "#84ae7a15";
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
      ctx.fillStyle = "#94ad9370";
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
      ctx.fillStyle = cell.highlighted ? "#9cc65b48" : "#6585752c";
      const side = Math.max(4, Math.min(22, camera.scale * 0.8));
      ctx.fillRect(cell.x - side / 2, cell.y - side / 2, side, side);
      if (camera.scale > 16) {
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
    for (const marker of markers) {
      const map = byId.get(marker.mapId);
      if (!map) continue;
      const [x, y] = project(map.x, map.y);
      ctx.fillStyle = marker.kind === "observation" ? "#99d9c7" : "#deb767";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#10231b";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (selected) {
      const map = byId.get(selected);
      if (map) {
        const [x, y] = project(map.x, map.y);
        ctx.strokeStyle = "#e4f7b1";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 11, y - 11, 22, 22);
        ctx.fillStyle = "#ecf6d1";
        ctx.font = "bold 12px system-ui";
        ctx.fillText(`[${map.x}, ${map.y}]`, x + 18, y - 12);
      }
    }
  }, [maps, markers, selected, routeIds, highlightedRegions, camera, size]);
  function position(clientX: number, clientY: number) {
    const rect = canvas.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - size.width / 2) / camera.scale + camera.x,
      y: (clientY - rect.top - size.height / 2) / camera.scale + camera.y,
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
      y: old.y - (py - rect.top - size.height / 2) / scale,
      scale,
    });
  }
  return (
    <div className="world-stage">
      <canvas
        ref={canvas}
        aria-label="Interaktive schematische DOFUS-Weltkarte"
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
        onWheel={(e) => {
          e.preventDefault();
          zoom(e.deltaY > 0 ? 0.85 : 1.18, e.clientX, e.clientY);
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
          setHover(`[${Math.round(p.x)}, ${Math.round(p.y)}]`);
          const d = drag.current;
          if (!d) return;
          if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
          if (d.moved)
            onCamera({
              ...d.original,
              x: d.original.x - (e.clientX - d.x) / d.original.scale,
              y: d.original.y - (e.clientY - d.y) / d.original.scale,
            });
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onPointerUp={(e) => {
          if (drag.current && !drag.current.moved) {
            const p = position(e.clientX, e.clientY);
            const found = maps.filter(
              (m) =>
                Math.abs(m.x - p.x) < Math.max(0.5, 8 / camera.scale) &&
                Math.abs(m.y - p.y) < Math.max(0.5, 8 / camera.scale),
            );
            if (found.length) onSelect(found);
          }
          drag.current = null;
        }}
      />
      <div className="world-map-label">
        <span className="eyebrow">ATLAS DER ZWÖLF</span>
        <strong>Jede Karte. Ein neues Ziel.</strong>
        <small>Schematische Ansicht · echte Kartenpositionen</small>
      </div>
      <div className="world-map-controls">
        <button aria-label="Vergrößern" onClick={() => zoom(1.4)}>
          ＋
        </button>
        <button aria-label="Verkleinern" onClick={() => zoom(1 / 1.4)}>
          −
        </button>
        <button
          aria-label="Ansicht zurücksetzen"
          onClick={() => onCamera({ x: 0, y: 0, scale: 20 })}
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

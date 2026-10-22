import { useMemo } from "react";
import {
  clusterGatheringNodes,
  type GatheringNode,
  type GatherableResource,
} from "@dofus/core";
import ItemImage from "../v2/shared/ItemImage";
import type { Camera } from "./WorldCanvas";
export default function ResourceLayer({
  nodes,
  resources,
  camera,
  width,
  height,
  aspect,
  cluster,
  onSelect,
}: {
  nodes: GatheringNode[];
  resources: GatherableResource[];
  camera: Camera;
  width: number;
  height: number;
  aspect: number;
  cluster: boolean;
  onSelect: (nodes: GatheringNode[]) => void;
}) {
  const groups = useMemo(
    () => clusterGatheringNodes(nodes, camera, width, height, aspect, cluster),
    [nodes, camera, width, height, aspect, cluster],
  );
  return (
    <div
      className="resource-map-layer"
      aria-label="Dokumentierte Sammelstellen"
      style={{ width, height }}
    >
      {groups.map((g) => {
        const resource = resources.find((r) => r.id === g.nodes[0].resourceId),
          maps = new Set(g.nodes.map((n) => n.mapId));
        return (
          <button
            key={g.nodes[0].id}
            className={`resource-map-marker ${g.nodes.some((n) => n.verification === "unconfirmed-version") ? "unconfirmed" : ""}`}
            style={{
              left: g.x,
              top: g.y,
              borderColor: (
                {
                  2: "#acd391",
                  24: "#b5b4d4",
                  26: "#df9ac7",
                  28: "#e4cb7d",
                  36: "#83cde8",
                } as Record<number, string>
              )[resource?.jobId ?? 0],
            }}
            title={`${resource?.name ?? "Ressource"} · ${g.nodes.length} dokumentierte Zellen · ${maps.size} Karten · Datenstand ${g.nodes[0].sourceVersion}${g.nodes[0].verification === "unconfirmed-version" ? " · Patch unbestätigt" : ""}`}
            aria-label={`${resource?.name ?? "Ressource"} Fundstellen anzeigen`}
            onClick={() => onSelect(g.nodes)}
          >
            {resource && (
              <ItemImage
                item={{ name: resource.name }}
                iconId={resource.iconId}
                itemId={resource.itemId}
                size={28}
              />
            )}
            <span className="resource-count">{g.nodes.length}</span>
          </button>
        );
      })}
    </div>
  );
}

import type { GatheringNode } from "@dofus/core";
import GameGlyph, { markerAppearance, mapCategories } from "../ui/GameGlyph";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ChevronDown,
  Compass,
  MapPin,
  Route,
  Search,
  Flag,
  Save,
  Maximize2,
  PanelLeftClose,
  PanelRightClose,
  Copy,
  Trash2,
} from "lucide-react";
import type {
  WorldMap,
  WorldPoint,
  WorldPosition,
  WorldMarker,
  WorldRoute,
  GatherableResource,
} from "@dofus/core";
import { estimateFarmValue } from "@dofus/core";
import { api, type Config } from "../client";
import { request, message } from "../v2/shared/request";
import { read, write } from "../storage";
import { useRoute } from "../v2/routing";
import WorldCanvas, { type Camera } from "./WorldCanvas";
import ItemImage from "../v2/shared/ItemImage";
import "./world.css";
import { useGameAssets } from "../gameAssets";
const finiteNumber = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

export interface ShareState {
  worldId: number;
  mapIds: number[];
  resourceIds: number[];
  title: string;
}
export default function WorldPage({
  config,
  farming = false,
  activity = false,
  sharedState,
  onShare,
  characterId,
}: {
  config: Config;
  farming?: boolean;
  activity?: boolean;
  sharedState?: ShareState | null;
  onShare?: (state: ShareState) => Promise<void>;
  characterId?: string;
}) {
  const assets = useGameAssets();
  const [gatheringNodes, setGatheringNodes] = useState<GatheringNode[]>([]),
    [includeUnconfirmed, setIncludeUnconfirmed] = useState(false),
    [clusterResources, setClusterResources] = useState(true),
    [resourceDetails, setResourceDetails] = useState<GatheringNode[]>([]),
    [estimatedOrder, setEstimatedOrder] = useState<number[]>([]),
    [farmNodeCount, setFarmNodeCount] = useState(0);
  const routeRevision = useRef(0);
  const [maxStops, setMaxStops] = useState(30),
    [omittedStops, setOmittedStops] = useState(0);
  const locationRoute = useRoute();
  const [rightVisible, setRightVisible] = useState(true);
  const [panelWidths, setPanelWidths] = useState({ left: 250, right: 285 });
  const [layoutReady, setLayoutReady] = useState(false);
  const params = new URLSearchParams(locationRoute.path.split("?")[1] ?? "");
  const [hiddenCategories, setHiddenCategories] = useState<number[]>([
    1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12,
  ]);
  const [points, setPoints] = useState<WorldPoint[]>([]);
  const [pointKinds, setPointKinds] = useState({
    zaap: true,
    dungeon: true,
    poi: false,
  });
  const [pointQuery, setPointQuery] = useState("");
  const [worlds, setWorlds] = useState<WorldMap[]>([]),
    [worldId, setWorldId] = useState(1);
  const [maps, setMaps] = useState<WorldPosition[]>([]),
    [routeMaps, setRouteMaps] = useState<WorldPosition[]>([]),
    [resources, setResources] = useState<GatherableResource[]>([]);
  const [query, setQuery] = useState(""),
    [resourceQuery, setResourceQuery] = useState(""),
    [resourceIds, setResourceIds] = useState<number[]>(
      params.has("resourceId") ? [Number(params.get("resourceId"))] : [],
    );
  const [results, setResults] = useState<WorldPosition[]>([]),
    [choices, setChoices] = useState<WorldPosition[]>([]),
    [selected, setSelected] = useState<WorldPosition | null>(null);
  const [camera, setCamera] = useState<Camera>({
    x: finiteNumber(params.get("x")),
    y: finiteNumber(params.get("y")),
    scale: 20,
  });
  const [bounds, setBounds] = useState({
    minX: -30,
    maxX: 30,
    minY: -20,
    maxY: 20,
  });
  const [markers, setMarkers] = useState<WorldMarker[]>([]),
    [route, setRoute] = useState<WorldRoute | null>(null),
    [startId, setStartId] = useState("");
  const [targetIds, setTargetIds] = useState<number[]>([]),
    [targetText, setTargetText] = useState(""),
    [roundTrip, setRoundTrip] = useState(false),
    [completed, setCompleted] = useState<number[]>([]);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [leftVisible, setLeftVisible] = useState(true),
    [version, setVersion] = useState(""),
    [stale, setStale] = useState(false);
  const [markerName, setMarkerName] = useState(""),
    [savedRoutes, setSavedRoutes] = useState<
      { id: string; name: string; route: WorldRoute }[]
    >([]);
  const [yieldPerNode, setYieldPerNode] = useState(1),
    [fraction, setFraction] = useState(0.5),
    [gatherSeconds, setGatherSeconds] = useState(5),
    [walkSeconds, setWalkSeconds] = useState(15),
    [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState(
      Math.max(1, finiteNumber(params.get("quantity"), 1)),
    ),
    [showMarkers, setShowMarkers] = useState(true);
  const [jobFilter, setJobFilter] = useState(""),
    [maxLevel, setMaxLevel] = useState(200),
    [onlyCharacter, setOnlyCharacter] = useState(false),
    [characterLevels, setCharacterLevels] = useState<
      { jobId: number; level: number }[]
    >([]);
  const [filterPresets, setFilterPresets] = useState<
      { name: string; resources: number[]; job: string; maxLevel: number }[]
    >([]),
    [presetName, setPresetName] = useState("");
  const [viewportTotal, setViewportTotal] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activity) {
      setLayoutReady(true);
      return;
    }
    void read("ui:world-layout", {
      left: true,
      right: true,
      widths: { left: 250, right: 285 },
    }).then((saved) => {
      setLeftVisible(saved.left);
      setRightVisible(saved.right);
      setPanelWidths({
        left: Math.max(200, Math.min(380, saved.widths.left)),
        right: Math.max(220, Math.min(400, saved.widths.right)),
      });
      setLayoutReady(true);
    });
  }, [activity]);
  useEffect(() => {
    if (layoutReady && !activity)
      void write("ui:world-layout", {
        left: leftVisible,
        right: rightVisible,
        widths: panelWidths,
      });
  }, [layoutReady, activity, leftVisible, rightVisible, panelWidths]);
  function resizePanel(side: "left" | "right", value: number) {
    setPanelWidths((v) => ({
      ...v,
      [side]: Math.max(
        side === "left" ? 200 : 220,
        Math.min(side === "left" ? 380 : 400, value),
      ),
    }));
  }
  function panelHandle(side: "left" | "right") {
    return (
      <div
        className={`ui-world-resizer ui-world-resizer-${side}`}
        role="separator"
        aria-label={side === "left" ? "Filterbreite" : "Detailbreite"}
        aria-orientation="vertical"
        aria-valuemin={side === "left" ? 200 : 220}
        aria-valuemax={side === "left" ? 380 : 400}
        aria-valuenow={panelWidths[side]}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            resizePanel(
              side,
              panelWidths[side] +
                (e.key === "ArrowRight" ? 1 : -1) *
                  (side === "left" ? 16 : -16),
            );
          }
          if (e.key === "Home") resizePanel(side, side === "left" ? 250 : 285);
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          e.preventDefault();
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const box = e.currentTarget.parentElement!.getBoundingClientRect();
          resizePanel(
            side,
            side === "left" ? e.clientX - box.left : box.right - e.clientX,
          );
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      />
    );
  }
  function fitWorld(id: number) {
    const art = assets?.worlds[String(id)];
    if (!art) return { x: 0, y: 0, scale: 15 };
    const width = root.current?.querySelector("canvas")?.clientWidth || 700;
    return {
      x: art.x + art.width / 2,
      y: art.y + art.height / 2,
      scale: Math.max(
        3,
        Math.min(width / art.width, 650 / (art.height * art.aspect)) * 0.92,
      ),
    };
  }
  useEffect(() => {
    if (assets && !params.has("mapId") && !params.has("x") && !sharedState)
      setCamera(fitWorld(worldId));
    // The initial atlas view is fitted only when the artwork first becomes available.
  }, [assets]);
  const onViewport = useCallback(
    (value: typeof bounds) => setBounds(value),
    [],
  );
  useEffect(() => {
    if (!resources.length) return;
    setResourceIds((ids) => {
      const next = [
        ...new Set(
          ids.map(
            (id) =>
              resources.find((r) => r.id === id || r.aliases?.includes(id))
                ?.id ?? id,
          ),
        ),
      ];
      return JSON.stringify(ids) === JSON.stringify(next) ? ids : next;
    });
  }, [resources, resourceIds]);
  const selectedResources = useMemo(
    () => resources.filter((r) => resourceIds.includes(r.id)),
    [resources, resourceIds],
  );
  const regionIds = useMemo(
    () => [
      ...new Set(
        selectedResources.flatMap((r) => r.regions.map((region) => region.id)),
      ),
    ],
    [selectedResources],
  );
  const displayedMaps = useMemo(() => {
    const byId = new Map(
      [
        ...maps,
        ...routeMaps,
        ...results,
        ...choices,
        ...(selected ? [selected] : []),
      ].map((m) => [m.id, m]),
    );
    return [...byId.values()].filter((m) => m.worldId === worldId);
  }, [maps, routeMaps, results, choices, selected, worldId]);
  async function run(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function send<T>(path: string, body: unknown, method?: string) {
    if (!activity) return api<T>(path, config, body, method);
    const response = await fetch(
      `${config.url}${path.replace("/api/world/", "/api/activity/")}`,
      {
        method: method ?? "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      },
    );
    const json = await response.json();
    if (!response.ok) throw Error(json.error ?? "Anfrage fehlgeschlagen");
    return json as { data: T };
  }
  useEffect(() => {
    const c = new AbortController();
    void Promise.all([
      request<WorldMap[]>("/api/world/worlds", config, c.signal),
      request<GatherableResource[]>("/api/world/resources", config, c.signal),
    ])
      .then(([w, r]) => {
        setWorlds(w.data);
        setResources(r.data);
        const itemId = Number(params.get("itemId"));
        if (itemId)
          setResourceIds(
            r.data
              .filter((resource) => resource.itemId === itemId)
              .map((resource) => resource.id),
          );
        setVersion(w.version ?? r.version ?? "");
        setWorldId((current) =>
          w.data.some((v) => v.id === current) ? current : (w.data[0]?.id ?? 1),
        );
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    if (!activity)
      void request<WorldMarker[]>(
        "/api/world/personal/markers",
        config,
        c.signal,
      )
        .then((r) => setMarkers(r.data))
        .catch(() => {});
    if (!activity)
      void request<{ id: string; name: string; route: WorldRoute }[]>(
        "/api/world/personal/routes",
        config,
        c.signal,
      )
        .then((r) => setSavedRoutes(r.data))
        .catch(() => {});
    return () => c.abort();
    // The world list is loaded once per backend connection.
  }, [config.url, config.token, activity]);
  useEffect(() => {
    const c = new AbortController();
    void request<WorldPoint[]>(
      `/api/world/points?worldId=${worldId}`,
      config,
      c.signal,
    )
      .then((r) => setPoints(r.data))
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [config, worldId]);
  useEffect(() => {
    const c = new AbortController(),
      search = new URLSearchParams({
        worldId: String(worldId),
        ...Object.fromEntries(
          Object.entries(bounds).map(([k, v]) => [k, String(v)]),
        ),
        limit: "2500",
      });
    void request<WorldPosition[]>(`/api/world/maps?${search}`, config, c.signal)
      .then((r) => {
        setMaps(r.data);
        setViewportTotal(r.total ?? r.data.length);
        setStale(!!r.stale);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [worldId, bounds, config]);
  useEffect(() => {
    if (activity) return;
    void read<typeof filterPresets>("world:filter-presets", []).then(
      setFilterPresets,
    );
    if (!characterId) {
      setCharacterLevels([]);
      return;
    }
    const controller = new AbortController();
    void request<{ levels: { jobId: number; level: number }[] }>(
      `/api/profession-personal/${characterId}`,
      config,
      controller.signal,
    )
      .then((r) => setCharacterLevels(r.data.levels))
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      });
    return () => controller.abort();
  }, [activity, characterId, config]);
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const c = new AbortController();
    const timer = setTimeout(() => {
      void request<WorldPosition[]>(
        `/api/world/maps?q=${encodeURIComponent(query)}&limit=60`,
        config,
        c.signal,
      )
        .then((r) => setResults(r.data))
        .catch((e) => {
          if (!c.signal.aborted) setError(message(e));
        });
    }, 280);
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [query, config]);
  useEffect(() => {
    const id = params.get("mapId");
    const coordinates = params.has("x") && params.has("y");
    if ((!id || !/^\d+$/.test(id)) && !coordinates) return;
    const c = new AbortController();
    const path =
      id && /^\d+$/.test(id)
        ? `/api/world/maps/${id}`
        : `/api/world/maps?worldId=${params.get("worldId") || 1}&minX=${finiteNumber(params.get("x"))}&maxX=${finiteNumber(params.get("x"))}&minY=${finiteNumber(params.get("y"))}&maxY=${finiteNumber(params.get("y"))}&limit=200`;
    void request<WorldPosition | WorldPosition[]>(path, config, c.signal)
      .then((r) => {
        const values = Array.isArray(r.data) ? r.data : [r.data];
        const map = values.find((m) => !m.interior) ?? values[0];
        if (!map) {
          setNotice(
            "Für diese Koordinate ist keine Karte im Datenstand vorhanden.",
          );
          return;
        }
        setChoices(values);
        setSelected(map);
        setWorldId(map.worldId);
        setCamera({ x: map.x, y: map.y, scale: 40 });
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [config.url, locationRoute.path]);
  useEffect(() => {
    const subArea = locationRoute.params.get("subAreaId");
    if (!subArea || !/^\d+$/.test(subArea)) return;
    const c = new AbortController();
    void request<WorldPosition[]>(
      `/api/world/maps?subAreaId=${subArea}&limit=2500`,
      config,
      c.signal,
    )
      .then((r) => {
        setResults(r.data);
        const map = r.data.find((m) => !m.interior) ?? r.data[0];
        if (map) {
          choose(map);
          setCamera({ x: map.x, y: map.y, scale: 24 });
          setNotice(
            `${r.total ?? r.data.length} Karten im Untergebiet ${map.subAreaName}.`,
          );
        } else
          setNotice("Für dieses Untergebiet sind keine Karten hinterlegt.");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [config, locationRoute.path]);
  useEffect(() => {
    if (activity) return;
    const id = locationRoute.params.get("routeId"),
      saved = savedRoutes.find((r) => r.id === id);
    if (!saved) return;
    setRoute(saved.route);
    setStartId(String(saved.route.mapIds[0] ?? ""));
    setTargetIds(saved.route.mapIds.slice(1));
    setTargetText(saved.route.mapIds.slice(1).join(", "));
    const controller = new AbortController();
    void request<WorldPosition>(
      `/api/world/maps/${saved.route.mapIds[0]}`,
      config,
      controller.signal,
    )
      .then((r) => {
        choose(r.data);
        setCamera({ x: r.data.x, y: r.data.y, scale: 32 });
        setNotice(`Route geladen: ${saved.name}`);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      });
    return () => controller.abort();
  }, [activity, savedRoutes, locationRoute.path, config]);
  useEffect(() => {
    if (sharedState) {
      setWorldId(sharedState.worldId);
      setTargetIds(sharedState.mapIds);
      setTargetText(sharedState.mapIds.join(", "));
      setResourceIds(sharedState.resourceIds);
      setNotice(`Gemeinsames Ziel: ${sharedState.title}`);
    }
  }, [sharedState]);
  useEffect(() => {
    const ids = route?.mapIds ?? sharedState?.mapIds ?? [];
    if (!ids.length) {
      setRouteMaps([]);
      return;
    }
    const controller = new AbortController();
    void request<WorldPosition[]>(
      `/api/world/maps?ids=${ids.slice(0, 2000).join(",")}&limit=2000`,
      config,
      controller.signal,
    )
      .then((r) => setRouteMaps(r.data))
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      });
    return () => controller.abort();
  }, [route, sharedState, config]);
  useEffect(() => {
    if (activity || !route?.mapIds.length) return;
    const next = route.mapIds.findIndex(
      (_, index) => index > 0 && !completed.includes(index),
    );
    const index = next < 0 ? route.mapIds.length - 1 : next;
    const map = routeMaps.find((m) => m.id === route.mapIds[index]);
    const navigation = {
      nextMapId: route.mapIds[index],
      ...(map ? { coordinates: { x: map.x, y: map.y } } : {}),
      direction: route.transitions[Math.max(0, index - 1)]?.direction ?? "Ziel",
      remaining: next < 0 ? 0 : route.mapIds.length - index,
      resourceNames: selectedResources.map((r) => r.name),
      step: index,
      total: route.steps,
    };
    void write("world:active-route", navigation)
      .then(() =>
        window.dispatchEvent(
          new CustomEvent("companion:route", { detail: navigation }),
        ),
      )
      .catch((e) => setError(message(e)));
  }, [route, routeMaps, completed, activity, selectedResources]);
  function choose(map: WorldPosition) {
    setNotice("");
    setSelected(map);
    setWorldId(map.worldId);
    setCamera((c) => ({ ...c, x: map.x, y: map.y }));
  }
  async function calculate(farm = false) {
    const revision = ++routeRevision.current;
    await run(async () => {
      const response = await send<WorldRoute>(
        farm ? "/api/world/farm-route" : "/api/world/route",
        {
          startMapId: Number(startId),
          targetMapIds: targetIds,
          resourceIds,
          includeUnconfirmed,
          maxStops,
          maxLevel,
          ...(jobFilter ? { jobId: Number(jobFilter) } : {}),
          ...(onlyCharacter && characterId ? { characterId } : {}),
          roundTrip,
          ...(farm && params.has("questId")
            ? { questId: Number(params.get("questId")) }
            : {}),
          ...(farm && params.has("areaIds")
            ? { areaIds: params.get("areaIds")!.split(",").map(Number) }
            : {}),
        },
      );
      if (revision !== routeRevision.current) return;
      const extra = response as typeof response & {
        estimatedOrderMapIds?: number[];
        omittedMapCount?: number;
        nodeCount?: number;
        warning?: string;
      };
      setEstimatedOrder(extra.estimatedOrderMapIds ?? []);
      setFarmNodeCount(extra.nodeCount ?? 0);
      setOmittedStops(extra.omittedMapCount ?? 0);
      setRoute(response.data);
      setCompleted([]);
      if (farm && response.data.mapIds.length <= 1) {
        setNotice(
          extra.warning ??
            "Keine bestätigten aktuellen Fundorte für diese Auswahl. Dokumentierte Fundorte eines älteren Datenstands können ausdrücklich eingeblendet werden.",
        );
        return;
      }
      setNotice(
        response.data.complete
          ? "Route über bekannte Kartenübergänge berechnet."
          : "Nur ein Teil der Ziele ist im vorhandenen Kartengraph erreichbar.",
      );
    });
  }
  async function saveMarker(observation = false) {
    if (!selected) return;
    await run(async () => {
      await api("/api/world/personal/markers", config, {
        mapId: selected.id,
        name: markerName || selected.name || `Karte ${selected.id}`,
        kind: observation ? "observation" : "waypoint",
        ...(observation && resourceIds[0]
          ? { resourceId: resourceIds[0] }
          : {}),
      });
      setMarkers(
        (await request<WorldMarker[]>("/api/world/personal/markers", config))
          .data,
      );
      setMarkerName("");
      setNotice(
        observation
          ? "Persönliche Beobachtung gespeichert. Kein aktueller Spawnstatus."
          : "Privater Wegpunkt gespeichert.",
      );
    });
  }
  const estimate = useMemo(
    () =>
      estimateFarmValue({
        nodeCount: markers.filter(
          (m) =>
            m.kind === "observation" &&
            route?.mapIds.includes(m.mapId) &&
            resourceIds.includes(m.resourceId ?? -1),
        ).length,
        yieldPerNode: Math.max(0, finiteNumber(yieldPerNode)),
        availableFraction: fraction,
        gatherSeconds: Math.max(0, finiteNumber(gatherSeconds)),
        transitionSeconds: Math.max(0, finiteNumber(walkSeconds)),
        transitions: route?.steps ?? 0,
        unitPrice: price === "" ? null : Math.max(0, finiteNumber(price)),
      }),
    [
      markers,
      route,
      resourceIds,
      yieldPerNode,
      fraction,
      gatherSeconds,
      walkSeconds,
      price,
    ],
  );
  const routeCharacterId=onlyCharacter?characterId:undefined;
  useEffect(() => {
    routeRevision.current++;
    setRoute(null);
    setEstimatedOrder([]);
    setResourceDetails([]);
  }, [
    resourceIds,
    jobFilter,
    maxLevel,
    onlyCharacter,
    includeUnconfirmed,
    routeCharacterId,
  ]);
  useEffect(() => {
    const c = new AbortController();
    setGatheringNodes([]);
    if (!resourceIds.length) return;
    const q = new URLSearchParams({
      worldId: String(worldId),
      resourceIds: resourceIds.join(","),
      includeUnconfirmed: String(includeUnconfirmed),
      includePersonal: String(!activity),
      maxLevel: String(maxLevel),
    });
    if (jobFilter) q.set("jobId", jobFilter);
    if (onlyCharacter && characterId) q.set("characterId", characterId);
    void request<GatheringNode[]>(`/api/world/gathering?${q}`, config, c.signal)
      .then((r) => {
        if (!c.signal.aborted) setGatheringNodes(r.data);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [
    config,
    worldId,
    resourceIds,
    includeUnconfirmed,
    maxLevel,
    jobFilter,
    onlyCharacter,
    characterId,
    characterLevels,
    markers,
    activity,
  ]);
  const resourceList = resources.filter(
    (r) =>
      (!jobFilter || r.jobId === Number(jobFilter)) &&
      r.level <= maxLevel &&
      (!onlyCharacter ||
        characterLevels.some(
          (j) => j.jobId === r.jobId && j.level >= r.level,
        )) &&
      `${r.name} ${r.nameFr} ${r.nameEn} ${r.jobName}`
        .toLocaleLowerCase()
        .includes(resourceQuery.toLocaleLowerCase()),
  );
  return (
    <div
      ref={root}
      className={`world-page ${leftVisible ? "" : "world-hide-left"} ${rightVisible ? "" : "world-hide-right"}`}
      style={
        {
          "--world-left-width": `${panelWidths.left}px`,
          "--world-right-width": `${panelWidths.right}px`,
        } as CSSProperties
      }
    >
      <div className="world-toolbar">
        <div className="world-title">
          <Compass size={25} />
          <div>
            <strong>
              {farming
                ? "Deine nächste Farmrunde"
                : "Entdecke die Welt der Zwölf"}
            </strong>
            <small>
              {version || "Importierter Spielstand"} ·{" "}
              {stale ? "Zwischengespeichert" : "Lokaler Atlas"}
            </small>
          </div>
        </div>
        <div className="toolbar">
          <button
            className="secondary"
            aria-label="Filter ein-/ausblenden"
            aria-expanded={leftVisible}
            title="Filter ein-/ausblenden"
            onClick={() => setLeftVisible((v) => !v)}
          >
            <PanelLeftClose size={16} />
          </button>
          <button
            className="secondary"
            aria-label="Details ein-/ausblenden"
            aria-expanded={rightVisible}
            onClick={() => setRightVisible((v) => !v)}
          >
            <PanelRightClose size={16} />
          </button>
          <select
            aria-label="Weltkarte"
            value={worldId}
            onChange={(e) => {
              setNotice("");
              setWorldId(Number(e.target.value));
              setSelected(null);
              setChoices([]);
              setCamera(fitWorld(Number(e.target.value)));
            }}
          >
            {worlds.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name || w.nameFr || `Welt ${w.id}`}
              </option>
            ))}
          </select>
          <button
            className="secondary"
            title="Vollbild"
            onClick={() =>
              void (
                document.fullscreenElement
                  ? document.exitFullscreen()
                  : root.current!.requestFullscreen()
              ).catch((e) => setError(message(e)))
            }
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="world-notice" role="status">
          {notice}
        </div>
      )}
      {viewportTotal > maps.length && (
        <div className="world-notice">
          {maps.length.toLocaleString("de-DE")} von{" "}
          {viewportTotal.toLocaleString("de-DE")} Karten im Ausschnitt geladen.
          Zoome näher heran, um die übrigen Karten zu laden.
        </div>
      )}
      <div className="world-layout">
        {leftVisible && panelHandle("left")}
        {rightVisible && panelHandle("right")}
        {leftVisible && (
          <aside className="world-side world-filters">
            <details className="ui-world-points" open>
              <summary>Kartenobjekte & Legende</summary>
              <div className="ui-point-filters">
                <label>
                  <input
                    type="checkbox"
                    checked={pointKinds.zaap}
                    onChange={(e) =>
                      setPointKinds((v) => ({ ...v, zaap: e.target.checked }))
                    }
                  />
                  <GameGlyph name="zaap" size={19} />
                  Zaaps
                </label>
              </div>
              <details className="map-category-filter world-layer-toggle">
                <summary>
                  Alle Kartenkategorien{" "}
                  <ChevronDown size={16} aria-hidden="true" />
                </summary>
                {Object.entries(mapCategories).map(([id, entry]) => (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={!hiddenCategories.includes(+id)}
                      onChange={(e) =>
                        setHiddenCategories((v) =>
                          e.target.checked
                            ? v.filter((i) => i !== +id)
                            : [...v, +id],
                        )
                      }
                    />
                    <GameGlyph name={entry.glyph} size={18} />
                    {entry.label}
                  </label>
                ))}
              </details>
              <label>
                Orte suchen
                <input
                  aria-label="Kartenobjekte suchen"
                  value={pointQuery}
                  onChange={(e) => setPointQuery(e.target.value)}
                  placeholder="Zaap, Werkstatt, Verkaufsstand …"
                />
              </label>
              <div className="ui-point-list">
                {points
                  .filter(
                    (p) =>
                      (p.kind === "zaap"
                        ? pointKinds.zaap
                        : !hiddenCategories.includes(p.categoryId)) &&
                      `${p.name} ${p.category}`
                        .toLocaleLowerCase()
                        .includes(pointQuery.toLocaleLowerCase()),
                  )
                  .map((p) => (
                    <button
                      className="text-button"
                      key={p.id}
                      onClick={() =>
                        void run(async () => {
                          const r = await request<WorldPosition>(
                            `/api/world/maps/${p.mapId}`,
                            config,
                          );
                          choose(r.data);
                          setCamera({ x: p.x, y: p.y, scale: 32 });
                          setNotice(
                            `${p.name} · [${p.x}, ${p.y}] · Original-Kartenhinweis #${p.id}`,
                          );
                        })
                      }
                    >
                      <span style={{ color: markerAppearance(p).color }}>
                        <GameGlyph name={markerAppearance(p).glyph} size={19} />
                      </span>
                      {p.name}
                      <small>
                        [{p.x}, {p.y}]
                      </small>
                    </button>
                  ))}
              </div>
              <small>Original-Kartenhinweise; keine Ressourcen-Spawns.</small>
            </details>
            <span className="eyebrow">DEIN ATLAS</span>
            <h2>Ein Ziel vor Augen.</h2>
            <label className="world-search">
              <Search size={16} />
              <input
                aria-label="Karten suchen"
                placeholder="Gebiet, Map-ID oder [x,y]"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {!!results.length && (
              <div className="world-results">
                {results.map((m) => (
                  <button
                    className="world-result"
                    key={m.id}
                    onClick={() => choose(m)}
                  >
                    <MapPin size={14} />
                    <span>
                      {m.subAreaName || m.name}
                      <small>
                        [{m.x}, {m.y}] · {m.id} · Welt {m.worldId}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <details open>
              <summary>
                Ressourcen & Berufe{" "}
                <span>{new Set(resources.map((r) => r.itemId)).size}</span>
              </summary>
              <input
                aria-label="Ressourcen filtern"
                placeholder="Erz, Holz, Getreide …"
                value={resourceQuery}
                onChange={(e) => setResourceQuery(e.target.value)}
              />
              <label>
                Beruf
                <select
                  aria-label="Berufsfilter"
                  value={jobFilter}
                  onChange={(e) => setJobFilter(e.target.value)}
                >
                  <option value="">Alle Sammelaktionen</option>
                  {[
                    ...new Map(
                      resources.map((r) => [r.jobId, r.jobName]),
                    ).entries(),
                  ].map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Bis Berufslevel
                <input
                  aria-label="Maximales Berufslevel"
                  type="number"
                  min={1}
                  max={200}
                  value={maxLevel}
                  onChange={(e) =>
                    setMaxLevel(
                      Math.max(1, Math.min(200, Number(e.target.value) || 1)),
                    )
                  }
                />
              </label>
              {!activity && (
                <label>
                  <input
                    type="checkbox"
                    checked={onlyCharacter}
                    disabled={!characterId}
                    onChange={(e) => setOnlyCharacter(e.target.checked)}
                  />{" "}
                  Nur für meinen Charakter verfügbar
                </label>
              )}
              {onlyCharacter && (
                <p>
                  Ressourcen ohne hinterlegtes Berufslevel sind ausgeblendet.
                  Berufslevel unter „Berufe & Sammelquests“ pflegen.
                </p>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={includeUnconfirmed}
                  onChange={(e) => setIncludeUnconfirmed(e.target.checked)}
                />{" "}
                Dokumentierte Fundorte aus älterem Patch anzeigen
              </label>
              <small>
                DofusDB 3.7.4.4 · Companion {version}. Exakte Quellenpositionen
                sind für diesen Patch unbestätigt. Regionen sind keine
                Sammelstellen.
              </small>
              <label>
                <input
                  type="checkbox"
                  checked={clusterResources}
                  onChange={(e) => setClusterResources(e.target.checked)}
                />{" "}
                Fundstellen bei kleinem Zoom gruppieren
              </label>
              <p role="status">
                {gatheringNodes.length} dokumentierte Sammelzellen für die
                aktuelle Auswahl sichtbar.
              </p>
              <div className="world-resource-list">
                {resourceList.map((r) => (
                  <label
                    className={`world-resource ${resourceIds.includes(r.id) ? "selected" : ""}`}
                    key={r.id}
                  >
                    <input
                      type="checkbox"
                      checked={resourceIds.includes(r.id)}
                      onChange={(e) =>
                        setResourceIds((current) =>
                          e.target.checked
                            ? [...current, r.id]
                            : current.filter((id) => id !== r.id),
                        )
                      }
                    />
                    <ItemImage
                      url={
                        r.iconId
                          ? `https://api.dofusdu.de/dofus3/v1/img/item/${r.iconId}-64.png`
                          : undefined
                      }
                      size={28}
                    />
                    <span>
                      {r.name}
                      <small>
                        {r.jobName} · Stufe {r.level}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="toolbar">
                <button
                  className="text-button"
                  onClick={() => setResourceIds([])}
                >
                  Auswahl leeren
                </button>
              </div>
              {!activity && (
                <details>
                  <summary>Filter speichern</summary>
                  <input
                    aria-label="Name der Filterauswahl"
                    value={presetName}
                    maxLength={60}
                    placeholder="Zum Beispiel: Meine Bergbaurunde"
                    onChange={(e) => setPresetName(e.target.value)}
                  />
                  <button
                    className="secondary"
                    disabled={!presetName.trim()}
                    onClick={() =>
                      void run(async () => {
                        const next = [
                          ...filterPresets.filter(
                            (p) => p.name !== presetName.trim(),
                          ),
                          {
                            name: presetName.trim(),
                            resources: resourceIds,
                            job: jobFilter,
                            maxLevel,
                          },
                        ].slice(-20);
                        await write("world:filter-presets", next);
                        setFilterPresets(next);
                        setPresetName("");
                      })
                    }
                  >
                    Auswahl speichern
                  </button>
                  {filterPresets.map((p) => (
                    <button
                      key={p.name}
                      className="text-button"
                      onClick={() => {
                        setResourceIds(p.resources);
                        setJobFilter(p.job);
                        setMaxLevel(p.maxLevel);
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </details>
              )}
            </details>
            <details open>
              <summary>
                Eigene Markierungen <span>{markers.length}</span>
              </summary>
              {activity ? (
                <p>Private Companion-Markierungen werden hier nicht geladen.</p>
              ) : (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={showMarkers}
                      onChange={(e) => setShowMarkers(e.target.checked)}
                    />{" "}
                    Auf Karte anzeigen
                  </label>
                  <p>
                    Beobachtungen dokumentieren persönliche Funde. Ihre aktuelle
                    Verfügbarkeit ist unbekannt.
                  </p>
                  {markers.slice(0, 30).map((m) => (
                    <div className="world-marker-row" key={m.id}>
                      <button
                        className="text-button"
                        onClick={() =>
                          void run(async () => {
                            const result = await request<WorldPosition>(
                              `/api/world/maps/${m.mapId}`,
                              config,
                            );
                            choose(result.data);
                          })
                        }
                      >
                        {m.name}
                      </button>
                      <button
                        className="icon-button"
                        title="Markierung löschen"
                        onClick={() =>
                          void run(async () => {
                            await api(
                              `/api/world/personal/markers/${encodeURIComponent(m.id)}`,
                              config,
                              undefined,
                              "DELETE",
                            );
                            setMarkers((v) => v.filter((x) => x.id !== m.id));
                          })
                        }
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </details>
            <div className="world-legend">
              <span>
                <i className="map" /> Bekannte Spielkarte
              </span>
              <span>
                <i className="region" /> Ressourcenregion
              </span>
              <span>
                <i className="observed" /> Persönliche Beobachtung
              </span>
              <span>
                <i className="route" /> Berechneter Kartenwechsel
              </span>
            </div>
          </aside>
        )}
        <WorldCanvas
          gatheringNodes={gatheringNodes}
          gatheringResources={resources}
          clusterResources={clusterResources}
          onResource={(nodes) => {
            setRightVisible(true);
            setResourceDetails(nodes);
            requestAnimationFrame(() => {
              const panel = root.current?.querySelector(".world-details");
              if (panel) panel.scrollTop = 0;
            });
            if (new Set(nodes.map((n) => n.mapId)).size > 1) {
              setResourceDetails([]);
              setCamera((c) => ({
                ...c,
                x: nodes[0].x,
                y: nodes[0].y,
                scale: Math.max(16, c.scale * 1.8),
              }));
              return;
            }
            void run(async () => {
              const r = await request<WorldPosition>(
                `/api/world/maps/${nodes[0].mapId}`,
                config,
              );
              choose(r.data);
            });
          }}
          onCoordinate={(x, y) => {
            void run(async () => {
              const result = await request<WorldPosition[]>(
                `/api/world/maps?worldId=${worldId}&minX=${x}&maxX=${x}&minY=${y}&maxY=${y}&limit=5000`,
                config,
              );
              setChoices(result.data);
              if (result.data.length)
                choose(result.data.find((m) => !m.interior) ?? result.data[0]);
              else
                setNotice(
                  `Für [${x}, ${y}] ist keine Karte im Datenstand vorhanden.`,
                );
            });
          }}
          points={points.filter(
            (p) =>
              (p.kind === "zaap"
                ? pointKinds.zaap
                : !hiddenCategories.includes(p.categoryId)) &&
              `${p.name} ${p.category}`
                .toLocaleLowerCase()
                .includes(pointQuery.toLocaleLowerCase()),
          )}
          onPoint={(p) =>
            void run(async () => {
              const r = await request<WorldPosition>(
                `/api/world/maps/${p.mapId}`,
                config,
              );
              choose(r.data);
              setNotice(`${p.name} · Original-Kartenhinweis #${p.id}`);
            })
          }
          artwork={assets?.worlds[String(worldId)]}
          maps={displayedMaps}
          markers={showMarkers ? markers : []}
          selected={selected?.id}
          routeIds={route?.mapIds ?? []}
          highlightedRegions={regionIds}
          camera={camera}
          onCamera={setCamera}
          onSelect={(m) => {
            setChoices(m);
            setSelected(m[0]);
          }}
          onViewport={onViewport}
        />
        {rightVisible && (
          <aside className="world-side world-details">
            {!!resourceDetails.length && (
              <section className="resource-map-details">
                <h3>Sammelstellen</h3>
                {[...new Set(resourceDetails.map((n) => n.resourceId))].map(
                  (id) => {
                    const resource = resources.find((r) => r.id === id);
                    return resource ? (
                      <div key={id}>
                        <ItemImage
                          item={{ name: resource.name }}
                          iconId={resource.iconId}
                          itemId={resource.itemId}
                          size={40}
                        />
                        <strong>{resource.name}</strong>
                        <p>
                          {resource.jobName} · Stufe {resource.level}
                        </p>
                      </div>
                    ) : null;
                  },
                )}
                <p>
                  [{resourceDetails[0].x}, {resourceDetails[0].y}] · Karte{" "}
                  {resourceDetails[0].mapId}
                </p>
                <p>
                  {resourceDetails.length} dokumentierte Zellen · Quellenpatch{" "}
                  {resourceDetails[0].sourceVersion}
                </p>
                <strong>
                  {resourceDetails[0].verification === "verified"
                    ? "Quellenstand bestätigt"
                    : resourceDetails[0].verification === "personal-observation"
                      ? "Persönliche Beobachtung · kein Echtzeit-Spawn"
                      : "Aktueller Patch unbestätigt"}
                </strong>
                <button
                  onClick={() => {
                    const id = resourceDetails[0].mapId;
                    setTargetIds((v) => [...new Set([...v, id])]);
                    setTargetText((v) =>
                      [
                        ...new Set([
                          ...v.split(",").filter(Boolean),
                          String(id),
                        ]),
                      ].join(", "),
                    );
                  }}
                >
                  Als Routenziel übernehmen
                </button>
              </section>
            )}
            <span className="eyebrow">DEIN NÄCHSTER SCHRITT</span>
            {selected ? (
              <>
                <h2>
                  [{selected.x}, {selected.y}]
                </h2>
                <p>
                  {selected.subAreaName}
                  <br />
                  {selected.areaName}
                </p>
                <small>
                  Map-ID {selected.id} {selected.interior ? "· Innenkarte" : ""}{" "}
                  · Welt {selected.worldId}
                </small>
                {choices.length > 1 && (
                  <label>
                    Ebene / Karte
                    <select
                      aria-label="Karte bei gleichen Koordinaten"
                      value={selected.id}
                      onChange={(e) =>
                        setSelected(
                          choices.find((c) => c.id === Number(e.target.value))!,
                        )
                      }
                    >
                      {choices.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.subAreaName} · {m.id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="world-actions">
                  <button
                    className="secondary"
                    onClick={() => setStartId(String(selected.id))}
                  >
                    <Flag size={14} /> Als Start
                  </button>
                  <button
                    onClick={() => {
                      const next = [...new Set([...targetIds, selected.id])];
                      setTargetIds(next);
                      setTargetText(next.join(", "));
                    }}
                  >
                    <MapPin size={14} /> Zum Ziel
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      void run(async () => {
                        await navigator.clipboard.writeText(
                          `[${selected.x},${selected.y}]`,
                        );
                        setNotice("Koordinaten kopiert.");
                      })
                    }
                  >
                    <Copy size={14} /> Koordinaten kopieren
                  </button>
                </div>
                {!activity && (
                  <>
                    <input
                      aria-label="Name der Markierung"
                      placeholder="Name deiner Markierung"
                      maxLength={100}
                      value={markerName}
                      onChange={(e) => setMarkerName(e.target.value)}
                    />
                    <button
                      className="secondary"
                      onClick={() => void saveMarker()}
                    >
                      Wegpunkt merken
                    </button>
                    {!!resourceIds.length && (
                      <button
                        className="secondary"
                        onClick={() => void saveMarker(true)}
                      >
                        Ressourcenfund bestätigen
                      </button>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="world-selection-empty">
                <MapPin size={30} />
                <h3>Wohin zieht es dich?</h3>
                <p>
                  Wähle eine Karte aus oder suche nach einem Gebiet und seinen
                  Karten.
                </p>
              </div>
            )}
            {!!selectedResources.length && (
              <details open>
                <summary>Bekannte Ressourcenregionen</summary>
                {selectedResources.map((r) => (
                  <div key={r.id}>
                    <strong>{r.name}</strong>
                    <small>
                      {r.regions.map((v) => v.name).join(" · ") ||
                        "Keine Region zugeordnet"}
                    </small>
                  </div>
                ))}
                <p>
                  Gebietsangaben belegen keine einzelnen Vorkommen auf diesen
                  Karten.
                </p>
              </details>
            )}
            <details open>
              <summary>
                <Route size={16} /> Route planen
              </summary>
              <label>
                Start · Map-ID
                <input
                  inputMode="numeric"
                  aria-label="Start Map-ID"
                  value={startId}
                  onChange={(e) => setStartId(e.target.value)}
                />
              </label>
              <label>
                Ziele · Map-IDs
                <input
                  aria-label="Ziel Map-IDs"
                  placeholder="Mit Komma trennen"
                  value={targetText}
                  onChange={(e) => {
                    setTargetText(e.target.value);
                    setTargetIds(
                      e.target.value
                        .split(/[,\s]+/)
                        .filter((v) => /^\d+$/.test(v))
                        .map(Number),
                    );
                  }}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={roundTrip}
                  onChange={(e) => setRoundTrip(e.target.checked)}
                />{" "}
                Zum Start zurückkehren
              </label>
              {farming && (
                <label>
                  Maximale Zielkarten
                  <input
                    aria-label="Maximale Zielkarten"
                    type="number"
                    min={1}
                    max={60}
                    value={maxStops}
                    onChange={(e) => {
                      setMaxStops(
                        Math.min(60, Math.max(1, Number(e.target.value) || 1)),
                      );
                      setRoute(null);
                      setEstimatedOrder([]);
                      routeRevision.current++;
                    }}
                  />
                </label>
              )}
              <div className="world-actions">
                <button
                  disabled={busy || !Number(startId) || !targetIds.length}
                  onClick={() => void calculate()}
                >
                  <Route size={14} /> Route berechnen
                </button>
                {farming && (
                  <button
                    className="secondary"
                    disabled={busy || !Number(startId) || !resourceIds.length}
                    onClick={() => void calculate(true)}
                  >
                    Fundorte planen
                  </button>
                )}
              </div>
            </details>
            {!!estimatedOrder.length && (
              <section aria-label="Geschätzte Fundortreihenfolge">
                <h3>Geschätzte Besuchsreihenfolge</h3>
                <p>
                  {Math.max(0, estimatedOrder.length - 1)} Zielkarten ·{" "}
                  {farmNodeCount} Fundstellen. Keine geprüfte Wegstrecke. Ältere
                  Quellen bleiben unbestätigt.
                </p>
                <p>
                  Start: Karte {estimatedOrder[0]} ·{" "}
                  {selectedResources.map((r) => r.name).join(", ")}
                </p>
                {omittedStops > 0 && (
                  <p>
                    {omittedStops} weitere Zielkarten außerhalb der gewählten
                    Begrenzung.
                  </p>
                )}
                <ol>
                  {estimatedOrder.map((id) => (
                    <li key={id}>
                      <button
                        className="text-button"
                        onClick={() =>
                          void run(async () =>
                            choose(
                              (
                                await request<WorldPosition>(
                                  `/api/world/maps/${id}`,
                                  config,
                                )
                              ).data,
                            ),
                          )
                        }
                      >
                        Karte {id}{" "}
                        {(() => {
                          const p =
                            gatheringNodes.find((n) => n.mapId === id) ??
                            displayedMaps.find((m) => m.id === id);
                          return p ? `[${p.x}, ${p.y}]` : "";
                        })()}{" "}
                        anzeigen
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {route && (
              <div className="world-route">
                <strong>{route.steps} Kartenwechsel</strong>
                <p>{route.warning}</p>
                {!route.complete && (
                  <p className="world-warning">
                    Nicht erreichbar: {route.unreachableMapIds.join(", ")}. Der
                    lokale Übergangsgraph ist unvollständig.
                  </p>
                )}
                <ol>
                  {route.mapIds.map((id, index) => (
                    <li key={`${id}:${index}`}>
                      <label>
                        <input
                          type="checkbox"
                          checked={completed.includes(index)}
                          onChange={(e) =>
                            setCompleted((v) =>
                              e.target.checked
                                ? [...v, index]
                                : v.filter((x) => x !== index),
                            )
                          }
                        />
                        <span>
                          <button
                            type="button"
                            className="text-button"
                            onClick={(e) => {
                              e.preventDefault();
                              void run(async () =>
                                choose(
                                  (
                                    await request<WorldPosition>(
                                      `/api/world/maps/${id}`,
                                      config,
                                    )
                                  ).data,
                                ),
                              );
                            }}
                          >
                            Karte {id}
                          </button>
                          <small>
                            {index < route.transitions.length
                              ? route.transitions[index].direction
                              : "Ziel"}
                          </small>
                        </span>
                      </label>
                    </li>
                  ))}
                </ol>
                {!activity && (
                  <button
                    className="secondary"
                    onClick={() =>
                      void run(async () => {
                        await api("/api/world/personal/routes", config, {
                          name: `Route ${new Date().toLocaleDateString("de-DE")}`,
                          startMapId: route.mapIds[0],
                          targetMapIds: [
                            ...new Set(route.mapIds.slice(1)),
                          ].slice(0, 60),
                          roundTrip,
                        });
                        setSavedRoutes(
                          (
                            await request<
                              { id: string; name: string; route: WorldRoute }[]
                            >("/api/world/personal/routes", config)
                          ).data,
                        );
                        setNotice("Route lokal gespeichert.");
                      })
                    }
                  >
                    <Save size={14} /> Route speichern
                  </button>
                )}
                {onShare && (
                  <button
                    onClick={() =>
                      void run(async () => {
                        await onShare({
                          worldId,
                          mapIds: route.mapIds,
                          resourceIds,
                          title: "Gemeinsame Farmroute",
                        });
                        setNotice("Route in dieser Discord-Sitzung geteilt.");
                      })
                    }
                  >
                    Route ausdrücklich teilen
                  </button>
                )}
              </div>
            )}
            {!!savedRoutes.length && (
              <details>
                <summary>Gespeicherte Routen ({savedRoutes.length})</summary>
                {savedRoutes.map((r) => (
                  <button
                    key={r.id}
                    className="text-button"
                    onClick={() => {
                      setRoute(r.route);
                      setCompleted([]);
                    }}
                  >
                    {r.name} · {r.route.steps} Schritte
                  </button>
                ))}
              </details>
            )}
            {farming && (
              <details open>
                <summary>Farmwert · eigene Annahmen</summary>
                <label>
                  Zielmenge
                  <input
                    type="number"
                    min={1}
                    max={1000000}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Math.max(1, Number(e.target.value)))
                    }
                  />
                </label>
                <label>
                  Ausbeute pro Fund
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={yieldPerNode}
                    onChange={(e) =>
                      setYieldPerNode(Math.max(0, Number(e.target.value)))
                    }
                  />
                </label>
                <label>
                  Verfügbarkeit · Anteil 0–1
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={1}
                    value={fraction}
                    onChange={(e) =>
                      setFraction(
                        Math.max(0, Math.min(1, Number(e.target.value))),
                      )
                    }
                  />
                </label>
                <label>
                  Sammelzeit · Sekunden
                  <input
                    type="number"
                    min={0}
                    value={gatherSeconds}
                    onChange={(e) =>
                      setGatherSeconds(Math.max(0, Number(e.target.value)))
                    }
                  />
                </label>
                <label>
                  Kartenwechsel · Sekunden
                  <input
                    type="number"
                    min={0}
                    value={walkSeconds}
                    onChange={(e) =>
                      setWalkSeconds(Math.max(0, Number(e.target.value)))
                    }
                  />
                </label>
                <label>
                  Eigener Stückpreis · Kamas
                  <input
                    type="number"
                    min={0}
                    placeholder="Unbekannt"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </label>
                <div className="world-estimate">
                  <strong>
                    {estimate.quantity.toLocaleString("de-DE")} / {quantity}{" "}
                    Ressourcen
                  </strong>
                  <span>
                    Schätzung aus {estimate.assumptions.nodeCount} eigenen
                    Funden · {(estimate.seconds / 60).toFixed(1)} Min.
                  </span>
                  <span>
                    {estimate.value === null
                      ? "Kein Marktpreis hinterlegt"
                      : `${estimate.value.toLocaleString("de-DE")} K · ${Math.round(estimate.kamasPerHour ?? 0).toLocaleString("de-DE")} K/h`}
                  </span>
                </div>
              </details>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

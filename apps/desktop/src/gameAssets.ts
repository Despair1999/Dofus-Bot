import { useEffect, useState } from "react";

export interface WorldArtwork {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  aspect: number;
}
interface Assets {
  version: string;
  worlds: Record<string, WorldArtwork>;
  monsters: Record<string, string>;
  items: Record<string, string>;
  itemIcons: Record<string, number>;
  spells: Record<string, string>;
}
let cached: Assets | undefined;
let pending: Promise<Assets> | undefined;
export function useGameAssets() {
  const [assets, setAssets] = useState(cached);
  useEffect(() => {
    let active = true;
    pending ??= fetch("/game-assets/manifest.json")
      .then((r) => {
        if (!r.ok) throw Error("Bildkatalog nicht verfügbar");
        return r.json() as Promise<Assets>;
      })
      .then((value) => (cached = value))
      .catch((e) => {
        pending = undefined;
        throw e;
      });
    void pending
      .then((value) => {
        if (active) setAssets(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return assets;
}

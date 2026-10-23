import dungeons from "../../../packages/community/src/dungeons.json";
import type { CatalogItem } from "@dofus/community/ui";
export const communityDungeons = dungeons;
let catalog: Promise<CatalogItem[]> | undefined;
export async function searchCommunityItems(q: string) {
  catalog ??= fetch("/community-items.json")
    .then((r) => {
      if (!r.ok) throw Error("Katalog nicht verfügbar.");
      return r.json() as Promise<CatalogItem[]>;
    })
    .catch((e) => {
      catalog = undefined;
      throw e;
    });
  return (await catalog)
    .filter((i) =>
      i.name.toLocaleLowerCase("de").includes(q.toLocaleLowerCase("de")),
    )
    .slice(0, 30);
}

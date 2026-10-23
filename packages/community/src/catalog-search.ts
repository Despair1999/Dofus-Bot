export type CatalogItem = {
  id: number;
  name: string;
  nameFr?: string;
  nameEn?: string;
  iconUrl: string;
  level?: number;
  category?: string;
  type?: string;
  typeId?: number;
  tradeable?: boolean;
};
export const normalizedCatalogText = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("de");
export function searchCatalog(items: CatalogItem[], q: string) {
  const needle = normalizedCatalogText(q.trim());
  return items.filter(
    (i) =>
      i.tradeable === true &&
      (!needle ||
        String(i.id) === needle ||
        [i.name, i.nameFr, i.nameEn].some(
          (name) => name && normalizedCatalogText(name).includes(needle),
        )),
  );
}
export function createCatalogSearch(url = "/community-items.json") {
  let catalog: Promise<CatalogItem[]> | undefined;
  return async (q: string) => {
    catalog ??= fetch(url)
      .then((r) => {
        if (!r.ok) throw Error("Gegenstandskatalog ist nicht verfügbar.");
        return r.json() as Promise<CatalogItem[]>;
      })
      .catch((e) => {
        catalog = undefined;
        throw e;
      });
    return searchCatalog(await catalog, q);
  };
}

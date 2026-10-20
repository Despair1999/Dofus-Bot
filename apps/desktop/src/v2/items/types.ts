import type { ItemDetail, Item as BaseItem } from "@dofus/core";
export type CatalogItem = BaseItem & {
  typeId?: number;
  mainGroup?: string;
  nameFr?: string;
  nameEn?: string;
  iconId?: number;
};
export type Material = CatalogItem & { itemId: number; quantity: number };
export type CatalogDetail = ItemDetail & {
  typeId?: number;
  mainGroup?: string;
  nameFr?: string;
  nameEn?: string;
  weight?: number;
  conditions?: string;
  requirements?: string;
  setName?: string;
  setId?: number;
  materials?: Material[];
  recipe: (ItemDetail["recipe"][number] & {
    name?: string;
    imageUrl?: string;
    level?: number;
    type?: string;
    item?: CatalogItem;
    material?: CatalogItem;
  })[];
  version?: string;
};
export interface ItemType {
  id: number;
  name: string;
  nameDe?: string;
  category?: string;
  mainGroup?: string;
  count?: number;
}
export interface ItemFilters {
  mainGroup: "equipment" | "resources";
  category?: string;
  typeId?: number;
  minLevel?: number;
  maxLevel?: number;
  sort: "name" | "level-asc" | "level-desc";
}
export const defaultFilters: ItemFilters = {
  mainGroup: "equipment",
  sort: "name",
};

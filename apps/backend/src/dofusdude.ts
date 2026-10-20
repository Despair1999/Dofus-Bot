import { z } from "zod";
import type { Envelope, Item, ItemDetail } from "@dofus/core";
import { PersonalStore } from "./store.js";

const base = "https://api.dofusdu.de/dofus3/v1";
export const languageSchema = z.enum(["de", "fr"]).default("de");
export const categorySchema = z
  .enum(["equipment", "resources", "consumables", "quest", "cosmetics"])
  .default("equipment");
const upstreamItem = z.object({
  ankama_id: z.number().int(),
  name: z.string(),
  level: z.number().int(),
  type: z.object({ name: z.string() }),
  item_subtype: z.object({ name_id: z.string() }).optional(),
  image_urls: z
    .object({ icon: z.url().optional(), sd: z.url().optional() })
    .optional(),
  description: z.string().optional(),
  effects: z.array(z.object({ formatted: z.string() })).optional(),
  recipe: z
    .array(
      z.object({
        item_ankama_id: z.number().int(),
        quantity: z.number().int().positive(),
        item_subtype: z.string(),
      }),
    )
    .optional(),
});
const almanaxSchema = z.object({
  date: z.string(),
  bonus: z.object({
    description: z.string(),
    type: z.object({ name: z.string(), id: z.string() }),
  }),
  tribute: z.object({
    item: z.object({
      ankama_id: z.number(),
      name: z.string(),
      image_urls: z
        .object({ icon: z.string().optional(), sd: z.string().optional() })
        .optional(),
      subtype: z.string().optional(),
    }),
    quantity: z.number(),
  }),
  reward_kamas: z.number(),
});
export class UpstreamError extends Error {
  constructor(
    message: string,
    public statusCode = 503,
  ) {
    super(message);
  }
}
export class Dofusdude {
  private failures = 0;
  private blockedUntil = 0;
  private inflight = new Map<string, Promise<Envelope<unknown>>>();
  constructor(
    private store: PersonalStore,
    private fetcher: typeof fetch = fetch,
    private now: () => number = Date.now,
  ) {}
  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    ttl = 3_600_000,
  ): Promise<Envelope<T>> {
    const cache = this.store.cacheGet(path);
    const envelope = (body: T, stale = false): Envelope<T> => ({
      data: body,
      source: "dofusdude / DOFUS 3",
      fetchedAt: cache?.fetchedAt,
      cached: true,
      stale,
    });
    if (cache && cache.expiresAt > this.now())
      return envelope(schema.parse(JSON.parse(cache.body)));
    const active = this.inflight.get(path);
    if (active) return active as Promise<Envelope<T>>;
    const run = async (): Promise<Envelope<T>> => {
      try {
        if (this.blockedUntil > this.now())
          throw new UpstreamError(
            "Datenquelle wird nach einer Störung später erneut geprüft.",
          );
        let body: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          let response: Response;
          try {
            response = await this.fetcher(`${base}/${path}`, {
              signal: AbortSignal.timeout(8000),
              headers: {
                accept: "application/json",
                "user-agent": "DofusCompanion/0.1",
              },
            });
          } catch (error) {
            if (attempt === 2) throw error;
            await new Promise((resolve) =>
              setTimeout(resolve, 200 * 2 ** attempt),
            );
            continue;
          }
          if (response.status === 404)
            throw new UpstreamError(
              "Keine Daten für diese Abfrage vorhanden.",
              404,
            );
          if (response.status === 429) {
            const seconds = Number(response.headers.get("retry-after"));
            this.blockedUntil =
              this.now() +
              (Number.isFinite(seconds) && seconds > 0
                ? Math.min(seconds, 3600) * 1000
                : 60_000);
            throw new UpstreamError(
              "Datenquelle begrenzt Anfragen. Bitte später erneut versuchen.",
            );
          }
          if (!response.ok) {
            if (response.status >= 500 && attempt < 2) {
              await new Promise((resolve) =>
                setTimeout(resolve, 200 * 2 ** attempt),
              );
              continue;
            }
            throw new UpstreamError(
              `Datenquelle antwortet mit HTTP ${response.status}.`,
            );
          }
          body = await response.json();
          break;
        }
        const parsed = schema.parse(body);
        this.store.cachePut(path, parsed, ttl);
        this.failures = 0;
        this.blockedUntil = 0;
        return {
          data: parsed,
          source: "dofusdude / DOFUS 3",
          fetchedAt: new Date().toISOString(),
          cached: false,
          stale: false,
        };
      } catch (error) {
        this.failures++;
        if (this.failures >= 3)
          this.blockedUntil = Math.max(this.blockedUntil, this.now() + 60_000);
        if (cache) return envelope(schema.parse(JSON.parse(cache.body)), true);
        if (error instanceof UpstreamError) throw error;
        throw new UpstreamError(
          "Spieldatenquelle nicht erreichbar oder Antwortformat ungültig. Kein Cache vorhanden.",
        );
      } finally {
        this.inflight.delete(path);
      }
    };
    const result = run();
    this.inflight.set(path, result as Promise<Envelope<unknown>>);
    return result;
  }
  async search(
    query: string,
    lang = "de",
    category?: string,
  ): Promise<Envelope<Item[]>> {
    const result = await this.request(
      `${lang}/items/${category ? category + "/" : ""}search?query=${encodeURIComponent(query)}&limit=30`,
      z.array(upstreamItem),
    );
    return {
      ...result,
      data: result.data.map((raw) =>
        this.item(raw, category ?? raw.item_subtype?.name_id ?? "equipment"),
      ),
    };
  }
  async itemDetail(
    id: number,
    category = "equipment",
    lang = "de",
  ): Promise<Envelope<ItemDetail>> {
    const result = await this.request(
      `${lang}/items/${category}/${id}`,
      upstreamItem,
    );
    const raw = result.data;
    return {
      ...result,
      data: {
        ...this.item(raw, category),
        description: raw.description ?? "",
        effects: (raw.effects ?? []).map((e) => e.formatted),
        recipe: (raw.recipe ?? []).map((r) => ({
          itemId: r.item_ankama_id,
          quantity: r.quantity,
          category: r.item_subtype,
        })),
        source: "dofusdude",
      },
    };
  }
  almanax(date: string, lang = "de") {
    return this.request(
      `${lang}/almanax/${date}`,
      almanaxSchema,
      6 * 3_600_000,
    );
  }
  version() {
    return this.request(
      "meta/version",
      z.object({
        version: z.string(),
        release: z.string(),
        update_stamp: z.string(),
      }),
      300_000,
    );
  }
  status() {
    return {
      name: "dofusdude",
      failures: this.failures,
      circuitOpen: this.blockedUntil > this.now(),
      retryAt: this.blockedUntil
        ? new Date(this.blockedUntil).toISOString()
        : null,
    };
  }
  private item(raw: z.infer<typeof upstreamItem>, category: string): Item {
    return {
      id: raw.ankama_id,
      name: raw.name,
      level: raw.level,
      type: raw.type.name,
      category,
      imageUrl: raw.image_urls?.sd ?? raw.image_urls?.icon,
    };
  }
}

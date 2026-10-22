export type { Character, Progress } from "@dofus/core";
import type { Item as BaseItem, ItemDetail } from "@dofus/core";
export type Item = BaseItem &
  Partial<Pick<ItemDetail, "description" | "effects" | "recipe">>;
export class Backend {
  constructor(
    private base: string,
    private token: string,
  ) {
    const url = new URL(base);
    if (!["http:", "https:"].includes(url.protocol))
      throw Error("Ungültige Backend-URL");
    if (
      url.protocol === "http:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      throw Error("Entfernte Backends benötigen HTTPS");
  }
  async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(new URL(path, this.base), {
      method: body === undefined ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw Error(`Backend-Anfrage fehlgeschlagen (${response.status})`);
    return (await response.json()) as T;
  }
  async progress(characterId: string, body: unknown) {
    const response = await fetch(
      new URL(
        `/api/characters/${encodeURIComponent(characterId)}/progress`,
        this.base,
      ),
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw Error(
        `Fortschritt nicht gespeichert (${response.status}); bitte neu laden.`,
      );
    return response.json();
  }
  async binary(path: string): Promise<Buffer> {
    const response = await fetch(new URL(path, this.base), {
      headers: { authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (
      !response.ok ||
      response.headers.get("content-type")?.split(";")[0] !== "image/png"
    )
      throw Error("Kartenvorschau nicht verfügbar.");
    const result = Buffer.from(await response.arrayBuffer());
    if (
      result.length > 2 * 1024 * 1024 ||
      result.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    )
      throw Error("Ungültige Kartengrafik.");
    return result;
  }
}

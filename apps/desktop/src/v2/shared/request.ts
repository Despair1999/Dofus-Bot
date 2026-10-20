import { ApiError, type Config } from "../../client";
import { read, write } from "../../storage";
export interface PageEnvelope<T> {
  data: T;
  total?: number;
  page?: number;
  pageSize?: number;
  source?: string;
  version?: string;
  stale?: boolean;
  cached?: boolean;
}
/** Abort-aware reads; a cancelled request never falls back to an older cached response. */
export async function request<T>(
  path: string,
  config: Config,
  signal?: AbortSignal,
): Promise<PageEnvelope<T>> {
  const server = new URL(config.url);
  if (
    server.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(server.hostname)
  )
    throw new Error("Entfernte Backends benötigen HTTPS.");
  const key = `cache:${config.url}:${path}`;
  try {
    const response = await fetch(`${server.origin}${path}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    });
    const result = (await response.json()) as PageEnvelope<T> & {
      error?: string | { message?: string };
    };
    if (!response.ok)
      throw new ApiError(
        response.status,
        typeof result.error === "string"
          ? result.error
          : (result.error?.message ??
              `Anfrage fehlgeschlagen (${response.status}).`),
      );
    if (signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
    await write(key, result);
    return result;
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    if (error instanceof ApiError && [401, 403].includes(error.status))
      throw error;
    const saved = await read<PageEnvelope<T> | null>(key, null);
    if (saved) return { ...saved, stale: true, cached: true };
    throw error;
  }
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

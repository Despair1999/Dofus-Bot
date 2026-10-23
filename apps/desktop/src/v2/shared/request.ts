import { ApiError, type Config } from "../../client";
import { localAccount, read, write } from "../../storage";
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
  const account = localAccount();
  const assertAccount = () => {
    if (account !== localAccount())
      throw new ApiError(409, "Account wurde während der Anfrage gewechselt.");
  };
  const server = new URL(config.url);
  if (
    server.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(server.hostname)
  )
    throw new Error("Entfernte Backends benötigen HTTPS.");
  const key = `cache:${config.url}:${path}`;
  try {
    const response = await fetch(`${server.origin}${path}`, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        ...(account ? { "X-Companion-Account": account } : {}),
      },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    });
    const result = (await response.json()) as PageEnvelope<T> & {
      error?: string | { message?: string };
    };
    assertAccount();
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
    assertAccount();
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    if (error instanceof ApiError && [401, 403, 409].includes(error.status))
      throw error;
    const saved = await read<PageEnvelope<T> | null>(key, null);
    assertAccount();
    if (saved) return { ...saved, stale: true, cached: true };
    throw error;
  }
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

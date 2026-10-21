import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Config } from "../../client";
import { read } from "../../storage";
export function useTranslatorConnection(provided?: Config) {
  const [config, setConfig] = useState<Config | undefined>(provided);
  useEffect(() => {
    let stopped = false;
    if (provided) {
      setConfig(provided);
      return;
    }
    void (async () => {
      const result = isTauri()
        ? await invoke<Config>("local_connection")
        : {
            ...(await read<Config>("config", {
              url: "http://127.0.0.1:4310",
              token: "",
            })),
            token: sessionStorage.getItem("companion-token") ?? "",
          };
      if (!stopped) setConfig(result);
    })().catch(() => {});
    return () => {
      stopped = true;
    };
  }, [provided]);
  return config;
}
export async function translatorRequest<T>(
  config: Config,
  operation: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(config.url);
  // Chat text stays on the computer even when another Companion backend is configured.
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Übersetzungen sind nur mit dem lokalen Backend möglich.");
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Ungültige lokale Backend-Adresse.");
  const response = await fetch(`${url.origin}/api/translator/${operation}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(100_000)])
      : AbortSignal.timeout(100_000),
  });
  const result = (await response.json()) as { data: T; error?: string };
  if (!response.ok)
    throw new Error(result.error ?? "Lokale Übersetzung fehlgeschlagen.");
  return result.data;
}

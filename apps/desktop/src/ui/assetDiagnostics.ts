export interface AssetFailure {
  path: string;
  count: number;
  lastSeen: string;
}
const failures = new Map<string, AssetFailure>();
export function recordAssetFailure(url: string) {
  // Session-only diagnostics: no user names, tokens, query strings, or remote reporting.
  let path: string;
  try {
    const value = new URL(url, location.origin);
    path =
      value.origin === location.origin
        ? value.pathname
        : value.hostname + value.pathname;
  } catch {
    return;
  }
  const previous = failures.get(path);
  if (!previous && failures.size >= 100) return;
  failures.set(path, {
    path,
    count: (previous?.count ?? 0) + 1,
    lastSeen: new Date().toISOString(),
  });
  window.dispatchEvent(new Event("companion:asset-failure"));
}
export function assetFailures() {
  return [...failures.values()];
}

export const GITHUB_REPOSITORY = "Despair1999/Dofus-Bot";
const ENDPOINT = `https://api.github.com/repos/${GITHUB_REPOSITORY}/releases?per_page=30`;
export const RELEASES_PAGE = `https://github.com/${GITHUB_REPOSITORY}/releases`;

export interface ReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
  content_type?: string;
}
export interface GithubRelease {
  tag_name: string;
  name: string | null;
  published_at: string | null;
  html_url: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: ReleaseAsset[];
}
export interface InstallerRelease {
  release: GithubRelease;
  installer: ReleaseAsset;
  portable?: ReleaseAsset;
  checksum?: ReleaseAsset;
}
const semver = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i;
function version(tag: string): number[] {
  const match = semver.exec(tag);
  return match ? match.slice(1, 4).map(Number) : [];
}
export function compareReleases(a: GithubRelease, b: GithubRelease): number {
  const av = version(a.tag_name), bv = version(b.tag_name);
  if (av.length && bv.length) {
    for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return bv[i] - av[i];
  } else if (av.length !== bv.length) return bv.length - av.length;
  return Date.parse(b.published_at || "") - Date.parse(a.published_at || "") || 0;
}
function safeAssetUrl(asset: ReleaseAsset): boolean {
  try {
    const url = new URL(asset.browser_download_url);
    return url.protocol === "https:" && url.hostname === "github.com" &&
      url.pathname.startsWith(`/${GITHUB_REPOSITORY}/releases/download/`) &&
      Number.isFinite(asset.size) && asset.size > 1024;
  } catch { return false; }
}
export function eligibleReleases(data: unknown): GithubRelease[] {
  if (!Array.isArray(data)) return [];
  return data.filter((r): r is GithubRelease =>
    !!r && typeof r === "object" && typeof r.tag_name === "string" &&
    !!version(r.tag_name).length && !r.draft && !r.prerelease &&
    typeof r.html_url === "string" && Array.isArray(r.assets)
  ).sort(compareReleases);
}
export function installerFor(release: GithubRelease): InstallerRelease | null {
  const assets = release.assets.filter(safeAssetUrl);
  const installers = assets.filter((a) => /(?:^|[-_.])setup\.exe$/i.test(a.name) || /(?:^|[-_.])x64-setup\.exe$/i.test(a.name));
  const installer = installers.sort((a,b) => Number(/x64/i.test(b.name)) - Number(/x64/i.test(a.name)))[0];
  if (!installer) return null;
  return { release, installer, portable: assets.find((a) => /portable\.zip$/i.test(a.name)), checksum: assets.find((a) => /^SHA256SUMS\.txt$/i.test(a.name)) };
}
export function latestInstaller(data: unknown): InstallerRelease | null {
  for (const release of eligibleReleases(data)) {
    const found = installerFor(release);
    if (found) return found;
  }
  return null;
}
export function fileSize(bytes: number): string { return (bytes / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " MB"; }
export async function fetchReleases(signal?: AbortSignal): Promise<GithubRelease[]> {
  const response = await fetch(ENDPOINT, { headers: { Accept: "application/vnd.github+json" }, signal });
  if (!response.ok) throw Error(response.status === 403 || response.status === 429 ? "GitHub-API derzeit limitiert." : "Versionsdaten derzeit nicht erreichbar.");
  return eligibleReleases(await response.json());
}

/** UI-only preview barrier: the verifier is public on static Firebase Hosting.
 * Not a server-side authorization mechanism. All hosted files remain fetchable.
 */
export type AccessConfig = {
  version: 1;
  scheme: "pbkdf2-sha256";
  iterations: number;
  salt: string;
  verifier: string;
};

export const SESSION_KEY = "dofus-companion-preview-v1";
export function hasPreviewSession(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === "granted"; } catch { return false; }
}
export function savePreviewSession(): void {
  try { sessionStorage.setItem(SESSION_KEY, "granted"); } catch { /* private mode */ }
}
export function clearPreviewSession(): void {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
}
export function isAccessConfig(value: unknown): value is AccessConfig {
  if (!value || typeof value !== "object") return false;
  const x = value as Record<string, unknown>;
  return x.version === 1 && x.scheme === "pbkdf2-sha256" &&
    Number.isInteger(x.iterations) && typeof x.iterations === "number" &&
    x.iterations >= 200_000 && x.iterations <= 1_000_000 &&
    typeof x.salt === "string" && /^[a-f0-9]{32}$/.test(x.salt) &&
    typeof x.verifier === "string" && /^[a-f0-9]{64}$/.test(x.verifier);
}
export async function verifyPreviewPassword(password: string, config: AccessConfig): Promise<boolean> {
  if (!password || !isAccessConfig(config)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bytes = Uint8Array.from(config.salt.match(/../g)!.map(n => parseInt(n, 16)));
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2",salt:bytes,iterations:config.iterations,hash:"SHA-256"}, key, 256);
  const actual = new Uint8Array(bits);
  const expected = Uint8Array.from(config.verifier.match(/../g)!.map(n => parseInt(n, 16)));
  let mismatch = 0;
  for(let i=0;i<actual.length;i++) mismatch |= actual[i] ^ expected[i];
  return mismatch === 0;
}
export async function loadAccessConfig(signal?: AbortSignal): Promise<AccessConfig> {
  const r = await fetch("/access-config.json", {cache:"no-store",signal});
  if (!r.ok) throw new Error("Vorschau-Zugang ist noch nicht eingerichtet.");
  const json: unknown = await r.json();
  if (!isAccessConfig(json)) throw new Error("Ungültige Zugangskonfiguration.");
  return json;
}

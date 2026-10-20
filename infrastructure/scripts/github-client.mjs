import { spawnSync } from "node:child_process";
const repository = "Despair1999/Dofus-Bot";
let credential;
function githubToken() {
  if (credential) return credential;
  credential = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!credential) {
    const result = spawnSync("git", ["credential", "fill"], {
      input: `protocol=https\nhost=github.com\npath=${repository}.git\n\n`,
      encoding: "utf8",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      windowsHide: true,
    });
    if (result.status === 0)
      credential = result.stdout
        .split(/\r?\n/)
        .find((line) => line.startsWith("password="))
        ?.slice(9);
  }
  if (!credential)
    throw new Error(
      "Kein vorhandener GitHub-Zugang für die Release-Veröffentlichung verfügbar.",
    );
  return credential;
}
export async function githubRequest(method, path, body) {
  if (!path.startsWith(`/repos/${repository}`))
    throw new Error("GitHub-Zugriff auf das Projekt beschränkt.");
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${githubToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 204) return null;
  const json = await response.json();
  if (!response.ok)
    throw new Error(
      `GitHub HTTP ${response.status}: ${json.message ?? "Anfrage fehlgeschlagen"}`,
    );
  return json;
}
export async function githubUpload(
  releaseId,
  name,
  content,
  contentType = "application/octet-stream",
) {
  const response = await fetch(
    `https://uploads.github.com/repos/${repository}/releases/${Number(releaseId)}/assets?name=${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken()}`,
        Accept: "application/vnd.github+json",
        "Content-Type": contentType,
      },
      body: content,
      signal: AbortSignal.timeout(300000),
    },
  );
  const json = await response.json();
  if (!response.ok)
    throw new Error(
      `GitHub-Upload HTTP ${response.status}: ${json.message ?? "fehlgeschlagen"}`,
    );
  return json;
}
export { repository };

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { latestInstaller, eligibleReleases, installerFor } from "./release";
const base = { name:"Test", body:"", published_at:"2026-10-22T16:00:00Z", html_url:"https://github.com/Despair1999/Dofus-Bot/releases/tag/v0.6.0", draft:false, prerelease:false };
test("sorts semantic versions instead of relying on GitHub API order", () => {
  const items = eligibleReleases([{...base,tag_name:"v0.5.0",assets:[]},{...base,tag_name:"v0.6.0",assets:[]}]);
  assert.equal(items[0].tag_name,"v0.6.0");
});
test("does not offer source ZIPs, signatures or untrusted installers", () => {
  const rel = {...base,tag_name:"v0.6.0",assets:[{name:"setup.exe.sig",size:100000,browser_download_url:"https://evil.example/install.exe"},{name:"source.zip",size:100000,browser_download_url:"https://github.com/Despair1999/Dofus-Bot/releases/download/v0.6.0/source.zip"}]};
  assert.equal(installerFor(rel),null);
  assert.equal(latestInstaller([rel]),null);
});
test("chooses a genuine public setup executable", () => {
  const rel = {...base,tag_name:"v0.6.0",assets:[{name:"DOFUS-Companion-0.6.0-setup.exe",size:12345678,browser_download_url:"https://github.com/Despair1999/Dofus-Bot/releases/download/v0.6.0/DOFUS-Companion-0.6.0-setup.exe"}]};
  assert.equal(latestInstaller([rel])?.installer.name,rel.assets[0].name);
});

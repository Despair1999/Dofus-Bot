// Serve the exact built frontend with a transparent loopback proxy to the
// isolated real backend. No fixture API responses or native API shims.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const root = resolve("apps/desktop/dist");
const backend = process.env.COMPANION_E2E_BACKEND || "http://127.0.0.1:4311";
assert.equal(new URL(backend).hostname, "127.0.0.1");
const token = (await readFile(process.env.COMPANION_E2E_TOKEN_FILE || ".data/polish-e2e/backend-token", "utf8")).trim();
const mime = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".webp":"image/webp", ".png":"image/png", ".svg":"image/svg+xml", ".woff2":"font/woff2", ".woff":"font/woff"};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/health" || url.pathname.startsWith("/api/")) {
      const chunks=[]; for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const upstream = await fetch(backend + req.url, {method:req.method, headers:{...(req.headers.authorization ? {authorization:req.headers.authorization}:{}), "content-type":"application/json"}, ...(body.length ? {body}:{} )});
      res.writeHead(upstream.status, {"content-type":upstream.headers.get("content-type") || "application/json"});
      res.end(Buffer.from(await upstream.arrayBuffer())); return;
    }
    const relative = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const file = resolve(root, "." + relative);
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, {"content-type":mime[extname(file)] || "application/octet-stream"}); res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors = [], missingAssets = [];
page.on("pageerror", e => errors.push(e.message));
page.on("response", r => { if(r.url().startsWith(origin) && r.status() >= 400) missingAssets.push(r.url()); });
await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
const passed=[];
try {
  await page.goto(origin);
  await page.evaluate(async ({origin,token}) => {
    sessionStorage.setItem("companion-token", token);
    await new Promise((done,reject) => {
      const request = indexedDB.open("dofus-companion",1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("records"))request.result.createObjectStore("records");};
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result, transaction=db.transaction("records","readwrite"), records=transaction.objectStore("records");
        records.put({url:origin,token:""},"config"); records.put(true,"onboarded");
        transaction.oncomplete=()=>{db.close();done();}; transaction.onerror=()=>reject(transaction.error);
      };
    });
  }, {origin,token});
  await page.goto(origin + "/#/world?mapId=99353610"); await page.reload();
  await expect(page.locator("canvas[data-background='loaded']")).toBeVisible();
  await expect(page.locator(".world-details")).toContainText("99353610");
  await expect(page.getByLabel("Weltkarte",{exact:true})).toHaveValue("1");
  passed.push("built frontend loads original world artwork and resolves an interior quest target with external requests blocked");
  await page.screenshot({path:"artifacts/v5-production-map.png",fullPage:true});
  await page.goto(origin + "/#/dungeons/1");
  await expect.poll(()=>page.locator(".dungeon-detail-heading img").evaluate(el=>el.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button",{name:"Strategie",exact:true}).click();
  await expect(page.locator(".combat-boss-plan")).toHaveCount(1);
  passed.push("boss artwork and original-grade combat plan load from the production bundle");
  await page.screenshot({path:"artifacts/v5-production-dungeon.png",fullPage:true});
  await page.goto(origin + "/#/professions");
  await expect(page.locator(".profession-card img")).toHaveCount(6);
  for (const image of await page.locator(".profession-card img").all()) {
    await image.scrollIntoViewIfNeeded(); await expect.poll(()=>image.evaluate(el=>el.naturalWidth)).toBeGreaterThan(0);
  }
  passed.push("all six profession quest illustrations load while external image hosts are blocked");
  await page.goto(origin + "/#/settings");
  for (const name of ["Wald der Zwölf","Sufokia","Zwielicht","Brâkmar"]) {
    const option=page.getByRole("button",{name:new RegExp(name)});await option.click();await expect(option).toHaveAttribute("aria-pressed","true");
  }
  await page.reload();await expect(page.locator("html")).toHaveAttribute("data-theme","ember");
  passed.push("all four production themes work and the chosen theme survives reload");
  await page.goto(origin + "/#/builder");
  for (const [name,color] of [["ap","rgb(120, 186, 255)"],["bp","rgb(147, 230, 156)"],["lp","rgb(255, 155, 159)"]]) await expect(page.locator(`.builder-summary-metrics .stat-${name} strong`)).toHaveCSS("color",color);
  passed.push("AP BP LP retain their semantic colors in the production builder");
  assert.deepEqual(errors,[]);assert.deepEqual(missingAssets,[]);
  await writeFile("docs/production-ui-v5-test.json",JSON.stringify({version:"0.5.0",testedAt:new Date().toISOString(),runtime:"Chromium / exact Vite production frontend / real isolated loopback backend",externalRequestsBlocked:true,passed,errors,missingAssets},null,2)+"\n");
  console.log(JSON.stringify({passed,errors,missingAssets}));
} finally {await browser.close();await new Promise(done=>server.close(done));}

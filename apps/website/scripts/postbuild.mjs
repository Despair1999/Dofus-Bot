import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
const dist = resolve("dist");
await mkdir(dist, { recursive: true });
const base = (process.env.VITE_SITE_URL || "").replace(/\/$/, "");
const routes = ["/", "/funktionen", "/desktop", "/discord", "/downloads", "/faq", "/changelog", "/impressum", "/datenschutz"];
if (base) {
  const site = new URL(base);
  if (site.protocol !== "https:") throw Error("VITE_SITE_URL muss eine HTTPS-URL sein.");
  await writeFile(resolve(dist, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + routes.map((p) => '<url><loc>' + new URL(p, site).href + '</loc></url>').join("") + "</urlset>\n");
}
await writeFile(resolve(dist, "robots.txt"), "User-agent: *\nAllow: /\n" + (base ? "Sitemap: " + base + "/sitemap.xml\n" : ""));
await copyFile(resolve(dist, "index.html"), resolve(dist, "404.html"));

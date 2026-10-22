import { mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
const dist = resolve("dist");
await mkdir(dist, { recursive: true });
// Private preview: never generate a public sitemap or indexable robots directive.
await rm(resolve(dist, "sitemap.xml"), {force: true});
await writeFile(resolve(dist, "robots.txt"), "User-agent: *\nDisallow: /\n");
await copyFile(resolve(dist, "index.html"), resolve(dist, "404.html"));

import { randomBytes, pbkdf2Sync } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const password = process.env.WEBSITE_PASSWORD;
if (!password || password.length < 12) {
  throw new Error("WEBSITE_PASSWORD fehlt oder ist kürzer als 12 Zeichen. Ohne Passwort wird kein Build erstellt.");
}
const iterations = 310_000;
const salt = randomBytes(16);
const verifier = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
const payload = {
  version: 1,
  scheme: "pbkdf2-sha256",
  iterations,
  salt: salt.toString("hex"),
  verifier,
};
await mkdir(resolve("public"), {recursive: true});
await writeFile(resolve("public/access-config.json"), JSON.stringify(payload));
console.log("Preview verifier generated for this build (password is not embedded).");

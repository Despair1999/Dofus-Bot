import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Windows JDK 17 can bind AF_UNIX but fail on connect. An intentionally absent socket directory
// makes OpenJDK's documented PipeImpl.createListener fallback use ordinary TCP loopback.
const missing = resolve(".data", "absent-java-unix-sockets");
if (existsSync(missing))
  throw Error("Emulator socket fallback directory must not exist.");
const env = { ...process.env };
if (process.platform === "win32")
  env.JAVA_TOOL_OPTIONS =
    `${env.JAVA_TOOL_OPTIONS ?? ""} -Djava.net.preferIPv4Stack=true -Djdk.net.unixdomain.tmpdir=${missing.includes(" ") ? '"' + missing + '"' : missing}`.trim();
const command = process.platform === "win32" ? "firebase.cmd" : "firebase";
const args = [
  "emulators:exec",
  "--only",
  "auth,firestore,storage",
  "--project",
  "demo-dofus-community",
  "pnpm exec tsx --test --test-concurrency=1 infrastructure/community/*.test.ts",
];
if (process.platform === "win32")
  args[args.length - 1] = '"' + args[args.length - 1] + '"';
const child = spawn(command, args, {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (e) => {
  console.error(e.message);
  process.exit(1);
});

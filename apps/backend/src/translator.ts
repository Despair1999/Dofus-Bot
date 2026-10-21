import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export type TranslationStatus = {
  ready: boolean;
  engine: string;
  runtimeAvailable: boolean;
  models: {
    pair: string;
    installed: boolean;
    bytes: number;
    url: string;
    version: string;
  }[];
  installing: boolean;
  progress?: { pair: string; received: number; total: number };
  error?: string;
  pivotDirections?: string[];
};
const languages = z.enum(["de", "en", "fr"]);
export const translationInput = z
  .object({
    source: languages,
    target: languages,
    text: z.string().trim().min(1).max(2000),
  })
  .refine(
    (v) => v.source !== v.target,
    "Ausgangs- und Zielsprache müssen verschieden sein.",
  );

/** One shared bounded worker, no shell, no message content in logs or persistent cache. */
export class LocalTranslator {
  private process?: ChildProcessWithoutNullStreams;
  private pending = new Map<
    string,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private state: TranslationStatus;
  private current?: Promise<unknown>;
  readonly python: string;
  readonly worker: string;
  readonly models: string;
  constructor(
    options: { python?: string; worker?: string; models?: string } = {},
  ) {
    const here = dirname(fileURLToPath(import.meta.url));
    const bundled = resolve(here, "translator");
    const repoRoot = resolve(here, "../../..");
    const development = resolve(repoRoot, ".data/translator-runtime");
    const root = existsSync(resolve(bundled, "python.exe"))
      ? bundled
      : development;
    this.python =
      options.python ??
      process.env.COMPANION_TRANSLATOR_PYTHON ??
      resolve(root, "python.exe");
    this.worker =
      options.worker ??
      (existsSync(resolve(bundled, "translator.py"))
        ? resolve(bundled, "translator.py")
        : resolve(here, "../runtime/translator.py"));
    this.models =
      options.models ??
      process.env.COMPANION_TRANSLATOR_MODELS ??
      resolve(
        process.env.DATA_DIR ?? resolve(repoRoot, ".data"),
        "translation-models",
      );
    this.state = {
      ready: false,
      engine: "Argos / CTranslate2 CPU int8",
      runtimeAvailable: existsSync(this.python) && existsSync(this.worker),
      models: [],
      installing: false,
    };
  }
  private start() {
    if (this.process) return;
    if (!this.state.runtimeAvailable)
      throw new Error(
        "Die lokale Übersetzungsruntime fehlt. Companion mit Übersetzer-Runtime installieren oder den dokumentierten Build-Setup ausführen.",
      );
    const child = spawn(this.python, ["-u", this.worker, this.models], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        PYTHONNOUSERSITE: "1",
        PYTHONPATH: resolve(dirname(this.python), "companion-deps"),
        OMP_NUM_THREADS: "2",
        MKL_NUM_THREADS: "2",
      },
    });
    this.process = child;
    // Native libraries may emit stderr. Drain it without recording chat contents.
    child.stderr.on("data", () => {});
    createInterface({ input: child.stdout }).on("line", (line) => {
      let value: {
        id: string;
        progress?: TranslationStatus["progress"];
        error?: string;
        result?: unknown;
      };
      try {
        value = JSON.parse(line);
      } catch {
        return;
      }
      const item = this.pending.get(value.id);
      if (!item) return;
      if (value.progress) {
        this.state.progress = value.progress;
        return;
      }
      clearTimeout(item.timer);
      this.pending.delete(value.id);
      if (value.error) item.reject(new Error(value.error));
      else item.resolve(value.result);
    });
    const failed = () => {
      if (this.process !== child) return;
      this.process = undefined;
      for (const item of this.pending.values()) {
        clearTimeout(item.timer);
        item.reject(
          new Error(
            "Der lokale Übersetzungsprozess wurde beendet. Er wird bei der nächsten Anfrage neu gestartet.",
          ),
        );
      }
      this.pending.clear();
    };
    child.once("error", failed);
    child.once("exit", failed);
    child.stdin.on("error", failed);
  }
  private call(op: string, payload: object = {}): Promise<unknown> {
    if (this.pending.size >= 8)
      return Promise.reject(
        new Error("Übersetzer ist ausgelastet. Bitte kurz warten."),
      );
    this.start();
    const id = randomUUID();
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(
        () => {
          this.close();
          reject(
            new Error(
              "Zeitlimit des lokalen Übersetzers überschritten. Bitte erneut versuchen.",
            ),
          );
        },
        op === "install" ? 30 * 60_000 : 90_000,
      );
      this.pending.set(id, { resolve: resolvePromise, reject, timer });
      this.process!.stdin.write(JSON.stringify({ id, op, ...payload }) + "\n");
    });
  }
  async status(): Promise<TranslationStatus> {
    if (!this.state.runtimeAvailable || this.state.installing)
      return { ...this.state };
    try {
      this.state = {
        ...this.state,
        ...((await this.call("status")) as object),
      };
    } catch (error) {
      this.state.error = (error as Error).message;
    }
    return { ...this.state };
  }
  async install() {
    if (this.state.installing) return this.state;
    this.state = {
      ...this.state,
      installing: true,
      error: undefined,
      progress: undefined,
    };
    this.current = Promise.resolve()
      .then(() => this.call("install"))
      .then((value) => {
        this.state = { ...this.state, ...(value as object), error: undefined };
      })
      .catch((error: Error) => {
        this.state.error = error.message;
      })
      .finally(() => {
        this.state.installing = false;
        this.current = undefined;
      });
    return this.state;
  }
  async translate(input: z.infer<typeof translationInput>) {
    if (this.state.installing)
      throw new Error("Die Sprachmodelle werden installiert. Bitte warten.");
    return this.call("translate", translationInput.parse(input));
  }
  close() {
    const child = this.process;
    this.process = undefined;
    child?.kill();
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error("Übersetzer beendet."));
    }
    this.pending.clear();
  }
}

export async function registerTranslator(
  app: FastifyInstance,
  translator = new LocalTranslator(),
) {
  app.get("/api/translator/status", async () => ({
    data: await translator.status(),
  }));
  app.post("/api/translator/install", async () => ({
    data: await translator.install(),
  }));
  app.post("/api/translator/translate", async (request, reply) => {
    const input = translationInput.parse(request.body);
    try {
      return { data: await translator.translate(input) };
    } catch (error) {
      return reply.code(503).send({ error: (error as Error).message });
    }
  });
  app.addHook("onClose", async () => translator.close());
}

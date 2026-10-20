import {
  optimizeBuild,
  type BuildInput,
  type BuilderItem,
  type BuilderSet,
  type OptimizeOptions,
} from "@dofus/core";
self.onmessage = (
  event: MessageEvent<{
    build: BuildInput;
    items: BuilderItem[];
    sets: BuilderSet[];
    options: OptimizeOptions;
  }>,
) => {
  try {
    const { build, items, sets, options } = event.data;
    const result = optimizeBuild(build, items, sets, options, (progress) =>
      postMessage({ progress }),
    );
    postMessage({ result });
  } catch (e) {
    postMessage({ error: String(e) });
  }
};

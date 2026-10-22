import test from "node:test";
import assert from "node:assert/strict";
import { clusterGatheringNodes, type GatheringNode } from "../src/world.js";
test("resource zoom clustering never mutates map identity or world coordinates", () => {
  const nodes = [
    { id: "a", mapId: 100, resourceId: 5, x: 7, y: -5 },
    { id: "b", mapId: 101, resourceId: 5, x: 8, y: -5 },
  ] as GatheringNode[];
  const before = JSON.stringify(nodes);
  for (const scale of [3, 10, 20, 100]) {
    const groups = clusterGatheringNodes(
      nodes,
      { x: 7, y: -5, scale },
      800,
      600,
      1,
      true,
    );
    assert.equal(groups.flatMap((g) => g.nodes).length, 2);
    const group = groups.find((g) => g.nodes.some((n) => n.id === "a"))!;
    assert.equal(group.x, 400);
    assert.equal(group.y, 300);
  }
  assert.equal(JSON.stringify(nodes), before);
  assert.equal(
    clusterGatheringNodes(nodes, { x: 7, y: -5, scale: 3 }, 800, 600, 1, false)
      .length,
    2,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  shortestMapPath,
  planMapTour,
  estimateFarmValue,
  type WorldTransition,
} from "../src/world.js";
const edges: WorldTransition[] = [
  { from: 1, to: 2, cost: 8, direction: "right", source: "test" },
  { from: 1, to: 3, cost: 1, direction: "bottom", source: "test" },
  { from: 3, to: 2, cost: 1, direction: "top", source: "test" },
  { from: 2, to: 1, cost: 2, direction: "left", source: "test" },
];
test("Dijkstra prefers the cheaper path across explicit directed transitions", () => {
  assert.deepEqual(shortestMapPath(edges, 1, 2)?.mapIds, [1, 3, 2]);
  assert.equal(shortestMapPath(edges, 2, 3)?.cost, 3);
  assert.equal(shortestMapPath(edges, 1, 99), null);
  assert.equal(shortestMapPath(edges, 1, 2, new Set([3]))?.cost, 8);
  assert.equal(shortestMapPath(edges, 1, 2, new Set([1])), null);
});
test("Tour closes a directed round trip and exposes unreachable targets", () => {
  const route = planMapTour(edges, 1, [2, 99], true);
  assert.deepEqual(route.mapIds, [1, 3, 2, 1]);
  assert.deepEqual(route.unreachableMapIds, [99]);
  assert.equal(route.complete, false);
  assert.equal(route.steps, 3);
});
test("A missing return edge is never invented", () => {
  const route = planMapTour(edges.slice(0, 3), 1, [2], true);
  assert.deepEqual(route.mapIds, [1, 3, 2]);
  assert.deepEqual(route.unreachableMapIds, [1]);
});
test("Farm values retain user assumptions and unknown prices", () => {
  const input = {
    nodeCount: 10,
    yieldPerNode: 3,
    availableFraction: 0.5,
    gatherSeconds: 6,
    transitionSeconds: 10,
    transitions: 3,
    unitPrice: null,
  };
  const estimate = estimateFarmValue(input);
  assert.equal(estimate.quantity, 15);
  assert.equal(estimate.seconds, 60);
  assert.equal(estimate.kamasPerHour, null);
  assert.equal(
    estimateFarmValue({ ...input, unitPrice: 2 }).kamasPerHour,
    1800,
  );
  assert.throws(() => estimateFarmValue({ ...input, availableFraction: 1.2 }));
});

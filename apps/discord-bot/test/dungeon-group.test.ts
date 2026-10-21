import test from "node:test";
import assert from "node:assert/strict";
import { dungeonGroupModal } from "../src/dungeon-group.js";
test("dungeon group modal binds stable dungeon/version and limits player input", () => {
  const modal = dungeonGroupModal(87, "3.7.12.12").toJSON();
  assert.equal(modal.custom_id, "intel-group:87:3.7.12.12");
  assert.equal(modal.components.length, 2);
  assert.throws(() => dungeonGroupModal(-1, "3.7.12.12"));
  assert.throws(() => dungeonGroupModal(87, "3.99.1.1"));
});

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { patchNotes } from "./changelog";
test("manually curated patchnotes are unique, complete and descending",()=>{
  assert.ok(patchNotes.length>=8);
  assert.equal(new Set(patchNotes.map(x=>x.version)).size,patchNotes.length);
  const nums=patchNotes.map(x=>Number(x.version.replace(/\D/g,"").padEnd(4,"0")));
  assert.deepEqual(nums,[...nums].sort((a,b)=>b-a));
  assert.equal(patchNotes[0].version,"v0.8.0");
  assert.ok(patchNotes.every(x=>x.date && x.title && x.groups.every(g=>g.entries.length && g.entries.every(Boolean))));
  assert.ok(patchNotes.every(x=>!JSON.stringify(x).includes("http")));
});

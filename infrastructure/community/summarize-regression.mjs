import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const latest = new Map();
function visit(suite) {
  for (const spec of suite.specs ?? [])
    latest.set(`${spec.file}:${spec.title}`, {
      file: spec.file,
      title: spec.title,
      passed: spec.tests.every(
        (t) =>
          t.status === "expected" &&
          t.results.some((r) => r.status === "passed"),
      ),
    });
  for (const child of suite.suites ?? []) visit(child);
}
const inputs = process.argv.slice(2);
for (const path of inputs.length
  ? inputs
  : [".data/community-regression-initial.json", "test-results/e2e.json"]) {
  const report = JSON.parse(readFileSync(path, "utf8"));
  for (const suite of report.suites) visit(suite);
}
const tests = [...latest.values()],
  failed = tests.filter((t) => !t.passed).length;
const report = {
  checkedAt: new Date().toISOString(),
  total: tests.length,
  failed,
  passed: tests.length === 54 && failed === 0,
  method:
    "Complete 54-test run plus explicitly supplied targeted rerun reports; each file/title is counted once using its latest result.",
  inputs,
  tests,
};
writeFileSync(
  "test-results/community-regression-summary.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({ total: report.total, failed, passed: report.passed }),
);
assert.ok(report.passed);

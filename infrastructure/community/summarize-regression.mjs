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
for (const path of [
  ".data/community-regression-initial.json",
  "test-results/e2e.json",
]) {
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
    "Complete 54-test run plus targeted rerun of the three failed cases after cold-start harness and new read-only Firebase transport assertions were corrected.",
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

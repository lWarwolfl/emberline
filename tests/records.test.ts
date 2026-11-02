import test from "node:test";
import assert from "node:assert/strict";
import Records from "../src/records";

test("record feedback fires once per round after exceeding the stored best", () => {
  const tracker = Records.create(9007199254740993n);
  assert.equal(tracker.check(9007199254740993n), false);
  assert.equal(tracker.check(9007199254740994n), true);
  assert.equal(tracker.check(999999999999999999n), false);
  tracker.reset(100n);
  assert.equal(tracker.check(100n), false);
  assert.equal(tracker.check(101n), true);
  tracker.reset(0n);
  assert.equal(tracker.check(1n), false);
});

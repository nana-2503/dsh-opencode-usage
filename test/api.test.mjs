/**
 * The wire normalizer: every field the Host sends must survive the trip into
 * the browser snapshot (a dropped field renders as "nothing happened").
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSnapshot } from "../src/client/api.ts";

/** A full Host answer. */
const WIRE = {
  configured: true,
  orgId: "org_test",
  keyHint: "YNTi",
  usage: {
    rolling: { percent: 4, limited: false, resetsAt: 1_800_000_000_000 },
    weekly: { percent: 5, limited: false },
    monthly: { percent: 2, limited: true },
  },
  summary: {
    from: "2026-11-03",
    to: "2026-12-03",
    requests: 1311,
    input: 3_204_766,
    output: 732_545,
    cacheRead: 266_197_460,
    cacheWrite: 0,
    total: 270_134_771,
  },
  fetchedAt: 1_800_000_000_000,
};

test("every field of a full answer survives", () => {
  const snapshot = parseSnapshot(WIRE);
  assert.equal(snapshot.status, "ready");
  assert.equal(snapshot.configured, true);
  assert.equal(snapshot.keyHint, "YNTi");
  assert.equal(snapshot.usage.rolling.percent, 4);
  assert.equal(snapshot.usage.monthly.limited, true);
  assert.equal(snapshot.summary.total, 270_134_771);
  assert.equal(snapshot.summary.input, 3_204_766);
  assert.equal(snapshot.summary.from, "2026-11-03");
  assert.equal(snapshot.fetchedAt, 1_800_000_000_000);
});

test("usage percentages are clamped and unknown windows dropped", () => {
  const snapshot = parseSnapshot({ configured: true, keyHint: "", usage: { rolling: { percent: 140 }, daily: { percent: 3 } } });
  assert.equal(snapshot.usage.rolling.percent, 100);
  assert.equal(snapshot.usage.daily, undefined);
});

test("a malformed summary is ignored wholesale", () => {
  assert.equal(parseSnapshot({ configured: true, keyHint: "", summary: { from: "x" } }).summary, undefined);
  assert.equal(parseSnapshot({ configured: true, keyHint: "", summary: "nope" }).summary, undefined);
});

test("a failure answer keeps its code and marks the snapshot as an error", () => {
  const snapshot = parseSnapshot({ configured: true, keyHint: "1234", error: { code: "unauthorized" } });
  assert.equal(snapshot.status, "error");
  assert.equal(snapshot.error.code, "unauthorized");
  assert.equal(snapshot.usage, undefined);
});

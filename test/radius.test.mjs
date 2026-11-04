/**
 * The global corner-radius scale: clamping and token projection.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_BASE,
  MAX_BASE,
  MIN_BASE,
  RADIUS_SCALE,
  clampBase,
  radiusTokens,
} from "../src/client/radius.ts";

test("clampBase keeps values inside the range and rounds to whole pixels", () => {
  assert.equal(clampBase(16), 16);
  assert.equal(clampBase("18"), 18);
  assert.equal(clampBase(18.4), 18);
  assert.equal(clampBase(-5), MIN_BASE);
  assert.equal(clampBase(99), MAX_BASE);
  assert.equal(clampBase(Number.NaN), DEFAULT_BASE);
  assert.equal(clampBase(undefined), DEFAULT_BASE);
});

test("the default base reproduces the shipped radius scale", () => {
  const tokens = radiusTokens(DEFAULT_BASE);
  assert.equal(tokens["--dsw-radius-xs"].light, "4px");
  assert.equal(tokens["--dsw-radius-sm"].light, "8px");
  assert.equal(tokens["--dsw-radius-md"].light, "12px");
  assert.equal(tokens["--dsw-radius-lg"].light, "16px");
  assert.equal(tokens["--dsw-radius-xl"].light, "20px");
  assert.equal(tokens["--dsw-radius-panel"].light, "28px");
});

test("every token follows the base proportionally in both schemes", () => {
  const tokens = radiusTokens(8);
  assert.equal(tokens["--dsw-radius-lg"].light, "8px");
  assert.equal(tokens["--dsw-radius-panel"].light, "14px");
  assert.deepEqual(tokens["--dsw-radius-panel"].light, tokens["--dsw-radius-panel"].dark);
  assert.equal(Object.keys(tokens).length, RADIUS_SCALE.length);
});

test("a zero base flattens every corner without going negative", () => {
  const tokens = radiusTokens(0);
  for (const [, value] of Object.entries(tokens)) {
    assert.equal(value.light, "0px");
  }
});

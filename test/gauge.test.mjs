/**
 * Pure allowance math: percentages, gauge tiers, the pill's window pick, and
 * the reset countdown. No DOM and no React, so this runs under plain `node`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  colorOf,
  formatInstant,
  mostConstrained,
  remainingPercent,
  resetCountdown,
  toneOf,
  usedPercent,
} from "../src/client/gauge.ts";

/** Minimal translate stub that exposes the key and its parameters. */
const t = (key, params) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`);

/** Meter helper. */
const meter = (percent, extra = {}) => ({ percent, limited: false, ...extra });

test("usedPercent rounds and clamps to 0-100", () => {
  assert.equal(usedPercent(meter(3.4)), 3);
  assert.equal(usedPercent(meter(3.6)), 4);
  assert.equal(usedPercent(meter(-5)), 0);
  assert.equal(usedPercent(meter(140)), 100);
});

test("remainingPercent is the complement of the used share", () => {
  assert.equal(remainingPercent(meter(0)), 100);
  assert.equal(remainingPercent(meter(3)), 97);
  assert.equal(remainingPercent(meter(100)), 0);
});

test("toneOf follows the remaining allowance, including both boundaries", () => {
  assert.equal(toneOf(meter(0)), "green");
  assert.equal(toneOf(meter(30)), "green"); // 70% left
  assert.equal(toneOf(meter(31)), "blue"); // 69% left
  assert.equal(toneOf(meter(50)), "blue"); // 50% left
  assert.equal(toneOf(meter(51)), "yellow"); // 49% left
  assert.equal(toneOf(meter(80)), "yellow"); // 20% left
  assert.equal(toneOf(meter(81)), "red"); // 19% left
  assert.equal(toneOf(meter(100)), "red");
});

test("a rate-limited window is red whatever its percentage", () => {
  assert.equal(toneOf(meter(10, { limited: true })), "red");
});

test("colorOf maps a tone onto its stylesheet variable", () => {
  assert.equal(colorOf("green"), "var(--ou-bar-green)");
  assert.equal(colorOf("red"), "var(--ou-bar-red)");
});

test("mostConstrained reports the window with the least left", () => {
  // monthly is 40% used, so it has the least allowance left even though the
  // rolling window is the one that changes fastest.
  const usage = {
    rolling: meter(1),
    weekly: meter(2),
    monthly: meter(40),
  };
  assert.equal(mostConstrained(usage)?.key, "monthly");
  assert.equal(mostConstrained(usage)?.short, "pill.short.monthly");
});

test("mostConstrained tolerates missing windows and an absent usage", () => {
  assert.equal(mostConstrained(undefined), undefined);
  assert.equal(mostConstrained({})?.key, undefined);
  assert.equal(mostConstrained({ weekly: meter(40) })?.key, "weekly");
});

test("resetCountdown phrases the remaining time in minutes, hours, then days", () => {
  const now = 1_800_000_000_000;
  assert.equal(resetCountdown(now + 30_000, t, now), "reset.soon");
  assert.equal(resetCountdown(now + 43 * 60_000, t, now), 'reset.minutes:{"count":43}');
  assert.equal(resetCountdown(now + 4 * 3_600_000, t, now), 'reset.hours:{"count":4}');
  assert.equal(resetCountdown(now + 3 * 86_400_000, t, now), 'reset.days:{"count":3}');
});

test("resetCountdown falls back when the window carries no reset", () => {
  assert.equal(resetCountdown(undefined, t), "overlay.noReset");
});

test("formatInstant renders a readable instant and tolerates absence", () => {
  assert.equal(formatInstant(undefined), undefined);
  const text = formatInstant(1_800_000_000_000);
  assert.equal(typeof text, "string");
  assert.ok((text ?? "").length > 0);
});

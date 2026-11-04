/**
 * Pure allowance math and wording, with no React or DOM dependency.
 *
 * The meter reads as *remaining* allowance: the bar fills with what is left,
 * the accent starts at the host's business colour, and only a nearly exhausted
 * window turns amber or red. Everything here is a pure function of a meter and
 * a clock, so it is unit-tested directly by `test/gauge.test.mjs`.
 * @module opencode-usage/client/gauge
 */

/** Window keys the Console allowance endpoint reports, in display order. */
export type WindowKey = "rolling" | "weekly" | "monthly";

/** One allowance window. `percent` is the share already consumed (0–100). */
export interface Meter {
  percent: number;
  limited: boolean;
  resetsAt?: number;
}

/** Allowance per window; a window missing upstream is simply absent. */
export type Usage = Partial<Record<WindowKey, Meter>>;

/** Translate function handed to slot entries through the `locale` option. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Display order, long label, and pill label dictionary key of each window. */
export const WINDOWS: ReadonlyArray<{ key: WindowKey; label: string; short: string }> = [
  { key: "rolling", label: "pill.window.rolling", short: "pill.short.rolling" },
  { key: "weekly", label: "pill.window.weekly", short: "pill.short.weekly" },
  { key: "monthly", label: "pill.window.monthly", short: "pill.short.monthly" },
];

/** Share of a window already consumed, rounded for display. */
export const usedPercent = (meter: Meter): number => Math.min(100, Math.max(0, Math.round(meter.percent)));

/** Share of a window still available. */
export const remainingPercent = (meter: Meter): number => 100 - usedPercent(meter);

/**
 * Gauge tier, read from the remaining share: green from 70% left, blue from
 * 50%, yellow from 20%, and red below that (or as soon as the allowance is
 * spent or the upstream reports the window rate-limited).
 */
export type Tone = "green" | "blue" | "yellow" | "red";

/** Tier of one window, from how much allowance is still available. */
export function toneOf(meter: Meter): Tone {
  if (meter.limited || meter.percent >= 100) return "red";
  const remaining = remainingPercent(meter);
  if (remaining >= 70) return "green";
  if (remaining >= 50) return "blue";
  if (remaining >= 20) return "yellow";
  return "red";
}

/** CSS colour a tone paints the bar and the status dot. */
export function colorOf(tone: Tone): string {
  return `var(--ou-bar-${tone})`;
}

/** The window with the least allowance left, which the collapsed pill reports. */
export function mostConstrained(usage: Usage | undefined): { key: WindowKey; label: string; short: string; meter: Meter } | undefined {
  if (usage === undefined) return undefined;
  let best: { key: WindowKey; label: string; short: string; meter: Meter } | undefined;
  for (const window of WINDOWS) {
    const meter = usage[window.key];
    if (meter === undefined) continue;
    if (best === undefined || remainingPercent(meter) < remainingPercent(best.meter)) {
      best = { key: window.key, label: window.label, short: window.short, meter };
    }
  }
  return best;
}

/**
 * Format one instant for a tooltip. Same-day instants show only the clock time;
 * later instants also carry the date. The viewer's locale decides the shape.
 * @param at - epoch milliseconds, when known.
 * @returns the formatted instant, or undefined without one.
 */
export function formatInstant(at: number | undefined): string | undefined {
  if (at === undefined || !Number.isFinite(at)) return undefined;
  const date = new Date(at);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  try {
    return new Intl.DateTimeFormat(undefined, sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(sameDay ? 11 : 5, 16);
  }
}

/** Minute, hour, and day thresholds used by {@link resetCountdown}. */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Say how long is left before a window resets, the way the Console does
 * ("resets in 43m"), rather than a wall-clock instant that needs arithmetic.
 * @param resetsAt - epoch milliseconds of the reset, when known.
 * @param t - namespace-bound translate.
 * @param now - current epoch milliseconds; injectable for tests.
 * @returns a localized phrase such as "43 分钟后重置".
 */
export function resetCountdown(resetsAt: number | undefined, t: Translate, now: number = Date.now()): string {
  if (resetsAt === undefined || !Number.isFinite(resetsAt)) return t("overlay.noReset");
  const left = resetsAt - now;
  if (left <= MINUTE) return t("reset.soon");
  if (left < HOUR) return t("reset.minutes", { count: Math.ceil(left / MINUTE) });
  if (left < DAY) return t("reset.hours", { count: Math.round(left / HOUR) });
  return t("reset.days", { count: Math.floor(left / DAY) });
}

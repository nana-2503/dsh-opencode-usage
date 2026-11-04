/**
 * Global corner-radius preference: the shared `--dsw-radius-*` scale expressed
 * as multiples of one base value, so a single control rescales every surface
 * built on it. Pure math only, so `test/radius.test.mjs` can check it directly.
 * @module opencode-usage/client/radius
 */

/** Override-layer identity handed to `ctx.theme.overrideTokens`. */
export const RADIUS_SOURCE = "@nana-2503/dsh-opencode-usage/radius";

/** Base radius matching the shipped `--dsw-radius-lg` (16px). */
export const DEFAULT_BASE = 16;

/** Accepted base-radius range, in px. */
export const MIN_BASE = 0;
export const MAX_BASE = 24;

/**
 * The shipped radius scale as multiples of the base: 4/8/12/16/20/28 px at the
 * default base of 16.
 */
export const RADIUS_SCALE: ReadonlyArray<readonly [string, number]> = [
  ["--dsw-radius-xs", 0.25],
  ["--dsw-radius-sm", 0.5],
  ["--dsw-radius-md", 0.75],
  ["--dsw-radius-lg", 1],
  ["--dsw-radius-xl", 1.25],
  ["--dsw-radius-panel", 1.75],
];

/**
 * Clamp one candidate base radius to an accepted whole number of pixels.
 * @param value - whatever the callers (or storage) supplied.
 * @returns an integer within {@link MIN_BASE}..{@link MAX_BASE}.
 */
export function clampBase(value: unknown): number {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return DEFAULT_BASE;
  return Math.min(MAX_BASE, Math.max(MIN_BASE, rounded));
}

/**
 * Project one base radius onto the token override layer.
 * @param base - base radius in px.
 * @returns every radius token, in both colour schemes.
 */
export function radiusTokens(base: number): Record<string, { light: string; dark: string }> {
  const tokens: Record<string, { light: string; dark: string }> = {};
  for (const [name, factor] of RADIUS_SCALE) {
    const px = `${Math.max(0, Math.round(base * factor))}px`;
    tokens[name] = { light: px, dark: px };
  }
  return tokens;
}

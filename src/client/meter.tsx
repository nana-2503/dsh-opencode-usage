/**
 * Presentation shared by the floating widget and the settings page: window
 * ordering, the "most constrained window" pick, reset-time wording, and the
 * one shadcn/Base UI meter row.
 *
 * The meter reads as *remaining* allowance: the bar fills with what is left,
 * the accent is the host's own primary colour, and only a nearly exhausted
 * window turns amber or red.
 * @module opencode-usage/client/meter
 */
import type { CSSProperties } from "react";
import { cn } from "cn";
import { Progress } from "@/components/ui/progress";
import type { Meter, Usage, WindowKey } from "./locale";

/** Display order and dictionary key of each allowance window. */
export const WINDOWS: ReadonlyArray<{ key: WindowKey; label: string; short: string }> = [
  { key: "rolling", label: "pill.window.rolling", short: "pill.short.rolling" },
  { key: "weekly", label: "pill.window.weekly", short: "pill.short.weekly" },
  { key: "monthly", label: "pill.window.monthly", short: "pill.short.monthly" },
];

/** Translate function handed to slot entries through the `locale` option. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Share of a window already consumed, rounded for display. */
export const usedPercent = (meter: Meter): number => Math.round(meter.percent);

/** Share of a window still available. */
export const remainingPercent = (meter: Meter): number => Math.max(0, 100 - usedPercent(meter));

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
 * Format one reset instant. Same-day instants show only the clock time; later
 * instants also carry the date. The viewer's locale decides the exact shape.
 * @param resetsAt - epoch milliseconds, when known.
 * @returns the formatted instant, or undefined without one.
 */
export function formatReset(resetsAt: number | undefined): string | undefined {
  if (resetsAt === undefined || !Number.isFinite(resetsAt)) return undefined;
  const at = new Date(resetsAt);
  const now = new Date();
  const sameDay = at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
  try {
    return new Intl.DateTimeFormat(undefined, sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(sameDay ? 11 : 5, 16);
  }
}

/** Wall-clock label for "when this snapshot was read". */
export function formatUpdated(fetchedAt: number | undefined): string | undefined {
  return formatReset(fetchedAt);
}

/**
 * One allowance row: window name, remaining share, a Base UI progress bar for
 * the remaining share, and the reset instant with the consumed share.
 */
export function MeterRow({ label, meter, t }: { label: string; meter: Meter; t: Translate }) {
  const used = usedPercent(meter);
  const tone = toneOf(meter);
  const color = colorOf(tone);
  const reset = formatReset(meter.resetsAt);
  const urgent = tone === "yellow" || tone === "red";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-xs font-semibold text-foreground">{label}</span>
          <span className="truncate text-[11px] text-muted-foreground">
            {reset === undefined ? t("overlay.noReset") : t("overlay.resetAt", { time: reset })}
          </span>
        </div>
        <span
          className="shrink-0 text-xs font-medium tabular-nums text-foreground"
          style={urgent ? { color } : undefined}
        >
          {meter.limited ? t("overlay.limited") : t("overlay.used", { percent: used })}
        </span>
      </div>
      <Progress
        value={used}
        aria-label={label}
        indicatorClassName={cn("ou-gauge-fill rounded-[2px]", used === 0 && "hidden")}
        trailing={used >= 100 ? null : (
          <div
            data-slot="progress-remainder"
            className="ou-gauge-rest h-full min-w-0 flex-1 rounded-[2px]"
          />
        )}
        className={cn(
          "gap-0 [&_[data-slot=progress-indicator]]:shrink-0 [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-transparent",
          used === 0 || used >= 100 ? "[&_[data-slot=progress-track]]:gap-0" : "[&_[data-slot=progress-track]]:gap-[3px]",
        )}
        style={{ "--ou-tone": color } as CSSProperties}
      />
    </div>
  );
}

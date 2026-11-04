/**
 * The one allowance row: window name, reset countdown, consumed share, and the
 * segmented gauge itself (fill + break + remaining segment), built on the
 * shadcn/Base UI progress primitive. All math lives in `gauge.ts`.
 * @module opencode-usage/client/meter
 */
import type { CSSProperties } from "react";
import avatar from "../../assets/avatar.png";
import { cn } from "cn";
import { Progress } from "@/components/ui/progress";
import {
  colorOf,
  formatCount,
  formatInstant,
  formatTokens,
  resetCountdown,
  toneOf,
  usedPercent,
  type Meter,
  type TokenSummary,
  type Translate,
} from "./gauge";

/**
 * One allowance row: window name, remaining-time caption, a Base UI gauge for
 * the consumed share, and the percentage on the right.
 */
export function MeterRow({ label, meter, t }: { label: string; meter: Meter; t: Translate }) {
  const used = usedPercent(meter);
  const tone = toneOf(meter);
  const color = colorOf(tone);
  const urgent = tone === "yellow" || tone === "red";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-xs font-semibold text-foreground">{label}</span>
          <span
            className="truncate text-[11px] text-muted-foreground"
            title={formatInstant(meter.resetsAt)}
          >
            {resetCountdown(meter.resetsAt, t)}
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
          "gap-0 [&_[data-slot=progress-indicator]]:shrink-0 [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:rounded-[2px] [&_[data-slot=progress-track]]:bg-transparent",
          used === 0 || used >= 100 ? "[&_[data-slot=progress-track]]:gap-0" : "[&_[data-slot=progress-track]]:gap-[3px]",
        )}
        style={{ "--ou-tone": color } as CSSProperties}
      />
    </div>
  );
}

/** The billing period's request count and token split, one wrapping line. */
export function PeriodTokens({ summary, t }: { summary: TokenSummary; t: Translate }) {
  return (
    <p
      className="text-[11px] leading-relaxed text-muted-foreground"
      title={t("usage.period", { from: summary.from, to: summary.to })}
    >
      {t("usage.stats", {
        requests: formatCount(summary.requests),
        input: formatTokens(summary.input),
        output: formatTokens(summary.output),
        cache: formatTokens(summary.cacheRead),
      })}
    </p>
  );
}

/**
 * The brand avatar shown where the status dot used to sit. The dot encoded the
 * most constrained window's tone, so the avatar keeps a 1.5px ring in that
 * colour; the artwork itself stays untouched.
 */
export function BrandAvatar({ color }: { color: string }) {
  return (
    <img
      src={avatar}
      alt=""
      aria-hidden
      draggable={false}
      className="size-4 shrink-0 rounded-full object-cover"
      style={{ boxShadow: `0 0 0 1.5px ${color}` }}
    />
  );
}

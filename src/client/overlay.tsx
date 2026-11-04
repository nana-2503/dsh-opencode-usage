/**
 * The floating widget. A collapsed pill reports the window with the least
 * allowance left; expanding it shows every window, its reset instant, and a
 * refresh action. It lives in `shell.overlay`, the frame-wide layer above the
 * columns, so it survives panel navigation.
 *
 * Surfaces use the host's raised-layer token, so the card is white in the light
 * theme and near-black in the dark one instead of carrying its own palette.
 * @module opencode-usage/client/overlay
 */
import { useState, useSyncExternalStore } from "react";
import { ChevronDown, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { failureText } from "./messages";
import {
  MeterRow,
  WINDOWS,
  colorOf,
  formatUpdated,
  mostConstrained,
  remainingPercent,
  toneOf,
  type Translate,
} from "./meter";
import { useOverlayVisible } from "./prefs";
import { usageStore } from "./store";
import type { Snapshot } from "./locale";

/** Props the slot injects beside the locale-bound `t`. */
interface OverlayProps {
  t: Translate;
  openSettings: () => void;
}

/** The pill's status dot, tinted by the most constrained window. */
function StatusDot({ color }: { color: string }) {
  return <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}

/** A short status line for the collapsed pill. */
function pillStatus(
  t: Translate,
  snapshot: Snapshot,
  worst: ReturnType<typeof mostConstrained>,
): string {
  if (!snapshot.configured) return t("pill.setup");
  if (snapshot.error !== undefined) return t("overlay.error");
  if (worst === undefined) return t("overlay.loading");
  if (worst.meter.limited) return t("overlay.limited");
  return t("pill.compact", { window: t(worst.short), percent: remainingPercent(worst.meter) });
}

/**
 * Render the pill, or the expanded card, in the bottom-right corner.
 */
export function UsageOverlay({ t, openSettings }: OverlayProps) {
  const visible = useOverlayVisible();
  const snapshot = useSyncExternalStore(usageStore.subscribe, usageStore.getSnapshot);
  const [open, setOpen] = useState(false);
  if (!visible) return null;

  const worst = mostConstrained(snapshot.usage);
  const color = worst === undefined ? "var(--ou-muted-bar)" : colorOf(toneOf(worst.meter));

  if (!open) {
    return (
      <div className="ou-root pointer-events-none absolute inset-0 z-30 flex items-end justify-end p-3">
        <button
          type="button"
          onClick={() => (snapshot.configured ? setOpen(true) : openSettings())}
          title={snapshot.configured ? t("overlay.expand") : t("pill.setup")}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-card py-1.5 pr-3 pl-2.5 text-xs text-card-foreground shadow-lg ring-1 ring-border transition-colors hover:bg-accent"
        >
          <StatusDot color={color} />
          <span className="font-medium">{t("pill.label")}</span>
          <span className="text-muted-foreground">{pillStatus(t, snapshot, worst)}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="ou-root pointer-events-none absolute inset-0 z-30 flex items-end justify-end p-3">
      <Card size="sm" className="pointer-events-auto w-[19.5rem] gap-3 shadow-xl">
        <div className="flex items-center justify-between gap-2 px-(--card-spacing)">
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot color={color} />
            <span className="truncate text-sm font-medium">{t("pill.label")}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("overlay.refresh")}
              title={t("overlay.refresh")}
              disabled={!snapshot.configured}
              onClick={() => {
                void usageStore.load(true);
              }}
            >
              <RefreshCw className={snapshot.busy ? "animate-spin" : undefined} />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("overlay.collapse")}
              title={t("overlay.collapse")}
              onClick={() => {
                setOpen(false);
              }}
            >
              <ChevronDown />
            </Button>
          </div>
        </div>

        <CardContent className="flex flex-col gap-3.5">
          {!snapshot.configured ? (
            <div className="flex flex-col items-start gap-2.5 rounded-lg bg-muted p-3">
              <p className="text-xs leading-relaxed text-muted-foreground">{t("overlay.empty")}</p>
              <Button size="sm" onClick={openSettings}>
                <Settings2 data-icon="inline-start" />
                {t("settings.key")}
              </Button>
            </div>
          ) : snapshot.usage === undefined ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {snapshot.error === undefined ? t("overlay.loading") : failureText(t, snapshot.error)}
            </p>
          ) : (
            WINDOWS.map((window) => {
              const meter = snapshot.usage?.[window.key];
              return meter === undefined
                ? null
                : <MeterRow key={window.key} label={t(window.label)} meter={meter} t={t} />;
            })
          )}
        </CardContent>

        <CardFooter className="justify-between gap-2 border-border text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            {formatUpdated(snapshot.fetchedAt) === undefined
              ? t("overlay.never")
              : t("overlay.updated", { time: formatUpdated(snapshot.fetchedAt) as string })}
          </span>
          <Button size="xs" variant="ghost" onClick={openSettings}>
            <Settings2 data-icon="inline-start" />
            {t("overlay.settings")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

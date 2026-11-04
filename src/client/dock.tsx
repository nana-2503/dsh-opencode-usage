/**
 * The compact strip that sits above the composer card when the widget is placed
 * there (`conversation.input.dock`). It shows all three windows on one line and
 * keeps the same actions as the floating card, so the overlay can stay hidden.
 * @module opencode-usage/client/dock
 */
import { useSyncExternalStore } from "react";
import { RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { failureText } from "./messages";
import {
  WINDOWS,
  colorOf,
  mostConstrained,
  remainingPercent,
  toneOf,
  type Translate,
} from "./gauge";
import { useWidgetMode } from "./prefs";
import { usageStore } from "./store";

/** Props the slot injects beside the locale-bound `t`. */
interface DockProps {
  t: Translate;
  openSettings: () => void;
}

/**
 * Render the one-line allowance strip above the composer.
 */
export function UsageDock({ t, openSettings }: DockProps) {
  const mode = useWidgetMode();
  const snapshot = useSyncExternalStore(usageStore.subscribe, usageStore.getSnapshot);
  if (mode !== "dock") return null;

  const worst = mostConstrained(snapshot.usage);
  const color = worst === undefined ? "var(--ou-muted-bar)" : colorOf(toneOf(worst.meter));

  return (
    <div className="ou-root w-full">
      <div className="flex items-center gap-3 rounded-lg bg-card/60 px-2.5 py-1.5 text-xs ring-1 ring-border">
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
          <span className="font-medium text-foreground max-sm:hidden">{t("pill.label")}</span>
        </span>

        {!snapshot.configured ? (
          <button
            type="button"
            onClick={openSettings}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("pill.setup")}
          </button>
        ) : snapshot.usage === undefined ? (
          <span className="truncate text-muted-foreground">
            {snapshot.error === undefined ? t("overlay.loading") : failureText(t, snapshot.error)}
          </span>
        ) : (
          <div className="flex min-w-0 items-center gap-3 overflow-hidden">
            {WINDOWS.map((window) => {
              const meter = snapshot.usage?.[window.key];
              if (meter === undefined) return null;
              const tone = toneOf(meter);
              return (
                <span key={window.key} className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
                  <span className="text-[11px] text-muted-foreground">{t(window.label)}</span>
                  <span
                    className="font-medium tabular-nums text-foreground"
                    style={tone === "yellow" || tone === "red" ? { color: colorOf(tone) } : undefined}
                  >
                    {meter.limited ? t("overlay.limited") : `${remainingPercent(meter)}%`}
                  </span>
                </span>
              );
            })}
          </div>
        )}

        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          <Button
            size="icon-xs"
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
            size="icon-xs"
            variant="ghost"
            aria-label={t("overlay.settings")}
            title={t("overlay.settings")}
            onClick={openSettings}
          >
            <Settings2 />
          </Button>
        </span>
      </div>
    </div>
  );
}

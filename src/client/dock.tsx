/**
 * The compact strip that sits above the composer card when the widget is placed
 * there (`conversation.input.dock`). It shows all three windows on one line and
 * can expand into the same gauge rows the floating card uses, so the overlay can
 * stay hidden.
 * @module opencode-usage/client/dock
 */
import { useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandAvatar, MeterRow, PeriodTokens } from "./meter";
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
 * Render the allowance strip above the composer, collapsed or with its meters.
 */
export function UsageDock({ t, openSettings }: DockProps) {
  const mode = useWidgetMode();
  const snapshot = useSyncExternalStore(usageStore.subscribe, usageStore.getSnapshot);
  const [open, setOpen] = useState(false);
  if (mode !== "dock") return null;

  const worst = mostConstrained(snapshot.usage);
  const color = worst === undefined ? "var(--ou-muted-bar)" : colorOf(toneOf(worst.meter));
  const expandable = snapshot.configured && snapshot.usage !== undefined;

  return (
    <div className="ou-root ou-dock">
      <div className="ou-dock-card flex flex-col px-4 py-1.5 text-xs">
        <div className="flex items-center gap-3">
          <span className="flex shrink-0 items-center gap-1.5">
            <BrandAvatar color={color} />
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
            {expandable ? (
              <Button
                size="icon-xs"
                variant="ghost"
                aria-expanded={open}
                aria-label={open ? t("overlay.collapse") : t("overlay.expand")}
                title={open ? t("overlay.collapse") : t("overlay.expand")}
                onClick={() => setOpen((current) => !current)}
              >
                {open ? <ChevronDown /> : <ChevronUp />}
              </Button>
            ) : null}
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

        {open && expandable ? (
          <div className="mt-1.5 flex flex-col gap-3 border-t border-border pt-2.5 pb-1">
            {WINDOWS.map((window) => {
              const meter = snapshot.usage?.[window.key];
              return meter === undefined
                ? null
                : <MeterRow key={window.key} label={t(window.label)} meter={meter} t={t} />;
            })}
            {snapshot.summary === undefined ? null : <PeriodTokens summary={snapshot.summary} t={t} />}
          </div>
        ) : null}
      </div>
    </div>
  );
}

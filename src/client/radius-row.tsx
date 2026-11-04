/**
 * The "Corner radius" row in Settings → General: one stepper that rescales the
 * shared `--dsw-radius-*` tokens for the whole Harness UI. It lives here (rather
 * than in a separate bundle) so this plugin is the only thing to install.
 * @module opencode-usage/client/radius-row
 */
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Translate } from "./gauge";
import { DEFAULT_BASE, MAX_BASE, MIN_BASE } from "./radius";

/** Props the slot injects beside the locale-bound `t`. */
interface RadiusRowProps {
  t: Translate;
  getRadius: () => number;
  setRadius: (next: number) => void;
}

/**
 * Render the corner-radius row: title and description on the left, a stepper
 * with a px unit and a reset action on the right, matching the host's own
 * preference rows.
 */
export function CornerRadiusRow({ t, getRadius, setRadius }: RadiusRowProps) {
  const [value, setValue] = useState(getRadius);
  const update = (next: number) => {
    if (next < MIN_BASE || next > MAX_BASE || next === value) return;
    setValue(next);
    setRadius(next);
  };
  return (
    <div className="ou-root">
      <div className="flex items-center gap-3 border-b border-border py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1 pr-12">
          <span className="text-sm leading-6 text-foreground">{t("radius.title")}</span>
          <span className="text-xs leading-[18px] text-muted-foreground">{t("radius.description")}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 items-center gap-0.5 rounded-md bg-muted px-1">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label={t("radius.decrease")}
              title={t("radius.decrease")}
              disabled={value <= MIN_BASE}
              onClick={() => {
                update(value - 1);
              }}
            >
              <ChevronDown />
            </Button>
            <span className="min-w-6 text-center text-sm tabular-nums text-foreground">{value}</span>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label={t("radius.increase")}
              title={t("radius.increase")}
              disabled={value >= MAX_BASE}
              onClick={() => {
                update(value + 1);
              }}
            >
              <ChevronUp />
            </Button>
          </div>
          <span className="text-sm text-muted-foreground">{t("radius.unit")}</span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="text-muted-foreground"
            disabled={value === DEFAULT_BASE}
            onClick={() => {
              update(DEFAULT_BASE);
            }}
          >
            {t("radius.reset")}
          </Button>
        </div>
      </div>
    </div>
  );
}

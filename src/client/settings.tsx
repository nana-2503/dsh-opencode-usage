/**
 * The bundle's configuration page (rendered on its page in Settings → Plugins):
 * paste the Console key once, then read the allowance without leaving the page.
 * @module opencode-usage/client/settings
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Eye, EyeOff, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { failureText } from "./messages";
import { MeterRow } from "./meter";
import { WINDOWS, formatInstant, type Translate } from "./gauge";
import { setWidgetMode, useWidgetMode, type WidgetMode } from "./prefs";
import { usageStore } from "./store";

/** The three placements, in the order the settings page offers them. */
const MODES = ["overlay", "dock", "hidden"] as const;

/** Props the slot injects beside the locale-bound `t`. */
interface SettingsProps {
  t: Translate;
}

/**
 * Render the credential form, the current allowance, and the placement choice.
 */
export function UsageSettings({ t }: SettingsProps) {
  const snapshot = useSyncExternalStore(usageStore.subscribe, usageStore.getSnapshot);
  const mode = useWidgetMode();
  const [key, setKey] = useState("");
  const [org, setOrg] = useState("");
  const [revealed, setRevealed] = useState(false);

  /** Seed the organization field once the Host reports one. */
  useEffect(() => {
    if (snapshot.orgId !== undefined) setOrg((current) => (current.length === 0 ? (snapshot.orgId as string) : current));
  }, [snapshot.orgId]);

  const busy = snapshot.saving || snapshot.busy;
  const notice = snapshot.notice;

  return (
    <section className="ou-root flex w-full max-w-[640px] flex-col gap-4 pb-1 text-foreground">
      <Card size="sm">
        <CardContent className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden />
              <h3 className="text-sm font-semibold">{t("settings.title")}</h3>
              {snapshot.configured ? (
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {t("settings.connected", { hint: snapshot.keyHint })}
                </Badge>
              ) : (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {t("settings.notConfigured")}
                </Badge>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t("settings.description")}</p>
          </header>

          <Separator />

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (key.trim().length === 0) return;
              void usageStore.save(key.trim(), org.trim(), t).then((saved) => {
                if (saved) setKey("");
              });
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="opencode-usage-key">{t("settings.key")}</Label>
              <div className="relative">
                <Input
                  id="opencode-usage-key"
                  type={revealed ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t("settings.keyPlaceholder")}
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  className="pr-9 font-mono text-xs"
                />
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  aria-label={revealed ? "hide" : "show"}
                  onClick={() => setRevealed((current) => !current)}
                >
                  {revealed ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{t("settings.keyHint")}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="opencode-usage-org">{t("settings.org")}</Label>
              <Input
                id="opencode-usage-org"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={t("settings.orgPlaceholder")}
                value={org}
                onChange={(event) => setOrg(event.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">{t("settings.orgHint")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Button type="submit" size="sm" disabled={busy || key.trim().length === 0}>
                {snapshot.saving ? t("settings.saving") : t("settings.save")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !snapshot.configured}
                onClick={() => {
                  void usageStore.load(true);
                }}
              >
                <RefreshCw data-icon="inline-start" className={snapshot.busy ? "animate-spin" : undefined} />
                {t("settings.refresh")}
              </Button>
              {snapshot.configured && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => {
                    void usageStore.clear();
                  }}
                >
                  <Trash2 data-icon="inline-start" />
                  {t("settings.clear")}
                </Button>
              )}
            </div>
          </form>

          {(notice !== undefined || snapshot.error !== undefined) && (
            <p
              className="text-[11px] leading-relaxed"
              style={{ color: notice?.tone === "error" || snapshot.error !== undefined ? "var(--ou-destructive)" : "var(--ou-success)" }}
            >
              {notice !== undefined
                ? t(notice.code, { hint: snapshot.keyHint, detail: notice.detail ?? "" })
                : failureText(t, snapshot.error)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{t("settings.current")}</h3>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {formatInstant(snapshot.fetchedAt) === undefined
                ? t("overlay.never")
                : t("overlay.updated", { time: formatInstant(snapshot.fetchedAt) as string })}
            </span>
          </div>
          {snapshot.usage === undefined ? (
            <p className="text-xs text-muted-foreground">
              {snapshot.configured && snapshot.error !== undefined ? failureText(t, snapshot.error) : t("settings.noUsage")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {WINDOWS.map((window) => {
                const meter = snapshot.usage?.[window.key];
                return meter === undefined
                  ? null
                  : <MeterRow key={window.key} label={t(window.label)} meter={meter} t={t} />;
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">{t("settings.footnote")}</p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 rounded-lg bg-muted px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-xs font-medium">{t("settings.mode")}</Label>
          <div className="flex items-center gap-1" role="radiogroup" aria-label={t("settings.mode")}>
            {(MODES satisfies readonly WidgetMode[]).map((option) => (
              <Button
                key={option}
                type="button"
                size="xs"
                role="radio"
                aria-checked={mode === option}
                variant={mode === option ? "default" : "outline"}
                onClick={() => setWidgetMode(option)}
              >
                {t(`settings.mode.${option}`)}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("settings.modeHint")}</p>
      </div>
    </section>
  );
}

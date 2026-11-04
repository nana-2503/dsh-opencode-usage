/**
 * The floating widget. A collapsed pill reports the window with the least
 * allowance left; expanding it shows every window, its reset instant, and a
 * refresh action. It lives in `shell.overlay`, the frame-wide layer above the
 * columns, so it survives panel navigation.
 *
 * The widget can be dragged anywhere inside the frame. Its position is measured
 * from the bottom-right corner, so expanding the card grows it up and to the
 * left instead of pushing it off-screen, and the corner is remembered per
 * browser. Surfaces use the host's raised-layer token, so the card is white in
 * the light theme and near-black in the dark one instead of carrying its own
 * palette.
 * @module opencode-usage/client/overlay
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronDown, RefreshCw, Settings2, Undo2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { failureText } from "./messages";
import { MeterRow, PeriodTokens } from "./meter";
import {
  WINDOWS,
  colorOf,
  formatInstant,
  mostConstrained,
  remainingPercent,
  toneOf,
  type Translate,
} from "./gauge";
import { DEFAULT_CORNER, readCorner, saveCorner, useWidgetMode, type Corner } from "./prefs";
import { usageStore } from "./store";
import type { Snapshot } from "./locale";

/** Props the slot injects beside the locale-bound `t`. */
interface OverlayProps {
  t: Translate;
  openSettings: () => void;
}

/** One in-flight drag. */
interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  right: number;
  bottom: number;
  moved: boolean;
}

/** Movement under this many pixels still counts as a click, not a drag. */
const DRAG_SLOP = 3;



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
 * Render the pill, or the expanded card, in its remembered corner.
 */
export function UsageOverlay({ t, openSettings }: OverlayProps) {
  const mode = useWidgetMode();
  const snapshot = useSyncExternalStore(usageStore.subscribe, usageStore.getSnapshot);
  const [open, setOpen] = useState(false);
  const [corner, setCorner] = useState<Corner>(readCorner);
  const [dragging, setDragging] = useState(false);
  const anchor = useRef<HTMLDivElement | null>(null);
  const drag = useRef<DragState | null>(null);
  /** Set when the last pointer gesture moved the widget, so its click does not also fire. */
  const dragged = useRef(false);

  /** Keep the widget fully inside the frame; the element size changes between pill and card. */
  const clamp = useCallback((right: number, bottom: number): Corner => {
    const element = anchor.current;
    const frame = element?.offsetParent as HTMLElement | null | undefined;
    if (element === null || frame === null || frame === undefined) {
      return { right: Math.max(0, right), bottom: Math.max(0, bottom) };
    }
    return {
      right: Math.min(Math.max(0, right), Math.max(0, frame.clientWidth - element.offsetWidth)),
      bottom: Math.min(Math.max(0, bottom), Math.max(0, frame.clientHeight - element.offsetHeight)),
    };
  }, []);

  /** Re-clamp after the card expands/collapses, so a corner near an edge cannot overflow. */
  useLayoutEffect(() => {
    setCorner((current) => {
      const next = clamp(current.right, current.bottom);
      return next.right === current.right && next.bottom === current.bottom ? current : next;
    });
  }, [open, mode, clamp]);

  /** Re-clamp when the window resizes. */
  useEffect(() => {
    const onResize = () => {
      setCorner((current) => clamp(current.right, current.bottom));
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [clamp]);

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-no-drag]") !== null) return;
    dragged.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      right: corner.right,
      bottom: corner.bottom,
      moved: false,
    };
    setDragging(true);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (state === null || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    state.moved = true;
    setCorner(clamp(state.right - dx, state.bottom - dy));
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (state === null || state.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (!state.moved) return;
    dragged.current = true;
    saveCorner(clamp(state.right - (event.clientX - state.startX), state.bottom - (event.clientY - state.startY)));
  };

  /** Put the widget back in the bottom-right corner. */
  const resetPosition = () => {
    const next = clamp(DEFAULT_CORNER.right, DEFAULT_CORNER.bottom);
    setCorner(next);
    saveCorner(next);
  };

  if (mode !== "overlay") return null;

  const worst = mostConstrained(snapshot.usage);
  /** The collapsed pill always reports the rolling window, the one that refills fastest. */
  const rolling = snapshot.usage?.rolling;
  const reported = rolling === undefined
    ? worst
    : { key: "rolling" as const, label: "pill.window.rolling", short: "pill.short.rolling", meter: rolling };
  /** Collapsed shows that window's tone; expanded shows the most constrained window's. */
  const summary = open ? worst : reported;
  const color = summary === undefined ? "var(--ou-muted-bar)" : colorOf(toneOf(summary.meter));
  const moved = corner.right !== DEFAULT_CORNER.right || corner.bottom !== DEFAULT_CORNER.bottom;
  const draggable = cn(
    "touch-none select-none",
    dragging ? "cursor-grabbing" : "cursor-grab",
  );

  return (
    <div className="ou-root pointer-events-none absolute inset-0 z-30">
      <div
        ref={anchor}
        style={{ right: corner.right, bottom: corner.bottom }}
        className="absolute"
      >
        {open ? (
          <Card size="sm" className="pointer-events-auto w-[19.5rem] max-w-[calc(100vw-1.5rem)] gap-3 shadow-[var(--ou-shadow)]">
            <div
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className={cn("flex items-center justify-between gap-2 px-(--card-spacing)", draggable)}
            >
              <div className="flex min-w-0 items-center gap-2">
                <StatusDot color={color} />
                <span className="truncate text-sm font-medium">{t("pill.label")}</span>
              </div>
              <div className="flex items-center gap-0.5" data-no-drag>
                {moved ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("overlay.reset")}
                    title={t("overlay.reset")}
                    onClick={resetPosition}
                  >
                    <Undo2 />
                  </Button>
                ) : null}
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
              {snapshot.summary === undefined ? null : <PeriodTokens summary={snapshot.summary} t={t} />}
            </CardContent>

            <CardFooter className="justify-between gap-2 border-border text-[11px] text-muted-foreground">
              <span className="tabular-nums">
                {formatInstant(snapshot.fetchedAt) === undefined
                  ? t("overlay.never")
                  : t("overlay.updated", { time: formatInstant(snapshot.fetchedAt) as string })}
              </span>
              <Button size="xs" variant="ghost" onClick={openSettings}>
                <Settings2 data-icon="inline-start" />
                {t("overlay.settings")}
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <button
            type="button"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={() => {
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              if (snapshot.configured) setOpen(true);
              else openSettings();
            }}
            title={snapshot.configured ? t("overlay.expand") : t("pill.setup")}
            className={cn(
              "pointer-events-auto flex items-center gap-2 rounded-full bg-card py-1.5 pr-3 pl-2.5 text-xs text-card-foreground shadow-lg ring-1 ring-border transition-colors hover:bg-accent",
              draggable,
            )}
          >
            <StatusDot color={color} />
            <span className="font-medium max-sm:hidden">{t("pill.label")}</span>
            <span className="text-muted-foreground">{pillStatus(t, snapshot, reported)}</span>
          </button>
        )}
      </div>
    </div>
  );
}

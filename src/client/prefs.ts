/**
 * Small client preferences that survive a reload. They describe presentation
 * only; the credential and the allowance cache belong to the Host.
 * @module opencode-usage/client/prefs
 */
import { useSyncExternalStore } from "react";

/** Where the allowance is drawn: the frame overlay, the strip above the composer, or nowhere. */
export type WidgetMode = "overlay" | "dock" | "hidden";

/** Storage key of the placement. */
const MODE_KEY = "opencode-usage:mode";
/** Pre-placement key, kept so an existing "hidden" choice survives the upgrade. */
const LEGACY_KEY = "opencode-usage:overlay-visible";

/** Registered listeners for the placement. */
const listeners = new Set<() => void>();

/** Read the stored placement, defaulting to the floating corner. */
function read(): WidgetMode {
  try {
    const raw = window.localStorage.getItem(MODE_KEY);
    if (raw === "overlay" || raw === "dock" || raw === "hidden") return raw;
    if (window.localStorage.getItem(LEGACY_KEY) === "0") return "hidden";
  } catch {
    /* storage may be unavailable in a hardened browser; the default still applies */
  }
  return "overlay";
}

let mode = read();

/**
 * Change where the widget is drawn.
 * @param next - the chosen placement.
 */
export function setWidgetMode(next: WidgetMode): void {
  mode = next;
  try {
    window.localStorage.setItem(MODE_KEY, next);
  } catch {
    /* the in-memory value still applies for this page lifetime */
  }
  for (const listener of listeners) listener();
}

/**
 * Subscribe one component to the placement.
 * @returns the current placement.
 */
export function useWidgetMode(): WidgetMode {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => mode,
  );
}

/** Where the floating widget sits, measured from the frame's right and bottom edges. */
export interface Corner {
  right: number;
  bottom: number;
}

/** Storage key of the dragged position. */
const CORNER_KEY = "opencode-usage:corner";

/** Default corner: the conventional bottom-right seat, inset by 12px. */
export const DEFAULT_CORNER: Corner = { right: 12, bottom: 12 };

/**
 * Read the stored corner, falling back to the default when absent or malformed.
 * @returns the remembered position.
 */
export function readCorner(): Corner {
  try {
    const raw = window.localStorage.getItem(CORNER_KEY);
    if (raw !== null) {
      const value = JSON.parse(raw) as Partial<Corner>;
      if (typeof value.right === "number" && typeof value.bottom === "number"
        && Number.isFinite(value.right) && Number.isFinite(value.bottom)) {
        return { right: Math.max(0, value.right), bottom: Math.max(0, value.bottom) };
      }
    }
  } catch {
    /* storage may be unavailable in a hardened browser; the default still applies */
  }
  return DEFAULT_CORNER;
}

/**
 * Remember where the user dropped the widget.
 * @param corner - position measured from the frame's right and bottom edges.
 */
export function saveCorner(corner: Corner): void {
  try {
    window.localStorage.setItem(CORNER_KEY, JSON.stringify(corner));
  } catch {
    /* the in-memory position still applies for this page lifetime */
  }
}

/**
 * Small client preferences that survive a reload. They describe presentation
 * only; the credential and the allowance cache belong to the Host.
 * @module opencode-usage/client/prefs
 */
import { useSyncExternalStore } from "react";

/** Storage key of the floating-widget switch. */
const OVERLAY_KEY = "opencode-usage:overlay-visible";

/** Registered listeners for the overlay switch. */
const listeners = new Set<() => void>();

/** Read the stored preference, defaulting to visible. */
function read(): boolean {
  try {
    return window.localStorage.getItem(OVERLAY_KEY) !== "0";
  } catch {
    return true;
  }
}

let visible = read();

/**
 * Change the floating-widget preference.
 * @param next - whether the widget renders.
 */
export function setOverlayVisible(next: boolean): void {
  visible = next;
  try {
    window.localStorage.setItem(OVERLAY_KEY, next ? "1" : "0");
  } catch {
    /* storage may be unavailable in a hardened browser; the in-memory value still applies */
  }
  for (const listener of listeners) listener();
}

/**
 * Subscribe one component to the floating-widget preference.
 * @returns the current preference.
 */
export function useOverlayVisible(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => visible,
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

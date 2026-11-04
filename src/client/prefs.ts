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

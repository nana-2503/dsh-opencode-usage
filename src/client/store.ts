/**
 * One observable snapshot of the allowance connection, shared by the floating
 * widget and the settings page so both render the same read.
 * @module opencode-usage/client/store
 */
import type { Snapshot } from "./locale";
import { clearKey, readState, refreshState, saveKey } from "./api";

/** Initial state before the first answer arrives. */
const INITIAL: Snapshot = {
  status: "loading",
  configured: false,
  keyHint: "",
  saving: false,
  busy: false,
};

/** Refresh cadence while a page stays open; the Host also refreshes on demand. */
const POLL_MS = 60_000;

class UsageStore {
  private snapshot: Snapshot = INITIAL;
  private readonly listeners = new Set<() => void>();
  private started = false;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): Snapshot => this.snapshot;

  private publish(patch: Partial<Snapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  /** Fetch once, keeping the previous usage visible while the read is in flight. */
  async load(force = false): Promise<void> {
    this.publish({ busy: true });
    try {
      const next = await (force ? refreshState() : readState());
      this.publish({ ...next, busy: false, status: next.error === undefined ? "ready" : "error" });
    } catch (error) {
      this.publish({
        busy: false,
        status: "error",
        error: { code: "network", message: String((error as Error)?.message ?? error) },
      });
    }
  }

  /** Save a key, then show what the Host read with it. */
  async save(apiKey: string, orgId: string, t: (key: string) => string): Promise<boolean> {
    this.publish({ saving: true, busy: true, notice: undefined });
    try {
      const next = await saveKey(apiKey, orgId);
      this.publish({
        ...next,
        status: next.error === undefined ? "ready" : "error",
        saving: false,
        busy: false,
        notice: next.error === undefined
          ? { tone: "success", code: "settings.saved", detail: next.keyHint }
          : { tone: "error", code: `settings.error.${next.error.code}`, detail: next.error.message ?? t("settings.error.unknown") },
      });
      return next.error === undefined;
    } catch (error) {
      this.publish({
        saving: false,
        busy: false,
        status: "error",
        error: { code: "network", message: String((error as Error)?.message ?? error) },
        notice: { tone: "error", code: "settings.error.network" },
      });
      return false;
    }
  }

  /** Forget the stored key after the Host confirms it is gone. */
  async clear(): Promise<void> {
    this.publish({ saving: true, busy: true, notice: undefined });
    try {
      const next = await clearKey();
      this.publish({ ...next, status: "ready", saving: false, busy: false, notice: { tone: "success", code: "settings.cleared" } });
    } catch (error) {
      this.publish({
        saving: false,
        busy: false,
        notice: { tone: "error", code: "settings.error.network", detail: String((error as Error)?.message ?? error) },
      });
    }
  }

  /**
   * Begin polling; the returned disposer stops the interval and is safe to call once.
   * @returns teardown for the plugin's effect scope.
   */
  start(): () => void {
    if (this.started) return () => {};
    this.started = true;
    if (this.snapshot.status === "loading") void this.load();
    const timer = window.setInterval(() => {
      void this.load();
    }, POLL_MS);
    return () => {
      this.started = false;
      window.clearInterval(timer);
    };
  }
}

/** The one store instance both slots read. */
export const usageStore = new UsageStore();

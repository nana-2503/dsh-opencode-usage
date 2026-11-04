/**
 * Browser half of the OpenCode Go usage widget.
 *
 * Registers the two contributions — the floating pill in `shell.overlay` and
 * the credential page on the bundle's settings page — plus the plugin-owned
 * stylesheet they render with.
 * @module opencode-usage/client
 */
import { CSS } from "./generated-css";
/** Dictionary namespace plus both locales. */
import { NS, en, zh } from "./locale";
import { UsageDock } from "./dock";
import { UsageOverlay } from "./overlay";
import { UsageSettings } from "./settings";
import { usageStore } from "./store";

/** Public package name; also the bundle page key this plugin configures. */
const PKG = "@nana-2503/dsh-opencode-usage";

/** Services this client half needs before it mounts. */
export const inject = ["slots", "locale"];

/**
 * Mount the contribution.
 * @param ctx - browser context owning the slot registrations.
 */
/** The slice of the browser context this half uses. */
interface ClientContext {
  effect(callback: () => unknown, label?: string): () => void;
  get(name: string): unknown;
  locale: { register(ns: string, dicts: Record<string, unknown>): () => void };
  slots: {
    inject(key: string, callback: () => unknown): unknown;
    register(options: Record<string, unknown>, component: unknown): unknown;
  };
}

export function apply(ctx: ClientContext): void {
  const services = ctx;

  ctx.effect(() => services.locale.register(NS, { zh, en }), "opencode-usage: dictionaries");

  ctx.effect(() => {
    if (typeof document === "undefined") return () => {};
    const tag = document.createElement("style");
    tag.dataset.plugin = PKG;
    tag.dataset.pluginCss = `${PKG}/styles.css`;
    tag.textContent = CSS;
    document.head.appendChild(tag);
    return () => {
      tag.remove();
    };
  }, "opencode-usage: stylesheet");

  ctx.effect(() => usageStore.start(), "opencode-usage: allowance polling");

  /** Open this bundle's page in Settings → Plugins, where the key form lives. */
  const openSettings = () => {
    const navigation = services.get("pluginNavigation") as { openBundle?: (name: string) => void } | undefined;
    if (typeof navigation?.openBundle === "function") {
      navigation.openBundle(PKG);
      return;
    }
    const layout = services.get("layout") as { selectPanel?: (id: string) => void } | undefined;
    layout?.selectPanel?.("plugins");
  };

  services.slots.inject("shell.overlay", () => services.slots.register({
    name: "shell.overlay",
    id: "opencode-usage",
    order: 40,
    locale: NS,
    inject: () => ({ openSettings }),
  }, UsageOverlay));

  services.slots.inject("conversation.input.dock", () => services.slots.register({
    name: "conversation.input.dock",
    id: "opencode-usage",
    order: 30,
    locale: NS,
    inject: () => ({ openSettings }),
  }, UsageDock));

  services.slots.inject("plugins.bundle.config", () => services.slots.register({
    name: "plugins.bundle.config",
    key: PKG,
    locale: NS,
  }, UsageSettings));
}

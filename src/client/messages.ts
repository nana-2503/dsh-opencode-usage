/**
 * Localized wording for the failure codes the Host reports.
 * @module opencode-usage/client/messages
 */
import type { Failure } from "./locale";
import type { Translate } from "./gauge";

/** Failure codes that own a dedicated sentence. */
const KNOWN = new Set(["unauthorized", "timeout", "network", "upstream", "shape", "empty"]);

/**
 * Turn one wire failure into the viewer's language.
 * @param t - namespace-bound translate.
 * @param failure - the failure carried by the snapshot.
 * @returns a sentence that is never empty.
 */
export function failureText(t: Translate, failure: Failure | undefined): string {
  if (failure === undefined) return "";
  if (KNOWN.has(failure.code)) return t(`settings.error.${failure.code}`);
  return t("settings.error.unknown", { detail: failure.message ?? failure.code });
}

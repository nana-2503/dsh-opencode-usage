/**
 * Wire access to this bundle's Host half. Every call is same-origin and
 * credential-free: the Host holds the key and answers with a redacted
 * snapshot, so nothing secret ever exists in page memory.
 * @module opencode-usage/client/api
 */
import type { Failure, Snapshot, Usage } from "./locale";
import type { TokenSummary } from "./gauge";

/** Route prefix registered by the Host half. */
const ROUTE = "/api/opencode-usage";

/** Narrow one upstream meter into the shape the views consume. */
function normalizeUsage(input: unknown): Usage | undefined {
  if (input === null || typeof input !== "object") return undefined;
  const source = input as Record<string, { percent?: unknown; limited?: unknown; resetsAt?: unknown }>;
  const out: Usage = {};
  for (const window of ["rolling", "weekly", "monthly"] as const) {
    const meter = source[window];
    if (meter === null || typeof meter !== "object") continue;
    const percent = Number(meter.percent);
    if (!Number.isFinite(percent)) continue;
    out[window] = {
      percent: Math.min(100, Math.max(0, percent)),
      limited: meter.limited === true,
      resetsAt: typeof meter.resetsAt === "number" && Number.isFinite(meter.resetsAt) ? meter.resetsAt : undefined,
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Narrow the token totals the Host reports for the billing period. */
function normalizeSummary(input: unknown): TokenSummary | undefined {
  if (input === null || typeof input !== "object") return undefined;
  const value = input as Record<string, unknown>;
  const total = Number(value.total);
  if (!Number.isFinite(total)) return undefined;
  const count = (inputValue: unknown) => {
    const parsed = Number(inputValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  return {
    from: typeof value.from === "string" ? value.from : "",
    to: typeof value.to === "string" ? value.to : "",
    requests: count(value.requests),
    input: count(value.input),
    output: count(value.output),
    cacheRead: count(value.cacheRead),
    cacheWrite: count(value.cacheWrite),
    total,
  };
}

/**
 * Shape one untrusted answer into a snapshot, defaulting every optional field.
 * Exported for the wire tests: a field the Host sends but this drops is invisible
 * in the UI, which is how the token totals went missing once.
 */
export function parseSnapshot(body: unknown): Snapshot {
  const value = (body ?? {}) as Record<string, unknown>;
  const error = value.error;
  const failure: Failure | undefined = error !== null && typeof error === "object"
    ? {
        code: typeof (error as Failure).code === "string" ? (error as Failure).code : "unknown",
        message: typeof (error as Failure).message === "string" ? (error as Failure).message : undefined,
      }
    : undefined;
  return {
    status: failure !== undefined ? "error" : "ready",
    configured: value.configured === true,
    orgId: typeof value.orgId === "string" ? value.orgId : undefined,
    keyHint: typeof value.keyHint === "string" ? value.keyHint : "",
    usage: normalizeUsage(value.usage),
    summary: normalizeSummary(value.summary),
    fetchedAt: typeof value.fetchedAt === "number" ? value.fetchedAt : undefined,
    error: failure,
    saving: false,
    busy: false,
  };
}

/** Perform one JSON request and always answer with a snapshot. */
async function call(path: string, init?: { method?: string; body?: unknown }): Promise<Snapshot> {
  const response = await fetch(`${ROUTE}${path}`, {
    method: init?.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }
  if (!response.ok && (parsed === null || typeof parsed !== "object")) {
    return { status: "error", configured: false, keyHint: "", error: { code: "upstream" }, saving: false, busy: false };
  }
  return parseSnapshot(parsed);
}

/** Read the cached snapshot, refreshing it when the Host considers it stale. */
export const readState = (): Promise<Snapshot> => call("/state");

/** Ask the Host to bypass its staleness window. */
export const refreshState = (): Promise<Snapshot> => call("/refresh", { method: "POST" });

/** Store a key (and optional organization id), then read the allowance with it. */
export const saveKey = (apiKey: string, orgId: string): Promise<Snapshot> =>
  call("/key", { method: "POST", body: { apiKey, orgId } });

/** Forget the stored key. */
export const clearKey = (): Promise<Snapshot> => call("/clear", { method: "POST" });

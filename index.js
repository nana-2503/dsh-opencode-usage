/**
 * Host half of the OpenCode Go usage widget.
 *
 * Owns the only thing the browser may not do itself: the credential storage
 * (a 0600 JSON file inside the active profile) and the upstream call to the
 * OpenCode Console allowance endpoint, which rejects browser CORS preflights.
 * The Client half renders the floating pill and the settings page and talks to
 * this module over three same-origin routes under `/api/opencode-usage`.
 *
 * @module @nana-2503/dsh-opencode-usage
 */
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Public package name, also the bundle page key the Client registers under. */
const PKG = "@nana-2503/dsh-opencode-usage";
/** OpenCode Console allowance endpoint (`/zen/go/v1/usage` on the console origin). */
const USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
/** Route prefix owned by this plugin. */
const ROUTE = "/api/opencode-usage";
/** Upstream request budget. A hung upstream must not pin a browser request. */
const UPSTREAM_TIMEOUT_MS = 15_000;
/** Cached usage older than this is refreshed in the background. */
const STALE_AFTER_MS = 60_000;
/** Background sweep cadence while a key is configured. */
const SWEEP_MS = 60_000;
/** Largest accepted credential body. */
const MAX_BODY_BYTES = 8_192;

/**
 * One classified upstream failure. The browser maps `code` to its own copy, so
 * a localized page never shows English prose from the Host.
 */
class UsageError extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
	}
}

/** Required Host services: the HTTP carrier the browser reaches. */
export const inject = ["webServer", "timer"];

/**
 * Mount the routes and the background sweep.
 * @param {import("@deepseek-ai/cordis").Context} ctx - owning Host context.
 */
export function apply(ctx) {
	/** Last successful allowance read; reset whenever the credential changes. */
	let cached;
	/** In-flight read, shared by concurrent callers. */
	let pending;
	/** Last failure, reported until a read succeeds. */
	let lastError;

	/** Absolute path of the credential file, resolved lazily so a late `profileContext` still names the profile home. */
	const storePath = () => {
		const home = ctx.get("profileContext")?.home ?? process.env.DSH_HOME ?? process.cwd();
		return join(String(home), "opencode-usage.json");
	};

	/** Read the stored credential, or an empty record. */
	const readStore = async () => {
		try {
			const text = await readFile(storePath(), "utf8");
			const parsed = JSON.parse(text);
			return {
				apiKey: typeof parsed?.apiKey === "string" && parsed.apiKey.length > 0 ? parsed.apiKey : undefined,
				orgId: typeof parsed?.orgId === "string" && parsed.orgId.length > 0 ? parsed.orgId : undefined,
			};
		} catch (error) {
			if (error?.code === "ENOENT") return {};
			ctx.logger.warn("opencode-usage: credential file is unreadable: %s", String(error?.message ?? error));
			return {};
		}
	};

	/** Persist the credential (or drop it) with owner-only permissions. */
	const writeStore = async (record) => {
		const path = storePath();
		await mkdir(dirname(path), { recursive: true });
		const temporary = `${path}.tmp`;
		await writeFile(temporary, `${JSON.stringify({ version: 1, ...record }, null, 2)}\n`, { mode: 0o600 });
		await rename(temporary, path);
		await chmod(path, 0o600).catch(() => {});
	};

	/** Last four characters of a credential, the only part the browser ever sees. */
	const hintOf = (key) => (typeof key === "string" && key.length >= 4 ? key.slice(-4) : "");

	/**
	 * Normalize one upstream meter.
	 * @param {unknown} input - wire value.
	 * @returns {{ percent: number, limited: boolean, resetsAt: number } | undefined}
	 */
	const meterOf = (input) => {
		if (input === null || typeof input !== "object") return undefined;
		const percent = Number(input.percent);
		if (!Number.isFinite(percent)) return undefined;
		const resetsAt = typeof input.resetsAt === "string" ? Date.parse(input.resetsAt) : Number(input.resetsAt);
		return {
			percent: Math.min(100, Math.max(0, percent)),
			limited: input.status === "rate-limited" || input.limited === true,
			resetsAt: Number.isFinite(resetsAt) ? resetsAt : undefined,
		};
	};

	/**
	 * Read the allowance from OpenCode Console.
	 * @param {{ apiKey: string, orgId?: string }} record - stored credential.
	 * @param {AbortSignal} signal - caller lifetime.
	 * @returns {Promise<{ rolling?: object, weekly?: object, monthly?: object }>} meter per window.
	 */
	const fetchUsage = async (record, signal) => {
		const headers = { accept: "application/json", authorization: `Bearer ${record.apiKey}` };
		if (record.orgId !== undefined) headers["x-opencode-org-id"] = record.orgId;
		const response = await fetch(USAGE_URL, { headers, signal });
		const text = await response.text();
		if (response.status === 401 || response.status === 403) {
			throw new UsageError("unauthorized", `HTTP ${response.status}`);
		}
		if (!response.ok) throw new UsageError("upstream", `HTTP ${response.status}`);
		let body;
		try {
			body = JSON.parse(text);
		} catch {
			throw new UsageError("shape", "answer is not JSON");
		}
		const usage = body?.usage;
		if (usage === null || typeof usage !== "object") throw new UsageError("shape", "answer has no usage field");
		const rolling = meterOf(usage.rolling);
		const weekly = meterOf(usage.weekly);
		const monthly = meterOf(usage.monthly);
		if (rolling === undefined && weekly === undefined && monthly === undefined) {
			throw new UsageError("shape", "answer carries no allowance window");
		}
		return { rolling, weekly, monthly };
	};

	/**
	 * Refresh the cached allowance, joining an in-flight read instead of stacking one.
	 * @param {{ force?: boolean }} [options] - `force` ignores the staleness check.
	 * @returns {Promise<void>} resolves once the cache reflects this attempt.
	 */
	const refresh = async (options = {}) => {
		const record = await readStore();
		if (record.apiKey === undefined) {
			cached = undefined;
			lastError = undefined;
			return;
		}
		if (pending !== undefined) return pending;
		if (!options.force && cached !== undefined && Date.now() - cached.fetchedAt < STALE_AFTER_MS) return;
		const task = (async () => {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
			try {
				const usage = await fetchUsage(record, controller.signal);
				cached = { usage, fetchedAt: Date.now(), hint: hintOf(record.apiKey) };
				lastError = undefined;
			} catch (error) {
				lastError = error?.name === "AbortError"
					? { code: "timeout" }
					: { code: error instanceof UsageError ? error.code : "network", message: String(error?.message ?? error) };
				ctx.logger.warn("opencode-usage: allowance read failed: %s (%s)", String(lastError.message ?? ""), lastError.code);
			} finally {
				clearTimeout(timer);
				pending = undefined;
			}
		})();
		pending = task;
		return task;
	};

	/** Project the browser-facing snapshot; never includes the credential itself. */
	const snapshotOf = async () => {
		const record = await readStore();
		const configured = record.apiKey !== undefined;
		return {
			configured,
			orgId: record.orgId,
			keyHint: configured ? hintOf(record.apiKey) : "",
			usage: configured ? cached?.usage : undefined,
			fetchedAt: configured ? cached?.fetchedAt : undefined,
			error: configured ? lastError : undefined,
		};
	};

	/**
	 * Answer one request with a snapshot, refreshing first when a key is configured.
	 * @param {boolean} force - bypass the staleness window.
	 */
	const respondState = async (force) => {
		const record = await readStore();
		if (record.apiKey !== undefined) await refresh({ force });
		return snapshotOf();
	};

	/** Trust guard shared by every route: refuse peers the transport does not admit. */
	const rejected = (req, res) => {
		const connection = ctx.get("connection");
		const rejection = connection?.requestRejection?.(req);
		if (rejection === undefined) return false;
		res.statusCode = rejection;
		res.end();
		return true;
	};

	/** Send one JSON body with no-store caching. */
	const sendJson = (res, status, payload) => {
		res.statusCode = status;
		res.setHeader("content-type", "application/json; charset=utf-8");
		res.setHeader("cache-control", "no-store");
		res.end(JSON.stringify(payload));
	};

	/** Collect a bounded JSON body, or undefined past the ceiling / on malformed JSON. */
	const readBody = async (req) => {
		const chunks = [];
		let size = 0;
		for await (const chunk of req) {
			size += chunk.byteLength;
			if (size > MAX_BODY_BYTES) {
				req.resume();
				return undefined;
			}
			chunks.push(chunk);
		}
		try {
			return JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
		} catch {
			return undefined;
		}
	};

	ctx.effect(() => ctx.interval(() => {
		void refresh().catch((error) => ctx.logger.warn("opencode-usage: sweep failed: %s", String(error)));
	}, SWEEP_MS), "opencode-usage: allowance sweep");

	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: `${ROUTE}/state`,
		handler: async (req, res) => {
			if (rejected(req, res)) return;
			if (req.method !== "GET") {
				res.statusCode = 405;
				res.setHeader("allow", "GET");
				res.end();
				return;
			}
			try {
				sendJson(res, 200, await respondState(false));
			} catch (error) {
				sendJson(res, 500, { configured: false, keyHint: "", error: { code: "unknown", message: String(error?.message ?? error) } });
			}
		},
	}), `opencode-usage: GET ${ROUTE}/state`);

	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: `${ROUTE}/refresh`,
		handler: async (req, res) => {
			if (rejected(req, res)) return;
			if (req.method !== "POST") {
				res.statusCode = 405;
				res.setHeader("allow", "POST");
				res.end();
				return;
			}
			try {
				sendJson(res, 200, await respondState(true));
			} catch (error) {
				sendJson(res, 500, { configured: false, keyHint: "", error: { code: "unknown", message: String(error?.message ?? error) } });
			}
		},
	}), `opencode-usage: POST ${ROUTE}/refresh`);

	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: `${ROUTE}/key`,
		handler: async (req, res) => {
			if (rejected(req, res)) return;
			if (req.method !== "POST") {
				res.statusCode = 405;
				res.setHeader("allow", "POST");
				res.end();
				return;
			}
			const body = await readBody(req);
			const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
			const orgId = typeof body?.orgId === "string" ? body.orgId.trim() : "";
			if (apiKey.length === 0) {
				sendJson(res, 400, { configured: false, keyHint: "", error: { code: "empty" } });
				return;
			}
			await writeStore({ apiKey, ...(orgId.length > 0 ? { orgId } : {}) });
			cached = undefined;
			lastError = undefined;
			await refresh({ force: true });
			sendJson(res, 200, await snapshotOf());
		},
	}), `opencode-usage: POST ${ROUTE}/key`);

	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: `${ROUTE}/clear`,
		handler: async (req, res) => {
			if (rejected(req, res)) return;
			if (req.method !== "POST") {
				res.statusCode = 405;
				res.setHeader("allow", "POST");
				res.end();
				return;
			}
			await writeStore({});
			cached = undefined;
			lastError = undefined;
			sendJson(res, 200, await snapshotOf());
		},
	}), `opencode-usage: POST ${ROUTE}/clear`);

	ctx.logger.info("opencode-usage: mounted %s (package %s)", ROUTE, PKG);
}

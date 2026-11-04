/**
 * Host half: credential storage, the four routes, upstream classification, and
 * the snapshot cache. The network is stubbed, the profile home is a temp dir.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { apply } from "../index.js";

/** A credential whose last four characters are easy to assert. */
const KEY = "oc_test_key_1234";

/** Token totals the Console reports for a period. */
const SUMMARY = {
  totalRequests: "33150",
  totalInputTokens: "105453758",
  totalOutputTokens: "19549073",
  totalCacheReadTokens: "8506197529",
  totalCacheWrite5mTokens: "0",
  totalCacheWrite1hTokens: "0",
};

/** One upstream answer in the shape the Console returns. */
const UPSTREAM = {
  usage: {
    rolling: { status: "ok", percent: 3, resetsAt: "2026-11-04T07:11:16.000Z" },
    weekly: { status: "ok", percent: 2, resetsAt: "2026-11-09T00:00:00.000Z" },
    monthly: { status: "ok", percent: 1, resetsAt: "2026-12-03T07:06:00.000Z" },
  },
};

/** Route table plus a disposable Host context rooted at one temp profile. */
function harness(home) {
  const routes = new Map();
  const disposers = [];
  const ctx = {
    effect(callback) {
      const dispose = callback();
      if (typeof dispose === "function") disposers.push(dispose);
      return () => {};
    },
    interval() {
      return () => {};
    },
    get(name) {
      if (name === "profileContext") return { name: "test", home };
      if (name === "connection") return { requestRejection: () => undefined };
      return undefined;
    },
    logger: { info() {}, warn() {}, error() {} },
    webServer: {
      register(route) {
        routes.set(route.path, route.handler);
        return () => routes.delete(route.path);
      },
    },
  };
  return {
    ctx,
    routes,
    dispose() {
      for (const dispose of disposers) dispose();
    },
  };
}

/** Swap `fetch` for a scripted responder and record the calls. */
function stubFetch(responder) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return responder(calls.length, String(url));
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

/** Drive one route with a fake request/response pair. */
function call(host, method, path, body) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const request = {
    method,
    url: path,
    headers: {},
    async *[Symbol.asyncIterator]() {
      yield* chunks;
    },
    resume() {},
  };
  const handler = host.routes.get(path);
  if (handler === undefined) throw new Error(`no route for ${path}`);
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 0,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      end(text) {
        resolve({ status: this.statusCode, body: text ? JSON.parse(text) : undefined });
      },
    };
    Promise.resolve(handler(request, response)).catch(reject);
  });
}

/** Poll a predicate for a few hundred milliseconds. */
async function waitFor(predicate, timeout = 1_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
}

/** Answer both upstream endpoints the way the Console does. */
function respond(_attempt, url) {
  if (url.includes("/console/api/usage/summary")) return new Response(JSON.stringify(SUMMARY), { status: 200 });
  return new Response(JSON.stringify(UPSTREAM), { status: 200 });
}

/** Fresh temp profile home. */
const home = () => mkdtemp(join(tmpdir(), "oc-usage-"));

test("state reports unconfigured before any key exists", async () => {
  const dir = await home();
  const net = stubFetch(() => new Response("{}", { status: 500 }));
  const host = harness(dir);
  try {
    apply(host.ctx);
    const state = await call(host, "GET", "/api/opencode-usage/state");
    assert.equal(state.status, 200);
    assert.deepEqual(state.body, { configured: false, keyHint: "" });
    assert.equal(net.calls.length, 0);
  } finally {
    host.dispose();
    net.restore();
  }
});

test("saving a key reads the allowance and never echoes the key", async () => {
  const dir = await home();
  const net = stubFetch(respond) ;
  const host = harness(dir);
  try {
    apply(host.ctx);
    const saved = await call(host, "POST", "/api/opencode-usage/key", { apiKey: KEY });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.configured, true);
    assert.equal(saved.body.keyHint, "1234");
    assert.equal(saved.body.usage.rolling.percent, 3);
    assert.equal(typeof saved.body.usage.rolling.resetsAt, "number");
    assert.ok(!JSON.stringify(saved.body).includes(KEY), "the snapshot must not carry the key");

    const stored = JSON.parse(await readFile(join(dir, "opencode-usage.json"), "utf8"));
    assert.equal(stored.apiKey, KEY);
    assert.equal(net.calls.length, 2, "one allowance read plus one token summary");
    assert.match(net.calls[0].init.headers.authorization, /^Bearer oc_test_key_1234$/);
    assert.match(net.calls[1].url, /\/console\/api\/usage\/summary\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);

    // input + output + cache read + cache write
    assert.equal(saved.body.summary.total, 8_631_200_360);
    assert.equal(saved.body.summary.input, 105_453_758);
    assert.equal(saved.body.summary.cacheRead, 8_506_197_529);
    assert.match(saved.body.summary.from, /^\d{4}-\d{2}-\d{2}$/);

    const again = await call(host, "GET", "/api/opencode-usage/state");
    assert.equal(again.body.fetchedAt, saved.body.fetchedAt, "a warm cache must not re-read upstream");
    assert.equal(net.calls.length, 2);
  } finally {
    host.dispose();
    net.restore();
  }
});

test("a restart paints from the remembered snapshot", async () => {
  const dir = await home();
  const first = stubFetch(respond) ;
  const before = harness(dir);
  try {
    apply(before.ctx);
    await call(before, "POST", "/api/opencode-usage/key", { apiKey: KEY });
    await waitFor(() => existsSync(join(dir, "opencode-usage.cache.json")));
  } finally {
    before.dispose();
    first.restore();
  }

  const second = stubFetch(() => new Response("{}", { status: 500 }));
  const after = harness(dir);
  try {
    apply(after.ctx);
    const state = await call(after, "GET", "/api/opencode-usage/state");
    assert.equal(state.body.configured, true);
    assert.equal(state.body.usage.rolling.percent, 3);
    assert.equal(second.calls.length, 0, "the remembered snapshot must be served without a request");
  } finally {
    after.dispose();
    second.restore();
  }
});

test("a rejected key is classified, not leaked", async () => {
  const dir = await home();
  const net = stubFetch(() => new Response("{}", { status: 401 }));
  const host = harness(dir);
  try {
    apply(host.ctx);
    const saved = await call(host, "POST", "/api/opencode-usage/key", { apiKey: "oc_wrong" });
    assert.equal(saved.body.configured, true);
    assert.equal(saved.body.error.code, "unauthorized");
    assert.equal(saved.body.usage, undefined);
  } finally {
    host.dispose();
    net.restore();
  }
});

test("the summary window is clamped to the previous month's last day", async () => {
  const dir = await home();
  const endOfMarch = {
    usage: { ...UPSTREAM.usage, monthly: { status: "ok", percent: 2, resetsAt: "2026-03-31T07:06:00.000Z" } },
  };
  const net = stubFetch((_attempt, url) => (url.includes("/usage/summary")
    ? new Response(JSON.stringify(SUMMARY), { status: 200 })
    : new Response(JSON.stringify(endOfMarch), { status: 200 })));
  const host = harness(dir);
  try {
    apply(host.ctx);
    await call(host, "POST", "/api/opencode-usage/key", { apiKey: KEY });
    const summaryCall = net.calls.find((entry) => entry.url.includes("/usage/summary"));
    assert.match(summaryCall.url, /from=2026-02-28&to=2026-03-31$/, "March 31 must clamp to February 28");
  } finally {
    host.dispose();
    net.restore();
  }
});

test("a key with control characters is refused", async () => {
  const dir = await home();
  const net = stubFetch(() => new Response("{}", { status: 500 }));
  const host = harness(dir);
  try {
    apply(host.ctx);
    const refused = await call(host, "POST", "/api/opencode-usage/key", { apiKey: "oc_evil\nInjected: 1" });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.error.code, "invalid");
    assert.equal(net.calls.length, 0);
  } finally {
    host.dispose();
    net.restore();
  }
});

test("a failing summary never hides the allowance", async () => {
  const dir = await home();
  const net = stubFetch((_attempt, url) => (url.includes("/usage/summary")
    ? new Response("{}", { status: 500 })
    : new Response(JSON.stringify(UPSTREAM), { status: 200 })));
  const host = harness(dir);
  try {
    apply(host.ctx);
    const saved = await call(host, "POST", "/api/opencode-usage/key", { apiKey: KEY });
    assert.equal(saved.body.configured, true);
    assert.equal(saved.body.usage.rolling.percent, 3);
    assert.equal(saved.body.summary, undefined);
  } finally {
    host.dispose();
    net.restore();
  }
});

test("an empty key is refused without touching upstream", async () => {
  const dir = await home();
  const net = stubFetch(() => new Response("{}", { status: 500 }));
  const host = harness(dir);
  try {
    apply(host.ctx);
    const refused = await call(host, "POST", "/api/opencode-usage/key", { apiKey: "   " });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.error.code, "empty");
    assert.equal(net.calls.length, 0);
  } finally {
    host.dispose();
    net.restore();
  }
});

test("clearing forgets the key and the remembered snapshot", async () => {
  const dir = await home();
  const net = stubFetch(respond) ;
  const host = harness(dir);
  try {
    apply(host.ctx);
    await call(host, "POST", "/api/opencode-usage/key", { apiKey: KEY });
    await waitFor(() => existsSync(join(dir, "opencode-usage.cache.json")));

    const cleared = await call(host, "POST", "/api/opencode-usage/clear");
    assert.equal(cleared.body.configured, false);
    assert.equal(cleared.body.usage, undefined);
    assert.equal(existsSync(join(dir, "opencode-usage.cache.json")), false);

    const stored = JSON.parse(await readFile(join(dir, "opencode-usage.json"), "utf8"));
    assert.equal(stored.apiKey, undefined);
  } finally {
    host.dispose();
    net.restore();
  }
});

test("the credential file is owner-only", { skip: process.platform === "win32" }, async () => {
  const dir = await home();
  const net = stubFetch(respond) ;
  const host = harness(dir);
  try {
    apply(host.ctx);
    await call(host, "POST", "/api/opencode-usage/key", { apiKey: KEY });
    const info = await stat(join(dir, "opencode-usage.json"));
    assert.equal(info.mode & 0o777, 0o600);
  } finally {
    host.dispose();
    net.restore();
  }
});

test("routes refuse the wrong method", async () => {
  const dir = await home();
  const host = harness(dir);
  try {
    apply(host.ctx);
    const wrong = await call(host, "POST", "/api/opencode-usage/state");
    assert.equal(wrong.status, 405);
  } finally {
    host.dispose();
  }
});

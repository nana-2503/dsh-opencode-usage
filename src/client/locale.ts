/** Dictionary namespace owned by this plugin. */
export const NS = "opencodeUsage";

/** Window keys the Console allowance endpoint reports, in display order. */
export type WindowKey = "rolling" | "weekly" | "monthly";

/** One allowance window. `percent` is the share already consumed (0–100). */
export interface Meter {
  percent: number;
  limited: boolean;
  resetsAt?: number;
}

/** Allowance per window; a window missing upstream is simply absent. */
export type Usage = Partial<Record<WindowKey, Meter>>;

/** Failure codes the Host reports, so the browser owns the wording. */
export type FailureCode =
  | "unauthorized"
  | "timeout"
  | "network"
  | "upstream"
  | "shape"
  | "empty"
  | "unknown";

/** One failure as it crosses the wire. */
export interface Failure {
  code: FailureCode;
  message?: string;
}

/** Everything the browser knows about the allowance connection. */
export interface Snapshot {
  /** "loading" only while the first answer for the current credential is pending. */
  status: "loading" | "ready" | "error";
  configured: boolean;
  orgId?: string;
  keyHint: string;
  usage?: Usage;
  fetchedAt?: number;
  error?: Failure;
  /** Transient outcome of the last save/clear, cleared by the next action. */
  notice?: { tone: "success" | "error"; code: string; detail?: string };
  saving: boolean;
  /** True while any request is in flight, so every view can show progress. */
  busy: boolean;
}

/** Localized copy for this plugin, read through the harness locale service. */
export const zh = {
  "pill.label": "OpenCode Go",
  "pill.remaining": "剩余 {percent}%",
  "pill.setup": "设置密钥",
  "pill.short.rolling": "5小时",
  "pill.short.weekly": "本周",
  "pill.short.monthly": "本月",
  "pill.compact": "{window} {percent}%",
  "pill.window.rolling": "5 小时窗口",
  "pill.window.weekly": "本周",
  "pill.window.monthly": "本月",
  "overlay.expand": "展开用量",
  "overlay.collapse": "收起",
  "overlay.refresh": "刷新",
  "overlay.settings": "设置",
  "overlay.updated": "{time} 更新",
  "overlay.never": "尚未获取",
  "overlay.limited": "已达上限",
  "overlay.used": "已用 {percent}%",
  "overlay.resetAt": "{time} 重置",
  "overlay.noReset": "无重置时间",
  "overlay.empty": "还没有密钥，先设置后再查询。",
  "overlay.loading": "正在查询用量…",
  "overlay.error": "查询失败",
  "settings.title": "OpenCode Go 用量",
  "settings.description": "悬浮窗显示 OpenCode Go 订阅的剩余额度。密钥只保存在本机，不会回传浏览器。",
  "settings.key": "API Key",
  "settings.keyHint": "在 opencode.ai/console → API Keys 创建后粘贴到这里。",
  "settings.keyPlaceholder": "粘贴 Console API Key",
  "settings.org": "组织 ID（可选）",
  "settings.orgHint": "仅当密钥同时属于多个组织时需要填写。",
  "settings.orgPlaceholder": "org_…",
  "settings.save": "保存并测试",
  "settings.saving": "保存中…",
  "settings.refresh": "刷新用量",
  "settings.clear": "移除密钥",
  "settings.saved": "已保存 {hint}",
  "settings.cleared": "已移除密钥",
  "settings.connected": "已连接 {hint}",
  "settings.notConfigured": "尚未配置密钥",
  "settings.showOverlay": "显示悬浮窗",
  "settings.showOverlayHint": "关闭后悬浮窗隐藏，设置页仍可查询。",
  "settings.current": "当前用量",
  "settings.noUsage": "保存密钥后这里会显示额度。",
  "settings.error.unauthorized": "密钥被拒绝，请重新生成。",
  "settings.error.timeout": "请求上游超时，请稍后重试。",
  "settings.error.network": "无法连接 opencode.ai，请检查网络。",
  "settings.error.upstream": "上游返回了错误。",
  "settings.error.shape": "上游返回了无法识别的内容。",
  "settings.error.empty": "密钥不能为空。",
  "settings.error.unknown": "查询失败：{detail}",
  "settings.footnote": "数据来自 OpenCode Console 的 /zen/go/v1/usage。",
};

/** English copy. */
export const en: Record<keyof typeof zh, string> = {
  "pill.label": "OpenCode Go",
  "pill.remaining": "{percent}% left",
  "pill.setup": "Set up key",
  "pill.short.rolling": "5h",
  "pill.short.weekly": "Week",
  "pill.short.monthly": "Month",
  "pill.compact": "{window} {percent}%",
  "pill.window.rolling": "5-hour window",
  "pill.window.weekly": "This week",
  "pill.window.monthly": "This month",
  "overlay.expand": "Expand usage",
  "overlay.collapse": "Collapse",
  "overlay.refresh": "Refresh",
  "overlay.settings": "Settings",
  "overlay.updated": "Updated {time}",
  "overlay.never": "Not fetched yet",
  "overlay.limited": "Limit reached",
  "overlay.used": "{percent}% used",
  "overlay.resetAt": "resets {time}",
  "overlay.noReset": "no reset time",
  "overlay.empty": "Add an API key to start tracking.",
  "overlay.loading": "Reading allowance…",
  "overlay.error": "Query failed",
  "settings.title": "OpenCode Go usage",
  "settings.description": "The floating widget shows how much of your OpenCode Go allowance is left. The key stays on this machine and never travels back to the browser.",
  "settings.key": "API key",
  "settings.keyHint": "Create one under opencode.ai/console → API keys, then paste it here.",
  "settings.keyPlaceholder": "Paste the Console API key",
  "settings.org": "Organization ID (optional)",
  "settings.orgHint": "Only needed when the key belongs to more than one organization.",
  "settings.orgPlaceholder": "org_…",
  "settings.save": "Save and test",
  "settings.saving": "Saving…",
  "settings.refresh": "Refresh usage",
  "settings.clear": "Remove key",
  "settings.saved": "Saved {hint}",
  "settings.cleared": "Key removed",
  "settings.connected": "Connected {hint}",
  "settings.notConfigured": "No key configured",
  "settings.showOverlay": "Show floating widget",
  "settings.showOverlayHint": "Hides the widget; this page still reads the allowance.",
  "settings.current": "Current allowance",
  "settings.noUsage": "Save a key to see the allowance here.",
  "settings.error.unauthorized": "The key was rejected — create a new one.",
  "settings.error.timeout": "The upstream request timed out. Try again.",
  "settings.error.network": "Cannot reach opencode.ai. Check the network.",
  "settings.error.upstream": "The upstream returned an error.",
  "settings.error.shape": "The upstream answer was not recognized.",
  "settings.error.empty": "The key must not be empty.",
  "settings.error.unknown": "Query failed: {detail}",
  "settings.footnote": "Values come from the OpenCode Console /zen/go/v1/usage endpoint.",
};

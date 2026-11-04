/** Dictionary namespace owned by this plugin. */
export const NS = "opencodeUsage";

/** Gauge shapes shared with the wire layer. */
import type { TokenSummary, Usage } from "./gauge";
export type { Meter, Usage, WindowKey } from "./gauge";

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
  /** Token totals for the current billing period, when the Console answered. */
  summary?: TokenSummary;
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
  "pill.short.rolling": "滚动",
  "pill.short.weekly": "本周",
  "pill.short.monthly": "本月",
  "pill.compact": "{window} {percent}%",
  "pill.window.rolling": "滚动窗口",
  "pill.window.weekly": "本周",
  "pill.window.monthly": "本月",
  "overlay.expand": "展开用量",
  "overlay.collapse": "收起",
  "overlay.refresh": "刷新",
  "overlay.settings": "设置",
  "overlay.reset": "复位位置",
  "overlay.updated": "{time} 更新",
  "overlay.never": "尚未获取",
  "overlay.limited": "已达上限",
  "overlay.used": "已用 {percent}%",
  "reset.soon": "即将重置",
  "reset.minutes": "{count} 分钟后重置",
  "reset.hours": "{count} 小时后重置",
  "reset.hoursMinutes": "{hours} 小时 {minutes} 分钟后重置",
  "reset.daysHours": "{days} 天 {hours} 小时后重置",
  "reset.days": "{count} 天后重置",
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
  "settings.mode": "显示位置",
  "settings.mode.overlay": "悬浮窗",
  "settings.mode.dock": "输入框上方",
  "settings.mode.hidden": "隐藏",
  "settings.modeHint": "放在输入框上方时，右下角的悬浮窗不再显示。",
  "settings.current": "当前用量",
  "settings.noUsage": "保存密钥后这里会显示额度。",
  "settings.error.unauthorized": "密钥被拒绝，请重新生成。",
  "settings.error.timeout": "请求上游超时，请稍后重试。",
  "settings.error.network": "无法连接 opencode.ai，请检查网络。",
  "settings.error.upstream": "上游返回了错误。",
  "settings.error.shape": "上游返回了无法识别的内容。",
  "settings.error.empty": "密钥不能为空。",
  "settings.error.invalid": "密钥包含不支持的字符。",
  "settings.error.unknown": "查询失败：{detail}",
  "usage.stats": "本周期 {requests} 次请求 · 输入 {input} · 输出 {output} · 缓存读 {cache}",
  "usage.period": "{from} ~ {to}",
  "settings.footnote": "数据来自 OpenCode Console 的 /zen/go/v1/usage 与 /api/usage/summary。",
};

/** English copy. */
export const en: Record<keyof typeof zh, string> = {
  "pill.label": "OpenCode Go",
  "pill.remaining": "{percent}% left",
  "pill.setup": "Set up key",
  "pill.short.rolling": "Rolling",
  "pill.short.weekly": "Week",
  "pill.short.monthly": "Month",
  "pill.compact": "{window} {percent}%",
  "pill.window.rolling": "Rolling",
  "pill.window.weekly": "This week",
  "pill.window.monthly": "This month",
  "overlay.expand": "Expand usage",
  "overlay.collapse": "Collapse",
  "overlay.refresh": "Refresh",
  "overlay.settings": "Settings",
  "overlay.reset": "Reset position",
  "overlay.updated": "Updated {time}",
  "overlay.never": "Not fetched yet",
  "overlay.limited": "Limit reached",
  "overlay.used": "{percent}% used",
  "reset.soon": "resets soon",
  "reset.minutes": "resets in {count}m",
  "reset.hours": "resets in {count}h",
  "reset.hoursMinutes": "resets in {hours}h {minutes}m",
  "reset.daysHours": "resets in {days}d {hours}h",
  "reset.days": "resets in {count}d",
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
  "settings.mode": "Placement",
  "settings.mode.overlay": "Floating",
  "settings.mode.dock": "Above composer",
  "settings.mode.hidden": "Hidden",
  "settings.modeHint": "The floating corner stays hidden while the strip above the composer is used.",
  "settings.current": "Current allowance",
  "settings.noUsage": "Save a key to see the allowance here.",
  "settings.error.unauthorized": "The key was rejected — create a new one.",
  "settings.error.timeout": "The upstream request timed out. Try again.",
  "settings.error.network": "Cannot reach opencode.ai. Check the network.",
  "settings.error.upstream": "The upstream returned an error.",
  "settings.error.shape": "The upstream answer was not recognized.",
  "settings.error.empty": "The key must not be empty.",
  "settings.error.invalid": "The key contains unsupported characters.",
  "settings.error.unknown": "Query failed: {detail}",
  "usage.stats": "this period · {requests} req · in {input} · out {output} · cache {cache}",
  "usage.period": "{from} ~ {to}",
  "settings.footnote": "Values come from the OpenCode Console /zen/go/v1/usage and /api/usage/summary endpoints.",
};

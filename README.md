# dsh-opencode-usage

[![ci](https://github.com/nana-2503/dsh-opencode-usage/actions/workflows/ci.yml/badge.svg)](https://github.com/nana-2503/dsh-opencode-usage/actions/workflows/ci.yml)

DeepSeek Harness（DSH）插件：在 Web 界面右下角**悬浮显示 OpenCode Go 订阅的剩余额度**，
并在插件设置页里输入 Console API Key 保存后查询。

A DeepSeek Harness plugin that floats an **OpenCode Go allowance widget** in the
bottom-right corner of the Web UI and stores the Console API key on the Host.

```
┌──────────────────────────────────┐
│ ● OpenCode Go              ⟳  ⌄ │
│                                  │
│ 滚动窗口  15:11 重置     已用 3% │
│ ▮▮▮▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯   │
│ 本周      11/9 08:00 重置 已用 3%│
│ ...                              │
│ ──────────────────────────────── │
│ 14:20 更新                ⚙ 设置 │
└──────────────────────────────────┘
```

## 功能 / Features

- **悬浮胶囊**：右下角常驻，显示最紧张的那个窗口的剩余百分比；点开是三段额度条、
  重置时间、刷新按钮。切换面板/会话都不会消失（渲染在 `shell.overlay` 浮层里）。
- **可拖动**：胶囊和卡片都能拖动，位置按浏览器记住；展开时会自动往左上长，不会跑出屏幕。
  拖离默认位置后，卡片右上角会出现「复位位置」按钮。
- **插件设置页**：左侧「插件」→ 已安装 → 本插件。粘贴 API Key（可选组织 ID），
  「保存并测试」立即查一次；支持刷新、移除密钥、开关悬浮窗。
- **四档配色**（按剩余额度）：≥70% 深绿 → ≥50% 蓝 → ≥20% 黄 → <20% 红；
  上游返回 `rate-limited` 时直接标红。
- **倒计时**：重置时间显示成「43 分钟后重置」这种相对时间（悬停可看绝对时刻），
  不用心算。
- **重启即显**：Host 会把最后一次读取结果缓存到磁盘，重启后第一帧就有数字，不会闪「查询中」。
- **密钥只在 Host**：浏览器只拿到末四位与用量数字，密钥永不回传页面。
- **跟随主题**：全部颜色走 `--dsw-alias-*` 令牌，浅色/深色自动切换。

## 安装 / Install

需要 DeepSeek Harness（`dsh`）以及一个 OpenCode Go 订阅。

**方式一：插件页添加**

在 DSH Web UI 的「插件 → 添加」里填入本仓库地址：

```
https://github.com/nana-2503/dsh-opencode-usage
```

**方式二：本地目录**

```bash
git clone https://github.com/nana-2503/dsh-opencode-usage
# 然后在 DSH 的插件页「添加」里选择这个目录，或通过 plugin_manager 安装该绝对路径
```

装好后刷新页面，右下角会出现「OpenCode Go」胶囊。

## 配置密钥 / API key

1. 打开 <https://opencode.ai/console>，创建一个 API Key。
2. DSH 里点胶囊 →「设置密钥」，或走「插件 → 已安装 → OpenCode Go 用量」。
3. 粘贴保存，页面会立即用该密钥查一次；失败会按原因提示（密钥被拒 / 超时 / 网络 / 上游异常）。

密钥保存在当前 profile 的 `opencode-usage.json`（权限 `0600`，例如
`~/.dsh/profiles/web/opencode-usage.json`）。浏览器侧只保存一个偏好：悬浮窗是否显示。

## 工作原理 / How it works

Host 半段注册四个同源路由，浏览器只与它们通信：

| 路由 | 作用 |
| --- | --- |
| `GET  /api/opencode-usage/state` | 读取缓存快照（必要时刷新） |
| `POST /api/opencode-usage/refresh` | 强制刷新 |
| `POST /api/opencode-usage/key` | 保存密钥并立即查询 |
| `POST /api/opencode-usage/clear` | 删除密钥 |

上游：

```
GET https://opencode.ai/zen/go/v1/usage
Authorization: Bearer <API key>
x-opencode-org-id: <org id>     # 可选，多组织密钥才需要
```

返回 `usage.rolling / usage.weekly / usage.monthly`（`percent` = 已用百分比、`status`、
`resetsAt`）。Host 侧最多每 60 秒刷新一次，页面每 60 秒轮询一次本地快照。

## 结构 / Layout

| 路径 | 作用 |
| --- | --- |
| `index.js` | Host：路由、密钥文件、上游请求、后台刷新 |
| `client.js` | 浏览器构件（由 `build.mjs` 生成，随仓库提交） |
| `cordis.patch.yml` | bundle 插入的插件行 |
| `locale/{zh,en}.json` | 插件列表里的标题与描述 |
| `src/client/*` | 悬浮窗、设置页、store、locale |
| `src/components/ui/*` | shadcn（base-nova / Base UI）组件 |
| `build.mjs` | Tailwind 编译 → 内联 CSS → esbuild 打包 |

组件来自 shadcn registry 的 **base-nova** 预设，跑在 **Base UI** 原语上
（`button`、`card`、`input`、`label`、`badge`、`progress`、`separator`、`switch`）。
`progress.tsx` 在原组件上加了 `trailing` / `indicatorClassName` 两个插槽，用来画
「填充块 + 断档 + 剩余段」这种分段额度条。

## 开发 / Development

```bash
npm install
npm run build      # 生成 client.js（已 minify）
npm run typecheck
npm test           # node:test，无第三方测试框架
```

CI（`.github/workflows/ci.yml`）跑 `typecheck → test → build`，并校验提交的
`client.js` 与源码一致 —— 改了 `src/` 忘记 `npm run build` 会被拦下。

Tailwind 只引 `theme` + `utilities` 两层、不含 preflight；插件自带一个限定在
`.ou-root` 内的作用域重置，避免影响 Harness 页面本身。改了 `client.js` 后，
DSH 的 client HMR 会自动重载浏览器模块；改了 `index.js`（Host 半段）需要重启
DSH，或在插件页把该行禁用/启用一次。

## 许可 / License

[MIT](LICENSE)

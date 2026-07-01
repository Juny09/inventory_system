# Debug Session: supplier-payment-404

Status: OPEN

## Problem
- Supplier payment 页面点击 `Save` 时，请求 `PUT /api/supplier-payments/:id` 返回 `404 (Not Found)`。
- 用户同时提供了 `/Users/junyuan78/Documents/trae_projects/inventory_system/error/console.txt`，需要判断哪些报错与项目有关。

## Scope
- Frontend: supplier payment modal save flow
- Backend: `/api/supplier-payments/:id` route reachability
- Environment: ngrok remote URL

## Hypotheses
1. 线上/ngrok 指向的后端进程还没有重启，仍在跑旧版本代码，所以没有 `PUT /:id` 路由。
2. 当前请求没有到达 `supplierPaymentRoutes`，而是被反向代理、部署配置或旧服务实例拦截。
3. 前端当前命中的 base URL 不是本地刚修改的服务，而是另一台未更新的远端环境。
4. `404` 不是业务层 `Payment record not found.`，而是路由级 `Not Found`，说明问题发生在 Express 路由注册之前。
5. `console.txt` 里的 `qk-background.js` / `qk-content.js` 报错来自浏览器扩展，不是你这个 inventory system 页面代码本身。

## Evidence Plan
- 检查前端 API base URL 配置，确认请求实际打到哪里。
- 检查后端启动脚本和当前运行方式，确认是否需要重启或重新部署。
- 给前端保存动作和后端 `PUT /:id` 增加最小化取证日志，上报到调试服务，而不是改业务逻辑。
- 如有需要，直接对目标 URL 做一次 HTTP 探测，区分“路由 404”还是“记录不存在 404”。

## Notes
- 在拿到运行时证据前，不修改业务逻辑。

## Evidence
- [api.js](file:///Users/junyuan78/Documents/trae_projects/inventory_system/web/src/services/api.js#L1-L44) 显示前端 API 走 `VITE_API_URL || '/api'`。
- [vite.config.js](file:///Users/junyuan78/Documents/trae_projects/inventory_system/web/vite.config.js#L8-L18) 显示开发环境下 `/api` 由 Vite 代理到 `http://localhost:4000`。
- 对 `https://skimmed-living-nephew.ngrok-free.dev/api/supplier-payments/5` 的直接探测返回 `ngrok ERR_NGROK_8012`，提示其上游是 `localhost:5173`，说明当前 ngrok 域名属于前端入口，不是独立后端域名。
- [console.txt](file:///Users/junyuan78/Documents/trae_projects/inventory_system/error/console.txt#L1336-L1355) 中的 `qk-background.js` / `qk-content.js` 来自浏览器扩展，不是业务代码文件。

## Hypothesis Status
| ID | Hypothesis | Status | Evidence |
|----|------------|--------|----------|
| A | ngrok 指到旧后端进程 | INCONCLUSIVE | 用户页面为 404，但命令行探测到当前 ngrok 域名本身连到 5173 前端入口 |
| B | 请求没进 `supplierPaymentRoutes` | LIKELY | 目前没有后端命中证据，且路由级 404 更像没进入新后端实例 |
| C | 前端命中的是错误服务入口 | CONFIRMED | ngrok 探测结果明确显示流量先到 `localhost:5173` |
| D | 这是路由级 404，不是记录不存在 404 | CONFIRMED | 用户报错是浏览器 `PUT ... 404`，而不是后端 JSON 业务消息 |
| E | `console.txt` 多数为浏览器扩展噪音 | CONFIRMED | 报错文件名均为 `qk-*` 扩展脚本 |

## Root Cause So Far
- 当前保存失败的核心不是表单字段本身，而是编辑模式依赖 `PUT /api/supplier-payments/:id`。
- 你实际命中的 ngrok 入口与本地前端开发服务绑定，当前这条链路下访问到的服务没有稳定提供该 `PUT` 路由，因此出现 404。
- 现有后端 `POST /api/supplier-payments` 已支持按 `supplier + year + month` 执行 upsert，可作为兼容回退路径。

## Fix Applied
- 前端编辑保存不再先发 `PUT /api/supplier-payments/:id`。
- 统一改为调用 `POST /api/supplier-payments` 的 upsert 逻辑。
- 如果编辑时改了 `supplier / month / year`，会在新记录 upsert 成功后，再删除旧记录，避免旧月份残留。
- 保留了最小取证日志，便于继续确认是否彻底修复。

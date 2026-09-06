# AWS 信号收件与本地 Codex 桥接迭代计划

日期：2026-09-06。状态：方案已选定，尚未实现或部署。用户授权记录与跨仓库同步；不代表授权部署 AWS、创建定时任务或自动交易。

## 已确认决策与仓库

- 复用现有 AWS API Gateway + Lambda webhook 服务，新增分析信号入口并持久化任务。
- 个人电脑普通 Python 程序按可配置间隔（默认 60 秒）检查一次；无任务不调用模型，有任务才提交 Codex。保持 Codex 和 TradingView 打开。
- AWS CDK / NestJS 仓库：`/Users/linuo/codes/trade-codes/trade-backend`。
- 内网 Docker 分析系统：`/Users/linuo/codes/local-trade-system`。
- 跨项目规格：`/Users/linuo/codes/trade-codes/trade-specs`。
- 本计划在三个仓库的 `docs/aws-signal-bridge-plan.md` 同步保留；跨服务契约变更须同次同步，不让副本独立演进。
- Cloudflare Tunnel 改为备选，不是首版依赖；邮件和 SQS 长轮询暂不并行建设。
- 不改变 M1 验收状态，也不提前启动 M1 完成后的 Next.js / shadcn / WebGPU 前端升级任务。

## 已核查基础与能力边界

后端 `cdk/lib/cdk-stack.ts` 使用 `apigw.LambdaRestApi`，当前是 REST API；已有 `src/modules/webhook/`，提供 TradingView trade-alert 路由。它们不是本需求的新任务队列，不能把已有通知功能当作本地分析闭环已完成。

本地系统已有方法版本、分析请求、受限读取和结果回传。新增云端收件、本地领取、自动提交桌面 Codex 与图上多空工具读取仍待实现。

Codex App Server 官方协议提供 `initialize` / `initialized`、`thread/resume`、`turn/start`，可供程序提交任务。官方同时标注 app-server / WebSocket 为实验性、非生产支持。协议存在不证明已打开桌面实例暴露同一连接，也不证明另启 CLI 实例继承桌面 Computer Use。本次只做文档和本地静态核查，未提交自动执行任务；CLI 帮助探测未完成，不能作为已验证能力。

## 首版数据流

TradingView → AWS HTTPS webhook → DynamoDB 持久收件 → 电脑 Python 按可配置间隔（默认 60 秒）领取 → 内网系统持久创建分析任务 → 同一电脑程序提交 Codex → 读取冻结方法与图表 → 结果回传内网案例。

首版由电脑上的一个桥接程序同时承担云端同步和桌面调度，避免家里服务器与电脑各做一次轮询。家里 Docker 服务无需公网入口；电脑通过 LAN 或已配置的 VPN 访问它。AWS 不直接向内网机器推送。电脑离线时任务留在 AWS；内网系统不可达时不得提前确认同步完成。

手动按钮创建同类任务，使用相同调度与分析流程；回放使用手动入口并明确记录回放时间，不依赖历史回放触发实时告警。

## 拆分迭代与验收门槛

| 步骤 | 范围 | 验收条件 |
|---|---|---|
| B0 桌面桥接验证 | I16 技术前置探针，不宣称 I16 完成 | Python 向目标桌面会话提交一条任务，确认会话身份、Computer Use 可用、能读取指定 TradingView，任务完成状态可获取；不下单 |
| B1 手动图表校对 | I15，依赖现有 I08 | 手动触发后读方法、核对 15min/1min 和图上文字/多空工具，结果回到同一案例 |
| B2 AWS 收件 | I14 / trade-backend | 复用 API Token 鉴权并限制 Admin / SuperAdmin，来源绑定和信号入口、DynamoDB 存储、去重、过期、领取/确认；持久成功后快速应答，不等待模型；保留既有通知行为 |
| B3 内网同步与调度 | I16 / local-trade-system | 可配置普通轮询（默认 60 秒），幂等导入，桌面串行执行；断网/进程重启可恢复，无任务零模型调用 |
| B4 实际闭环验收 | 两项目联调 | 一个真实告警从 AWS 到图表校对到结果保存；重复投递不重复分析，错误品种/过期信号不误分析 |

B0 是优先验证的小切片；如果无法接入已有桌面实例或拿到其工具，保留“任务准备好后手动提交”作为明确降级，不静默换成缺少 Computer Use 的 CLI。B0 通过后再冻结具体运行适配接口。以上为设计顺序，不自动更改原迭代依赖或启动开发。

## 拟定任务契约（开发前细化 API，不是已发布接口）

- 最小字段：signal_id、owner/source、exchange、symbol、timeframe、occurred_at、expires_at、mode（live/replay）、chart_binding、received_at。AWS 只保存必要信号，不需要上传整套个人交易方法。
- Bridge 客户端复用现有 API Token 模块，不另建设备 Token 系统；来源凭据仅用于 webhook 投递并绑定同一账户。限制大小、验证字段；告警文本是数据，不能成为 shell 指令或额外授权。
- AWS 同步状态与本地分析状态分开：云端 received / leased / imported / expired；本地 pending / running / completed / failed / needs_user / expired。
- AWS 领取使用有期限的租约；内网数据库幂等导入成功后才 ACK 云端。崩溃后重投凭 signal_id 找回同一任务，不重新创建。不能用“取走即删除”。
- 本地执行另有租约与续期；超时先对照 Codex turn 状态再重试，避免模型仍执行时重启第二次分析。一个桌面同一时间只执行一个图表任务。
- 显式绑定专用分析会话，不把行情信号插入正在做开发的当前会话；保存 task_id / thread_id / turn_id 的对应关系。
- 过期信号保留记录并提示过期；不能拿当前行情冒充告警时行情。信号时间、截图时间、回放截止时间分别保存。

## API Token、角色与用户隔离（用户确认的待实现要求）

- AWS Bridge 客户端通过现有 `tc_` API Token 模块鉴权，复用签发、哈希存储、验证和撤销流程；Token 放在鉴权请求头，不写入任务正文、日志或 URL。
- Bridge 仅允许 `Role.Admin`（`Admins`）与 `Role.SuperAdmin`（`SuperAdmins`）使用。FreePlan / ProPlan 不可使用；现有守卫按角色显式匹配，因此必须列出两个允许角色，不能假设自动继承。
- 每次 Bridge 请求都必须验证 Token 有效性和账户当前角色。现有 `authenticateToken` 只返回 userId/tokenId/scopes，不返回角色；实现时必须从服务端可信账户角色来源补齐，不接受客户端声明的 role。撤销 Token 或角色降级后拒绝后续调用。
- 现有 API Token 中间件主要允许 `/trade`，scope 类型也只有 trade 权限。开发时显式增加 Bridge 路由与操作权限映射，复用现有 Token，不把所有路由一并开放；具体 scope 映射在 API 实现前细化。不能仅在界面隐藏入口。
- Token 只解决身份识别，用户隔离还必须由数据访问保证：从认证结果推导 userId，创建、查询、领取、续约、确认和状态更新均校验 owner；拒绝请求体 userId 覆盖身份。Admin / SuperAdmin 也只能处理自己的 Bridge 任务，不自动获得跨用户访问权。
- TradingView webhook 的来源凭据只准投递，服务端将来源映射到所属用户，并检查该用户仍有 Bridge 使用权限；不要求 TradingView 携带客户端 API Token，不把 API Token 暴露在告警 URL。复用既有 webhook 来源机制，不另设绕过角色校验的入口。
- 内网导入绑定经过认证的云端账户与本地连接，禁止通过请求参数切换其他用户数据。内网已有受限分析 Token 继续负责方法读取和结果回传；AWS API Token 不因同名而自动获得内网权限。
- 验收覆盖：默认 60 秒及自定义间隔、非法配置；有效/无效/撤销 Token；Admin 与 SuperAdmin 成功、FreePlan/ProPlan 拒绝；角色降级；两用户互相猜测 task_id 或伪造 userId 均无法读写、领取、确认对方任务。

## 每次 AI 分析必须完成

1. 从内网系统读取本案例采用的方法版本与经验并冻结引用；新任务使用已采用版本，重试沿用原快照。MD 是维护/导出载体，运行时以服务记录为准。
2. 定位已打开的 TradingView，核对交易所、品种、15min/1min、实时或回放状态。按需调整缩放与时间位置，保留用户绘图；回放不得越过指定时点偷看后续行情。
3. 按用户双周期 FVG 方法分析行情，再校对用户图上文字、结构及多空工具中的入场、止损、止盈；无需另填人工观点表单。
4. 精确价位看不清时读取工具属性或标为缺证据，不能凭像素猜数。计划不当作已成交，不自动下单或修改用户计划。
5. 返回支持、冲突、缺项和下一观察点到原案例。用户修订方法/经验须确认后采用，历史快照不改写。

电脑开机、桌面可交互、应用权限可用是执行条件。锁屏、权限提示、窗口不匹配或断网应转为等待/需用户处理，不能承诺无人值守一定完成。

## 延迟与成本

轮询间隔配置项拟为 `BRIDGE_POLL_INTERVAL_SECONDS`，默认 `60`，单位秒；只接受正整数，非法配置明确报错，不退化为忙循环。运行时变更配置后重启桥接程序生效。故障退避独立于正常轮询间隔，无任务不调用模型。

默认 60 秒周期通常增加 0–60 秒的检查等待，另加 API、排队、截图和模型时间，不承诺 60 秒内完成分析。按 30 天全天运行，每台同步设备约 43,200 次检查；通用计算为 `30 × 24 × 3600 / interval_seconds`，只在交易时段运行可按比例下降。

本项目现有 REST API，应按 REST API Gateway 请求、Lambda 请求与执行时长、DynamoDB 读取/写入、日志/流量分别估算，不能直接套 HTTP API 单价。免费额度、区域和现有套餐未核实，不承诺免费。空队列用索引查询与小响应，避免全表扫描；云端只轮询一次，下游内网请求不额外经过 API Gateway。模型费用仅在实际分析时发生。

先记录每月请求量和端到端延迟，再判断是否值得增加 SQS 长轮询；首版不因空轮询成本增加另一套基础设施。

## 参考

- [Codex App Server](https://learn.chatgpt.com/docs/app-server)：任务协议与运行边界。
- [API Gateway 定价](https://aws.amazon.com/api-gateway/pricing/)；[Lambda 定价](https://aws.amazon.com/lambda/pricing/)。
- [TradingView webhook](https://www.tradingview.com/support/solutions/43000529348-how-to-configure-webhook-alerts/)：接收端必须快速响应。

# AWS 通知 Bridge 迭代计划

2026-09-06 用户最新要求：独立 Bridge hook 后端与前端管理，不复用交易 webhook。当前系统只负责 webhook 接收通知并入库、API Token 查询未读任务、将任务设为已读。此前的桌面 Codex、内网导入、轮询调度、租约和分析流程不属于本次交付。

## 范围与契约

- 仓库：`trade-backend` 实现 API/CDK，`trade-frontend` 实现管理页，`trade-specs` 维护规格与验证文档。
- 复用现有 API Gateway REST API、Lambda、Cognito、API Token；来源凭据由独立 Bridge 模块签发。
- `POST /webhook/bridge/:triggerToken`：使用独立 bh_ 凭据确定所属用户；旧 tw_ 交易 webhook 不适用。接受 JSON 对象或 `text/plain` 通知，最大 8 KiB；仅在 DynamoDB 保存成功后返回 200。不发送 Telegram，不调用模型。
- JSON 可带非空 `event_id`（最多 120 字符），相同用户 + hook + event_id 去重；同 ID 不同正文返回 409。不带 event_id 或纯文本按每次请求保存一条新通知。
- `GET /bridge/tasks?limit=20&cursor=...`：查询当前用户的未读任务，返回 `{items,nextCursor}`。`items` 为空且无 nextCursor 表示本次查询无未读任务；GSI 存在短暂可见延迟。
- `POST /bridge/tasks/:taskId/read`：将当前用户的任务标为 `read`，重复调用保持原 `readAt`；不删除记录。已读仅表示消费方确认，不表示分析完成。
- 任务状态只有 `unread` / `read`，没有领取、租约、过期、调度或自动处理状态。

## 身份与隔离

- 查询/已读复用 `Authorization: Bearer tc_...` 或 `X-API-Token`。GET 映射现有 `trade:read`，POST 映射 `trade:write`，已有 Token 无需重新签发；只开放两个任务消费路由；按 APP_ENV 兼容已配置 stage 前缀。
- 保留之前确认的权限要求：仅 Admin / SuperAdmin，实时从 Cognito 查当前用户启用状态和分组。普通用户、角色降级、禁用用户不可调用。
- 所有数据访问从认证结果确定 userId，任务 ID、正文、分页 cursor 都不能扩大用户权限。Webhook 只凭来源投递，不能查询或改为已读；每次投递核查 hook 未撤销且所属用户仍有权限。
- 独立管理页 `/trade/devtools/bridge`：创建、分页列表、重新生成 URL、停用。API 为 POST/GET `/bridge/hooks`、POST `/bridge/hooks/:hookId/rotate`、DELETE `/bridge/hooks/:hookId`，只接受网页登录，不开放给 API Token。
- 来源凭据格式 `bh_<hookId>.<随机secret>`，存储 secretHash，创建/重新生成时仅返回一次 webhookPath；前端使用已配置 API base 拼成完整 URL。重新生成立即使旧 URL 失效，停用后不再接收，已有任务保留。
- 原交易 Webhook 和 Telegram 接口保持独立，不迁移其 hook 或改变已有告警 URL。

## 存储与基础设施

新增独立 `BRIDGE_HOOKS_TABLE_NAME`：hookId 主键，user-created-index 按 userId/createdAt 分页；记录 name、userId、secretHash、createdAt、revokedAt。

通知 DynamoDB 表 `BRIDGE_TABLE_NAME`，主键 `userId + taskId`。保存 hookId、payload、status、receivedAt、readAt（可选）及去重摘要。

稀疏 GSI `unread-received-index`：`unreadUser + receivedOrder`，只保留未读记录的索引字段。查询按接收顺序分页；标已读通过条件更新设置状态与时间并移除索引字段。索引候选会回主表强一致读取，过滤已读记录。保留历史记录，不配置自动过期删除。

CDK 配置按需计费、PITR、RETAIN 和 Lambda 表读写权限。没有定时器、新公网服务或消费端代码；前端管理页需要同步部署。

## 交付与验收

实现交付状态：IN_REVIEW；代码和专项用例已编写但未执行，用户按 [验证文档](aws-signal-bridge-validation.md) 验证。未获得明确指令不运行 build、lint、测试或部署。

验收主链：前端创建独立 Bridge hook、复制完整 URL → POST 通知 → API Token 查到 unread → 标 read → 未读列表不再返回 → 重复标记保持幂等。

其他验收：无效/撤销来源与 Token、Admin/SuperAdmin/普通角色、角色降级、两用户隔离、去重冲突、大小限制、纯文本通知、分页、数据库失败时不假报成功、旧 Telegram 路由回归。

原跨系统计划由本次用户指令收敛；`local-trade-system` 本轮没有代码或文件变更，其旧计划副本不代表本仓库当前实现范围。

## 上次线上验证记录

2026-09-06 使用提供的 API Token 调用线上 GET /bridge/tasks，返回 401（API token 无权访问该接口），未创建测试通知。当前尚不能确认是部署旧包还是路径问题。本轮收窄并补充 stage 路径匹配，用例已编写；需要部署最新后端后复测，不标记线上问题已解决。

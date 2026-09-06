# AWS 通知 Bridge 验证文档

日期：2026-09-06。范围：webhook → DynamoDB → API Token 查询未读 → 标为已读。

## 本次交付与验证状态

| 项目 | 状态 |
|---|---|
| 后端通知入口、未读查询、幂等标记已读 | 2026-09-06 线上 HTTP 主链验证通过；多页分页专项尚未覆盖 |
| API Token 路由准入、实时 Admin/SuperAdmin 检查、用户隔离 | 已实现，待执行验证 |
| DynamoDB 表、未读索引、Lambda 配置和权限 | 线上接口读写成功；未直接审计 CloudFormation/IAM/主表 |
| JSON / 纯文本入口 | 两种线上投递均通过 |
| 专项自动化用例 | 已编写，未运行 |
| 前端 build（含内置 lint/类型检查/预渲染） | 2026-09-06 用户授权后执行 yarn build，通过；保留既有非阻塞警告 |
| 后端 build / 专项测试 | 未执行 |
| 真实 AWS / TradingView 告警验收 | AWS HTTP 主链通过；TradingView 自身告警触发尚未验证 |

本次修改 `trade-backend`、`trade-frontend` 与 `trade-specs`。没有消费端、Python 轮询、内网同步、Codex 调度或交易分析实现。已读是调用者确认消费的状态，不表示模型处理成功。

## 1. 验证前准备

1. 在 `trade-backend` 根目录用现有部署脚本发布最新 Lambda 和 CDK（生产命令 `yarn deploy:prod` 会先 build:lambda，再部署 CDK）。直接在 cdk 目录部署不会重新构建 Lambda，可能仍上传旧代码。
2. 确认 CDK 新增 `BRIDGE_HOOKS_TABLE_NAME` 与 `BRIDGE_TABLE_NAME`，分别包含 user-created-index 与 unread-received-index；环境变量和表权限由 CDK 注入。
3. 部署本次前端，确保 `NEXT_PUBLIC_API_BASE_URL` 是对应后端地址，包含 stage 前缀。
4. 用启用状态的 Admin / SuperAdmin 登录，进入“开发者工具 → Webhook Bridge”，输入名称并创建，复制一次性完整 Hook URL。无需选择交易记录或 Telegram 群。旧交易 webhook URL/token 不适用于独立 Bridge。
5. 同一账户在 API Token 页面创建或复用未撤销 tc_ Token。已有 trade:read / trade:write 足够。
6. 只需将新 Hook URL 和 API Token 提供给测试者；API base 可从 Hook URL 提取。API Token 无权创建、列出、重新生成或停用 hook。

测试 shell 配置（不将明文凭据写入报告）：

```bash
export BRIDGE_API_BASE='https://<api-id>.execute-api.<region>.amazonaws.com/<stage>'
read -r -s BRIDGE_API_TOKEN
export BRIDGE_API_TOKEN
read -r -s BRIDGE_HOOK_URL
export BRIDGE_HOOK_URL
```

新建 hook 的列表索引可能短暂延迟；投递使用主表凭据校验，不依赖来源索引。

## 2. 主链验收

### 2.1 接收 JSON 通知

```bash
curl --fail-with-body -sS -X POST \
  "$BRIDGE_HOOK_URL" \
  -H 'Content-Type: application/json' \
  --data '{"event_id":"bridge-validation-20260906-001","message":"BTCUSDT 15m 测试通知","symbol":"BTCUSDT","timeframe":"15"}'
```

预期 HTTP 200，响应形状：

```json
{"taskId":"<64位任务ID>","status":"unread","duplicate":false}
```

确认 DynamoDB 主表存在该 taskId，`userId` 是独立 Bridge hook 所属账户，`payload` 保留通知，`status=unread`。只有持久写入成功才返回成功。每轮验收更换 event_id，避免读到上轮已读任务。

### 2.2 API Token 查询未读

```bash
curl --fail-with-body -sS \
  "$BRIDGE_API_BASE/bridge/tasks?limit=20" \
  -H "Authorization: Bearer $BRIDGE_API_TOKEN"
```

预期 HTTP 200：`items` 中找到上述 taskId，并可读取 `payload`、`hookId`、`receivedAt`、`status`。无任务时返回 `{"items":[],"nextCursor":null}`。响应无外层 `success/data` 包装。

如有 `nextCursor`，使用 URL 编码继续查询：

```bash
export BRIDGE_CURSOR='<上次返回的nextCursor>'
curl --fail-with-body -sS -G "$BRIDGE_API_BASE/bridge/tasks" \
  -H "Authorization: Bearer $BRIDGE_API_TOKEN" \
  --data-urlencode 'limit=20' --data-urlencode "cursor=$BRIDGE_CURSOR"
```

GSI 新写入有短暂可见延迟；刚投递后未查到时重试查询，不要立即重复投递。每轮新检查从无 cursor 的第一页开始。

### 2.3 标记已读

```bash
export BRIDGE_TASK_ID='<2.1返回的taskId>'
curl --fail-with-body -sS -X POST \
  "$BRIDGE_API_BASE/bridge/tasks/$BRIDGE_TASK_ID/read" \
  -H "Authorization: Bearer $BRIDGE_API_TOKEN"
```

预期 HTTP 200，返回任务 `status=read` 和 `readAt`。再次查询未读列表，该任务不再出现。主表记录保留，未读索引字段已移除。重复执行标记请求仍成功，`readAt` 保持第一次的值。

### 2.4 去重与纯文本

- 重复 2.1 的相同 JSON，预期相同 taskId、`duplicate=true`，已读任务不重新变成未读。JSON 属性顺序变化不影响去重。
- 保持 event_id 不变、修改 message，预期 HTTP 409。
- JSON 不带 event_id 时，每次请求产生新任务；如果发送方需要防止重投重复，应提供稳定 event_id。
- 纯文本调用：

```bash
curl --fail-with-body -sS -X POST \
  "$BRIDGE_HOOK_URL" \
  -H 'Content-Type: text/plain' --data 'TradingView plain text test'
```

预期入库 `payload={"message":"TradingView plain text test"}`。纯文本无法提供 event_id，每次请求创建新任务。

## 3. 前端 hook 管理验收

- `/trade/devtools/bridge` 可创建、列出自己的 hook；API Token 页面可跳转该页。
- 创建成功直接显示可复制的完整 URL，带正确 API stage；不出现 tradeShortId、交易选择或 Telegram 绑定。
- 刷新后不显示旧凭据；重新生成 URL 时显示新 URL，旧 URL 投递返回 403。
- 停用后列表展示“已停用”，该 URL 投递返回 403，之前接收的任务仍可查询/标已读。
- 另一账户不能管理该 hook；API Token 调用 hook 管理接口被拒绝。
- 网络失败显示错误，不显示“创建成功”；不将凭据保存到 localStorage 或文档。
- 页面手工验证待部署完成后进行，前端 build 已通过，浏览器验收未执行。

## 4. 权限与异常验收清单

| 场景 | 预期 | 实测记录 |
|---|---|---|
| Admin / SuperAdmin 的有效 Token | 两类账户均可查询并标已读 | 待验证 |
| `X-API-Token` 代替 Bearer | 同样可访问 | 待验证 |
| 无效、缺少或已撤销 Token | 401/403，不能读写任务 | 待验证 |
| FreePlan / ProPlan | 403 | 待验证 |
| 管理员降级 / 账户禁用后复用旧 Token | 后续访问拒绝 | 待验证 |
| 无效 / 已撤销 webhook 来源 | 403、不入库 | 待验证 |
| hook 所属用户降级 / 禁用 | webhook 拒绝、不入库 | 待验证 |
| B 用户查询未读 | 只返回 B 的任务 | 待验证 |
| B 用户使用 A 的 taskId 标已读 | 404，A 的任务不变 | 待验证 |
| B 用户复用 A 的分页 cursor | 400 | 待验证 |
| payload 中伪造 userId / status | 仅作为通知正文保存，不能更改归属或初始 unread 状态 | 待验证 |
| 空正文、空对象、数组、非字符串 event_id | 400 | 待验证 |
| JSON / 文本超过 8 KiB | 拒绝（解析器 413，或规范化后校验 400），不入库 | 待验证 |
| limit=0 / 101 / abc / 1.5，非法 cursor | 400 | 待验证 |
| 不存在的合法 taskId | 标记返回 404 | 待验证 |
| 只有 trade:read 的 Token 标已读 | 403 | 待验证 |
| 两个请求同时标同一任务已读 | 两者成功且相同 readAt | 待验证 |
| DynamoDB 不可用 / 未配置表名 | 返回错误，不假报接收成功 | 待验证 |
| 旧 trade-alert → Telegram 路由 | 仍按原流程通知 | 待验证 |
| Bridge 路由 | 无 Telegram 消息、模型调用或后台消费 | 待验证 |

数据库故障、角色降级、撤销等操作只对专用测试资源执行。新入口的应用错误日志已遮蔽 URL 内的 triggerToken；部署环境如启用了额外访问日志，应检查其是否记录完整 URL。

## 5. 可选专项自动化命令（本次未执行）

经用户授权后，在后端仓库运行：

```bash
cd /Users/linuo/codes/trade-codes/trade-backend
yarn test --runInBand src/modules/bridge/bridge.service.spec.ts src/modules/bridge/bridge-access.service.spec.ts src/modules/bridge/bridge-hooks.service.spec.ts
```

用例覆盖持久写入失败、去重、已读幂等、未读索引候选回主表过滤、分页、跨用户 cursor、角色、Token 路由与撤销检查。这里的 SDK 调用使用 mock，不能替代真实 AWS 条件写入、IAM、HTTP 路由和 TradingView 延迟验收。运行结果填写于本文件，不因用例存在就标记通过。

## 6. 发布与回滚

- 没有数据库历史数据迁移；新增独立表。先检查 CDK 变更清单，再由用户执行部署。
- 验证实际 webhook 应答延迟满足发送方超时要求；服务不等待消费方，但仍包含 Cognito 鉴权和 DynamoDB 写入耗时。
- 回滚时先停用发送方告警或撤销测试 hook，再恢复前一版 Lambda。新表使用 RETAIN，保留通知记录，不自动删除。
- 只有完成上面的实际主链和权限验收后，再将迭代状态从 IN_REVIEW 推进至验收/发布阶段。

## 7. 已发生的线上探测（上一版）

2026-09-06T02:38:10Z：GET /bridge/tasks?limit=1 返回 HTTP 401，错误 API token 无权访问该接口。此次在发送通知前停止，没有创建或标记任何任务。独立 Bridge 版本尚未部署，不能用这次失败证明新版本可用或确认故障根因。

## 前端构建修复记录（2026-09-06）

`yarn build` 复现 Bridge 管理页 28 行类型错误：object 不能赋给 Record<string, unknown>。将页面 request 辅助函数的 body 类型改为 `Record<string, unknown>`，与 fetchWithAuth.actualBody 一致，无运行时逻辑变化。

修复后再次执行 `yarn build`：退出码 0，完整构建通过（15.98 秒），包含类型检查和预渲染。现有 img / React Hook 依赖警告不阻塞构建。本次未部署，未执行浏览器或后端接口验证。

## 独立 Bridge 线上验收结果（2026-09-06T02:54:02.276501+00:00）

通过 18 项 HTTP 检查。使用本次提供的独立 hook 与 API Token；报告不保存凭据。只创建两条测试通知，均已标记已读，未修改原有任务或 hook 设置。

| 检查 | 结果 | HTTP / 耗时 |
|---|---|---|
| API token unread query | 通过 | 200 / 1398 ms |
| JSON receive | 通过 | 200 / 1371 ms |
| JSON persisted payload query | 通过 | — |
| duplicate delivery | 通过 | 200 |
| same event_id changed payload rejected | 通过 | 409 |
| JSON mark read | 通过 | 200 |
| JSON repeated mark read | 通过 | 200 |
| JSON no longer unread | 通过 | — |
| redelivery does not reopen read task | 通过 | 200 |
| plain text receive | 通过 | 200 / 1062 ms |
| plain text persisted payload query | 通过 | — |
| plain text mark read | 通过 | 200 |
| plain text repeated mark read | 通过 | 200 |
| plain text no longer unread | 通过 | — |
| invalid API token denied | 通过 | 401 |
| API token cannot manage hooks | 通过 | 401 |
| invalid hook denied | 通过 | 403 |
| empty notification rejected | 通过 | 400 |

测试记录（保留在主表，状态为 read）：

- JSON：`73413e301d481f1d06f76ecadf254fd2cb92f78d7c973c1bfb77f31c7567fd71`，readAt：2026-09-06T02:54:09.307Z。
- plain text：`3d27db2781ca46db3f4926343c702f2540d94981971c15847d150a72acdeaec1`，readAt：2026-09-06T02:54:15.643Z。

与上次结果对比：GET /bridge/tasks 已返回 200，本次不再出现先前路由权限 401；不追溯判定旧版本故障根因。接收请求样本耗时分别为 1371 ms / 1062 ms，不代表持续延迟或冷启动保证。

验证边界：这是直接调用线上 AWS API 的实测，未从 TradingView UI 触发真实告警；未覆盖跨用户、角色降级、撤销真实凭据、hook 旋转/停用、并发、多页分页及故障注入。

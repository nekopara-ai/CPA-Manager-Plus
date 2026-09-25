# Codex 网关铸票界面

此界面适配 CLIProxyAPI 定制版 `v7.3.16-nekopara.168` 的 gateway-mint 合约，
保留旧后端的展示兼容性，不在浏览器里铸票或转发模型请求。

## 入口

- **配置管理 → 可视化 → Codex 网关铸票**：编辑 `codex.turn-ticket`。
- **账号列表／卡片 → 铸票状态 → 账号详情**：分别查看上报的 SSE、WebSocket 材料。
- **实时监控**：请求来源仍区分缓存注入、客户端透传、未携带及未知；响应票长只作为中性观测值。

## 配置保存

表单提供总开关、自适应路径、新引擎、注入开关、fail-closed，以及目标网关、票长、
票据与 Cookie pair 的独立期限、尝试预算、超时、冷却、容量、并发、模型、凭据和传输范围。
留空继承后端；布尔 false 和数值 0 不等于未配置。尤其票长留空继承套餐策略、0 仅关闭长度比较。
仅更新实际修改的键，保留 YAML 注释、其他 Codex 设置、旧策略和未知新字段。

开启总开关会启动真实上游请求并可能消耗配额。无合格材料且 fail-closed 开启时，范围内业务会被阻断；
仅探测（关闭注入）但不阻断业务，需要显式关闭 fail-closed。关闭 gateway-mint 是旧引擎回滚，
不是关闭总功能。模型名必须是实际上游名称；auth-ids 是 CPA 内部凭据 ID；代理可留空，先走原业务出口。
表单保存成功不是实际材料获取成功；不会自动切换业务网络出口或开启凭据的 WebSocket 能力。

## 状态合约

读取凭据响应 `codex_turn_ticket.models[].mint_states.sse/websocket`，只使用明确上报的传输。
接收 ready、gateway、model、ticket_length、ticket_expires_at、pair_expires_at、observed_at、
next_attempt_at、attempts、status、reason、in_flight；不保留原始票据、Cookie 或令牌。

后端 ready=true 且票据／pair 均未到期，才显示对应路径的材料就绪。
前端时钟只能把过期结果降为不可用，不能从相同模型名、780 票长、路由标签或旧 healthy/direct 汇总推导就绪。
所有已上报路径都就绪才显示完整就绪；SSE 成功但 WebSocket 未就绪显示部分路径就绪。
未上报的传输可能未配置、不支持或未上报，不臆造成功或失败。空／无效的 mint_states 不退回旧票长判定。

两个到期时间独立展示，Go 零时间不显示为公元一年。按需更新过期状态。
原因和次数是账号／传输共享采集轮次的最近结果，不冒充逐模型完整探测日志。
“材料就绪”和“注入开关开启”都不证明某条业务请求已实际注入，更不证明模型智能水平。
未知原因显示受控的未知结果文案，不直接输出任意后端错误正文。

## 发布与迁移边界

此次面板基于同步到上游 v1.14.0 的定制分支，保留 effective_service_tier 计费语义。
归档恢复保留归档中的派生计费字段；非归档数据继续优先使用 CPA 上报的 effective_service_tier。
没有增加数据库迁移，没有改变 CPA 业务转发，部署面板也不会自动修改你的 CPA 运行配置。
发布入口仍是仓库的 Build patched image：PR 验证后合入 `codex/cpamp-effective-tier`，
由该分支自动生成 `ghcr.io/nekopara-ai/cpa-manager-plus:patched` 和不可变 SHA 镜像标签。

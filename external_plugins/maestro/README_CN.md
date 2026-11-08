# maestro

ZCode 多智能体编排插件。安装一套调度协议与六类最小权限的专业子智能体，由**当前主会话担任编排者（maestro）**，将任务路由给各专家。灵感来自 oh-my-opencode-slim 等编排者/专家工作流，以纯 ZCode 插件组件实现——无 MCP、无 Hook、无网络访问。

## 成员

| 智能体（调用名） | 职责 | 工具 |
|---|---|---|
| `maestro:scout` | 只读代码侦察与调研：探索、追踪调用链、查外部文档 | Read, Grep, Glob, Bash, WebFetch, WebSearch |
| `maestro:elder` | 架构与风险顾问：决策、权衡、疑难问题诊断策略 | Read, Grep, Glob, Bash |
| `maestro:atelier` | UI/UX 设计负责人：设计决策、界面评审、可落地规范 | Read, Grep, Glob, Bash |
| `maestro:wright` | 有边界的实现者：按明确规范落地改动，跑测试/构建 | Read, Edit, Write, Grep, Glob, Bash |
| `maestro:lens` | 视觉分析师：截图、PDF、图表——如实报告所见 | Read |
| `maestro:tribunal` | 对抗式评审团：多视角裁决并附通过条件 | Read, Grep, Glob, Bash |

设计原则：

- **最小权限**——每个智能体只获得其角色所需的最窄工具集。只有 `wright` 能修改文件；`lens` 只能读；各顾问路线完全无写入权限。
- **禁止嵌套**——专家永不派生其他智能体；所有路由经由编排者（主会话）。专家需要其他路线时只负责说明，由编排者派发。
- **派发自包含**——协议的任务契约要求每次派发携带目标、上下文、范围、输出格式与验证方式，因为专家从零开始工作。
- **续用而非重启**——追问延续同一个智能体，不重启丢失上下文的新实例。

## 人的调用方式

- `/maestro <任务>` —— 以编排模式执行任务：规划路线、派发、汇总、验证。
- 示例：`/maestro 将 auth 模块重构为使用新的 token API，并更新其测试`

## Agent 的调用方式

- `maestro` 技能（`skills/maestro-orchestration/`）会被自动发现；当请求呈现编排形态（"并行委派"、"交给专家"）时激活，为当前会话注入路由表、派发契约、防火墙与汇合规则。
- 可通过子智能体工具直接派发，`subagent_type` 取：`maestro:scout`、`maestro:elder`、`maestro:atelier`、`maestro:wright`、`maestro:lens`、`maestro:tribunal`。

## 典型流程

1. 主会话加载协议，按任务规划路线。
2. 独立路线并行派发（例如 `scout` 绘制代码地图的同时 `lens` 阅读设计稿）。
3. 决策类问题路由给 `elder`/`atelier`；高风险方案交 `tribunal` 终审。
4. `wright` 执行实现路线并返回证据（测试/构建输出）。
5. 编排者阅读产出物，对照验收标准验证后汇报。

## 范围与副作用

仅含纯 Markdown 组件：无 Hook、无 MCP 服务、无脚本、无网络端点、无用户配置。可能的副作用仅来自各智能体被授予的工具（见成员表）及其使用方式。

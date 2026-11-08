# maestro

ZCode 多智能体编排插件。安装一套调度协议、四项配套工作流技能（`codemap`、`simplify`、`deepwork`、`verification`）、一个 `PreToolUse` Bash 只读防护 Hook，以及六类最小权限的专业子智能体，由**当前主会话担任编排者（maestro）**，将任务路由给各专家。灵感来自 oh-my-opencode-slim 等编排者/专家工作流，以原生 ZCode 插件组件实现。

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

- **最小权限**——每个智能体只获得其角色所需的最窄工具集。只有 `wright` 能修改文件；`lens` 只能读；各只读顾问路线的 `Bash` 调用由插件 `PreToolUse` Hook 强制拦截写操作。
- **禁止嵌套**——专家永不派生其他智能体；所有路由经由编排者（主会话）。专家需要其他路线时只负责说明，由编排者派发。
- **派发自包含**——协议的任务契约要求每次派发携带目标、上下文、范围、输出格式与验证方式，因为专家从零开始工作。
- **续用而非重启**——追问延续同一个智能体，不重启丢失上下文的新实例。

## 配套工作流技能

| 技能 | 斜杠命令 | 用途 |
|---|---|---|
| `maestro` | `/maestro <任务>` | 核心编排协议：规划路线、派发专家、汇总并验证结果。 |
| `maestro-codemap` | `/maestro:codemap [目标]` | 仓库代码地图生成：并行派发 `maestro:scout` 梳理架构、入口点（`file:line`）、数据流与不变量。 |
| `maestro-simplify` | `/maestro:simplify <目标>` | 保持行为不变的代码化简：由 `maestro:elder` 识别冗余复杂度，交 `maestro:wright` 实施等价精简并验证。 |
| `maestro-deepwork` | `/maestro:deepwork <任务>` | 深度三阶段自治开发（**Sketch 骨架 → Structure 结构 → Detail 打磨**），适用于大型跨模块任务。 |
| `maestro-verification` | `/maestro:verify-plan <变更>` | 实现前验证规划：提炼可证伪断言、设计经验验证路径，并制定不重复的路线测试预算。 |

## 人的调用方式

- `/maestro <任务>` —— 以编排模式执行任务：规划路线、派发、汇总、验证。
- `/maestro:codemap [子系统]` —— 并行派发 `maestro:scout` 生成仓库或子系统架构地图。
- `/maestro:simplify <模块或 diff>` —— 在不改变外部可观测行为的前提下化简复杂代码。
- `/maestro:deepwork <复杂特性>` —— 以三阶段渐进式流程（**Sketch → Structure → Detail**）自治完成大型开发。
- `/maestro:verify-plan <计划变更>` —— 在编码前设计具体的验证证据链与测试预算。

## Agent 的调用方式

- 五项技能（`maestro`、`maestro-codemap`、`maestro-simplify`、`maestro-deepwork`、`maestro-verification`）均会自动发现，并在匹配请求时激活。
- 可通过子智能体工具直接派发，`subagent_type` 取：`maestro:scout`、`maestro:elder`、`maestro:atelier`、`maestro:wright`、`maestro:lens`、`maestro:tribunal`。

## 典型流程

1. 主会话加载协议（按需加载 `maestro-codemap` / `maestro-verification`），按任务规划路线。
2. 独立路线并行派发（例如 `scout` 绘制代码地图的同时 `lens` 阅读设计稿）。
3. 决策类问题路由给 `elder`/`atelier`；高风险方案交 `tribunal` 终审。
4. `wright` 执行实现路线（或按 `maestro-deepwork` 三阶段推进）并返回证据（测试/构建输出）。
5. 编排者阅读产出物，按需执行 `maestro-simplify` 精简，对照验收标准验证后汇报。

## 范围、Hook 与副作用

- **组件**：纯 Markdown 命令、技能与子智能体，外加一个本地 `PreToolUse` Hook（`hooks/hooks.json` → `hooks/guard-bash.mjs`，需 `PATH` 中存在 `node`）。无 MCP 服务、无网络端点、无用户配置。
- **Bash 只读与高危防护（`hooks/guard-bash.mjs`）**：在 `PreToolUse` 阶段拦截 `Bash` 调用。当处于只读专家路线（`scout`、`elder`、`atelier`、`tribunal`、`lens`）时，禁止文件修改、重定向写入（`>`）、变更类 `git` 子命令及包管理/构建写入；同时在所有路线中拦截灾难性破坏命令（如 `git reset --hard`、`git clean -f`、未带 `--force-with-lease` 的 `git push --force`）。

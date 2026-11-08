# maestro

Multi-agent orchestration for ZCode. The plugin installs a dispatch protocol, four companion workflow skills (`codemap`, `simplify`, `deepwork`, `verification`), a `PreToolUse` Bash mutation guard hook, and six least-privilege specialist sub-agents; **your main session acts as the orchestrator** ("maestro") and routes work to the specialists. Inspired by orchestrator/specialist workflows like oh-my-opencode-slim, rebuilt as native ZCode plugin components.

## Roster

| Agent (invoked as) | Role | Tools |
|---|---|---|
| `maestro:scout` | Read-only codebase recon and research: discovery, tracing, external docs | Read, Grep, Glob, Bash, WebFetch, WebSearch |
| `maestro:elder` | Architecture and risk advisor: decisions, trade-offs, debugging strategy | Read, Grep, Glob, Bash |
| `maestro:atelier` | UI/UX design owner: design decisions, reviews, buildable specs | Read, Grep, Glob, Bash |
| `maestro:wright` | Bounded implementer: applies well-specified changes, runs tests/builds | Read, Edit, Write, Grep, Glob, Bash |
| `maestro:lens` | Visual analyst: screenshots, PDFs, diagrams — reports what is visible | Read |
| `maestro:tribunal` | Adversarial review panel: multi-perspective verdicts with conditions | Read, Grep, Glob, Bash |

Design principles carried over from orchestrator/specialist practice:

- **Least privilege** — every agent gets the narrowest toolset its role needs. Only `wright` can modify files; `lens` can only read; the advisory lanes cannot write at all and their `Bash` calls are guarded by the plugin's `PreToolUse` hook.
- **No nesting** — specialists never dispatch other agents; all routing goes through the orchestrator (your session). A specialist that needs another lane says so, and the orchestrator dispatches it.
- **Self-contained dispatches** — the protocol's dispatch contract forces every task prompt to carry objective, context, scope, output format, and validation, because specialists start cold.
- **Amend, don't respawn** — follow-ups resume the same agent instead of restarting cold work.

## Companion workflow skills

| Skill | Slash command | Purpose |
|---|---|---|
| `maestro` | `/maestro <task>` | Core orchestration protocol: plan lanes, dispatch specialists, reconcile and verify results. |
| `maestro-codemap` | `/maestro:codemap [target]` | Repository cartography: dispatch parallel `maestro:scout` lanes to map architecture, entry points (`file:line`), data flow, and invariants. |
| `maestro-simplify` | `/maestro:simplify <target>` | Behavior-preserving code simplification: diagnose accidental complexity with `maestro:elder` and apply surgical cleanup with `maestro:wright`. |
| `maestro-deepwork` | `/maestro:deepwork <task>` | Autonomous three-pass execution (**Sketch → Structure → Detail**) for large, multi-phase engineering tasks. |
| `maestro-verification` | `/maestro:verify-plan <change>` | Pre-implementation verification planning: frame falsifiable claims, design empirical evidence paths, and set per-lane verification budgets. |

## How a person invokes it

- `/maestro <task>` — run a task in orchestrated mode: lanes are planned, dispatched, reconciled, and verified.
- `/maestro:codemap [subsystem]` — map the repository or a subsystem in parallel via `maestro:scout`.
- `/maestro:simplify <module or diff>` — simplify complex code without changing observable behavior.
- `/maestro:deepwork <complex feature>` — run autonomous three-pass execution (**Sketch → Structure → Detail**).
- `/maestro:verify-plan <planned change>` — design an empirical verification plan before implementation.

## How an Agent invokes it

- All five skills (`maestro`, `maestro-codemap`, `maestro-simplify`, `maestro-deepwork`, `maestro-verification`) are auto-discovered and activate on matching requests.
- Specialists can be dispatched directly through the sub-agent tool with `subagent_type`: `maestro:scout`, `maestro:elder`, `maestro:atelier`, `maestro:wright`, `maestro:lens`, `maestro:tribunal`.

## Typical flow

1. Main session loads the protocol (and `maestro-codemap` / `maestro-verification` when needed) and plans lanes from the task.
2. Independent lanes are dispatched in parallel (e.g. `scout` maps the code while `lens` reads the mockup).
3. Decisions route to `elder`/`atelier`; `tribunal` reviews the plan if stakes are high.
4. `wright` applies implementation lanes (or progressive `maestro-deepwork` passes) and returns evidence (test/build output).
5. The orchestrator reads the artifacts, optionally runs a `maestro-simplify` pass, verifies against acceptance criteria, and reports.

## Scope, hooks, and side effects

- **Components**: Markdown commands, skills, and sub-agents, plus one local `PreToolUse` Hook (`hooks/hooks.json` → `hooks/guard-bash.mjs`, requires `node` on `PATH`). No MCP servers, no network endpoints, no user configuration.
- **Bash mutation guard (`hooks/guard-bash.mjs`)**: Runs on `PreToolUse` for `Bash`. It blocks file writes, shell output redirections (`>`), mutating `git` subcommands, and package/build mutations when invoked from read-only specialist lanes (`scout`, `elder`, `atelier`, `tribunal`, `lens`), and blocks catastrophic destructive commands (`git reset --hard`, `git clean -f`, unguarded `git push --force`) across all lanes.

# maestro

Multi-agent orchestration for ZCode. The plugin installs a dispatch protocol plus six least-privilege specialist sub-agents; **your main session acts as the orchestrator** ("maestro") and routes work to the specialists. Inspired by orchestrator/specialist workflows like oh-my-opencode-slim, rebuilt as pure ZCode plugin components — no MCP, no hooks, no network access.

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

- **Least privilege** — every agent gets the narrowest toolset its role needs. Only `wright` can modify files; `lens` can only read; the advisory lanes cannot write at all.
- **No nesting** — specialists never dispatch other agents; all routing goes through the orchestrator (your session). A specialist that needs another lane says so, and the orchestrator dispatches it.
- **Self-contained dispatches** — the protocol's dispatch contract forces every task prompt to carry objective, context, scope, output format, and validation, because specialists start cold.
- **Amend, don't respawn** — follow-ups resume the same agent instead of restarting cold work.

## How a person invokes it

- `/maestro <task>` — run a task in orchestrated mode: lanes are planned, dispatched, reconciled, and verified.
- Example: `/maestro refactor the auth module to use the new token API and update its tests`

## How an Agent invokes it

- The `maestro` skill (in `skills/maestro-orchestration/`) is auto-discovered; it activates on orchestration-shaped requests ("delegate this in parallel", "route this to specialists") and installs the routing table, dispatch contract, firewall, and reconciliation rules into the current session.
- Specialists can be dispatched directly through the sub-agent tool with `subagent_type`: `maestro:scout`, `maestro:elder`, `maestro:atelier`, `maestro:wright`, `maestro:lens`, `maestro:tribunal`.

## Typical flow

1. Main session loads the protocol and plans lanes from the task.
2. Independent lanes are dispatched in parallel (e.g. `scout` maps the code while `lens` reads the mockup).
3. Decisions route to `elder`/`atelier`; `tribunal` reviews the plan if stakes are high.
4. `wright` applies implementation lanes and returns evidence (test/build output).
5. The orchestrator reads the artifacts, verifies against acceptance criteria, and reports.

## Scope and side effects

Plain markdown components only: no hooks, no MCP servers, no scripts, no network endpoints, no user configuration. The only side effects possible are through the tools granted to each agent (see roster table) and whatever a specialist does with them.

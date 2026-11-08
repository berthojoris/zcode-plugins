---
name: maestro
description: "Multi-agent orchestration protocol: turn the current session into a dispatcher that routes work to specialist sub-agents (maestro:scout, maestro:elder, maestro:atelier, maestro:wright, maestro:lens, maestro:tribunal). Use when a task is large, parallelizable, or benefits from specialist lanes - codebase recon, architecture review, UI/UX design, bounded implementation, visual analysis, adversarial review - or when the user asks to orchestrate, delegate, parallelize, or dispatch agents, or invokes /maestro. 多智能体编排、任务分派、并行 lane。"
---

# Maestro orchestration protocol

You are the orchestrator. Specialists do the work; you manage the work: plan, dispatch, reconcile, verify, report. Follow this protocol whenever it is loaded.

## Roster and routing

| Agent | Route when | Do NOT route when |
|---|---|---|
| `maestro:scout` | discovery, multi-file search, tracing behavior, external docs research | you already hold the facts; a known path needs reading anyway |
| `maestro:elder` | architecture decisions, high-risk trade-offs, debugging strategy after 2+ failed fixes, simplification review | routine time-sensitive calls; escalation is not a default check |
| `maestro:atelier` | any UI/UX decision: layout, hierarchy, styling, motion, accessibility, design review | purely mechanical follow-ups (wright applies the spec) |
| `maestro:wright` | bounded, well-specified implementation, multi-file mechanical lanes, applying atelier specs, tests for specified behavior | the task needs discovery, decisions, or design judgment first |
| `maestro:lens` | judgment depends on an image/PDF/diagram: screenshots, rendered UI checks, mockup comparison | text-only analysis; always pass the full file path |
| `maestro:tribunal` | high-stakes or hard-to-reverse decisions: plan review before implementation, contested trade-offs | ordinary reviews; convening a panel is expensive |

## Direct-work boundary

Delegate when the lane matches and the work is substantial. Act directly when: the change is small and clear, you already hold the needed context, or the work IS that context (docs, changelogs, summaries) — a dispatched agent starts cold and must re-load what you know. Ask the user questions yourself; never delegate clarifying questions to a specialist.

## Dispatch contract

Every dispatch must be self-contained — the agent sees nothing but its prompt. Include:

1. **Objective** — the outcome, stated as acceptance criteria.
2. **Context** — file paths, decisions, constraints the agent cannot discover; enough to start without re-searching.
3. **Scope** — what to touch and what must not change.
4. **Output format** — what to return (scout: findings with `file:line`; wright: changed files + evidence; atelier: concrete spec; lens: observations; tribunal: verdict with conditions).
5. **Validation** — how the agent should prove it is done.

## Parallelism and write ownership

- Split independent work into lanes and dispatch them in one message so they run concurrently.
- Parallel writers must never share write scopes: one owner per file/area.
- The dispatching agent itself must not touch files a lane owns while it runs.
- For tribunal on a big decision, dispatch several `maestro:tribunal` instances in parallel, each told to lead with a different perspective, then weigh their verdicts yourself.

## The firewall

Specialists never dispatch other agents. All routing goes through you: if a specialist's report says "needs scout / elder / atelier / tribunal", you make that dispatch. Never grant a specialist a task that requires it to delegate.

## Reconciliation and verification

- Sub-agent summaries are claims, not evidence. Read the produced artifacts (diffs, reports) before relying on them.
- To correct or extend a lane, send a follow-up to the same agent (resume via SendMessage) instead of respawning a fresh one — never restart work that already has warm context.
- If a specialist refuses and names another lane, treat that as routing input; change the brief for the new lane, do not retry the same agent with the same task.
- Verify proportionately: run the project's checks once at the end, or have a wright lane do it — not every lane redundantly.

## Completion

When lanes finish: reconcile results, verify against the original acceptance criteria, then report to the user — what changed and where, what was verified and how, what was deliberately skipped, and any open follow-ups.

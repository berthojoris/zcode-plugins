---
name: maestro-verification
description: "Pre-implementation verification planning protocol: frames behavioral claims, designs empirical evidence paths (controllable inputs, observable states, boundary conditions), sets a non-duplicative verification budget, and assigns verification ownership before code changes begin. Use before risky refactors, subtle bug fixes, or multi-lane implementations, or when the user asks for a verification plan, evidence path, or invokes /maestro:verify-plan. 验证规划、证据链设计、测试预算制定。"
---

# Maestro verification planning protocol

Design a concrete, project-specific path from behavioral claims to empirical evidence **before** implementation begins, so `maestro:wright` lanes prove correctness with high-signal checks rather than redundant or superficial test habits.

## Three-step method

### 1. Frame the claims
Break the task's acceptance criteria into explicit, falsifiable claims:
- **Positive claims**: What exact behavior must become true given specific inputs?
- **Invariant claims**: What existing behavior, data, or contract must remain unchanged?
- **Failure-mode claims**: What is the likeliest way this change fails in production, and how must the system behave when that boundary is hit?

### 2. Design the evidence path
For each claim, inspect the codebase (`maestro:scout` if needed) and identify:
- **Controllable input**: The closest entry point (unit call, CLI command, HTTP handler, fixture, or state setup) that exercises the real code path without mocking away the risk.
- **Observable output**: The exact return value, state transition, stdout/stderr, file artifact, or rendered UI state (`maestro:lens` for visual checks) that proves the claim holds.
- **Boundary cases**: Empty input, malformed input, permission denial, concurrency/ordering, or platform path differences.

### 3. Set the verification budget & ownership
Prevent slow, duplicative test runs across sub-agents:
- **Per-lane checks**: Assign each `maestro:wright` lane the fastest targeted check (single test file, focused command, or syntax/type check) that proves its specific claim.
- **Orchestrator final gate**: Reserve full-suite builds, integration suites, and cross-module checks for a single reconciliation pass after parallel lanes finish.
- **Unverifiable gaps**: If a claim cannot be verified locally (e.g., requires live production credentials or hardware not present), state that gap explicitly up front rather than substituting a fake mock test.

## Deliverable format

- **Claims table**: Claim ID → Statement → Failure mode guarded.
- **Evidence mapping**: Claim ID → Exact command / test file / visual check → Expected observable outcome.
- **Lane budget**: Which check runs inside each `maestro:wright` lane vs. once at final reconciliation.

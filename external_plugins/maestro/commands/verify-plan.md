---
description: "Design a concrete pre-implementation verification plan: falsifiable claims, empirical evidence paths, and per-lane verification budgets."
argument-hint: "<planned change or feature to verify>"
---

Load and follow the **maestro-verification** skill (alongside **maestro** orchestration). Inspect the relevant code and test harnesses (using `maestro:scout` if needed), break the planned change into falsifiable positive, invariant, and failure-mode claims, map each claim to controllable inputs and observable outputs, and produce a non-duplicative per-lane verification budget ready for `maestro:wright`.

Planned change: $ARGUMENTS

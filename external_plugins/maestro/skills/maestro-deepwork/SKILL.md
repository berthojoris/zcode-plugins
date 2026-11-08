---
name: maestro-deepwork
description: "Autonomous multi-pass execution protocol ('Work Like a Painter': Sketch -> Structure -> Detail) for large, multi-phase, or cross-cutting engineering tasks. Coordinates maestro:scout, maestro:elder, maestro:atelier, maestro:wright, and maestro:tribunal across three progressive passes with verification gates. Use for subsystem builds, multi-module migrations, complex features, or when the user asks for deepwork, autonomous multi-phase execution, or invokes /maestro:deepwork. 深度多阶段自治开发、渐进式三轮构建。"
---

# Maestro deepwork protocol

Execute complex, multi-phase engineering work autonomously using a progressive three-pass methodology (**Sketch → Structure → Detail**). Instead of trying to build one file to 100% perfection before discovering integration flaws in the next, bring the whole task up in three deliberate passes.

## Pre-flight: Recon & verification plan

1. Dispatch `maestro:scout` lanes to map the affected modules, interfaces, and existing test harnesses (or run `maestro-codemap` if the repo is unfamiliar).
2. For architectural forks or UI surfaces, consult `maestro:elder` and/or `maestro:atelier` up front so implementation lanes never guess on structure or design specs.
3. Frame the acceptance criteria and verification path (`maestro-verification`) before Pass 1 begins.

## The three passes ("Work Like a Painter")

### Pass 1 — Sketch (End-to-end thin slice)
- **Goal**: Connect every major flow from entry point to output along the happy path.
- **Rule**: Rough is fine; fake is not. Wire real calls across real files, even if edge cases are not yet handled. Never leave silent no-ops or fabricated return values masquerading as working logic.
- **Gate**: Dispatch `maestro:wright` lane(s) to build the thin slice and confirm it compiles/runs end-to-end.

### Pass 2 — Structure (Real models, boundaries, and primary failure paths)
- **Goal**: Lock in complete data models, module contracts, validation rules, and primary error/failure handling.
- **Rule**: Parallelize independent subsystem lanes across `maestro:wright` with strict non-overlapping write ownership. If UI is involved, apply the exact `maestro:atelier` specification.
- **Gate**: Run typechecks, integration tests, and primary failure-path checks. If a structural flaw surfaces, escalate to `maestro:elder` before patching blindly.

### Pass 3 — Detail (Hardening, edge cases, simplification, and review)
- **Goal**: Edge-case resilience, cleanup (`maestro-simplify`), test completeness, and final verification.
- **Rule**: For high-stakes changes, convene `maestro:tribunal` on the completed diff to cross-examine builder, skeptic, and maintainer perspectives. Resolve any blocking conditions via `maestro:wright`.
- **Gate**: Full project verification suite passes with concrete command evidence.

## Autonomy discipline

- Run continuously from Pass 1 through Pass 3 without stopping halfway for routine decisions that the codebase or `maestro:elder` can answer.
- Pause and ask the user **only** for genuine external blockers: missing credentials/secrets, destructive external actions, or fundamental product ambiguity that changes what the user receives.

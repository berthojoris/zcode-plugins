---
name: maestro-codemap
description: "Repository cartography and hierarchical codemap generator: dispatches parallel maestro:scout lanes to map project structure, entry points, module boundaries, data flow, and cross-cutting invariants into a concise architectural reference. Use when entering an unfamiliar codebase, onboarding a session before a cross-cutting change, updating CODEMAP.md, or when the user asks for a codemap, repo map, architecture map, or invokes /maestro:codemap. 代码地图、仓库结构图谱、模块边界梳理。"
---

# Maestro codemap protocol

Build or refresh a dense, high-signal architectural map of the repository so the orchestrator and specialists can navigate directly to the right files without redundant blind searches.

## When to run

- Starting work in an unfamiliar repository or a large subsystem with unclear boundaries.
- Before planning a multi-lane refactor (`maestro-deepwork` or `/maestro`) that touches several directories.
- When the user asks to generate or update `CODEMAP.md` or invokes `/maestro:codemap`.

## Workflow

1. **Top-level inventory (direct, fast)**
   Inspect the root directory listing and manifest files (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, workspace configs) to identify the major top-level subsystems or packages.
2. **Parallel `maestro:scout` lanes**
   Split the major subsystems into 2–4 independent `maestro:scout` lanes in a single turn. Give each scout lane:
   - **Objective**: Map the assigned directory/subsystem's responsibility, public entry points, key internal modules, external dependencies, and non-obvious invariants.
   - **Scope**: Strictly the assigned directory tree (read-only).
   - **Output format**: Exact `file:line` anchors for entry points, core types/interfaces, and state transitions.
3. **Synthesize the codemap**
   Reconcile the scout reports into a single structured codemap (written to `CODEMAP.md` only if the user requested a file, otherwise returned inline and kept in session context):
   - **System overview**: 2–3 sentences stating what the repository builds and how runtime control flows from entry to output.
   - **Directory & module map**: Hierarchical tree of load-bearing directories and files with one-line responsibilities.
   - **Entry points & execution paths**: Primary CLI, server, UI, build, or test entry points with `file:line` references.
   - **Data flow & state boundaries**: Where state lives, how modules communicate, and which boundaries are strict.
   - **Invariants & landmines**: Frozen files, build contracts, validation gates, or subtle coupling that future `maestro:wright` lanes must respect.

## Rules

- **Verify every path**: Never list guessed filenames or stale paths. Every path in the codemap must come from current inspection.
- **Density over exhaustiveness**: Map load-bearing files and boundaries; omit generated artifacts, lockfiles, and trivial boilerplate.
- **Read-only by default**: Do not write or overwrite `CODEMAP.md` unless the user explicitly asks to persist the map to disk.

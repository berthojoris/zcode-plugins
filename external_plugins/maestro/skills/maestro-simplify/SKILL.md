---
name: maestro-simplify
description: "Behavior-preserving code simplification workflow: pairs maestro:elder (to identify accidental complexity, dead abstractions, and readability bottlenecks) with maestro:wright (to apply surgical simplifications and prove identical behavior). Use after a feature lands, when untangling complex functions or modules, or when the user asks to simplify, clean up, flatten, or declutter code without changing behavior, or invokes /maestro:simplify. 等价代码化简、消除冗余抽象、保持行为不变的重构。"
---

# Maestro simplify protocol

Drive behavior-preserving code simplification. The goal is not fewer lines for golf's sake — it is code that a teammate or agent can read, modify, and debug faster while preserving 100% of observable behavior.

## Non-negotiable invariants

1. **Exact behavior preservation**: Inputs, outputs, return types, side effects, error messages/codes, concurrency semantics, and public exports must remain identical.
2. **Local idiom over personal taste**: Match the repository's existing patterns, naming, and architecture. Never introduce a foreign paradigm in the name of "clean code".
3. **Leave clean and hot paths alone**: Never touch code that is already straightforward, and never replace a performance-critical path with a slower "cleaner" abstraction.

## Workflow

1. **Target & baseline check**
   Identify the target files or recent diff. Confirm what automated checks (unit tests, typecheck, lint, build) cover the target.
2. **Complexity diagnosis (`maestro:elder`)**
   For non-trivial targets, dispatch `maestro:elder` (or evaluate directly when the target is a single small file) to pinpoint specific simplification candidates with `file:line`:
   - Single-use wrapper functions or premature indirection layers
   - Deeply nested conditionals replaceable by guard clauses / early returns
   - Duplicated branching or state flags that can be unified cleanly
   - Dead code, unused parameters, or redundant intermediate transformations
   Each candidate must state why removing it improves clarity and confirm that no externally visible behavior changes.
3. **Surgical execution (`maestro:wright`)**
   Dispatch `maestro:wright` with the approved candidate list, explicit scope boundaries, and the verification command(s). `wright` applies only the listed simplifications and runs the project checks.
4. **Diff & evidence review**
   Inspect the resulting diff to confirm zero scope creep and verify that all tests and typechecks pass. Report what was simplified, what was intentionally left untouched, and the verification evidence.

---
description: "Run a behavior-preserving code simplification pass: diagnose accidental complexity with maestro:elder and apply verified surgical cleanup with maestro:wright."
argument-hint: "<file, module, or recent diff to simplify>"
---

Load and follow the **maestro-simplify** skill (alongside **maestro** orchestration). Identify accidental complexity, redundant abstractions, and readability bottlenecks in the target scope (consulting `maestro:elder` for non-trivial modules), apply surgical simplifications through `maestro:wright` without altering any observable behavior, run the project's verification checks, and report the diff and evidence.

Target scope: $ARGUMENTS

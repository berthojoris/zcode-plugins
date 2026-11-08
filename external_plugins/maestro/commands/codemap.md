---
description: "Generate or refresh a structured architectural codemap of the repository or a target subsystem using parallel maestro:scout lanes."
argument-hint: "[subsystem path or focus area]"
---

Load and follow the **maestro-codemap** skill (alongside **maestro** orchestration). Dispatch parallel `maestro:scout` lanes to map the repository or the specified target area, then synthesize the architectural overview, directory/module responsibilities, entry points (`file:line`), data flow, and key invariants. Write to `CODEMAP.md` only if explicitly requested in the arguments.

Target / focus: $ARGUMENTS

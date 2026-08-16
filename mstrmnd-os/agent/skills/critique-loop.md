---
name: critique-loop
description: Load when a plan or draft should be hardened before it is executed or shipped.
---

# Critique Loop

Run this loop until the improvement list is empty or only trivial:

1. **Restate** the artifact in one line (the strongest version of it).
2. **Attack** — list risks, failure modes, and unstated assumptions, most
   severe first.
3. **Improve** — turn each finding into a concrete, prioritized change.
4. **Revise** — apply the top changes.
5. **Re-check** — repeat from step 2 on the revised artifact.

Stop when the remaining findings are cosmetic. Record the final decision and
its rationale to the Third-Mind.

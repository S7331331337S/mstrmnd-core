# Skill Adapter

Provider skill runtimes (Anthropic Skills API, AI SDK skills, Cursor skill
modes) are **compile targets**, not MSTRMND products.

Canonical contract: `skills/<id>/SKILL.md`

```text
canonical SKILL.md
        │
        ├─► Claude Skills   (adapters/claude/SKILL.md)
        └─► AI SDK / harness (adapters/ai-sdk/skill.ts)
```

The adapter preserves:

- **behavioral consistency** — procedure checksum (headings + numbered steps + activation)
- **activation reliability** — activation phrases must appear in every target
- **portability** — one body of operational knowledge

Benchmark skill: [`skills/market-intelligence/SKILL.md`](../skills/market-intelligence/SKILL.md)
(the Operator Market Brief procedure).

```bash
pnpm skill:adapt -- skills/market-intelligence/SKILL.md
```

Do not grow a proprietary skill runtime that duplicates Claude computer use,
Files API, or Cursor skill modes.

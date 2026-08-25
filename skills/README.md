# Canonical skills

MSTRMND skills are portable procedures. One `SKILL.md` is the source of operational
knowledge. The Skill Adapter compiles it into Anthropic Claude Skills and AI SDK
harness modules — we do not maintain three copies.

```text
skills/<id>/SKILL.md          ← canonical (edit this)
  adapters/claude/SKILL.md    ← generated
  adapters/ai-sdk/skill.ts    ← generated
```

Compile:

```bash
pnpm skill:adapt -- skills/market-intelligence/SKILL.md
```

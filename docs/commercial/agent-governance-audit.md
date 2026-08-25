# Agent Governance Audit

Commercial (and Operator Zero) audit of who an agent is, what it may touch, and
what it actually did. This is the business-policy layer **above** network MCP
controls (Cloudflare Gateway and peers). MSTRMND does not replace those
controls; it inventories and governs them.

## Inventory graph

```text
human/agent identity
        → model / harness
        → MCP / tool
        → credential
        → data scope
        → allowed actions
        → approvals
        → audit trail
```

## Containment / MCP exposure (mandatory section)

Not an implementation footnote. Record:

- whether a threat boundary exists
- network default (deny-all vs allow-list)
- MCP allow-list vs observed MCP servers (**shadow MCP**)
- credential allow-list vs observed credentials
- cost ceiling
- consequential-action approval coverage

Shadow MCP is analog to shadow SaaS: agents talking to tools under no named
authority. High risk if there is no boundary.

## How to run (Operator Zero)

`buildGovernanceInventory()` in `@mstrmnd/intelligence-core` emits the graph
from runtime state. Attach it to discovery / audit engagements next to the
client's preferred execution agent (Claude, Codex, Cursor, Perplexity Computer).

Positioning on those calls:

> Perplexity / Claude / Codex execute work. MSTRMND makes that work coherent
> with the company — context, operating policy, connected systems, measurable
> workflows.

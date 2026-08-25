# MSTRMND Architecture

MSTRMND is the intelligence layer between an operator and replaceable execution
resources (models, coding harnesses, creative providers).

Core layers:

1. Personal / company intelligence (context, memory, identity, business state)
2. Policy / threat boundary (mandatory per workflow)
3. Hermes agent runtime (orchestration, skills, tools)
4. MCP interface (plugin transport — not the planner)
5. Edge adapters (Obsidian, SCM, sandbox, A2A, model gateway)
6. External execution (Cursor, Codex, Claude, Firefly, Perplexity Computer, …)

The model and the harness are replaceable. The intelligence layer persists.

GitHub is the current SCM source of truth. Do not migrate Core to Cursor Origin
during beta. A2A is an edge protocol, not a Core dependency — a single
well-governed agent with tools is still the default topology.


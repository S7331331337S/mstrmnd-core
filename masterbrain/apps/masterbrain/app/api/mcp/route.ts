// ============================================================
// /api/mcp — MCP server endpoint
// ============================================================
// Wire your existing MSTRMND Labs MCP implementation here.
// The endpoint exposes MASTERBRAIN as a tool callable from
// Claude Desktop, Claude Code, or any MCP-aware client.
//
// Recommended tool surface:
//   - council.deliberate(signal)   → runLoop()
//   - canon.query(signal)          → Canon.queryPriors()
//   - canon.ingest(decision_id, verdict, evidence)
//
// See: https://modelcontextprotocol.io for the spec.
// ============================================================

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    name: 'masterbrain-mcp',
    version: '0.1.0',
    description: 'The Council of Twelve, as a tool.',
    tools: [
      {
        name: 'council_deliberate',
        description: 'Run the full closed loop on a signal. Returns a synthesized decision.',
      },
      {
        name: 'canon_query',
        description: 'Surface relevant priors from MASTERBRAIN memory.',
      },
      {
        name: 'canon_ingest',
        description: 'Record an outcome and let CANON extract patterns.',
      },
    ],
    status: 'stub — wire your existing MCP implementation here',
  });
}

export async function POST() {
  return NextResponse.json(
    { error: 'MCP POST handler not yet implemented. See packages/integrations/.' },
    { status: 501 }
  );
}

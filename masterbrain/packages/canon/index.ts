// ============================================================
// @masterbrain/canon — convenience re-export
// ============================================================
// CANON's implementation lives in @masterbrain/agents.
// This package re-exports through the package boundary rather
// than a relative path, so it resolves under real package
// resolution and not only under flat tsconfig paths.
// ============================================================

export { Canon } from '@masterbrain/agents';

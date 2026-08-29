/** Short, sortable-enough id. Sessions are local-only, so collision risk is nil. */
export function createId(prefix = ""): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${stamp}${rand}`;
}

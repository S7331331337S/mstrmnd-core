import { disableTool } from "eve/tools";

// Filesystem tools are part of the sandbox execution slice, not Slice 1.
// eve 1.0 adds `edit_file` as a default tool; keep it off with the others.
// (`glob` and `grep` are opt-in in eve 1.0, so they need no disable file.)
export default disableTool();

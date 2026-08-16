import { disableTool } from "eve/tools";

// Filesystem tools are part of the sandbox execution slice, not Slice 1.
export default disableTool();

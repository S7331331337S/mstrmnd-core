import { disableTool } from "eve/tools";

// Shell execution is delegated to the approval-gated `execute_code` tool
// (isolated Vercel Sandbox) rather than the sandbox-backed built-in `bash`.
export default disableTool();

import type { NextConfig } from "next";
import { withEve } from "eve/next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {};

// Compose both wrappers: the eve agent runtime (mounted same-origin at
// /eve/v1/*) and the Workflow SDK (durable, checkpointed orchestration).
export default withEve(withWorkflow(nextConfig));

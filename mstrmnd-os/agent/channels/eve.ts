import { eveChannel } from "eve/channels/eve";
import { localDev, type AuthFn } from "eve/channels/auth";
import { getSessionFromRequest } from "../../lib/session";

/**
 * Route auth for the agent. The agent is reachable only by a signed-in app
 * user: we verify the same session cookie the Next.js app issues, and map it
 * to a user principal whose workspaceId scopes the Third-Mind. `localDev()`
 * remains as the final fallback for local tooling (`eve dev`).
 */
function appSession(): AuthFn<Request> {
  return async (request) => {
    const session = await getSessionFromRequest(request);
    if (!session) return null; // skip; fall through to the next entry
    return {
      authenticator: "app",
      principalId: session.userId,
      principalType: "user",
      attributes: {
        email: session.email,
        name: session.name,
        workspaceId: session.workspaceId,
      },
    };
  };
}

export default eveChannel({
  auth: [appSession(), localDev()],
});

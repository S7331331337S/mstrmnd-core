/**
 * Board Chair → Chief of Staff writeback draft.
 * Board never posts to Slack; CoS owns draft → approved → posted.
 * silentSendForbidden is always true.
 */
export type WritebackSource = "board" | "mastermind";
export type WritebackStatus = "draft" | "approved" | "posted";

export interface BoardChairWritebackDraft {
  /** Binding ruling text in plain language. */
  decision: string;
  /** People or roles accountable for executing the decision. */
  owners: string[];
  /** Exactly three concrete actions for the current week. */
  thisWeek: [string, string, string];
  /** Id of the Board/Mastermind session that produced the ruling. */
  sessionId: string;
  /** Repo paths or org/name hints (may be empty). */
  repoHints: string[];
  /** Origin of the ruling. */
  source: WritebackSource;
  /** Lifecycle owned by CoS. */
  status: WritebackStatus;
  /** Always true — no silent/auto Slack post; Board never posts. */
  silentSendForbidden: true;
}

/** Example fixture used by Board → CoS dogfood (status: draft). */
export const WRITEBACK_DRAFT_EXAMPLE: BoardChairWritebackDraft = {
  decision:
    "Board Expo moves to New Architecture this week; EAS production profile gated behind TestFlight.",
  owners: ["CoS", "Board eng"],
  thisWeek: [
    "Install expo-upgrade + expo-dev-client skills and run New Arch checklist",
    "Add eas-workflows PR preview build for Board",
    "Draft TestFlight submit path via eas-app-stores (no silent Slack)",
  ],
  sessionId: "board-2026-09-05-a",
  repoHints: ["Board", "S7331331337S/skills"],
  source: "board",
  status: "draft",
  silentSendForbidden: true,
};

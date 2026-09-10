/**
 * Read-only Cockpit stub — fixture writeback only.
 * Inline fixture matches WRITEBACK_DRAFT_EXAMPLE from @mstrmnd/schemas
 * (packages/schemas/src/writeback.ts). mstrmnd-os does not yet depend on
 * @mstrmnd/schemas; prefer package import once workspace dep is wired.
 */

export const dynamic = "force-dynamic";

/** Fixture matching WRITEBACK_DRAFT_EXAMPLE exactly (inline — no @mstrmnd/schemas dep). */
const WRITEBACK_DRAFT_EXAMPLE = {
  decision:
    "Board Expo moves to New Architecture this week; EAS production profile gated behind TestFlight.",
  owners: ["CoS", "Board eng"],
  thisWeek: [
    "Install expo-upgrade + expo-dev-client skills and run New Arch checklist",
    "Add eas-workflows PR preview build for Board",
    "Draft TestFlight submit path via eas-app-stores (no silent Slack)",
  ] as [string, string, string],
  sessionId: "board-2026-09-05-a",
  repoHints: ["Board", "S7331331337S/skills"],
  source: "board" as const,
  status: "draft" as const,
  silentSendForbidden: true as const,
};

export default function CockpitPage() {
  const draft = WRITEBACK_DRAFT_EXAMPLE;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <span className="label">Operator writeback · read-only</span>
        <h1 className="display-pixel text-2xl font-medium tracking-tight text-foreground">
          Cockpit
        </h1>
        <p className="text-muted max-w-2xl leading-relaxed">
          Fixture / example Board Chair → CoS writeback draft. No approve, post,
          or send controls — CoS owns mutation outside this view.
        </p>
      </section>

      <section className="border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 h-10">
          <span className="label-grid">Writeback draft</span>
          <span className="label">
            fixture ·{" "}
            <span className="text-foreground border border-line px-1.5 py-0.5 mono text-[10px]">
              {draft.status}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border-b border-line">
          <div className="bg-surface px-4 py-3 flex flex-col gap-1 sm:col-span-2">
            <span className="label">Decision</span>
            <p className="text-sm text-foreground leading-relaxed">
              {draft.decision}
            </p>
          </div>

          <div className="bg-surface px-4 py-3 flex flex-col gap-1">
            <span className="label">Owners</span>
            <div className="flex flex-wrap gap-1">
              {draft.owners.map((owner) => (
                <span
                  key={owner}
                  className="mono text-[10px] text-foreground border border-line px-1.5 py-0.5"
                >
                  {owner}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-surface px-4 py-3 flex flex-col gap-1">
            <span className="label">Session</span>
            <span className="mono text-xs text-foreground">{draft.sessionId}</span>
          </div>

          <div className="bg-surface px-4 py-3 flex flex-col gap-1">
            <span className="label">Source</span>
            <span className="mono text-xs text-foreground">{draft.source}</span>
          </div>

          <div className="bg-surface px-4 py-3 flex flex-col gap-1">
            <span className="label">Repo hints</span>
            <div className="flex flex-wrap gap-1">
              {draft.repoHints.map((hint) => (
                <span
                  key={hint}
                  className="mono text-[10px] text-faint border border-line px-1.5 py-0.5"
                >
                  {hint}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="border-b border-line">
          <div className="flex items-center justify-between border-b border-line px-4 h-10">
            <span className="label-grid">This week</span>
            <span className="label">{draft.thisWeek.length} actions</span>
          </div>
          <ol className="divide-y divide-line">
            {draft.thisWeek.map((item, i) => (
              <li
                key={item}
                className="px-4 py-3 flex items-start gap-3 text-sm text-foreground/90 leading-relaxed"
              >
                <span className="label shrink-0 pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="px-4 py-3 flex flex-col gap-1">
          <span className="label">Silent send</span>
          <p className="text-sm text-muted leading-relaxed">
            {draft.silentSendForbidden
              ? "silentSendForbidden = true — Board never posts; no silent/auto Slack from this draft."
              : "Silent send allowed"}
          </p>
        </div>
      </section>
    </div>
  );
}

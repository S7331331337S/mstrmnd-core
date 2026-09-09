# Board Chair → CoS Writeback Schema

Field guide for `packages/schemas` type `BoardChairWritebackDraft` and `docs/schemas/board-chair-writeback-draft.json`.

## Purpose

Capture a **Board Chair ruling** as a structured **Chief of Staff writeback draft**. The Board (and Mastermind) decide; **CoS alone** turns the draft into an approved Slack writeback. **Board never posts to Slack.**

## Hard rule

`silentSendForbidden` is always `true`. No agent, Board seat, or automation may post the writeback without an explicit CoS approval transition (`draft` → `approved` → `posted`). Silent or auto-send is forbidden.

## Fields

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `decision` | string | yes | Binding ruling text in plain language. |
| `owners` | string[] (≥1) | yes | Who owns execution (roles or names). |
| `thisWeek` | string[3] | yes | Exactly **three** concrete actions for the current week. |
| `sessionId` | string | yes | Session id for audit/trace (Board or Mastermind). |
| `repoHints` | string[] | yes (may be `[]`) | Repos or path hints for agents implementing `thisWeek`. |
| `source` | `"board"` \| `"mastermind"` | yes | Where the ruling came from. |
| `status` | `"draft"` \| `"approved"` \| `"posted"` | yes | Lifecycle owned by CoS. |
| `silentSendForbidden` | `true` | yes | Constant; encodes the no-silent-send / Board-never-posts policy. |

## Status flow (CoS only)

1. **`draft`** — CoS (or agent under CoS) records the Chair ruling; not visible as a Slack post yet.
2. **`approved`** — CoS (human) signs off on wording, owners, and thisWeek.
3. **`posted`** — CoS posts to Slack. Board does not post. Agents do not post while `silentSendForbidden` is true (always).

## Code

- TypeScript: `packages/schemas/src/writeback.ts` (`BoardChairWritebackDraft`, `WRITEBACK_DRAFT_EXAMPLE`)
- JSON Schema: `docs/schemas/board-chair-writeback-draft.json`

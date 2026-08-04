import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { IdentityModel } from "@mstrmnd/schemas";
import {
  localProvenance,
  OPERATOR_ZERO_SCOPE,
  resolveScope,
} from "./operator-scope";

const IDENTITY_CANDIDATES = [
  "identity.md",
  "00-Identity/identity.md",
  "10-Identity/identity.md",
];

function emptyIdentityShell(): IdentityModel {
  return {
    values: [],
    interests: [],
    creativePatterns: [],
    preferences: [],
    scope: { ...OPERATOR_ZERO_SCOPE },
    provenance: localProvenance("identity", {
      adapter: "identity-loader",
      producedBy: "empty",
    }),
  };
}

export const EMPTY_IDENTITY: IdentityModel = emptyIdentityShell();

function parseStringList(block: string): string[] {
  const trimmed = block.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim().replace(/['"]/g, ""))
      .filter(Boolean);
  }
  return trimmed
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim().replace(/['"]/g, ""))
    .filter(Boolean);
}

function parsePreferences(block: string): IdentityModel["preferences"] {
  const items: IdentityModel["preferences"] = [];
  const entries = block.split(/\n(?=-\s+concept:)/);
  for (const entry of entries) {
    const concept = entry.match(/concept:\s*(.+)/)?.[1]?.trim().replace(/['"]/g, "");
    const affinity = Number(entry.match(/affinity:\s*([\d.]+)/)?.[1] ?? "0.5");
    const context = entry.match(/context:\s*(.+)/)?.[1]?.trim().replace(/['"]/g, "");
    if (concept) {
      items.push({ concept, affinity, ...(context ? { context } : {}) });
    }
  }
  return items;
}

function parseIdentityFrontmatter(raw: string): Omit<
  IdentityModel,
  "scope" | "provenance"
> {
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) {
    return {
      values: [],
      interests: [],
      creativePatterns: [],
      preferences: [],
    };
  }

  const body = fm[1];
  const pick = (key: string) => {
    const m = body.match(new RegExp(`${key}:\\s*([\\s\\S]*?)(?:\\n\\w|$)`));
    return m?.[1] ?? "";
  };

  return {
    values: parseStringList(pick("values")),
    interests: parseStringList(pick("interests")),
    creativePatterns: parseStringList(pick("creativePatterns")),
    preferences: parsePreferences(pick("preferences")),
  };
}

/**
 * Load identity from a vault-authored profile note.
 * Looks for identity.md at the vault root or under 00-Identity/.
 * Applies Operator Zero local scope by default.
 */
export async function loadIdentity(
  vaultPath: string,
  scopeOverrides?: Parameters<typeof resolveScope>[0]
): Promise<IdentityModel> {
  const scope = resolveScope(scopeOverrides);
  for (const rel of IDENTITY_CANDIDATES) {
    const abs = join(vaultPath, rel);
    if (!existsSync(abs)) continue;
    const raw = await readFile(abs, "utf8");
    const parsed = parseIdentityFrontmatter(raw);
    const hasContent =
      parsed.values.length > 0 ||
      parsed.interests.length > 0 ||
      parsed.creativePatterns.length > 0 ||
      parsed.preferences.length > 0;
    if (hasContent) {
      return {
        ...parsed,
        scope,
        provenance: localProvenance("obsidian", {
          adapter: "identity-loader",
          sourcePath: rel,
          producedBy: "vault-identity",
        }),
      };
    }
  }
  return {
    ...emptyIdentityShell(),
    scope,
    provenance: localProvenance("identity", {
      adapter: "identity-loader",
      producedBy: "empty",
      sourcePath: vaultPath,
    }),
  };
}

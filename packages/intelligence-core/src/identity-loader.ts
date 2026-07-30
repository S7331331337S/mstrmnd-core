import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { IdentityModel } from "@mstrmnd/schemas";

const IDENTITY_CANDIDATES = [
  "identity.md",
  "00-Identity/identity.md",
  "10-Identity/identity.md",
];

export const EMPTY_IDENTITY: IdentityModel = {
  values: [],
  interests: [],
  creativePatterns: [],
  preferences: [],
};

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

function parseIdentityFrontmatter(raw: string): IdentityModel {
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return { ...EMPTY_IDENTITY };

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
 */
export async function loadIdentity(vaultPath: string): Promise<IdentityModel> {
  for (const rel of IDENTITY_CANDIDATES) {
    const abs = join(vaultPath, rel);
    if (!existsSync(abs)) continue;
    const raw = await readFile(abs, "utf8");
    const identity = parseIdentityFrontmatter(raw);
    const hasContent =
      identity.values.length > 0 ||
      identity.interests.length > 0 ||
      identity.creativePatterns.length > 0 ||
      identity.preferences.length > 0;
    if (hasContent) return identity;
  }
  return { ...EMPTY_IDENTITY };
}

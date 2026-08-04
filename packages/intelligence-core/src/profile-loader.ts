import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  BusinessContext,
  CompanyProfile,
  OperatorProfile,
  RuntimeScope,
} from "@mstrmnd/schemas";
import { localProvenance, resolveScope } from "./operator-scope";

function pickFm(body: string, key: string): string {
  const m = body.match(new RegExp(`${key}:\\s*([\\s\\S]*?)(?:\\n\\w|$)`));
  return m?.[1] ?? "";
}

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

function parseIdSummaryList(
  block: string
): Array<{ id: string; summary: string }> {
  const items: Array<{ id: string; summary: string }> = [];
  const entries = block.split(/\n(?=-\s+id:)/);
  for (const entry of entries) {
    const id = entry.match(/id:\s*(.+)/)?.[1]?.trim().replace(/['"]/g, "");
    const summary = entry
      .match(/summary:\s*(.+)/)?.[1]
      ?.trim()
      .replace(/['"]/g, "");
    if (id) items.push({ id, summary: summary ?? "" });
  }
  return items;
}

function frontmatter(raw: string): string | null {
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  return fm?.[1] ?? null;
}

async function readFirst(
  roots: string[],
  candidates: string[]
): Promise<{ raw: string; path: string } | null> {
  for (const root of roots) {
    for (const rel of candidates) {
      const abs = join(root, rel);
      if (!existsSync(abs)) continue;
      return { raw: await readFile(abs, "utf8"), path: rel };
    }
  }
  return null;
}

export async function loadOperatorProfile(
  searchRoots: string[],
  scope?: Partial<RuntimeScope>
): Promise<OperatorProfile> {
  const resolved = resolveScope(scope);
  const found = await readFirst(searchRoots, [
    "operator.md",
    "00-Identity/operator.md",
  ]);
  if (!found) {
    return {
      id: resolved.userId,
      displayName: "Local Operator",
      role: resolved.role,
      scope: resolved,
      provenance: localProvenance("operator", {
        adapter: "profile-loader",
        producedBy: "default",
      }),
    };
  }
  const body = frontmatter(found.raw) ?? "";
  return {
    id: pickFm(body, "id").trim().replace(/['"]/g, "") || resolved.userId,
    displayName:
      pickFm(body, "displayName").trim().replace(/['"]/g, "") ||
      "Local Operator",
    role: pickFm(body, "role").trim().replace(/['"]/g, "") || resolved.role,
    preferenceRefs: parseStringList(pickFm(body, "preferenceRefs")),
    scope: resolved,
    provenance: localProvenance("obsidian", {
      adapter: "profile-loader",
      sourcePath: found.path,
    }),
  };
}

export async function loadCompanyProfile(
  searchRoots: string[],
  scope?: Partial<RuntimeScope>
): Promise<{ company: CompanyProfile; business: BusinessContext }> {
  const resolved = resolveScope(scope);
  const found = await readFirst(searchRoots, [
    "company.md",
    "00-Identity/company.md",
  ]);
  const baseProv = localProvenance(found ? "obsidian" : "company", {
    adapter: "profile-loader",
    sourcePath: found?.path,
    producedBy: found ? "vault" : "default",
  });

  if (!found) {
    return {
      company: {
        id: resolved.organizationId,
        name: "MSTRMND",
        missionSummary:
          "Install the intelligence layer between a company's vision and its daily execution.",
        brandId: resolved.brandId,
        scope: resolved,
        provenance: baseProv,
      },
      business: {
        goals: [],
        constraints: [],
        activeProjects: [],
        activeClients: [],
        scope: resolved,
        provenance: baseProv,
      },
    };
  }

  const body = frontmatter(found.raw) ?? "";
  const company: CompanyProfile = {
    id: pickFm(body, "id").trim().replace(/['"]/g, "") || resolved.organizationId,
    name: pickFm(body, "name").trim().replace(/['"]/g, "") || "MSTRMND",
    missionSummary:
      pickFm(body, "missionSummary").trim().replace(/['"]/g, "") || undefined,
    systemsMapRefs: parseStringList(pickFm(body, "systemsMapRefs")),
    brandId:
      pickFm(body, "brandId").trim().replace(/['"]/g, "") || resolved.brandId,
    positioningRef:
      pickFm(body, "positioningRef").trim().replace(/['"]/g, "") || undefined,
    scope: resolved,
    provenance: baseProv,
  };

  const business: BusinessContext = {
    goals: parseStringList(pickFm(body, "goals")),
    constraints: parseStringList(pickFm(body, "constraints")),
    activeProjects: parseIdSummaryList(pickFm(body, "activeProjects")),
    activeClients: parseIdSummaryList(pickFm(body, "activeClients")),
    scope: resolved,
    provenance: baseProv,
  };

  return { company, business };
}

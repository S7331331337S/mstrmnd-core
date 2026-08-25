import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type {
  CompiledSkill,
  SkillAdapterBenchmark,
  SkillAdapterTarget,
  SkillManifest,
} from "@mstrmnd/schemas";

export class SkillAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillAdapterError";
  }
}

/**
 * Parse a canonical MSTRMND SKILL.md (YAML frontmatter + markdown body).
 * Frontmatter is intentionally small and JSON-subset YAML so we do not
 * take a YAML runtime dependency.
 */
export function parseSkillMarkdown(markdown: string, fallbackId: string): SkillManifest {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new SkillAdapterError("SKILL.md must start with YAML frontmatter");
  }
  const fm = parseFrontmatter(match[1]);
  const id = str(fm.id) || fallbackId;
  const name = str(fm.name);
  const version = str(fm.version) || "0.0.0";
  const description = str(fm.description);
  if (!name || !description) {
    throw new SkillAdapterError("skill frontmatter requires name and description");
  }
  return {
    id,
    name,
    version,
    description,
    activation: strList(fm.activation),
    inputs: strList(fm.inputs),
    outputs: strList(fm.outputs),
    body: match[2].trim(),
    policyNotes: strList(fm.policyNotes),
  };
}

export async function loadCanonicalSkill(absPath: string): Promise<SkillManifest> {
  const text = await readFile(absPath, "utf8");
  const fallback = absPath.split(/[/\\]/).slice(-2, -1)[0] ?? "skill";
  return parseSkillMarkdown(text, fallback);
}

export function procedureChecksum(manifest: SkillManifest): string {
  const activation = [...manifest.activation].map((s) => s.trim().toLowerCase()).sort();
  const steps = manifest.body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^#{1,3}\s/.test(l) || /^\d+\.\s/.test(l) || /^- \*\*/.test(l));
  const payload = JSON.stringify({
    id: manifest.id,
    activation,
    steps,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function compileSkill(
  manifest: SkillManifest,
  target: SkillAdapterTarget
): CompiledSkill {
  const checksum = procedureChecksum(manifest);
  if (target === "canonical") {
    return {
      target,
      filename: "SKILL.md",
      contents: renderCanonical(manifest),
      checksum,
    };
  }
  if (target === "claude") {
    return {
      target,
      filename: "adapters/claude/SKILL.md",
      contents: renderClaude(manifest),
      checksum,
    };
  }
  return {
    target,
    filename: "adapters/ai-sdk/skill.ts",
    contents: renderAiSdk(manifest),
    checksum,
  };
}

export function compileSkillTargets(manifest: SkillManifest): CompiledSkill[] {
  return (["canonical", "claude", "ai-sdk"] as SkillAdapterTarget[]).map((t) =>
    compileSkill(manifest, t)
  );
}

/**
 * Skill Adapter benchmark: same SKILL.md must drive Claude Skills and
 * AI SDK/harness execution without three bodies of operational knowledge.
 */
export function benchmarkSkillAdapter(manifest: SkillManifest): SkillAdapterBenchmark {
  const compiled = compileSkillTargets(manifest);
  const checksums: Record<string, string> = {};
  for (const item of compiled) checksums[item.target] = item.checksum;
  const unique = new Set(Object.values(checksums));
  const activationPreserved = compiled.every((item) =>
    manifest.activation.every((phrase) =>
      item.contents.toLowerCase().includes(phrase.toLowerCase())
    )
  );
  const notes: string[] = [];
  if (unique.size !== 1) notes.push("procedure checksum diverged across targets");
  if (!activationPreserved) notes.push("activation phrases missing from a compiled target");
  if (!manifest.activation.length) notes.push("skill has no activation phrases");
  return {
    skillId: manifest.id,
    targets: compiled.map((c) => c.target),
    behavioralConsistency: unique.size === 1,
    activationPreserved,
    portability: unique.size === 1 && activationPreserved && compiled.length === 3,
    checksums,
    notes,
  };
}

function renderCanonical(manifest: SkillManifest): string {
  const fm = [
    "---",
    `id: ${manifest.id}`,
    `name: ${manifest.name}`,
    `version: ${manifest.version}`,
    `description: ${jsonish(manifest.description)}`,
    "activation:",
    ...manifest.activation.map((a) => `  - ${jsonish(a)}`),
    "inputs:",
    ...manifest.inputs.map((a) => `  - ${jsonish(a)}`),
    "outputs:",
    ...manifest.outputs.map((a) => `  - ${jsonish(a)}`),
    ...(manifest.policyNotes?.length
      ? ["policyNotes:", ...manifest.policyNotes.map((a) => `  - ${jsonish(a)}`)]
      : []),
    "---",
    "",
    manifest.body,
    "",
  ];
  return fm.join("\n");
}

function renderClaude(manifest: SkillManifest): string {
  const when = manifest.activation.length
    ? ` Load when: ${manifest.activation.join("; ")}.`
    : "";
  const title = `# ${manifest.name}`;
  const body = manifest.body.startsWith(title)
    ? manifest.body
    : `${title}\n\n${manifest.body}`;
  return [
    "---",
    `name: ${manifest.id}`,
    `description: ${jsonish(manifest.description + when)}`,
    "---",
    "",
    body,
    "",
    "## Activation",
    ...manifest.activation.map((a) => `- ${a}`),
    "",
  ].join("\n");
}

function renderAiSdk(manifest: SkillManifest): string {
  const activation = JSON.stringify(manifest.activation, null, 2);
  const body = JSON.stringify(manifest.body);
  const description = JSON.stringify(manifest.description);
  return `/** Generated by @mstrmnd/intelligence-core skill adapter — do not hand-edit. */
export const skill = {
  id: ${JSON.stringify(manifest.id)},
  name: ${JSON.stringify(manifest.name)},
  version: ${JSON.stringify(manifest.version)},
  description: ${description},
  activation: ${activation},
  body: ${body},
} as const;
`;
}

function parseFrontmatter(raw: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let currentList: string | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (/^\s+-\s+/.test(line) && currentList) {
      const items = (out[currentList] as string[]) ?? [];
      items.push(unquote(line.replace(/^\s+-\s+/, "").trim()));
      out[currentList] = items;
      continue;
    }
    const kv = line.match(/^([A-Za-z][\w]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim();
    if (value === "" || value === "|" || value === ">") {
      currentList = key;
      out[key] = [];
      continue;
    }
    currentList = null;
    out[key] = unquote(value);
  }
  return out;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string" && value) return [value];
  return [];
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function jsonish(value: string): string {
  if (/[:#{}[\],&*?]|^\s|\s$/.test(value)) return JSON.stringify(value);
  return value;
}

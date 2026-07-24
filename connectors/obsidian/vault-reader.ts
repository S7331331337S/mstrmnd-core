import { readdir, readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";

export interface VaultNote {
  /** Absolute path on disk */
  path: string;
  /** Path relative to the vault root */
  relativePath: string;
  /** Title: first H1 (# title) or the filename without extension */
  title: string;
  /** Raw note body (YAML frontmatter stripped) */
  body: string;
  /** Tags from `#tag` inline mentions and YAML `tags:` frontmatter */
  tags: string[];
}

const SKIP_DIRS = new Set([".obsidian", ".git", ".trash", "_attachments"]);

function extractTags(body: string, frontmatterTags: string[]): string[] {
  const inline = body.match(/#([\p{L}\d/_-]+)/gu) ?? [];
  const inlineTags = inline.map((m) => m.slice(1).toLowerCase());
  return Array.from(new Set([...frontmatterTags, ...inlineTags]));
}

function stripFrontmatter(raw: string): {
  body: string;
  tags: string[];
} {
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fm) return { body: raw, tags: [] };
  const fmBody = fm[1];
  const tags: string[] = [];
  const tagMatch = fmBody.match(/tags:\s*([\s\S]*?)(?:\n\w|$)/);
  if (tagMatch) {
    const raw = tagMatch[1].trim();
    if (raw.startsWith("[")) {
      // YAML array form: [tag1, tag2]
      raw
        .slice(1, -1)
        .split(",")
        .forEach((t) => {
          const v = t.trim().replace(/['"]/g, "");
          if (v) tags.push(v.toLowerCase());
        });
    } else {
      // YAML list form: each "- tag" on its own line
      raw.split("\n").forEach((line) => {
        const t = line.replace(/^-\s*/, "").trim().replace(/['"]/g, "");
        if (t) tags.push(t.toLowerCase());
      });
    }
  }
  return { body: raw.slice(fm[0].length), tags };
}

async function walk(dir: string, vaultRoot: string, out: VaultNote[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(abs, vaultRoot, out);
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      const raw = await readFile(abs, "utf8");
      const { body, tags: fmTags } = stripFrontmatter(raw);
      const h1 = body.match(/^#\s+(.+)$/m);
      const title = h1
        ? h1[1].trim()
        : entry.name.replace(/\.md$/, "");
      out.push({
        path: abs,
        relativePath: relative(vaultRoot, abs),
        title,
        body: body.trim(),
        tags: extractTags(body, fmTags),
      });
    }
  }
}

/**
 * Recursively read an Obsidian vault, returning all markdown notes
 * with parsed title, body, and tags. Read-only — never mutates the vault.
 */
export async function readVault(vaultPath: string): Promise<VaultNote[]> {
  const notes: VaultNote[] = [];
  await walk(vaultPath, vaultPath, notes);
  return notes;
}

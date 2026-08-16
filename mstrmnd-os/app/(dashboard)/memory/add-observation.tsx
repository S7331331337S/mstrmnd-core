"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddObservation() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="border border-line bg-surface p-4 flex flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!key.trim() || !content.trim() || saving) return;
        setSaving(true);
        setError(null);
        try {
          const res = await fetch("/api/third-mind", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              key: key.trim(),
              content: content.trim(),
              tags: tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "write failed");
          setKey("");
          setContent("");
          setTags("");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "write failed");
        } finally {
          setSaving(false);
        }
      }}
    >
      <span className="label">Record an observation</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="key (stable id)"
          className="bg-transparent border border-line px-3 py-2 text-sm outline-none focus:border-line-strong mono"
        />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tags, comma, separated"
          className="bg-transparent border border-line px-3 py-2 text-sm outline-none focus:border-line-strong mono"
        />
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="observation…"
        rows={3}
        className="bg-transparent border border-line px-3 py-2 text-sm outline-none focus:border-line-strong resize-y"
      />
      <div className="flex items-center justify-between">
        {error ? (
          <span className="label text-foreground">{error}</span>
        ) : (
          <span className="label">Shared across every mind in the alliance</span>
        )}
        <button
          type="submit"
          disabled={saving || !key.trim() || !content.trim()}
          className="label border border-line-strong px-3 py-1.5 text-foreground hover:bg-surface-2 disabled:opacity-40"
        >
          {saving ? "Writing…" : "Write to Third-Mind"}
        </button>
      </div>
    </form>
  );
}

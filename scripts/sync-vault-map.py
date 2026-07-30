#!/usr/bin/env python3
"""Unified vault-map generator for MSTRMND second brain.

Curated DIGEST notes (not file mirrors — a 46k-file mirror breaks
Obsidian + the memory graph). Each note is a real stats+structure+notables
index of a source area. Idempotent: re-running overwrites the same notes.

Covers:
  - iCloud Drive areas (Business/Creative/Research/Docs/Projects/Inbox/Archive/...)
  - local ~/Projects, ~/Archive, ~/Downloads
  - notable ARTIFACTS (brand decks, GPT images, Gemini video) referenced as Artifact notes

Excludes: node_modules, .git, Assets/, .pvt previews, code bulk.
"""
import os, sys, multiprocessing as _mp

_mp.set_start_method("fork", force=True)

def _walk_worker(q, root, max_depth):
    """Worker: walk `root` up to max_depth, push (dirpath, dirnames, filenames)
    tuples onto the queue. Runs in a forked child so a hung iCloud dir can be
    killed by the parent without affecting the main process."""
    out = []
    try:
        for dp, dns, fns in os.walk(root, followlinks=False):
            out.append((dp, list(dns), list(fns)))
    except Exception:
        pass
    q.put(out)

HOME = os.path.expanduser("~")
ICLOUD = os.path.join(HOME, "Library", "Mobile Documents", "com~apple~CloudDocs")
VAULT = os.path.join(HOME, "Documents", "Obsidian Vault")

# (display name, source root) -> vault relative path
AREAS = [
    ("iCloud · Business",   os.path.join(ICLOUD, "Business"),  "20-Areas/Business.md"),
    ("iCloud · Creative",   os.path.join(ICLOUD, "Creative"),  "20-Areas/Creative.md"),
    ("iCloud · Research",   os.path.join(ICLOUD, "Research"),  "30-Resources/Research.md"),
    ("iCloud · Docs",       os.path.join(ICLOUD, "Docs"),      "30-Resources/Docs.md"),
    ("iCloud · Projects",   os.path.join(ICLOUD, "Projects"),  "10-Projects/iCloud Projects.md"),
    ("iCloud · Inbox",     os.path.join(ICLOUD, "Inbox"),    "00-Inbox/iCloud Inbox.md"),
    ("iCloud · Archive",    os.path.join(ICLOUD, "Archive"),   "40-Archives/iCloud Archive.md"),
    ("iCloud · Downloads",  os.path.join(ICLOUD, "Downloads"), "30-Resources/Downloads.md"),
    ("iCloud · Pixelmost",  os.path.join(ICLOUD, "Pixelmost"), "30-Resources/Pixelmost.md"),
    ("iCloud · Documents",  os.path.join(ICLOUD, "Documents"),"30-Resources/Documents.md"),
    ("iCloud · Documents 2",os.path.join(ICLOUD, "Documents 2"),"30-Resources/Documents 2.md"),
    ("iCloud · dad finally",os.path.join(ICLOUD, "dad finally"),"30-Resources/dad finally.md"),
    ("iCloud · Reality Composer", os.path.join(ICLOUD, "Reality Composer"), "30-Resources/Reality Composer.md"),
    ("Local · Projects",    os.path.join(HOME, "Projects"),  "10-Projects/Local Projects.md"),
    ("Local · Archive",     os.path.join(HOME, "Archive"),   "40-Archives/Local Archive.md"),
    ("Local · Downloads",   os.path.join(HOME, "Downloads"), "30-Resources/Downloads.md"),
]

SKIP_DIRS = {".assets","assets",".git","node_modules",".obsidian",".trash","_attachments"}
SKIP_FILES = {".ds_store","icloudglue","icloudgluev3"}
DOC_EXT = {".pdf",".docx",".md",".txt",".pages",".key",".numbers",".xlsx",
            ".pptx",".csv",".doc",".rtf"}
ART_EXT = {".png",".jpg",".jpeg",".webp",".heic",".mp4",".mov",".gif"}

def walk_stats(root, max_depth=4):
    total = 0; size = 0; exts = {}; tree = []; notable = []
    timed_out = False
    if not os.path.isdir(root):
        return total, size, exts, tree, notable
    paths, timed_out = _bounded_walk(root, max_depth)
    for dp, dns, fns in paths:
        dns[:] = [d for d in dns if d.lower() not in SKIP_DIRS]
        depth = dp[len(root):].count(os.sep)
        if depth > max_depth:
            dns[:] = []; continue
        for fn in fns:
            fl = fn.lower()
            if fl in SKIP_FILES or fl.endswith(".pvt"):
                continue
            fp = os.path.join(dp, fn)
            try: sz = os.path.getsize(fp)
            except OSError: sz = 0
            total += 1; size += sz
            ext = os.path.splitext(fn)[1].lower() or "<none>"
            exts[ext] = exts.get(ext, 0) + 1
            notable.append((sz, os.path.relpath(fp, root)))
        if depth <= 2:
            tree.append(f"{'  '*depth}- {os.path.basename(dp)}/")
    notable.sort(reverse=True)
    return total, size, exts, tree, notable[:15], timed_out

def fmt(n):
    for u in ("B","KB","MB","GB","TB"):
        if n < 1024: return f"{n:.0f}{u}"
        n /= 1024
    return f"{n:.0f}PB"

def area_note(name, root):
    if not os.path.isdir(root):
        return f"# {name}\n\n> Source folder not present on this machine.\n"
    total, size, exts, tree, notable, timed_out = walk_stats(root)
    top = sorted(exts.items(), key=lambda x:-x[1])[:12]
    ext_str = ", ".join(f"{e} {c}" for e, c in top) or "none"
    L = [f"# {name}\n",
         f"> Curated map of `{root}`. Auto-generated index — source files stay in place, not mirrored here.\n",
         "## Stats", f"- **Files:** {total:,}", f"- **Size:** {fmt(size)}",
         f"- **Top types:** {ext_str}\n", "## Structure (depth-limited)", "```",
         tree[0] if tree else "(empty)", *tree[1:], "```\n"]
    if timed_out:
        L.append("> ⚠️ _iCloud sync was still in progress for part of this area when indexed — "
                 "some files may be missing. Re-run `sync-vault-map.py` after sync settles._\n")
    if notable:
        L.append("## Notable files")
        for sz, rel in notable:
            L.append(f"- `{rel}` — {fmt(sz)}")
        L.append("")
    L += ["---", f"_Indexed from `{root}`_"]
    return "\n".join(L) + "\n"

def artifact_note():
    L = ["# AI & Brand Artifacts", "",
         "> Notable generated/shared artifacts referenced from iCloud + local. Files stay in place; linked here as memory anchors.\n",
         "## Brand & Strategy docs (iCloud/Docs/loose)"]
    docs = os.path.join(ICLOUD, "Docs", "loose")
    if os.path.isdir(docs):
        for fn in sorted(_retry_eintr(os.listdir, docs)):
            if os.path.splitext(fn)[1].lower() in DOC_EXT:
                p = os.path.join(docs, fn)
                L.append(f"- `{fn}` — {fmt(os.path.getsize(p))}  _(type: document)_")
    L.append("")
    L.append("## ChatGPT shared images (iCloud/Research/GPT-convos)")
    gpt = os.path.join(ICLOUD, "Research", "GPT-convos", "Gpt convos")
    if os.path.isdir(gpt):
        n = sum(1 for f in os.listdir(gpt) if f.lower().endswith((".webp",".png",".jpg")))
        L.append(f"- {n} shared images (webp/png) — referenced, not mirrored")
    L.append("")
    L.append("## Gemini generated media (iCloud/Assets/media)")
    gem = os.path.join(ICLOUD, "Assets", "media")
    if os.path.isdir(gem):
        for fn in sorted(os.listdir(gem)):
            if "gemini" in fn.lower():
                p = os.path.join(gem, fn)
                L.append(f"- `{fn}` — {fmt(os.path.getsize(p))}  _(type: video/media)_")
    L += ["", "---", "_Artifact references only; source files live in iCloud._"]
    return "\n".join(L) + "\n"

import errno, multiprocessing as _mp

def _bounded_walk(root, max_depth=4, timeout=8):
    """Walk root but never block longer than `timeout` seconds — iCloud
    folders that are mid-sync can hang os.walk indefinitely. Runs the walk in
    a forked worker process and kills it if it overstays. Returns (paths, timed_out)
    where paths is a list of (dirpath, dirnames, filenames) tuples."""
    q = _mp.Queue()
    pr = _mp.Process(target=_walk_worker, args=(q, root, max_depth))
    pr.start(); pr.join(timeout)
    if pr.is_alive():
        pr.kill(); pr.join()
        return [], True
    try:
        return (q.get_nowait() or []), False
    except Exception:
        return [], True

def _retry_eintr(fn, *a, **k):
    # macOS/iCloud filesystem ops occasionally raise EINTR ("Interrupted
    # system call"); retry a few times so a transient signal doesn't abort
    # the whole sync.
    for _ in range(5):
        try:
            return fn(*a, **k)
        except InterruptedError:
            continue
        except OSError as e:
            if e.errno == errno.EINTR:
                continue
            raise
    return fn(*a, **k)

def main():
    dry = "--dry" in sys.argv
    written = []
    moc = ["# iCloud Drive Map", "",
            "> Master index of cloud + local surfaces, mapped into this vault. Each note is a curated digest (files stay in place).\n",
            "## Areas & Projects"]
    for name, root, vrel in AREAS:
        note = area_note(name, root)
        target = os.path.join(VAULT, vrel)
        moc.append(f"- [[{os.path.splitext(vrel)[0]}]] — {name}")
        if dry:
            print(f"[DRY] would write {target} ({len(note)} bytes)")
        else:
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, "w") as f: f.write(note)
            written.append(target)
    # artifact note
    art = artifact_note()
    art_path = os.path.join(VAULT, "30-Resources/AI & Brand Artifacts.md")
    moc.append(f"- [[30-Resources/AI & Brand Artifacts]] — Artifacts")
    if dry:
        print(f"[DRY] would write {art_path} ({len(art)} bytes)")
    else:
        os.makedirs(os.path.dirname(art_path), exist_ok=True)
        with open(art_path, "w") as f: f.write(art)
        written.append(art_path)
    moc_path = os.path.join(VAULT, "30-Resources/iCloud Drive Map.md")
    moc_text = "\n".join(moc) + "\n"
    if dry:
        print(f"[DRY] would write {moc_path} ({len(moc_text)} bytes)")
    else:
        os.makedirs(os.path.dirname(moc_path), exist_ok=True)
        with open(moc_path, "w") as f: f.write(moc_text)
        written.append(moc_path)
    print(f"{'DRY-RUN' if dry else 'WROTE'} {len(written)} notes")
    if not dry:
        for w in written: print("  +", os.path.relpath(w, VAULT))

if __name__ == "__main__":
    main()

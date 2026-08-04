#!/usr/bin/env python3
"""Sync pinned MSTRMND doctrine into .generated/mstrmnd-md/.

Sources (first match wins):
  1. --from-dir PATH   local checkout of mstrmnd.md
  2. GitHub API        repository + ref from doctrine.pin.json / env / flags

Never executes doctrine content. Markdown is copied as data only.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from doctrine_common import (  # noqa: E402
    GENERATED_ROOT,
    MANIFEST_PATH,
    PIN_PATH,
    ROOT,
    assert_safe_source_path,
    is_floating_ref,
    is_full_sha,
    load_pin,
    normalize_ref,
    required_files,
    sha256_bytes,
    write_json,
)


def _env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    if value is None or not value.strip():
        return default
    return value.strip()


def resolve_git_sha(repo_dir: Path, ref: str | None) -> str:
    target = ref or "HEAD"
    proc = subprocess.run(
        ["git", "-C", str(repo_dir), "rev-parse", target],
        check=False,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise SystemExit(
            f"unable to resolve ref {target!r} in {repo_dir}: {proc.stderr.strip()}"
        )
    sha = proc.stdout.strip()
    if not is_full_sha(sha):
        raise SystemExit(f"git rev-parse returned non-SHA: {sha!r}")
    return sha


def read_local_file(repo_dir: Path, source_path: str) -> bytes:
    path = repo_dir / source_path
    if not path.is_file():
        raise SystemExit(f"missing doctrine file in local source: {source_path}")
    return path.read_bytes()


def github_api_json(url: str, token: str | None) -> dict:
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", "mstrmnd-core-doctrine-sync")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        raise SystemExit(f"GitHub API error {err.code} for {url}: {body[:500]}") from err
    except urllib.error.URLError as err:
        raise SystemExit(f"GitHub API network error for {url}: {err}") from err


def resolve_github_sha(repository: str, ref: str, token: str | None) -> str:
    url = f"https://api.github.com/repos/{repository}/commits/{ref}"
    data = github_api_json(url, token)
    sha = data.get("sha")
    if not is_full_sha(sha):
        raise SystemExit(f"GitHub did not return a full SHA for ref {ref!r}")
    return sha


def fetch_github_file(repository: str, sha: str, source_path: str, token: str | None) -> bytes:
    import base64

    url = f"https://api.github.com/repos/{repository}/contents/{source_path}?ref={sha}"
    data = github_api_json(url, token)
    if data.get("encoding") != "base64" or not data.get("content"):
        raise SystemExit(f"unexpected GitHub contents payload for {source_path}")
    return base64.b64decode(data["content"])


def clear_generated() -> None:
    if GENERATED_ROOT.exists():
        shutil.rmtree(GENERATED_ROOT)
    GENERATED_ROOT.mkdir(parents=True, exist_ok=True)


def write_file(local_path: Path, content: bytes) -> None:
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(content)


def update_pin(pin_path: Path, repository: str, sha: str, status: str = "active") -> None:
    pin = load_pin(pin_path)
    pin["repository"] = repository
    pin["ref"] = sha
    pin["status"] = status
    write_json(pin_path, pin)


def sync(
    *,
    repository: str,
    ref: str | None,
    from_dir: Path | None,
    token: str | None,
    update_pin_file: bool,
    pin_path: Path,
) -> dict:
    pin = load_pin(pin_path)
    allowlist = set(required_files(pin))

    if from_dir is not None:
        if not from_dir.is_dir():
            raise SystemExit(f"--from-dir is not a directory: {from_dir}")
        sha = resolve_git_sha(from_dir, ref)
        reader = lambda source_path: read_local_file(from_dir, source_path)
        source_label = f"local:{from_dir}"
    else:
        if not ref:
            raise SystemExit(
                "no doctrine ref to sync. Pass --ref, set doctrine.pin.json ref, "
                "or use --from-dir with a local checkout."
            )
        if is_floating_ref(ref):
            raise SystemExit(
                f"refusing to sync floating doctrine ref {ref!r}. Pin a full commit SHA."
            )
        sha = ref if is_full_sha(ref) else resolve_github_sha(repository, ref, token)
        reader = lambda source_path: fetch_github_file(repository, sha, source_path, token)
        source_label = f"github:{repository}@{sha}"

    clear_generated()
    files_meta: list[dict[str, str]] = []
    for source_path in sorted(allowlist):
        assert_safe_source_path(source_path, allowlist)
        content = reader(source_path)
        local_rel = f".generated/mstrmnd-md/{source_path}"
        local_path = ROOT / local_rel
        write_file(local_path, content)
        files_meta.append(
            {
                "sourcePath": source_path,
                "localPath": local_rel,
                "sha256": sha256_bytes(content),
            }
        )

    manifest = {
        "schemaVersion": "1.0.0",
        "repository": repository,
        "ref": sha,
        "syncedAt": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "source": source_label,
        "files": files_meta,
    }
    write_json(MANIFEST_PATH, manifest)

    if update_pin_file:
        update_pin(pin_path, repository, sha, status="active")

    print(f"synced {len(files_meta)} doctrine files from {source_label}")
    print(f"manifest: {MANIFEST_PATH.relative_to(ROOT)}")
    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--from-dir",
        type=Path,
        help="Local checkout of mstrmnd.md (preferred when GitHub access is unavailable)",
    )
    parser.add_argument(
        "--ref",
        help="Commit SHA (preferred) or resolvable ref. Floating main/master is rejected.",
    )
    parser.add_argument(
        "--repository",
        help="GitHub owner/name (default: pin file or MSTRMND_DOCTRINE_REPOSITORY)",
    )
    parser.add_argument(
        "--pin",
        type=Path,
        default=PIN_PATH,
        help="Path to doctrine.pin.json",
    )
    parser.add_argument(
        "--update-pin",
        action="store_true",
        help="Write resolved SHA back into doctrine.pin.json and set status=active",
    )
    parser.add_argument(
        "--dry-run-resolve",
        action="store_true",
        help="Print resolved repository/ref/source and exit without writing files",
    )
    args = parser.parse_args(argv)

    pin = load_pin(args.pin)
    repository = (
        args.repository
        or _env("MSTRMND_DOCTRINE_REPOSITORY")
        or pin.get("repository")
    )
    if not repository or not isinstance(repository, str):
        raise SystemExit("doctrine repository is required")

    ref = normalize_ref(args.ref or _env("MSTRMND_DOCTRINE_REF") or pin.get("ref"))
    token = _env("MSTRMND_DOCTRINE_TOKEN") or _env("GITHUB_TOKEN")

    if args.dry_run_resolve:
        print(
            json.dumps(
                {
                    "repository": repository,
                    "ref": ref,
                    "fromDir": str(args.from_dir) if args.from_dir else None,
                    "pinStatus": pin.get("status"),
                },
                indent=2,
            )
        )
        return 0

    sync(
        repository=repository,
        ref=ref,
        from_dir=args.from_dir,
        token=token,
        update_pin_file=args.update_pin,
        pin_path=args.pin,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

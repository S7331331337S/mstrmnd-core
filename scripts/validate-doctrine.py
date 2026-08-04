#!/usr/bin/env python3
"""Validate doctrine pin + optional generated manifest.

Modes:
  default     Validate pin policy. If status=active, require SHA + manifest integrity.
  --strict    Fail unless status=active, full SHA pin, and manifest verify.
  --fixture   Self-test: sync fixtures/doctrine-min and validate the result.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from doctrine_common import (  # noqa: E402
    GENERATED_ROOT,
    MANIFEST_PATH,
    PIN_PATH,
    ROOT,
    is_floating_ref,
    is_full_sha,
    load_pin,
    normalize_ref,
    required_files,
    sha256_file,
)

AWAITING_STATUSES = {
    "awaiting_repository_access",
    "awaiting_first_pin",
}


def validate_pin(pin: dict, *, strict: bool) -> list[str]:
    errors: list[str] = []
    status = pin.get("status")
    raw_ref = pin.get("ref")
    if raw_ref is None:
        ref = None
    elif isinstance(raw_ref, str):
        ref = normalize_ref(raw_ref)
    else:
        errors.append("ref must be a string or null")
        ref = None

    repository = pin.get("repository")
    if not isinstance(repository, str) or "/" not in repository:
        errors.append("repository must look like owner/name")

    try:
        required_files(pin)
    except SystemExit as err:
        errors.append(str(err))

    if is_floating_ref(ref):
        errors.append(f"floating doctrine ref is forbidden: {ref!r}")

    if status == "active":
        if not is_full_sha(ref):
            errors.append("status=active requires a full 40-char commit SHA in ref")
    elif status in AWAITING_STATUSES:
        if strict:
            errors.append(
                f"strict mode forbids pin status {status!r}; pin an active SHA first"
            )
        if ref is not None and not is_full_sha(ref):
            errors.append(
                f"when set, ref must be a full SHA even in awaiting status (got {ref!r})"
            )
    else:
        errors.append(
            f"unknown pin status {status!r}; expected active or awaiting_repository_access"
        )

    return errors


def validate_manifest(pin: dict) -> list[str]:
    errors: list[str] = []
    if not MANIFEST_PATH.is_file():
        return [f"missing manifest: {MANIFEST_PATH.relative_to(ROOT)}"]

    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        return [f"manifest is not valid JSON: {err}"]

    pin_ref = pin.get("ref")
    if pin.get("status") == "active" and manifest.get("ref") != pin_ref:
        errors.append(
            f"manifest ref {manifest.get('ref')!r} does not match pin ref {pin_ref!r}"
        )

    if manifest.get("repository") != pin.get("repository"):
        errors.append("manifest repository does not match pin repository")

    required = set(required_files(pin))
    seen: set[str] = set()
    files = manifest.get("files")
    if not isinstance(files, list) or not files:
        errors.append("manifest.files must be a non-empty list")
        return errors

    for entry in files:
        if not isinstance(entry, dict):
            errors.append("manifest file entry must be an object")
            continue
        source = entry.get("sourcePath")
        local = entry.get("localPath")
        expected = entry.get("sha256")
        if not isinstance(source, str) or source not in required:
            errors.append(f"unexpected or missing allowlisted sourcePath: {source!r}")
            continue
        seen.add(source)
        if not isinstance(local, str):
            errors.append(f"localPath missing for {source}")
            continue
        path = ROOT / local
        if not path.is_file():
            errors.append(f"generated file missing: {local}")
            continue
        actual = sha256_file(path)
        if actual != expected:
            errors.append(f"checksum mismatch for {local}")

    missing = sorted(required - seen)
    if missing:
        errors.append("manifest missing required files: " + ", ".join(missing))

    # Ensure no hand-edited junk outside allowlist under generated root markdown paths.
    if GENERATED_ROOT.is_dir():
        for path in GENERATED_ROOT.rglob("*"):
            if not path.is_file() or path.name == "manifest.json":
                continue
            rel = path.relative_to(GENERATED_ROOT).as_posix()
            if rel not in required:
                errors.append(f"non-allowlisted generated file present: {rel}")

    return errors


def run_fixture_selftest() -> None:
    fixture = ROOT / "fixtures" / "doctrine-min"
    if not fixture.is_dir():
        raise SystemExit(f"missing fixture doctrine tree: {fixture}")

    # Initialize a tiny git repo so sync can rev-parse a SHA.
    with tempfile.TemporaryDirectory(prefix="mstrmnd-doctrine-fixture-") as tmp:
        tmp_path = Path(tmp)
        source = tmp_path / "doctrine"
        shutil.copytree(fixture, source)
        subprocess.run(["git", "init"], cwd=source, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.email", "ci@mstrmnd.local"], cwd=source, check=True)
        subprocess.run(["git", "config", "user.name", "mstrmnd-ci"], cwd=source, check=True)
        subprocess.run(["git", "add", "."], cwd=source, check=True, capture_output=True)
        subprocess.run(
            ["git", "commit", "-m", "fixture doctrine"],
            cwd=source,
            check=True,
            capture_output=True,
        )

        # Use a temp pin so we do not mutate the committed awaiting pin during CI.
        pin_src = load_pin(PIN_PATH)
        temp_pin = tmp_path / "doctrine.pin.json"
        pin_src = {
            **pin_src,
            "status": "active",
            "ref": None,
            "repository": "S7331331337S/mstrmnd.md",
        }
        temp_pin.write_text(json.dumps(pin_src, indent=2) + "\n", encoding="utf-8")

        sync_script = ROOT / "scripts" / "sync-doctrine.py"
        subprocess.run(
            [
                sys.executable,
                str(sync_script),
                "--from-dir",
                str(source),
                "--pin",
                str(temp_pin),
                "--update-pin",
            ],
            check=True,
        )

        pin = load_pin(temp_pin)
        errors = validate_pin(pin, strict=True)
        errors.extend(validate_manifest(pin))
        if errors:
            raise SystemExit("fixture self-test failed:\n- " + "\n- ".join(errors))
        print("doctrine fixture self-test OK")
        print(f"fixture pin ref: {pin.get('ref')}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="Require active pinned SHA + manifest")
    parser.add_argument(
        "--fixture",
        action="store_true",
        help="Run sync+validate against fixtures/doctrine-min",
    )
    parser.add_argument("--pin", type=Path, default=PIN_PATH)
    args = parser.parse_args(argv)

    if args.fixture:
        run_fixture_selftest()
        # Still validate committed pin policy afterward (non-strict unless requested).
        pin = load_pin(args.pin)
        errors = validate_pin(pin, strict=args.strict)
        if pin.get("status") == "active":
            errors.extend(validate_manifest(pin))
        if errors:
            print("doctrine pin validation failed:", file=sys.stderr)
            for err in errors:
                print(f"- {err}", file=sys.stderr)
            return 1
        print("doctrine pin validation OK")
        if pin.get("status") in AWAITING_STATUSES:
            print(
                "note: doctrine pin is awaiting repository access; "
                "sync real mstrmnd.md when available"
            )
        return 0

    pin = load_pin(args.pin)
    errors = validate_pin(pin, strict=args.strict)
    if pin.get("status") == "active" or args.strict:
        errors.extend(validate_manifest(pin))

    if errors:
        print("doctrine validation failed:", file=sys.stderr)
        for err in errors:
            print(f"- {err}", file=sys.stderr)
        return 1

    print("doctrine validation OK")
    if pin.get("status") in AWAITING_STATUSES:
        print(
            "note: pin status is awaiting_repository_access "
            "(mstrmnd.md not pinned yet; tooling + CI self-test still gate the pipeline)"
        )
    else:
        print(f"pinned {pin.get('repository')}@{pin.get('ref')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

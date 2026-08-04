#!/usr/bin/env python3
"""Shared doctrine pin / manifest helpers for sync and validate."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
PIN_PATH = ROOT / "doctrine.pin.json"
GENERATED_ROOT = ROOT / ".generated" / "mstrmnd-md"
MANIFEST_PATH = GENERATED_ROOT / "manifest.json"

FLOATING_REFS = {"main", "master", "head", "origin/main", "origin/master"}
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
SHORT_SHA_RE = re.compile(r"^[0-9a-f]{7,39}$")


def load_pin(path: Path = PIN_PATH) -> dict[str, Any]:
    if not path.is_file():
        raise SystemExit(f"missing doctrine pin: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit("doctrine.pin.json must be an object")
    return data


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def is_full_sha(ref: str | None) -> bool:
    return bool(ref and SHA_RE.fullmatch(ref))


def is_floating_ref(ref: str | None) -> bool:
    if not ref:
        return False
    return ref.strip().lower() in FLOATING_REFS


def normalize_ref(ref: str | None) -> str | None:
    if ref is None:
        return None
    value = ref.strip()
    return value or None


def required_files(pin: dict[str, Any]) -> list[str]:
    files = pin.get("requiredFiles")
    if not isinstance(files, list) or not files:
        raise SystemExit("doctrine.pin.json requiredFiles must be a non-empty list")
    out: list[str] = []
    for item in files:
        if not isinstance(item, str) or not item.strip():
            raise SystemExit("requiredFiles entries must be non-empty strings")
        # Prevent path escape; doctrine paths are repo-relative POSIX paths.
        cleaned = item.strip().lstrip("/")
        if ".." in cleaned.split("/"):
            raise SystemExit(f"illegal required path: {item}")
        out.append(cleaned)
    return out


def assert_safe_source_path(source_path: str, allowed: set[str]) -> None:
    if source_path not in allowed:
        raise SystemExit(f"refusing to sync non-allowlisted path: {source_path}")

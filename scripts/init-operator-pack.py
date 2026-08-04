#!/usr/bin/env python3
"""Copy templates/operator-pack into a target directory for a new operator."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "templates" / "operator-pack"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dir",
        required=True,
        type=Path,
        help="Destination directory for the new operator pack",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite destination if it exists",
    )
    args = parser.parse_args(argv)

    if not SRC.is_dir():
        print(f"missing template: {SRC}", file=sys.stderr)
        return 1

    dest: Path = args.dir.expanduser().resolve()
    if dest.exists() and any(dest.iterdir()) and not args.force:
        print(
            f"destination not empty: {dest} (pass --force to overwrite)",
            file=sys.stderr,
        )
        return 1

    if dest.exists() and args.force:
        shutil.rmtree(dest)
    shutil.copytree(SRC, dest)
    print(f"operator pack created at {dest}")
    print("Next:")
    print(f'  export OBSIDIAN_VAULT_PATH="{dest}"')
    print("  cd <mstrmnd-core> && pnpm doctrine:sync && pnpm hermes -- --dry-run")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

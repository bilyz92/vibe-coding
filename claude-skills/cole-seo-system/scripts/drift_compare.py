#!/usr/bin/env python3
"""Compare two lightweight SEO drift snapshots.

Usage:
  python3 drift_compare.py <before.json> <after.json>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


KEYS = [
    "title",
    "meta_description_present",
    "canonical_present",
    "h1_count",
    "h2_count",
    "image_count",
    "images_missing_alt",
    "json_ld_present",
    "approx_word_count",
]


def load_json(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python3 drift_compare.py <before.json> <after.json>")
        return 2

    before = load_json(sys.argv[1])
    after = load_json(sys.argv[2])

    print("SEO Drift Compare")
    print(f"- Before: {sys.argv[1]}")
    print(f"- After: {sys.argv[2]}")
    print("Changes:")

    changes = 0
    for key in KEYS:
        b = before.get(key)
        a = after.get(key)
        if b != a:
            changes += 1
            print(f"- {key}: {b!r} -> {a!r}")

    if changes == 0:
        print("- No tracked changes detected.")

    print("Quick interpretation:")
    if before.get("canonical_present") and not after.get("canonical_present"):
        print("- Regression: canonical disappeared.")
    if before.get("meta_description_present") and not after.get("meta_description_present"):
        print("- Regression: meta description disappeared.")
    if after.get("images_missing_alt", 0) > before.get("images_missing_alt", 0):
        print("- Regression: more images are missing alt text.")
    if after.get("h1_count") not in (None, 1):
        print("- Check heading structure: H1 count is not ideal.")
    if after.get("json_ld_present") and not before.get("json_ld_present"):
        print("- Improvement: JSON-LD schema was added.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

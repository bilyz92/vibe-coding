#!/usr/bin/env python3
"""Create a lightweight SEO drift snapshot for a page.

Usage:
  python3 drift_snapshot.py <url-or-html-file> [output.json]

Snapshot fields:
- source
- title
- meta_description_present
- canonical_present
- h1_count
- h2_count
- image_count
- images_missing_alt
- json_ld_present
- approx_word_count
"""

from __future__ import annotations

import json
import re
import sys
from html import unescape
from pathlib import Path

from _safe_fetch import load_source, tag_attr


def first_group(pattern: str, text: str, flags: int = re.I) -> str:
    m = re.search(pattern, text, flags)
    return unescape(m.group(1).strip()) if m else ""


def all_tags(pattern: str, text: str, flags: int = re.I) -> list[str]:
    return re.findall(pattern, text, flags)


def strip_tags(html: str) -> str:
    html = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    html = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", html)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def snapshot(source: str, html: str) -> dict:
    title = first_group(r"<title>(.*?)</title>", html, re.I | re.S)
    meta = tag_attr(html, "meta", "name", "description", "content")
    canonical = tag_attr(html, "link", "rel", "canonical", "href")
    h1_count = len(all_tags(r"<h1\b", html, re.I))
    h2_count = len(all_tags(r"<h2\b", html, re.I))
    imgs = all_tags(r"<img\b[^>]*>", html, re.I | re.S)
    missing_alt = sum(1 for img in imgs if not re.search(r'\balt\s*=\s*["\'].*?["\']', img, re.I | re.S))
    json_ld_present = bool(re.search(r'application/ld\+json', html, re.I))
    approx_word_count = len(strip_tags(html).split())
    return {
        "source": source,
        "title": title,
        "meta_description_present": bool(meta),
        "canonical_present": bool(canonical),
        "h1_count": h1_count,
        "h2_count": h2_count,
        "image_count": len(imgs),
        "images_missing_alt": missing_alt,
        "json_ld_present": json_ld_present,
        "approx_word_count": approx_word_count,
    }


def main() -> int:
    if len(sys.argv) not in (2, 3):
        print("Usage: python3 drift_snapshot.py <url-or-html-file> [output.json]")
        return 2

    source = sys.argv[1]
    output = sys.argv[2] if len(sys.argv) == 3 else ""
    html = load_source(source)
    data = snapshot(source, html)
    payload = json.dumps(data, ensure_ascii=False, indent=2)

    if output:
        Path(output).write_text(payload + "\n", encoding="utf-8")
        print(output)
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

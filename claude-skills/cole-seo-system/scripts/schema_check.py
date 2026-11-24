#!/usr/bin/env python3
"""Lightweight schema detection and recommendation helper.

Usage:
  python3 schema_check.py <url-or-html-file>

Current scope:
- detect JSON-LD blocks
- infer simple schema types from raw JSON-LD strings
- recommend likely schema opportunities by site/profile
"""

from __future__ import annotations

import re
import sys
from urllib.parse import urlparse

from _safe_fetch import load_source, one_line


def detect_site(url_or_path: str) -> str:
    if not url_or_path.startswith(("http://", "https://")):
        return "generic"
    host = urlparse(url_or_path).netloc.lower()
    if "cole.edu.vn" in host:
        return "cole.edu.vn"
    if "softwareengineer.vn" in host:
        return "softwareengineer.vn"
    return "generic"


def extract_json_ld_blocks(html: str) -> list[str]:
    return re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.I | re.S,
    )


def infer_types(blocks: list[str]) -> list[str]:
    found: set[str] = set()
    for block in blocks:
        for match in re.findall(r'"@type"\s*:\s*"([^"]+)"', block, re.I):
            found.add(match)
        for match in re.findall(r'"@type"\s*:\s*\[(.*?)\]', block, re.I | re.S):
            for inner in re.findall(r'"([^"]+)"', match):
                found.add(inner)
    return sorted(found)


def recommend(site: str, types: list[str]) -> list[str]:
    existing = set(types)
    recs: list[str] = []

    def maybe_add(schema_type: str, reason: str) -> None:
        if schema_type not in existing:
            recs.append(f"Add {schema_type}: {reason}")

    maybe_add("BreadcrumbList", "helps clarify site hierarchy and page context")
    maybe_add("Organization", "strengthens entity clarity and publisher identity")

    if site == "cole.edu.vn":
        maybe_add("Article", "supports educational article understanding")
        maybe_add("FAQPage", "fits definition/guide content when genuine FAQs exist")
        maybe_add("Course", "use on course or training landing pages")
    elif site == "softwareengineer.vn":
        maybe_add("Article", "supports technical article understanding")
        maybe_add("FAQPage", "use on explanatory pages with real FAQs")
        maybe_add("WebSite", "helps define site-level search/publisher context")
    else:
        maybe_add("Article", "common win for article-like content")

    return recs


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 schema_check.py <url-or-html-file>")
        return 2

    source = sys.argv[1]
    html = load_source(source)
    site = detect_site(source)
    blocks = extract_json_ld_blocks(html)
    types = infer_types(blocks)
    recs = recommend(site, types)

    print(f"Schema Check: {one_line(source)}")
    print(f"Site Profile: {site}")
    print(f"JSON-LD blocks: {len(blocks)}")
    print("Detected types:")
    if types:
        for t in types:
            print(f"- {one_line(t)}")
    else:
        print("- none detected")

    print("Recommendations:")
    for rec in recs:
        print(f"- {rec}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

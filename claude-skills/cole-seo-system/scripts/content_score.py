#!/usr/bin/env python3
"""Lightweight content scoring for cole.edu.vn and softwareengineer.vn.

Usage:
  python3 content_score.py <url-or-html-file>

Scoring dimensions (0-100 total, simple heuristic):
- title quality
- meta description presence/length
- H1 presence
- H2 structure
- word count depth
- list/table scanability
- schema hint presence
"""

from __future__ import annotations

import re
import sys
from html import unescape
from urllib.parse import urlparse

from _safe_fetch import load_source, tag_attr


def detect_site(url_or_path: str) -> str:
    if not url_or_path.startswith(("http://", "https://")):
        return "generic"
    host = urlparse(url_or_path).netloc.lower()
    if "cole.edu.vn" in host:
        return "cole.edu.vn"
    if "softwareengineer.vn" in host:
        return "softwareengineer.vn"
    return "generic"


def first_group(pattern: str, text: str, flags: int = re.I) -> str:
    m = re.search(pattern, text, flags)
    return unescape(m.group(1).strip()) if m else ""


def count(pattern: str, text: str, flags: int = re.I) -> int:
    return len(re.findall(pattern, text, flags))


def strip_tags(html: str) -> str:
    html = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    html = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", html)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def score_content(html: str, site: str) -> tuple[int, list[str]]:
    notes: list[str] = []
    score = 0

    title = first_group(r"<title>(.*?)</title>", html, re.I | re.S)
    meta = tag_attr(html, "meta", "name", "description", "content")
    h1_count = count(r"<h1\b", html, re.I)
    h2_count = count(r"<h2\b", html, re.I)
    list_count = count(r"<(ul|ol)\b", html, re.I)
    table_count = count(r"<table\b", html, re.I)
    has_json_ld = bool(re.search(r'application/ld\+json', html, re.I))
    words = len(strip_tags(html).split())

    if 35 <= len(title) <= 65:
        score += 15
    elif title:
        score += 8
        notes.append(f"Title length is less ideal at {len(title)} chars.")
    else:
        notes.append("Missing title tag.")

    if 70 <= len(meta) <= 165:
        score += 15
    elif meta:
        score += 8
        notes.append(f"Meta description length is less ideal at {len(meta)} chars.")
    else:
        notes.append("Missing meta description.")

    if h1_count == 1:
        score += 15
    elif h1_count > 1:
        score += 5
        notes.append(f"Multiple H1s detected ({h1_count}).")
    else:
        notes.append("Missing H1.")

    if h2_count >= 3:
        score += 15
    elif h2_count >= 1:
        score += 8
        notes.append("Section structure exists but could be stronger.")
    else:
        notes.append("No H2 structure detected.")

    if words >= 1200:
        score += 20
    elif words >= 700:
        score += 15
    elif words >= 450:
        score += 8
        notes.append(f"Content depth looks moderate at ~{words} words.")
    else:
        notes.append(f"Content may be thin at ~{words} words.")

    if list_count + table_count >= 2:
        score += 10
    elif list_count + table_count == 1:
        score += 5
        notes.append("Some scanable structure exists, but more lists/tables may help.")
    else:
        notes.append("No list/table structure detected for scanability.")

    if has_json_ld:
        score += 10
    else:
        notes.append("No JSON-LD schema detected.")

    site_bonus = 0
    if site == "cole.edu.vn":
        if h2_count >= 4 and words >= 900:
            site_bonus = 5
        else:
            notes.append("Cole-style educational structure could be stronger.")
    elif site == "softwareengineer.vn":
        if words >= 700 and h2_count >= 2:
            site_bonus = 5
        else:
            notes.append("Technical explainer depth/sectioning could be stronger.")

    score += site_bonus
    return min(score, 100), notes


def band(score: int) -> str:
    if score >= 85:
        return "Strong"
    if score >= 70:
        return "Good"
    if score >= 50:
        return "Needs work"
    return "Weak"


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 content_score.py <url-or-html-file>")
        return 2
    source = sys.argv[1]
    html = load_source(source)
    site = detect_site(source)
    score, notes = score_content(html, site)
    print(f"Content Score: {score}/100 ({band(score)})")
    print(f"Site Profile: {site}")
    if notes:
        print("Notes:")
        for note in notes:
            print(f"- {note}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

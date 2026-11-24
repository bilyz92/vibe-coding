#!/usr/bin/env python3
"""Lightweight internal-link audit.

Usage:
  python3 internal_link_audit.py <url-or-html-file>

Current scope:
- extract internal/relative links from a page
- count anchor text quality basics
- surface likely quick wins for cluster linking
"""

from __future__ import annotations

import re
import sys
from urllib.parse import urlparse

from _safe_fetch import load_source, one_line


WEAK_ANCHORS = {
    "xem thêm",
    "click here",
    "here",
    "tại đây",
    "xem chi tiết",
    "đọc thêm",
    "learn more",
    "more",
}


def detect_host(url_or_path: str) -> str:
    if not url_or_path.startswith(("http://", "https://")):
        return ""
    return urlparse(url_or_path).netloc.lower()


def extract_links(html: str) -> list[tuple[str, str]]:
    matches = re.findall(r'<a\b[^>]*href=["\'](.*?)["\'][^>]*>(.*?)</a>', html, re.I | re.S)
    links: list[tuple[str, str]] = []
    for href, text in matches:
        clean_text = re.sub(r'<[^>]+>', ' ', text)
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        links.append((href.strip(), clean_text))
    return links


def is_internal(href: str, host: str) -> bool:
    if href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
        return False
    if href.startswith("/"):
        return True
    if href.startswith(("http://", "https://")):
        return urlparse(href).netloc.lower() == host if host else False
    return True


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 internal_link_audit.py <url-or-html-file>")
        return 2

    source = sys.argv[1]
    html = load_source(source)
    host = detect_host(source)
    links = extract_links(html)
    internal_links = [(href, text) for href, text in links if is_internal(href, host)]
    weak = [(href, text) for href, text in internal_links if text.lower() in WEAK_ANCHORS or len(text) < 4]
    empty = [(href, text) for href, text in internal_links if not text.strip()]

    print(f"Internal Link Audit: {one_line(source)}")
    print(f"- Total links: {len(links)}")
    print(f"- Internal/relative links: {len(internal_links)}")
    print(f"- Weak anchor texts: {len(weak)}")
    print(f"- Empty anchor texts: {len(empty)}")

    if weak[:5]:
        print("Weak anchor examples:")
        for href, text in weak[:5]:
            label = text if text else "[empty]"
            print(f"- {one_line(label)} -> {one_line(href)}")

    print("Quick wins:")
    if len(internal_links) < 3:
        print("- Add more internal links to adjacent topic pages, category hubs, or conversion pages.")
    if weak:
        print("- Replace generic anchor text with descriptive topic-aligned anchors.")
    if empty:
        print("- Ensure image/icon links still expose meaningful accessible text or labels where appropriate.")
    if not any([len(internal_links) < 3, weak, empty]):
        print("- No obvious first-pass internal-link issues detected.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

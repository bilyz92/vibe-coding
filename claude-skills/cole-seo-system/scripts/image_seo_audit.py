#!/usr/bin/env python3
"""Lightweight image SEO audit.

Usage:
  python3 image_seo_audit.py <url-or-html-file>

Current scope:
- count images
- detect missing alt text
- flag obvious placeholder image patterns
- flag missing width/height attributes
- summarize likely quick wins
"""

from __future__ import annotations

import re
import sys

from _safe_fetch import load_source, one_line


PLACEHOLDER_PATTERNS = [
    r"placeholder",
    r"PLACEHOLDER_",
    r"picsum\.photos",
    r"dummyimage",
    r"via\.placeholder",
]


def extract_images(html: str) -> list[str]:
    return re.findall(r"<img\b[^>]*>", html, re.I | re.S)


def attr(tag: str, name: str) -> str:
    m = re.search(rf'\b{name}\s*=\s*["\'](.*?)["\']', tag, re.I | re.S)
    return m.group(1).strip() if m else ""


def has_attr(tag: str, name: str) -> bool:
    return re.search(rf'\s{name}(\s*=|[\s/>])', tag, re.I) is not None


def is_placeholder(src: str) -> bool:
    if not src:
        return False
    return any(re.search(pattern, src, re.I) for pattern in PLACEHOLDER_PATTERNS)


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 image_seo_audit.py <url-or-html-file>")
        return 2

    source = sys.argv[1]
    html = load_source(source)
    imgs = extract_images(html)

    missing_alt = 0
    missing_dimensions = 0
    placeholders: list[str] = []

    for img in imgs:
        src = attr(img, "src")
        width = attr(img, "width")
        height = attr(img, "height")

        if not has_attr(img, "alt"):  # alt="" = decorative, valid
            missing_alt += 1
        if not width or not height:
            missing_dimensions += 1
        if is_placeholder(src):
            placeholders.append(src or "[missing src]")

    print(f"Image SEO Audit: {one_line(source)}")
    print(f"- Total images: {len(imgs)}")
    print(f"- Missing alt text: {missing_alt}")
    print(f"- Missing width/height: {missing_dimensions}")
    print(f"- Placeholder-like sources: {len(placeholders)}")

    if placeholders:
        print("Placeholder examples:")
        for src in placeholders[:5]:
            print(f"- {one_line(src)}")

    print("Quick wins:")
    if missing_alt:
        print("- Add descriptive alt text to meaningful images.")
    if missing_dimensions:
        print("- Add width/height or enforce aspect-ratio to reduce layout shift risk.")
    if placeholders:
        print("- Replace placeholder/demo image sources with stable production assets.")
    if not any([missing_alt, missing_dimensions, placeholders]):
        print("- No obvious first-pass image issues detected.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

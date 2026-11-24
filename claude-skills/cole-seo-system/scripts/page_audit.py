#!/usr/bin/env python3
"""Simple page-level SEO audit for cole.edu.vn and softwareengineer.vn.

Usage:
  python3 page_audit.py <url-or-html-file>

Current scope:
- Detect site profile from URL/hostname
- Extract title, meta description, canonical, H1/H2, images, schema hints
- Produce concise markdown-style findings with quick wins

This is intentionally lightweight for the first implementation.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from html import unescape
from typing import List, Optional, Tuple
from urllib.parse import urlparse

from _safe_fetch import load_source, one_line, tag_attr


@dataclass
class AuditData:
    source: str
    site: str
    profile: str
    title: str
    meta_description: str
    canonical: str
    h1s: List[str]
    h2s: List[str]
    image_count: int
    images_missing_alt: int
    has_json_ld: bool
    word_count: int


def detect_site(url_or_path: str) -> Tuple[str, str]:
    if url_or_path.startswith(("http://", "https://")):
        host = urlparse(url_or_path).netloc.lower()
    else:
        host = "local-file"

    if "cole.edu.vn" in host:
        return "cole.edu.vn", "education-content-hub"
    if "softwareengineer.vn" in host:
        return "softwareengineer.vn", "engineering-publisher"
    return host, "generic"


def strip_tags(html: str) -> str:
    html = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    html = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", html)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def first_group(pattern: str, text: str, flags: int = re.I) -> str:
    m = re.search(pattern, text, flags)
    return unescape(m.group(1).strip()) if m else ""


def all_groups(pattern: str, text: str, flags: int = re.I) -> List[str]:
    return [unescape(x.strip()) for x in re.findall(pattern, text, flags) if x.strip()]


def audit_html(source: str, html: str) -> AuditData:
    site, profile = detect_site(source)
    title = first_group(r"<title>(.*?)</title>", html, re.I | re.S)
    meta_description = tag_attr(html, "meta", "name", "description", "content")
    canonical = tag_attr(html, "link", "rel", "canonical", "href")
    h1s = all_groups(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    h2s = all_groups(r"<h2[^>]*>(.*?)</h2>", html, re.I | re.S)
    imgs = re.findall(r"<img\b[^>]*>", html, re.I | re.S)
    missing_alt = sum(1 for img in imgs if not re.search(r'\balt\s*=\s*["\'].*?["\']', img, re.I | re.S))
    has_json_ld = bool(re.search(r'application/ld\+json', html, re.I))
    word_count = len(strip_tags(html).split())
    return AuditData(
        source=source,
        site=site,
        profile=profile,
        title=title,
        meta_description=meta_description,
        canonical=canonical,
        h1s=h1s,
        h2s=h2s,
        image_count=len(imgs),
        images_missing_alt=missing_alt,
        has_json_ld=has_json_ld,
        word_count=word_count,
    )


def severity_findings(data: AuditData) -> List[Tuple[str, str, str, str]]:
    findings: List[Tuple[str, str, str, str]] = []

    if not data.title:
        findings.append(("Critical", "Missing title tag", "Search/snippet quality collapses without a title.", "Add a unique, intent-matching <title>."))
    elif len(data.title) > 65:
        findings.append(("Medium", f"Title looks long ({len(data.title)} chars)", "Long titles are more likely to truncate.", "Trim title toward a clearer primary intent."))

    if not data.meta_description:
        findings.append(("High", "Missing meta description", "CTR and snippet control are weaker without a description.", "Add a concise meta description aligned to the page intent."))
    elif len(data.meta_description) > 170:
        findings.append(("Medium", f"Meta description looks long ({len(data.meta_description)} chars)", "Long descriptions may truncate or dilute the message.", "Tighten to the strongest promise / summary."))

    if not data.canonical:
        findings.append(("High", "Missing canonical", "Canonical ambiguity can create indexing and duplication issues.", "Add a self-referencing canonical URL."))

    if not data.h1s:
        findings.append(("High", "Missing H1", "The page lacks a clear primary heading signal.", "Add one strong H1 aligned with title + intent."))
    elif len(data.h1s) > 1:
        findings.append(("High", f"Multiple H1s detected ({len(data.h1s)})", "Template + content duplication can confuse structure.", "Keep one visible primary H1 and demote extras."))

    if len(data.h2s) < 2 and data.word_count > 600:
        findings.append(("Medium", "Long page with weak sectioning", "Large pages need H2 structure for readability and scanability.", "Add clearer H2 sections matching sub-intents."))

    if data.image_count and data.images_missing_alt:
        findings.append(("Medium", f"Images missing alt text ({data.images_missing_alt}/{data.image_count})", "Missing alt reduces accessibility and image-search clarity.", "Add descriptive alt text to meaningful images."))

    if not data.has_json_ld:
        findings.append(("Medium", "No JSON-LD schema detected", "Schema is a missed clarity signal for search engines and AI extraction.", "Add at least Article/Breadcrumb/Organization schema when relevant."))

    if data.site == "cole.edu.vn":
        if data.word_count < 500:
            findings.append(("Medium", "Content may be too thin for Cole educational intent", "Cole definition/guide pages usually need fuller explanation and examples.", "Expand with use cases, examples, FAQ, and internal links."))
        if not data.h2s:
            findings.append(("High", "Cole page lacks H2 structure", "Cole pages depend on clear educational structure for intent coverage.", "Add H2s like định nghĩa / lợi ích / ví dụ / khi nào nên học."))

    if data.site == "softwareengineer.vn":
        if data.word_count < 450:
            findings.append(("Medium", "Content may be thin for technical explainer intent", "Technical explainers often need more depth and examples.", "Expand with examples, tradeoffs, and implementation notes."))

    return findings


def quick_wins(data: AuditData) -> List[str]:
    wins: List[str] = []
    if not data.meta_description:
        wins.append("Write a concise meta description aligned to the main search intent.")
    if len(data.h1s) != 1:
        wins.append("Normalize heading structure to exactly one H1.")
    if data.site == "cole.edu.vn":
        wins.append("Add 2-4 internal links into the relevant topic cluster and course/CTA path.")
    elif data.site == "softwareengineer.vn":
        wins.append("Re-check template-level meta, H1, image, and canonical behavior after any fix.")
    else:
        wins.append("Add schema + section structure before doing deeper optimization work.")
    return wins[:3]


def render_report(data: AuditData) -> str:
    findings = severity_findings(data)
    lines = []
    lines.append(f"# Page Audit: {one_line(data.source)}")
    lines.append("")
    lines.append("## Summary")
    lines.append(f"- Site: {data.site}")
    lines.append(f"- Profile: {data.profile}")
    lines.append(f"- Title: {one_line(data.title) or '[missing]'}")
    lines.append(f"- Meta description: {'present' if data.meta_description else 'missing'}")
    lines.append(f"- Canonical: {one_line(data.canonical) or '[missing]'}")
    lines.append(f"- H1 count: {len(data.h1s)}")
    lines.append(f"- H2 count: {len(data.h2s)}")
    lines.append(f"- Images: {data.image_count} total, {data.images_missing_alt} missing alt")
    lines.append(f"- JSON-LD: {'yes' if data.has_json_ld else 'no'}")
    lines.append(f"- Approx word count: {data.word_count}")
    lines.append("")
    lines.append("## Findings")
    if not findings:
        lines.append("- No obvious first-pass issues detected.")
    else:
        for sev, obs, why, action in findings:
            lines.append(f"- **{sev}** — {obs}")
            lines.append(f"  - Why it matters: {why}")
            lines.append(f"  - Recommended action: {action}")
    lines.append("")
    lines.append("## Quick Wins")
    for item in quick_wins(data):
        lines.append(f"- {item}")
    return "\n".join(lines)


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 page_audit.py <url-or-html-file>")
        return 2
    source = sys.argv[1]
    html = load_source(source)
    data = audit_html(source, html)
    print(render_report(data))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

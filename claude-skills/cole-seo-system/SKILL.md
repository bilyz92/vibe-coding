---
name: cole-seo-system
description: Audit, improve, and monitor SEO for cole.edu.vn and softwareengineer.vn. Use when analyzing article pages, category pages, landing pages, templates, schema, internal links, images, or technical SEO hygiene on these two sites. Best for actionable page audits, content refreshes, technical regressions, GEO/citability checks, and drift tracking with site-specific rules.
---

# Cole SEO System

Use this skill for SEO work on:
- `cole.edu.vn`
- `softwareengineer.vn`

Do not use it for generic backlink outreach, local SEO/maps-heavy work, or e-commerce catalog optimization unless the user explicitly expands scope.

## Core workflow

1. Identify target site:
   - `cole.edu.vn` → education/content hub, course conversion, article refresh, internal links, GEO/citability.
   - `softwareengineer.vn` → technical publisher/app, template consistency, rendering stability, technical hygiene.
2. Choose the smallest useful module set:
   - `technical`
   - `content`
   - `schema`
   - `images`
   - `links`
   - `geo`
   - `drift`
3. Prefer live page evidence or local source evidence before making claims.
4. Produce only actionable findings, not long generic theory.
5. When the task includes a fix, verify the fix before claiming success.

## Site-specific priorities

### cole.edu.vn
Prioritize:
- search intent match for “X là gì” / roadmap / comparison pages
- heading structure and readability
- CTA placement after value delivery
- internal linking into topic clusters and course pages
- schema opportunities for `Article`, `FAQPage`, `BreadcrumbList`, `Course`, `Organization`
- GEO/citability readiness: concise definitions, lists, tables, quotable facts

### softwareengineer.vn
Prioritize:
- title/meta/canonical consistency
- duplicate or broken H1 structure
- image validity and placeholder regressions
- feed/crawl hygiene
- cache/stale-render symptoms
- schema consistency for `Article`, `FAQPage`, `BreadcrumbList`, `WebSite`, `Organization`

## Module guide

### technical
Use for:
- crawlability / indexability
- canonical / robots / sitemap
- feed hygiene
- charset / content-type
- image rendering issues
- duplicate metadata
- template regressions
- cache/staleness symptoms

### content
Use for:
- title and meta description quality
- heading hierarchy
- intro quality and direct answer coverage
- readability / scannability
- article completeness
- CTA placement
- content refresh suggestions

### schema
Use for:
- detecting existing schema
- validating implementation
- identifying missing opportunities
- generating JSON-LD suggestions

### images
Use for:
- missing or weak alt text
- oversized images
- placeholders or broken images
- aspect-ratio / crop inconsistencies
- social/meta image checks

### links
Use for:
- internal link opportunities
- orphan-risk review
- anchor text quality
- topic-cluster coherence

### geo
Use for:
- quotable definitions
- fact/list/table readiness
- entity clarity
- concise answer blocks for AI-search style extraction

### drift
Use for repeated snapshots and regression checks across:
- title/meta/H1
- schema presence
- image validity
- canonical
- feed status
- rough content length
- internal link count

## Output format

Keep outputs concise and structured:

1. Summary
   - URL
   - site profile
   - audit type
   - severity snapshot
2. Findings by priority
   - Critical / High / Medium / Low
3. Each finding should include
   - Observation
   - Why it matters
   - Recommended action
   - Verification check
4. Quick wins
   - 3 highest-leverage next actions
5. If content page
   - suggested title
   - suggested meta description
   - heading improvements
   - internal links to add
   - CTA suggestion when relevant

## References to load when needed

- For site rules and priorities: read `references/cole-site-profiles.md`
- For cole.edu.vn content rules: read `references/cole-seo-rules.md`
- For softwareengineer.vn technical/editorial rules: read `references/softwareengineer-seo-rules.md`
- For output/report shapes: read `references/output-formats.md`
- For post-fix verification: read `references/verification-checklists.md`

## Scripts to use when available

- `scripts/page_audit.py`
- `scripts/content_score.py`
- `scripts/schema_check.py`
- `scripts/internal_link_audit.py`
- `scripts/image_seo_audit.py`
- `scripts/drift_snapshot.py`
- `scripts/drift_compare.py`

If scripts are placeholders, use the workflow above manually and keep outputs compatible with the intended script names.

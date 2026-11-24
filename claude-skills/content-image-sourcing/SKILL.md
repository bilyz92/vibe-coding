---
name: content-image-sourcing
description: Source, validate, download, attribute, optimize, and place third-party or official images for SEO articles, especially softwareengineer.vn style technical content. Use when article visuals may come from official vendor docs/blogs, open-license/community-shared images, screenshots, diagrams, or public assets instead of AI-generated images.
---

# Content Image Sourcing

Use this skill when an SEO article needs real, contextual images and they do not have to be AI-generated.

## Core rule
Images may be:
- created manually or with AI,
- sourced from official vendors/product docs/blogs/press kits,
- sourced from permissive/open-license libraries,
- sourced from community-shared material only when reuse is clearly allowed,
- captured as screenshots only when legally/ethically appropriate and useful.

Do **not** use random web images just because they look relevant. Every sourced image needs permission confidence, context fit, and optimization.

## Source priority
1. **Official source first**
   - vendor documentation, engineering blog, press/media kit, GitHub project assets, official diagrams.
   - Best for technologies, platforms, tools, architecture examples.

2. **Open-license / permissive sources**
   - Wikimedia Commons, Unsplash/Pexels/Pixabay where license allows reuse, official open-source project assets, CC BY/CC0 assets.
   - Preserve license and attribution requirements.

3. **Community-shared assets**
   - Only use if reuse permission is explicit or license is clear.
   - Prefer linking/citing rather than rehosting if permission is ambiguous.

4. **Screenshots**
   - Use for product UI, docs, GitHub repo examples, dashboards, code snippets, or step-by-step tutorials.
   - Avoid exposing personal/private data, tokens, emails, API keys, internal dashboards, or non-public screens.

5. **AI/manual diagrams**
   - Use when no suitable licensed image exists or when article needs a custom checklist/process/system diagram.

## License / permission checklist
Before using a third-party image, confirm at least one:
- official vendor/product source with reuse allowed or normal editorial/fair-use context,
- license says CC0/public domain/permissive reuse,
- license says CC BY and attribution can be included,
- the image is generated/captured/created by us,
- explicit permission is present.

If license is unclear:
- do not rehost as article image;
- either find another source, create a custom diagram, or link to the source instead.

## Attribution standard
For sourced images, keep a small source record in the article draft or logs:

```md
Image source record:
- File: ...
- Source URL: ...
- Source owner/vendor: ...
- License/permission: ...
- Required attribution: ...
- Date accessed: YYYY-MM-DD
- Transformations: resized/compressed/cropped/annotated
```

If attribution is required, include it in figcaption or a source note near the image.

## Context-fit rules
An image must help the reader understand the article. Prefer:
- official architecture diagrams,
- product screenshots matching the tool being discussed,
- real code/editor/terminal screenshots,
- technical workflow diagrams,
- community diagrams that explain an actual concept,
- realistic production context images.

Avoid:
- generic laptop/stock photos,
- decorative photos unrelated to the section,
- images with misleading logos or unrelated UI,
- low-resolution/blurry screenshots,
- copyrighted diagrams copied without permission.

## Optimization rules for softwareengineer.vn
Unless the user requests otherwise:
- prefer static public JPG URLs for live article images;
- avoid SVG directly in article HTML;
- avoid ActiveStorage redirect/signed URLs where possible;
- avoid WebP if the current theme/browser path has issues;
- target each image `<50KB` when feasible;
- use 16:9 for featured and most in-content images;
- preserve readability if the image contains text or UI;
- write useful alt text, not keyword stuffing.

## Workflow
1. Define the visual intent per image: definition, process, comparison, checklist, outcome, or context.
2. Search official/vendor/open-license sources first.
3. Validate license/permission and save source record.
4. Download only if permission is acceptable.
5. Crop/resize/compress to site standard.
6. Upload or place as static public asset.
7. Add alt text and source/attribution where needed.
8. Verify live image URL, article HTML, file size, and no broken links.

## When to create instead of source
Create a custom image/diagram when:
- no licensed source matches the article intent,
- the article needs a checklist/roadmap/process unique to our structure,
- sourced image would be too generic,
- legal/attribution uncertainty is high.

## Search queries to try
- `site:docs.<vendor>.com <topic> architecture diagram`
- `<vendor> official architecture diagram <topic>`
- `<tool> logo usage guidelines press kit`
- `<topic> diagram CC BY`
- `<topic> Wikimedia Commons diagram`
- `<topic> GitHub README architecture diagram license`

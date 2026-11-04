# Image prompts and visual asset record

Last updated: 4 November 2026

## Website photographs: AI-generated

The owner supplied three images on 4 November 2026. Their embedded C2PA content credentials identify them as AI-generated: the creating software is **ChatGPT (`gpt-image`)**, signed by OpenAI, with the IPTC digital source type `trainedAlgorithmicMedia`. They were created between 23:12 and 23:14 UTC on 3 November 2026 (4 November in Sydney).

| Original (kept with its C2PA credentials, not served) | Used for | Web files | Caption on the page |
| --- | --- | --- | --- |
| `scripts/source/images/hero-garden.png` (1448 × 1086) | Not currently used (the hero shows the step 1 enquiry form since 4 Nov 2026); files kept | `assets/images/hero/hero-garden-{640,960,1280,1448}.webp`, fallback `hero-garden-960.jpg` | “AI-generated illustrative image. Not a photo of a real job or property.” |
| `scripts/source/images/tree-removal.png` (1448 × 1086, cropped to 3:2) | Services: Tree removal card | `assets/images/services/tree-removal-{480,800,1200}.webp`, fallback `tree-removal-800.jpg` | “AI-generated illustrative image” |
| `scripts/source/images/tree-pruning.png` (1672 × 941, cropped to 3:2) | Services: Tree pruning card, and the social sharing image | `assets/images/services/tree-pruning-{480,800,1200}.webp`, fallback `tree-pruning-800.jpg`; `assets/images/social/sydney-tree-connect-social.jpg` (1200 × 630) | “AI-generated illustrative image” (also printed on the social image) |

**Content check (4 Nov 2026):** none of the images contain text, logos, people, machinery, fake staff, hazards or before/after comparisons. They show mature trees in Sydney-style gardens. They don't depict tree work being done, and must never be presented as evidence of real jobs or customers.

**Prompts:** the prompts used to create these images were not supplied. If you have them, record them in the log below.

**Originals are kept in Git on purpose** (owner decision, 4 Nov 2026, about 10.4 MB) so the web images can be rebuilt and the C2PA credentials preserved. `scripts/` is blocked from web access, so they are never served.

**Processing:** `python scripts/build-images.py` crops, resizes and converts the originals to WebP (quality 70) with one JPEG fallback each (quality 76). It also builds the social image. The C2PA credentials remain in the PNG originals. The resized web files don't carry them, which is why the pages show visible captions.

## Logo and icons

The logo, symbol and favicons are original vector artwork (`scripts/build-brand.py`, `scripts/render-brand-png.cjs`). No image generation was used. The wordmark is Figtree at weight 720, converted to outlines. Service and step icons are simple inline SVG line icons.

## Guidance for future images

When generating replacements or new images, keep to the build brief:

> No people operating machinery, no workers or fake staff, no chainsaws, ladders, trucks or climbing gear, no fallen or damaged trees or storm damage, no before/after comparisons, no text, lettering, logos, watermarks, signage, house numbers or identifiable real addresses.

Add the “AI-generated illustrative image” caption wherever an image could be mistaken for a real job. Then re-run `scripts/build-images.py` (adding the new file to `JOBS`) and record it below.

## Generation log

| Date | Asset | Tool | Prompt / notes |
| --- | --- | --- | --- |
| 2026-11-04 | hero-garden, tree-removal, tree-pruning | ChatGPT (`gpt-image`), per C2PA credentials | Supplied by the owner. Prompts not recorded. |
| 2026-11-04 | Logo, symbol, favicon | None (vector) | Leaf symbol with vein lines ending in nodes (connection motif). |
| 2026-11-04 | Temporary hero illustration | None (procedural SVG) | Replaced by hero-garden on 4 Nov 2026 and removed from the site. |

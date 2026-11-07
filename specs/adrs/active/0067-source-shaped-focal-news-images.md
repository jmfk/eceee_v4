---
id: ADR-0067
title: Source-shaped focal crops for news images
status: accepted
created: 2026-11-07
related_prds:
  - PRD-0045
  - PRD-0047
---

# Source-shaped focal crops for news images

The owner's updated reference makes source dimensions authoritative for cropped news images: landscape sources use a 7:4 frame, while square and portrait sources use a square frame. Metadata supplies the initial shape; external images without dimensions update after their natural dimensions load. The legacy News Flash image-shape setting remains a fallback for unknown dimensions and placeholders, and is removed from the editor's manual choices.

Reuse the media library's pure bounded focal-crop calculation in a presentation-only news image component. Center the saved normalized focal point in the measured frame where possible, clamping the crop to the source edges so the nearest edge is retained. Recalculate after image load and frame resizing. Missing or invalid focus coordinates default to center. News Flash, Top News and Sidebar thumbnails use this presentation; stored Article bodies and their inline images are unchanged.

Public media lookups return width, height and only the saved focal-point metadata through the existing tenant-scoped, public/non-deleted media filter. News feeds resolve media references through that lookup rather than relying on stale embedded snapshots. This adds no migration or content rewrite.

The adjacent text-only card correction omits the missing image rather than rendering a blue image area. Its body copy has an additional 40px right inset inside the normal 30px padding; headings retain the full content width. Existing font sizes and outside outlines remain intact.

Verification: 193 focused frontend tests and 90 publisher tests pass, including source orientation, natural-dimension fallback, left/right/bottom focal crops, public media metadata and legacy naming. Frontend build, publisher lint/typecheck, specs governance and all 51 frozen contract cases pass. Browser checks cover desktop and 390px layouts with real news images plus isolated portrait/landscape/square focal fixtures. The temporary fixture page was removed after verification; no articles or media focal points were edited.

# Export / Import

.docx export and import using python-docx.

## Files

| File | Purpose |
|------|---------|
| `docx_service.py` | Export TipTap JSON → .docx, Import .docx → TipTap JSON |

## Export

Converts TipTap JSON nodes to .docx:
- Headings (h1, h2, h3) → Word heading styles
- Bold, italic → run formatting
- Bullet/ordered lists → Word list styles
- Paragraphs → standard paragraphs

## Import

Reads a .docx file and converts to TipTap JSON:
- Word headings → TipTap heading nodes
- Bold/italic runs → marks
- Lists → bullet/ordered list nodes
- Paragraphs → paragraph nodes

## Latest updates

- Phase 1: export and import working for headings, bold, italic, lists, paragraphs
- Future: support for more formatting (tables, images, hyperlinks)

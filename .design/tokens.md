---
name: Remanga Reader Enhancer
last_updated: 2026-05-09
---

# Design tokens for "Remanga Reader Enhancer"

When generating frontend code (TSX/CSS/Tailwind) for this project, use these tokens — they mirror the actual `remanga.org` computed styles so the extension UI feels native.

## Colors

| Token                       | Hex       | Use                                              |
|-----------------------------|-----------|--------------------------------------------------|
| `color.background`          | `#131416` | Primary surface (page bg, popup bg)              |
| `color.surface.elevated`    | `#18191B` | Cards, pill buttons, sub-panels                  |
| `color.border`              | `#27272A` | Hard borders                                     |
| `color.border.soft`         | `rgba(64,64,67,0.5)` | Section dividers (matches Remanga oklab) |
| `color.text.primary`        | `#FAFAFA` | Primary text                                     |
| `color.text.secondary`      | `#8A8F9C` | Captions, muted, section headings                |
| `color.accent`              | `#3EDAE0` | Active toggles, primary CTA, brand highlights    |
| `color.accent.soft`         | `rgba(62,218,224,0.12)` | Accent button background, hover tints   |
| `color.danger`              | `#FF6B6B` | Errors, destructive states                       |
| `color.toggle.off`          | `rgba(255,255,255,0.08)` | Toggle inactive track                  |

## Typography

- **Family character:** "Exo 2" (Remanga's actual brand font, available on Google Fonts).
- Fallback stack: `"Exo 2", system-ui, -apple-system, sans-serif`
- **Weights used:** 400, 500, 600, 700
- **Heading scale:** 14 (popup section heading is 10 uppercase tracked)
- **Body:** 13, line-height 1.4
- **Captions:** 11, line-height 1.3

## Spacing

4px base unit. Common values: 4, 8, 12, 14, 16, 18, 24.

## Radii

- `radius.sm`: 6
- `radius.md`: 12
- `radius.full`: 9999 (pills, toggles, action buttons)

## Shadows / depth

Visual language is flat — no global shadow tokens. Use opacity transitions and accent glow sparingly.

## Hard NOs (must not appear in generated code)

- No Comic Sans / decorative scripts
- No rainbow gradients, no purple-blue gradient backgrounds
- No `!important` overrides on color/spacing
- No inline hex outside this token list — always reference tokens
- No comic-book styling (halftone, thick borders) — that's the OLD icon, do not reproduce

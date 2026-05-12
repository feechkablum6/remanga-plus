# gpt-image-prompt log for "Remanga Reader Enhancer"

## 2026-05-11 — Hero image for Remanga forum post (v2 with real screenshots)

**Type:** marketing hero / before-after composite (single PNG, 1536×1024 landscape) — REFERENCE-BASED collage, not from-scratch render
**Subject:** before/after of remanga.org's reader chrome composited from two REAL product screenshots (`screenshots/clean-rail-before.png` + `screenshots/clean-rail-after.png`), with a teal vertical divider and "ReManga Plus" wordmark on top.

**Why v2:** v1 (below) tried to render the manga-reader UI from scratch with verbal description — produced low-quality generic mock. v2 attaches the actual product screenshots and instructs the model to use them AS-IS like a photo collage, only adding wordmark + divider + captions. Brand consistency is automatic (real product = real brand colors).

**Constraints:**
- Soft post (option B chosen) — UI cleanup only, no Premium Free
- Forum bans external links — picture must NOT contain URLs or install CTAs
- Brand-primed already (`brand.md` since 2026-05-09)
- Composite mode (one PNG) — forum has one image slot
- Reference screenshots attached: Image 1 = `clean-rail-before.png`, Image 2 = `clean-rail-after.png`

```text
Use the brand defaults remembered in ChatGPT memory for project "Remanga Reader Enhancer" — colors, typography, visual language.

Two reference images attached to this chat:
- Image 1 = the "До" (Before) screenshot — actual remanga.org native reader chrome with the cluttered right-side toolbar.
- Image 2 = the "После" (After) screenshot — the same chrome after the ReManga Plus extension cleaned it up.

These are REAL product screenshots. Treat them as photographic content for a collage — do NOT redraw, do NOT re-render, do NOT stylize. The whole point of attaching them is to preserve the real UI pixel-perfect.

Step 1 — Compose ONE single 1536×1024 landscape PNG with this exact layout:

(a) Top band — full canvas width, ~90px tall, solid #131416 background. Centered horizontally: a small 10px solid square in teal #3EDAE0, immediately to its right (~12px gap) the wordmark "ReManga Plus" in 28px equivalent, color #FAFAFA, geometric sans-serif (Exo 2 character — chunky stems, slightly humanist, semibold weight). Total wordmark + dot is centered as a single unit.

(b) Below the top band, the remaining ~934px tall area is split into two side-by-side panels of EQUAL width (~768px each), separated by a thin vertical teal #3EDAE0 divider, 2px wide, no glow, no gradient, full height of the panel area.

(c) LEFT panel: place Image 1 inside, fitted with a clean 32px margin on all sides. Preserve aspect ratio — DO NOT stretch or distort. If the screenshot is narrower than the panel, center it horizontally and fill the gaps with the same #131416 background. In the TOP-LEFT corner of the panel, overlay caption "До" in 22px equivalent semibold, color #FAFAFA, with 16px padding from panel edges. The caption sits on a small dark pill (#18191B background, 6px corner radius, 8px horizontal padding) for readability against the screenshot.

(d) RIGHT panel: same treatment for Image 2, with caption "После" in the same style.

Step 2 — Self-check:
(a) Image 1 and Image 2 appear UNCHANGED — same pixels, same icons, same colors as the attached files. Not redrawn, not stylized, not enhanced.
(b) Cyrillic captions "До" and "После" are spelled exactly — no Latin substitution, no autocorrection.
(c) Wordmark is exactly "ReManga Plus" — two words, capital R, capital P, one space.
(d) Divider is a clean 2px teal vertical line — no glow, no thickness drift, no fade.
(e) All gap-fill background is #131416 — no white, no other dark shade.
(f) No extra decoration anywhere.

CRITICAL RULES:
- DO NOT redraw, recreate, or restyle the screenshots — they are used AS-IS, like a photo in a magazine layout. The model's job is layout + wordmark + divider + captions, NOT generation of UI content.
- DO NOT add comic-book styling, halftone dots, sparkles, glow, gradients, or any decoration beyond what's described.
- DO NOT add any URL, install instruction, button, badge, or text other than the wordmark "ReManga Plus" and the captions "До" / "После".
- DO NOT include the Remanga yin-yang logo anywhere — it's their trademark.

Final output: ONE 1536×1024 landscape PNG, single image, solid #131416 background, two real screenshots composited side-by-side under the wordmark with a teal divider and Russian captions.
```

**Notes:** _empty_

---

## 2026-05-11 — Hero image for Remanga forum post (v1, from-scratch render — ABANDONED)

**Type:** marketing hero / before-after composite (single PNG, 1536×1024 landscape) — verbal description only
**Subject:** before/after comparison of remanga.org's reader UI — left panel "До" with cluttered native chrome (right toolbar with 11+ icons, full top/bottom bars), right panel "После" with the same manga page but stripped chrome (3 icons in toolbar, minimal bars). Centered teal divider, "ReManga Plus" wordmark on top.

**Why abandoned:** verbal description of manga-reader UI from scratch produced generic-looking mock that didn't match real remanga.org. Replaced by v2 above (reference-based collage).

**Constraints driving prompt design:**
- Soft post (option B chosen) — talks ONLY about UI cleanup, not Premium Free, to survive remanga.org's own forum moderation
- Forum bans external links — picture must NOT contain any URL, install instruction, or call-to-action beyond brand name
- Brand-primed already (`brand.md` exists since 2026-05-09) — preamble triggers memory recall, no need to redeclare palette
- Composite mode (one PNG) intentional, NOT batch — forum has one image slot

```text
Use the brand defaults remembered in ChatGPT memory for project "Remanga Reader Enhancer" — colors, typography, visual language, composition, audience tone — apply automatically unless overridden below. Pull these from the saved memory entry titled "Remanga Reader Enhancer".

Step 1 — Reference: briefly browse current 2026 manga reader UIs (Tachiyomi, Mihon, Crunchyroll Manga, Webtoon). Identify how a dense right-side icon column looks at production density. Also note remanga.org's actual reader chrome — dark surface, right-side icon column with many stacked buttons, single teal accent.
Step 2 — Synthesize: do not copy any specific app. Extract the visual register (dark, dense, icon-column on the right). Design a clean mock that demonstrates the difference between native cluttered state and extension-enhanced state.
Step 3 — Design: ONE single 1536×1024 landscape PNG. Composite layout — split into two side-by-side panels of EQUAL width, separated by a thin vertical divider in the project's accent teal #3EDAE0 (1.5px wide, no glow). Each panel is a mock screenshot of the same manga-reader screen.

Left panel — caption "До" (Russian for "Before") in the top-left of the panel, 18px equivalent semibold, color #FAFAFA. Shows the native cluttered state:
- Top bar (full width of the panel): logo placeholder on the left (small abstract shape, NOT the Remanga yin-yang), centered search field, profile circle on the right, small notification badge floating near the profile.
- Manga page placeholder occupying ~68% of the panel width on the LEFT side of the panel content area.
- Vertical right-side toolbar on the RIGHT side of the panel: 12 abstract monochrome icon glyphs stacked tightly with ~8px spacing between them (gear, eye, page-layout, list, comments, bookmark, palette, info, fullscreen, share, font, and one more — render as generic 16px outline/filled glyph silhouettes in #8A8F9C, no readable text on them, no real Remanga icons).
- Bottom bar (full width): chapter prev arrow, chapter title text, page counter "12 / 47", comment count "23", three more small icons.
- Overall feeling: VISUALLY NOISY, lots of competing UI elements packed together.

Right panel — caption "После" (Russian for "After") in the top-left of the panel, same typography as "До". Shows the same screen, stripped clean:
- Top bar: minimal — just a thin centered title or removed entirely. NO notification badge. NO profile circle.
- Manga page placeholder occupying the SAME width and position as in the left panel — IDENTICAL.
- Vertical right-side toolbar: ONLY 3 icons (gear, page-mode, bookmark), generously spaced ~24px apart.
- Bottom bar: minimal — just chapter prev/next arrows and page counter "12 / 47", nothing else.
- Overall feeling: VISUALLY CALM, generous breathing room around every element.

Manga page placeholder (IDENTICAL in both panels): a vertical rectangle in mid-grey #2A2A2D representing a manga page, aspect roughly 3:4 (portrait). Inside the rectangle: 3-4 horizontal subtle dividers suggesting comic panel boundaries, and a few simple geometric placeholder shapes in lighter grey #3A3A3D suggesting blocked-out figures and speech-bubble silhouettes. NO actual manga drawing, NO faces, NO text, NO recognizable characters — just abstract page composition that READS as "manga page" without copying anything specific.

In the very top-center of the canvas, ABOVE both panels, in the empty band between the canvas top edge and the panels: a horizontal wordmark "ReManga Plus" in 26px equivalent, color #FAFAFA, in the project's typography character (Exo 2 — geometric sans-serif, chunky stems, slightly humanist). To the immediate left of the "R" letter, a small 8px solid square in accent teal #3EDAE0 as a brand mark. Total wordmark + accent dot is centered horizontally across the full canvas width.

Step 4 — Self-check: verify (a) the manga page placeholder is PIXEL-IDENTICAL in both panels (same width, same height, same internal shapes, same position), (b) only the surrounding chrome differs, (c) left panel has exactly 12 toolbar icons, right panel has exactly 3, (d) Cyrillic captions are spelled EXACTLY: "До" and "После", no Latin substitution, no autocorrection, (e) wordmark is "ReManga Plus" exactly, (f) the central divider is a clean thin teal line — no glow, no thickness >2px, no gradient, (g) overall mood matches the brand's calm-and-clean intent — NO comic-book styling, NO rainbow, NO sparkles.

Subject: hero image for a forum post about a Chrome extension that strips visual noise from remanga.org's reader interface.

Style: flat dark UI mock, very subtle depth (no heavy 3D, no glassmorphism), two-color discipline + single teal accent. Looks like a high-fidelity product screenshot, NOT an illustration.

Color palette (strictly these, no others):
- Canvas background and panel surfaces: #131416 (deep near-black with subtle blue undertone)
- Top/bottom bars and right toolbar surface: #18191B (slightly elevated dark)
- Thin separators between bars and content area: #27272A
- Text primary (captions "До" / "После", wordmark): #FAFAFA
- Text muted (page counter, comment count, chapter title): #8A8F9C
- Toolbar icon glyphs: #8A8F9C
- Single accent (central vertical divider, brand square next to wordmark): #3EDAE0
- Manga page placeholder body: #2A2A2D
- Manga page inner shapes: #3A3A3D

Typography character: Exo 2 — geometric sans-serif, slightly humanist, chunky stems. Captions "До" / "После" 18px equivalent semibold. Page counter "12 / 47" 11px equivalent regular. Wordmark "ReManga Plus" 26px equivalent semibold.

CRITICAL — all text labels are 100% OPAQUE PAINT on top of their respective surfaces. Every pixel of every letter is fully filled with its color. Text is NOT cut through the surface, NOT translucent, NOT a stencil. The Cyrillic characters "До" and "После" must be rendered EXACTLY verbatim, character-for-character, no rewording, no auto-correction, no Latin look-alike substitution. The wordmark "ReManga Plus" is two words separated by one space, capital R and capital P.

Composition: clean side-by-side before/after comparison, equal panel widths, generous internal padding (24px equivalent from each panel edge to its content), central divider perfectly vertical and centered. The image reads instantly as "Before / After" even at thumbnail size.

Background: solid #131416 across the entire 1536×1024 canvas, no halos, no fringing, no vignette, no gradient transitions.

Do not include: any real Remanga logo or trademark (NO yin-yang shape anywhere), any specific manga title text, any specific manga artwork or characters or faces or drawn humans, watermarks, photorealistic photos, URLs, install instructions, call-to-action buttons, comic-book halftone dots, thick black borders, drop shadows on the canvas, glow on the divider or wordmark, sparkles, decorative flourishes, additional accent colors beyond the single teal #3EDAE0.
```

**Notes:** _empty_

---

## 2026-05-11 — Popup UX redesign (v0.6.0 ship)

**Type:** UI exploration → final mockup → scale-up polish
**Subject:** заменили линейный список настроек в `public/popup.html` на дашборд с 3 карточками-категориями (Сайт / Читалка / Premium Free), drill-down экранами по тапу на карточку, и компактным блоком «Сервис» (parser-server статус + clickable site-links + пилюля «Импорт →»).

**Что сгенерили в ChatGPT Images 2.0 (batch-режим, по 5–8 файлов за один промпт):**

1. **Первый batch** — 5 концептов лэйаута для outline-сравнения (320px-popups, отдельные PNG):
   - Tabs сверху (горизонтальные вкладки)
   - Sidebar слева (вертикальный icon column)
   - **Dashboard cards (2×2 grid + drill-down)** ← выбран
   - Минимум + ⚙ (compact main + drawer)
   - Аккордеон + поиск

2. **Второй batch (после выбора Dashboard)** — 8 вариаций карточки Premium Free и общей раскладки:
   - PF drill-down с 3 настройками
   - PF с мини-статистикой
   - PF promo (off-state CTA)
   - PF hero (full-width сверху)
   - Сервис вместо Импорт+Сервер
   - **3 карточки полной ширины** ← база финала
   - PF с выбором провайдера
   - PF в шапке, без карточки

3. **Финал** — один PNG с главным экраном + drill-down PF. Anchored to selected mockup (attached as Image 1) so style stayed consistent.

**Брендовая ключевая база для всех промптов** (см. `brand.md` и `tokens.md`):
- Surface base #131416, elevated #18191B, border #27272A, border-soft rgba(64,64,67,0.5)
- Text #FAFAFA / muted #8A8F9C, accent #3EDAE0 / soft rgba(62,218,224,0.12), danger #FF6B6B
- Typography character: "Exo 2", body 13/14px, section headings 10/11px UPPERCASE tracked, popup title 14/16px semibold

**Post-ship scale-up (commit e6a47aa):** после установки в реальный Chrome 320px popup воспринимался мельче чем на 1024px canvas мокапа. Bumped:
- Popup width 320 → 360
- Body 13 → 14, card title 13 → 16, subtitle 11 → 12, icon 36 → 44, card height 72 → 84
- Toggle pill 32×18 (knob 14) → 44×26 (knob 20), label 13 → 15
- Header monogram 24 → 30, title 14 → 16
- Drill-down title 14 → 16, subsection heading 10 → 11
- Service row 11 → 13, refresh icon 16 → 20, auth row 13 → 14, import pill 13 → 14 (padding bumped)

**Out of scope для этого редизайна:** translation picker (Senkuro/Mangabuff/InkStory остаются как невидимый fallback в parser-server), статистика чтения, поиск по настройкам, drill-down мелких тулбар-настроек читалки.

**Spec:** [docs/superpowers/specs/2026-05-11-popup-dashboard-redesign-design.md](../docs/superpowers/specs/2026-05-11-popup-dashboard-redesign-design.md)
**Plan:** [docs/superpowers/plans/2026-05-11-popup-dashboard-redesign.md](../docs/superpowers/plans/2026-05-11-popup-dashboard-redesign.md)

**Notes:** _empty_

---

## 2026-05-09 — Brand priming + master extension icon (initial)

**Type:** brand priming + browser extension icon (replaces existing red comic-book "R" icon)
**Subject:** clean monogram-style "R" mark in Remanga's dark + teal palette, used both as the extension icon (Chrome toolbar / extensions list / Web Store listing) AND as the inline header mark inside the popup at 22px

### Brand priming prompt

(See `.design/brand.md` for the canonical version — paste once into ChatGPT.)

### Main icon prompt

```text
Use the brand defaults remembered in ChatGPT memory for project "Remanga Reader Enhancer" — colors, typography, visual language, composition, audience tone — apply automatically unless overridden below. Pull these from the saved memory entry titled "Remanga Reader Enhancer".

Step 1 — Reference: briefly browse current 2026 Chrome extension icons for content-enhancing utilities (Dark Reader, Bionic Reading, Reader Mode, Mercury Reader). Identify the dominant visual register: bold single-shape silhouette, two-color discipline, calm dark-mode-friendly palette.
Step 2 — Synthesize: do not copy. Extract the calm-and-confident register, then design something distinct that pairs well with remanga.org's actual UI (deep near-black surface + teal yin-yang accent).
Step 3 — Design: render a single bold Cyrillic-friendly capital letter "R" (Latin R, since "Remanga" is the brand) on a deep near-black filled square, with a single teal "enhancement" accent — a small horizontal serif or clean diagonal stroke that crosses the lower half of the R, suggesting underlining/marking-up content. The accent reads as "this letter has been polished/enhanced".
Step 4 — Self-check: verify the R is opaque white paint (NOT a stencil cutout), the teal accent is opaque teal paint, edge-to-edge fill with zero transparent margins, the R fills 75-82% of the canvas height, no internal subdivisions or extra detail that would disappear at 16px.

Subject: extension icon for "Remanga Reader Enhancer" — a Chrome MV3 extension that strips visual noise from remanga.org's manga reader. The icon must feel like a native part of Remanga's own dark-and-teal UI, not a loud third-party badge.

Style: flat, minimal, two-color discipline + single accent. Calm and confident, NOT comic-book, NOT 3D, NOT glassmorphic. Soft inner highlight on the letter is acceptable; no drop shadow, no glow.

Color palette:
- Background fill: #131416 (deep near-black with subtle blue undertone — exact Remanga --background)
- Letter "R": #FAFAFA (near-white)
- Accent stroke under/across the lower half of the R: #3EDAE0 (signature Remanga teal)
- Strictly these three colors, no others.

Letterform: bold geometric sans-serif in the character of "Exo 2" — slightly humanist proportions, chunky stems, confident terminals. Stroke thickness ≈ 28% of letter height. The "R" fills 78% of the canvas height, with a small safe margin so the silhouette doesn't bleed off the canvas edges.

Accent detail: a single short horizontal teal stroke OR a clean diagonal teal slash that crosses the bottom-right leg of the R, ~12% of letter height in thickness. It reads as a "highlighter mark" or "polished underline". Do NOT add multiple sparkles, dots, particles, glow, or decorative flourishes — exactly ONE accent stroke.

The image is a 1024x1024 canvas filled EDGE TO EDGE — the deep near-black background touches all four edges of the canvas with zero padding, no transparent margins around the shape, no rounded-square container sitting inside empty space. NO subtle inner padding. NO rounded corners on the canvas itself.

CRITICAL — the letter "R" and the teal accent stroke are 100% OPAQUE PAINT on top of the deep near-black fill. Every pixel of every stroke is fully filled with its color (white for the R, teal for the accent). They are NOT holes cut through the background, NOT stencils, NOT translucent. NO part of the page background, browser UI, or anything else shows through any glyph. The deep near-black visible in the negative space around the letter is the FILL of the shape, NOT transparency.

Composition: centered, balanced, reads clearly at 16x16 in a Chrome toolbar AND at 128x128 in the extensions list. The same image must be used at sizes 16/32/48/128/512/1024 — verify the silhouette holds up at the smallest size.

Background: solid deep near-black across the whole canvas, no halos, no fringing, no subtle gradient.

Do not include: text other than the single letter "R", watermarks, logos, photorealistic details, brand trademarks, stock-photo elements, comic-book halftone dots, thick black outlines, drop shadows on the background, glows, sparkles, multiple accent marks, the Remanga yin-yang logo (that's their trademark, do not reproduce), gears or shields or books.
```

**Notes:** _empty_

---

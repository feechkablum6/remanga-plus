# Remanga Reader Enhancer

## Source Of Truth

- `src/content.ts` bootstraps the content script, watches route/storage changes, and requests re-syncs.
- `src/background.ts` owns parser-server startup coordination, healthchecks, and Native Messaging requests.
- `src/reader-enhancer.ts` owns DOM discovery plus all reader UI mutations.
- `src/premium-free.ts` is the client-side contract for parser-server URLs, ReManga metadata extraction, and Premium Free response shapes.
- `src/parser-server.ts` is the shared source of truth for parser-server URLs, startup message types, and Native Messaging host names.
- `src/popup-dismissal.ts` contains popup candidate selectors plus close-button heuristics for gifts/promos and other dismissible overlays.
- `src/settings.ts` is the Chrome `storage.sync` contract. Keep defaults and merges aligned with any new toggle.
- `parser-server/src/server.ts`, `parser-server/src/routes/chapters.ts`, and `parser-server/src/resolve-chapter.ts` are the backend source of truth for external chapter resolution.
- `parser-server/src/config.ts` is the source of truth for provider priority and manual title overrides. Do not duplicate override logic in the extension.
- `native-host/host.ts`, `native-host/install-macos.ts`, and `native-host/native-host-manifest.json` own the macOS Native Messaging launcher flow. Keep the host manifest and extension host name in sync with `src/parser-server.ts`.
- `dist/` is build output only. Change `src/` and rebuild instead of editing bundled files.
- `src/bookmark-filter.ts` is the shared source of truth for bookmark category definitions, cache keys, message types, and card-matching helpers for the home bookmark filter feature.

## Commands

- `npm run check` runs TypeScript validation for source and tests.
- `npm run build` rebuilds the MV3 content script plus background service worker into `dist/content.js` and `dist/background.js`.
- `npm run native:build` compiles `native-host/dist/host.js`.
- `npm run native:install` builds and registers the macOS Native Messaging host. It derives the extension id from the `"key"` in `public/manifest.json` by default; pass `--extension-id <id>` (repeatable) to allow additional ids alongside the derived one, for example when Chrome kept a legacy id cached.
- `cd parser-server && npm run check` validates the backend resolver.
- `cd parser-server && npm test` runs backend resolver/provider/image proxy tests.
- Runtime test for the rail overlay helper:
  `npx tsc --module NodeNext --moduleResolution NodeNext --target ES2022 --outDir .codex-tmp/test-build tests/rail-overlay-state.test.ts`
  then `node --test .codex-tmp/test-build/tests/rail-overlay-state.test.js`
- Runtime test for popup dismissal heuristics:
  `npx tsc --module NodeNext --moduleResolution NodeNext --target ES2022 --outDir .codex-tmp/test-build tests/popup-dismissal.test.ts src/popup-dismissal.ts`
  then `node --test .codex-tmp/test-build/tests/popup-dismissal.test.js`

## Behavior Patterns

- The right rail is managed by per-button visibility, not by one blanket hide rule. `hideRightRail` enables the preset; the nested toggles decide which controls disappear.
- The minimized settings entry point is a separate fixed overlay (`settings-peek-zone`). It must only exist while the reader drawer is closed.
- Reader settings drawer refreshes need one immediate sync on `childList` open plus separate settled follow-up syncs for panel transitions. Reusing one debounce handle for both paths delays all visibility fixes until after the first paint.
- The native right rail should stay visible while the reader settings drawer is open. Opening the drawer should only remove the minimized settings overlay, not hide the rail itself.
- Animated visibility changes must use staged motion helpers first and apply `data-rre-hidden="true"` only after the exit animation settles. Direct `markHidden(...)` is still correct for non-animated flows.
- The custom `fullscreen-main` rail button should be mounted as a sibling before the native settings group, not inside that shared group. Otherwise the group pill/background collapses out of sync with the button animation.
- When `Минимизировать кнопку настроек` is enabled, the minimized entry point should still leave a visible slice of the gear button peeking from the right edge and slide the full button into view on hover/focus. On touch, tapping it should still open settings immediately.
- Minimize animations for the native settings entry point should target `settingsGroup` when it exists, not only the nested `settingsButton`. The native pill/background can live on the wrapper even when the icon button is the interactive child.
- Forwarding the minimized settings peek button through the hidden native control requires a temporary one-frame revive of `settingsGroup`. ReManga ignores `settingsButton.click()` while that wrapper is under `display:none`, even though the same click works when the wrapper is merely invisible.
- `Улучшить меню настроек` follows the same preset + nested toggles pattern as the right rail subsection, but its nested toggles default to `true` so enabling the preset hides the listed native items immediately.
- Home bookmark filter only applies on the root page (`remanga.org/`). It must not hide cards in the catalog or on other pages.
- Home bookmark filter uses `data-rre-home-hidden="bookmark-filter"` to hide cards. When the filter is disabled or no categories match, all `bookmark-filter` hidden markers are cleared.
- Bookmark data is fetched once from the API and cached for 30 minutes in `chrome.storage.local`. Toggling a category does not re-fetch — only the client-side filter changes.
- The nested subsections under `Скрывать боковую панель` and `Улучшить меню настроек` always start collapsed when the drawer opens. Their expanded state is transient and must reset when the native drawer closes.
- Native reader settings items should be matched by stable visible text first, not utility classes. ReManga labels drift much less often than drawer class names.
- The `Дополнительные настройки` section is collapsible by clicking its title, and its expanded state is persisted in `chrome.storage.sync`. New users should see it expanded by default.
- `cloneToolbarButton(...)` must strip RRE-owned hidden/motion attributes from templates before reuse. Cloning an already-managed node otherwise recreates new controls in a hidden state.
- Gift/promo auto-hide is not toast-only. The dismissal pass must scan both toast containers and modal `dialog`/`alertdialog` overlays, then prefer a native close control over force-hiding.
- `Premium Free` replaces the old buy-banner hide toggle. When enabled, the extension should keep a stateful custom container in the premium area with `idle -> resolving -> rendering/error` transitions instead of a one-line placeholder.
- Premium Free rendering must mirror live ReManga reader settings. `Лента` should render repeated `reader-container-width` page wrappers; `Постраничная` should render one page plus a local `ClickableArea`-shaped left/center/right overlay instead of a custom fixed-width gallery.
- Premium Free should sample reader width/brightness from live ReManga CSS vars first (`--reader-container-width`, `--reader-brightness`) by reading a native reader node or a temporary `data-reader-vars-scope` probe. Use the serialized `defaultValue` reader settings only as a fallback when no live state is available.
- Premium Free metadata should be derived from ReManga page facts first: chapter URL/canonical, reader title text, current `том - глава` control, and page description aliases. Avoid hardcoding per-title logic in the content script.
- In `Лента`, Premium Free should derive its initial parser target from the actual premium boundary: current chapter on a paid page, or the inline paid-next card plus next-chapter link on a free chapter. Do not resolve the current free chapter again when the user reaches a paid-next banner.
- Feed-mode Premium Free owns a synthetic chapter stream only after ReManga stops natively. Let native free-to-free continuation stay native, but once the stream starts, append parser chapters from backend `nextChapter` metadata and update visible chapter/page indicators from the active synthetic page.
- When `premiumFree` is enabled, the content script should warm parser startup on any `remanga.org` page load through the background worker. The reader flow must still call the same startup gate before hitting `/api/chapters/resolve`, because warmup can race the first premium render.
- The extension talks only to `parser-server`; it must not fetch `mangabuff` pages or images directly. All external chapter pages/images go through the backend resolver and `/api/images/...` proxy URLs.
- Parser startup status is owned by the MV3 background worker, not by the content script. Missing Native Messaging installation should surface as `install_required`; backend reachability after startup should surface as `resolver_unavailable`.
- Title overrides and provider priority are backend concerns. The extension may build a generic manual Mangabuff search URL for fallback UI, but source matching decisions live in `parser-server/src/config.ts`.
- Settings toggles read by deeply nested async stream-loader code (e.g. `prefetchNextChapterEnabled`, `progressTrackerEnabled`) are exposed via module-level `let` flags updated at the top of `syncReaderEnhancer`. New cross-cutting toggles needed inside async paths should follow the same pattern instead of threading `settings` through five+ layers.

## Failure Patterns

- Symptom: opening the native settings drawer shows native items or extension rows for a frame before they hide.
  Cause: settings-panel open mutations go through the generic debounced refresh path, or the immediate and settled refreshes overwrite each other through one timeout handle.
  Prevention: route drawer `childList`/transition mutations through `requestSettingsPanelRefresh()` and keep settled follow-up timers separate from the generic debounce handle.
  Quick check: with hidden native items configured and `Дополнительные настройки` collapsed, the first drawer frame after page load should already match the final hidden state.
- Symptom: animated items never visibly enter/exit, or they snap in after the animation duration.
  Cause: the parent right-rail group or final hidden state is toggled before the child motion finishes.
  Prevention: reveal the rail/group context before enter animations and defer the final `data-rre-hidden` state until the staged motion helper settles.
  Quick check: re-enable a previously hidden rail button and verify it slides back in instead of appearing only at the end.
- Symptom: the custom fullscreen button icon slides out, but its background/pill disappears only at the end.
  Cause: `fullscreen-main` is mounted inside the native settings button group, so the shared wrapper background stays until layout recomputes after the button hides.
  Prevention: mount `fullscreen-main` as a sibling before `settingsGroup`, not as a child inside it.
  Quick check: hide the fullscreen toggle and verify the whole control, including its background, exits as one piece.
- Symptom: minimized settings mode hides the settings entry point completely, so users do not discover where settings went.
  Cause: the peek overlay only reveals content on hover and leaves no visible gear slice in its resting state.
  Prevention: keep `settings-peek-button` partially translated off-screen instead of fully hidden, and reveal it on hover/focus.
  Quick check: with minimized settings enabled and the drawer closed, a small piece of the gear remains visible on the right edge.
- Symptom: minimized settings gear never appears or the hover zone feels dead.
  Cause: `settings-peek-button` was cloned from a settings button that already had `data-rre-hidden` or motion attributes, so the overlay inherited the hidden state immediately.
  Prevention: sanitize cloned toolbar buttons by removing RRE visibility/motion attributes before mounting them.
  Quick check: with minimized settings enabled, inspect `settings-peek-button` and verify it has no `data-rre-hidden` or `data-rre-motion-state="hidden"` attributes.
- Symptom: minimizing the native settings entry point makes the gear slide away first and only then removes the pill/frame.
  Cause: the animation targets the nested `settingsButton`, while the visible background belongs to the outer `settingsGroup`.
  Prevention: animate `settingsGroup` for minimize/show flows whenever that wrapper exists.
  Quick check: minimize settings and verify the whole control exits as one piece instead of splitting into icon and background phases.
- Symptom: the minimized settings peek button is visible, but clicking it does not open the drawer and leaves the button stuck in its expanded hover/focus state.
  Cause: ReManga ignores `settingsButton.click()` while `settingsGroup` is hidden with `display:none`, so forwarding the click from the peek overlay into the fully hidden native control does nothing.
  Prevention: temporarily clear `data-rre-hidden` on `settingsGroup`, keep it `visibility:hidden`/`pointer-events:none`, dispatch the native click, then restore the hidden state on the next animation frame.
  Quick check: with minimized settings enabled, click the peek gear and verify the drawer opens even though the native settings wrapper stays visually hidden.
- Symptom: collapsed `Дополнительные настройки` flash open for a frame when the native drawer opens.
  Cause: the extension section is inserted into the DOM before the stored expanded/collapsed state is applied.
  Prevention: initialize the section title and `settings-rows` hidden state before `insertAdjacentElement(...)`.
  Quick check: collapse the extension section, close the drawer, reopen it, and verify the rows never flash visible.
- Symptom: opening the native settings drawer makes the right rail disappear.
  Cause: `getRailOverlayState(...)` hides the native rail container based on drawer-open state instead of limiting the rule to the minimized settings overlay.
  Prevention: keep `hideRailContainer` disabled for the native drawer flow; only gate `settings-peek-zone` through `getRailOverlayState(...)`.
  Quick check: with the drawer open, the native rail buttons remain visible and no `settings-peek-zone` exists in the DOM.
- Symptom: after closing the native settings drawer, the right rail stays hidden until the page reloads.
  Cause: ReManga closes the drawer in two phases: it first mutates `div.bg-background-content` classes/styles, then removes the visible content after the transition. A single immediate refresh can run too early and keep the rail hidden until another DOM event (for example scroll) happens.
  Prevention: observe `class`, `style`, `data-state`, and `aria-hidden` mutations in the content-script refresh observer, and schedule a settled refresh for settings-panel attribute transitions.
  Quick check: open and close the native settings drawer without reloading or scrolling; the right rail should return immediately.
- Symptom: opening the native settings drawer freezes the page, and only the drawer frame appears while its contents stay blank.
  Cause: the content-script observer treats `aria-checked` / `aria-valuenow` mutations on RRE-owned drawer controls as native settings changes. `syncSettingsPanel()` then rewrites those same attributes on every pass, which creates an immediate self-refresh loop.
  Prevention: when detecting fast settings-panel control mutations in `src/content.ts`, ignore any target inside `[data-rre-control]`; only native ReManga controls should request the immediate drawer refresh path.
  Quick check: open the drawer with the extension enabled and verify the settings body renders immediately, while toggling an RRE switch no longer retriggers a full drawer refresh.
- Symptom: the `Поздравляем` gift reward popup stays visible even though `Авто-скрывать подарки и промо` is enabled.
  Cause: the dismissal logic only scanned toast containers and toast-specific close buttons, so centered gift dialogs never entered the auto-hide flow.
  Prevention: include `dialog`/`alertdialog`/`aria-modal` candidates in the popup scan and use dialog-aware close selectors plus the top-right icon-button heuristic before any force-hide path.
  Quick check: with gifts/promos auto-hide enabled, finish a chapter reward flow and verify the gift dialog closes without clicking `Выбрать`.
- Symptom: Premium Free resolves the wrong state after route changes or repeated syncs.
  Cause: a stale in-flight request survives after the chapter key changes, or the content script keeps the previous premium container alive when the premium block disappears.
  Prevention: abort the previous request whenever the premium block disappears, the feature is disabled, or the derived chapter key changes; re-render only when the current page key still matches.
  Quick check: switch chapters quickly while Premium Free is enabled and verify the rendered result always matches the final URL, not an earlier chapter.
- Symptom: Premium Free returns `provider_error` even though one Mangabuff candidate clearly matches.
  Cause: the resolver treats a failed detail fetch for any side candidate as a provider-wide failure instead of skipping that candidate and continuing exact-match evaluation.
  Prevention: only fail the provider on search/override/chapter fetch failures; when a non-selected search candidate cannot load, skip it and continue scoring.
  Quick check: simulate a broken secondary search result and verify the resolver still returns the exact matching title or `chapter_not_found`.
- Symptom: switching `Тип читалки` or `Ширина контейнера` on a paid chapter does not update Premium Free until reload, or the paywall reader stays stuck on the old width.
  Cause: the content-script observer ignores `aria-checked` / `aria-valuenow` changes inside the settings drawer, or Premium Free reuses stale inline reader vars instead of sampling a fresh native/probe node.
  Prevention: route those attribute mutations through `requestSettingsPanelRefresh()` and collect width/brightness from a non-RRE reader node or a fresh `data-reader-vars-scope` probe before rerendering.
  Quick check: with Premium Free enabled on a paid chapter, switch `Лента` <-> `Постраничная` and drag the width slider; the custom reader should rerender immediately and match the native reader column width.
- Symptom: Premium Free immediately shows `Parser-server недоступен` on every page load even though autostart is supposed to work.
  Cause: the Native Messaging host was never installed for the current unpacked extension ID, `src/parser-server.ts` host name drifted from `native-host/native-host-manifest.json`, or `public/manifest.json` lost its `"key"` field and Chrome rotated the extension ID.
  Prevention: keep the host name synchronized between extension and native-host files, keep the `"key"` field in `public/manifest.json` intact, and rerun `npm run native:install` whenever the installer changes.
  Quick check: open `chrome://extensions`, confirm the current ID matches the one `npm run native:install` prints, then verify the premium area moves from startup to chapter resolve without `Specified native messaging host not found`.
- Symptom: reaching the paid-next card on a free chapter shows the current free chapter again instead of the next paid parser chapter.
  Cause: Premium Free derived the resolve target only from `window.location` and ignored the inline paid banner plus the header next-chapter link.
  Prevention: in feed mode, resolve the initial parser target through the premium boundary helper (`derivePremiumFreeTargetReference`) so free pages map to the banner's `Том X глава Y`, while paid pages still map to the current route.
  Quick check: open a free chapter whose next chapter is paid, scroll to the inline paywall card, and verify the injected parser pages start at the paid-next chapter label instead of duplicating the free chapter you just finished.
- Symptom: after finishing one parser-loaded paid chapter, the next parser chapter does not auto-append, especially when ReManga has no native next chapter after the current route.
  Cause: feed-mode autoload relied too heavily on `IntersectionObserver` state. On long parser pages the page-ratio observer can fail to nominate an active page, and the trailing sentinel may never become a reliable sole trigger.
  Prevention: keep observer-based prefetch as an accelerator, but also sync active synthetic pages from real DOM geometry on scroll/resize and trigger next-chapter loading when the viewport approaches the bottom of the last synthetic page.
  Quick check: on a paid chapter chain like `1915807 -> 1915808`, scroll to the final parser page and verify the next parser chapter appears without manual page navigation even after ReManga's own chapter list ends.

# QA checklist

## Enhancement work in this revision (Nov 14, 2026)
- [x] Playwright + axe suite: 9 tests pass, including story progression/quizzes, the mobile mission timeline, language persistence, WebGL/file URL fallbacks, and service-worker revisit.
- [x] Mocked Web Speech API test verifies automatic narration, initially hidden words, boundary-only reveal, full text on end when boundaries are absent, close cancellation, and reset on reopen.
- [x] Axe checks pass on the mobile home and mobile story finale; both layouts have no horizontal overflow at 390×780.
- [x] Story intro describes four explorers (not four robots); home-button accessible names no longer override visible text.
- [ ] Verify audible SpeechSynthesis word timing and voice quality in browsers with actual speech engines; automated tests dispatch boundary events and do not assess audio.
- [ ] Independently verify every displayed figure and mission year against its linked NASA record.
- [ ] Lighthouse mobile performance run (`npm run lighthouse`); no score is claimed.
- [ ] Visual inspection/screenshots at 1366×800; automated checks cover mobile at 390×780.
- [ ] Safari, Firefox, Edge, iOS Safari, screen readers, and a formal contrast audit.

The verified section below records earlier application-baseline checks; only the 9-test suite above was run for this revision.

## Verified (automated, Chromium headless via Playwright with software WebGL, Nov 14 2026)
- [x] Served over HTTP; **0 console errors / page errors** across all flows (only the Google Fonts request fails offline in the sandbox).
- [x] Home: 4 stones render from JSON; both CTAs navigate.
- [x] Story: all 6 steps (intro, Eagle, Pioneer 10, Opportunity, Ingenuity, finale); Back/Next, dots, ← → keys, Replay, "Explore the Garden" at the end; "Read the full record" opens/closes (Esc).
- [x] Explore: scene builds; drag-rotate, wheel-zoom, Reset, 4 filters; **raycast picks** of all four explorers and of Moon/Mars/Earth open the right panel/chip; labels and the keyboard-accessible explorer list also open records.
- [x] Record dialog for all 4 explorers: timeline, sources, facts, Q&A chips and typed questions return answers or a clear "not in my notes".
- [x] Error states: `file://` shows a how-to-run message; WebGL disabled → fallback list opens records with a static icon preview.
- [x] Mobile viewport 390×780 (touch emulation): no horizontal overflow, story bar usable, explore HUD compact, tap on a label opens a record.

## NOT verified (please check before presenting)
- [ ] Real GPU performance / battery on phones (tested only with software rendering).
- [ ] Safari, Firefox, Edge; iOS Safari audio and pinch-zoom feel.
- [ ] Audible SpeechSynthesis output and voice quality (only API availability was checked).
- [ ] Screen readers (NVDA/VoiceOver) and a formal contrast audit.
- [ ] That each external NASA link still resolves today (not crawled).
- [ ] Opportunity launch/end years and Ingenuity ending wording against the NASA pages (see README).

## Limitations
- Models are simplified, enlarged, procedural illustrations, not NASA models.
- Planet textures are procedural (stylised), not real imagery.
- "Ask the notes" is keyword matching, deliberately not an AI chatbot.
- Google Fonts need internet; fallback fonts are used offline.

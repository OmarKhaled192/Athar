# Prompt for Google Antigravity — enhance ATHAR

Paste everything below into an Antigravity agent session with this project folder opened as the workspace.

---

You are a senior creative front-end engineer working in an existing, **working** project: **ATHAR — Every Mission Leaves a Mark**, an interactive memorial garden about four real NASA hardware explorers (Pioneer 10, Opportunity, Ingenuity, Apollo 11 Lunar Module *ascent stage*). It is for the NASA Space Apps Challenge "Left Behind / hardware across the solar system", audience: school-age children. Read `README.md`, `docs/AWARDS_MAPPING.md` and `docs/QA_CHECKLIST.md` first.

## Hard rules (do not break)
1. Stack stays **vanilla HTML/CSS/JS + local Three.js** (`vendor/`). No framework, no build step, no backend, no paid APIs, no API keys.
2. `data/characters.json` is the single source of truth. No explorer text in HTML/JS.
3. **Scientific guardrails:** Pioneer 10 = deep space (never on Mars/Moon; last signal Jan 23, 2003). Opportunity = Mars rover (last contact Jun 10, 2018, mission ended 2019). Ingenuity = Mars *helicopter*, 72 flights, mission completed Jan 25, 2024. COSPAR 1969-059C = Apollo 11 LM **ascent stage**: jettisoned into lunar orbit, **fate/location unknown**; the **descent stage** (different object) is at Tranquility Base. Never place the ascent stage on the surface.
4. The 3D scene is an educational visualization, not to scale; keep that disclaimer.
5. Keep "Verified fact" vs "Creative narration" labelling. Do not invent facts or dates. If unsure, say so. Every new fact needs a NASA source link in the JSON.
6. Keep it independent: "not affiliated with or endorsed by NASA" stays visible. Only use NASA media that is clearly public domain, with credit; do not use NASA logos.
7. Accessibility must not regress: keyboard access, focus management, `prefers-reduced-motion`, ≥44px targets, contrast, no-WebGL fallback, `file://` friendly error.

## Goals, in priority order (map to NASA awards)
**A. Arabic + RTL (Global Connection, Local Impact).** Add a language switch (EN/AR). Move UI strings into `data/i18n/en.json` and `ar.json`; add `story_ar` fields (or `data/characters.ar.json`) with careful, simple Modern Standard Arabic for kids; `dir="rtl"`, mirrored layout, Arabic-capable font (e.g. Noto Naskh / Cairo), Arabic SpeechSynthesis (`ar-EG`/`ar-SA`). Keep numbers/dates correct. Persist choice in `localStorage` with try/catch.

**B. Quiz & classroom mode (Galactic Impact).** After each explorer in Story Mode, a 2-question multiple-choice check generated **from `whatITaught`/`funFacts`** (add a `quiz[]` field to the JSON, with source). Finale shows a badge ("Garden Keeper") and a printable one-page teacher summary (CSS print stylesheet). No tracking, no accounts.

**C. Real data (Best Use of Data).** Add a "Mission data" tab per record: a timeline visualisation (SVG/canvas) built from JSON dates, plus 2–3 real numbers as simple charts (e.g. Ingenuity: planned 5 vs actual 72 flights; Pioneer 10: planned 21 months vs 30+ years; Opportunity: distance 28.06 mi). Optionally show 1 public-domain NASA image per record via local files in `assets/img/` with credit + source URL in JSON (download them once; do not hotlink).

**D. Create a Memorial (Most Inspirational).** A small kid-friendly form: name a robot idea + its mission + one sentence. Render it as a new glowing stele in the garden (client-side only, `localStorage`, clearly labelled "your imagination, not a real mission"). Export as a PNG card via canvas.

**E. Visual polish (Art & Technology).** Improve Mars/Moon realism (better procedural or CC0 textures with credit), add subtle dust particles and glowing garden lanterns at the base of each explorer, a gentle camera "intro fly-in" on first Explore (skipped for reduced motion), and improved models (more detail on Opportunity wheels/mast, Eagle windows and legs-free ascent stage silhouette). Keep draw calls and texture sizes modest.

**F. Quality & performance (Best Use of Technology).** Add a Playwright test suite (`tests/`) covering: story flow, explore picking via raycast, all 4 records, filters, fallback without WebGL, `file://` message, mobile viewport overflow, and an axe-core accessibility scan. Add a Lighthouse pass; target Performance ≥ 85 on mobile emulation. Add a tiny service worker for offline use (cache `index.html`, css, js, data, vendor).

## How to work
- Plan first: list the files you will touch and the risks. Work in small, verifiable steps; after each goal, run the app on `http://localhost:8000` with the browser agent, take screenshots at 1366×800 and 390×780, check the console for errors, and fix issues before moving on.
- Do not rewrite working code unnecessarily. Prefer small modules in `js/`.
- Update `README.md`, `docs/QA_CHECKLIST.md` (only tick what you actually ran) and `docs/DEMO_SCRIPT.md` at the end.

## Definition of done
All guardrails intact; EN/AR both complete; no console errors; Playwright + axe pass; offline works; every button works; a final report listing what changed, what you tested (with evidence) and what you could not test.

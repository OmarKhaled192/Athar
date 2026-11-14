# ATHAR — Every Mission Leaves a Mark

An interactive memorial garden for four real pieces of NASA hardware: **Pioneer 10**, **Opportunity**, **Ingenuity** and the **Apollo 11 Lunar Module "Eagle" (ascent stage)**. Plain HTML + CSS + JavaScript with a local copy of Three.js. No build step, no backend, no API keys.

> **ATHAR is an independent educational project. It is not affiliated with or endorsed by NASA.**

## Run it
Browsers block `fetch()` and ES modules on `file://`, so serve the folder over HTTP:

```bash
cd athar
python3 -m http.server 8000      # or: npx serve .
# open http://localhost:8000
```
Opening `index.html` by double-click shows a friendly explanation instead of a blank page. Three.js is bundled in `vendor/`, so it also works offline (only the Google Fonts request needs internet; system fonts are the fallback).

## Two paths
| | **Start the Story** (`#story`) | **Explore the Garden** (`#explore`) |
|---|---|---|
| What | Guided, 6 steps: intro → 4 explorers (in launch order) → finale | Free 3D scene: Moon, Mars, Earth (distant), deep space |
| Per explorer | Rotatable 3D model, short first-person line, one verified fact, one science takeaway, timeline, audio, "full record" | Tap a pin/label/model to open the full record panel |
| Controls | Back / Next, progress dots, ← → keys | Drag = rotate, scroll/pinch = zoom, filters (All/Moon/Mars/Deep space), Reset view |

The full record panel has: 3D preview, name, object type, status, timeline, a milestone SVG and source-linked mission data cards, location wording, story, "what it taught us", fun facts, SpeechSynthesis narration that reveals words on speech-boundary events (remaining hidden until speech ends in browsers without boundary events), rule-based "Ask the notes", and NASA source links. Opening a record starts its narration automatically.

The story finale compares each explorer's launch year with its final recorded mission year. These data-derived bands are clickable and open the corresponding sourced record; they do not imply continuous operation or show a to-scale duration.

## Architecture
```
index.html            semantic shell, import map, dialogs
css/styles.css        design tokens, layout, responsive, reduced-motion
js/app.js             data loading, routing (#home/#story/#explore), Story Mode, record dialog,
                      speech, rule-based Q&A, credits
js/scene.js           Explore scene: OrbitControls, raycasting, labels, camera fly-to, cleanup
js/models.js          procedural explorer models, procedural planet textures, shared Preview renderer
data/characters.json  SOURCE OF TRUTH for all explorer content
data/worlds.json      Moon / Mars / Earth / deep-space blurbs + scale disclaimer
data/i18n/            English and Arabic interface/story labels and Arabic story narration
sw.js                 small same-origin offline app-shell cache
tests/                Playwright end-to-end and axe checks
vendor/               three.module.min.js (r170, MIT) + OrbitControls
docs/                 demo script, QA checklist, awards mapping, Antigravity prompt, reference images
```
Nothing about a specific explorer is hardcoded in HTML/JS. Only the 3D model builder is keyed by `id` (`pioneer-10`, `opportunity`, `ingenuity`, `eagle`).

### Data schema (per record in `characters.json`)
`id, name, fullName, destination (deep_space|mars|moon), worldLabel, objectType, status, statusLabel, tagline, launchYear, arrivalYear, endYear, endNote, location, locationNote, timeline[{label,value}], missionData[{label,value,display,sourceIndex}], storyMode{fact,takeaway}, story{intro,paragraphs[],farewell}, whatITaught[{title,text}], funFacts[], quiz[{question,options[],answer,sourceIndex}], aiContext, fallbackAnswers[{question,answer}], sources[{label,url}], colors{accent}, model{type,credit}`. Quiz and mission data source indices refer to an existing NASA source by its zero-based index in `sources`.
To add an explorer: add a record, add a model builder in `models.js`, and (for Explore) a placement in `scene.js`.

## Scientific guardrails (preserved)
- **Pioneer 10** is a deep-space probe, shown far from both worlds with an "illustrative path". Last signal: **January 23, 2003**.
- **Opportunity** is a Mars rover. Last contact **June 10, 2018** (dust storm); mission ended **2019**. Evidence of past liquid water.
- **Ingenuity** is a Mars **helicopter**, not a rover: **72 flights**, last flight **Jan 18, 2024**, mission completed **Jan 25, 2024** after rotor-blade damage.
- **COSPAR 1969-059C = Apollo 11 LM ascent stage.** It lifted the astronauts to lunar orbit and was jettisoned. **Its current location and fate are unknown** (NASA assumes it crashed into the Moon within 1–4 months). The **descent stage** is a different object that stayed at Tranquility Base. ATHAR therefore draws the ascent stage **in lunar orbit**, never on the surface.
- The 3D scene is an **educational visualization**: not to scale, not an ephemeris. Models are enlarged.
- First-person voice is a storytelling device, labelled in the UI. "Verified fact" and "Creative narration" badges separate the two.

### Changes made to the supplied `characters.json`
- **Eagle** rewritten to represent the ascent stage (name, story, location, status "Jettisoned, fate unknown", fun facts, Q&A). Added an explicit ATHAR note to `aiContext`.
- **Opportunity**: `launchYear` set to 2003 and `endYear` to 2019 (per project brief; **please confirm both on the NASA page**). Added the NASA/JPL blog source confirming Perseverance passed its record on Oct 11, 2026 (checked online on Nov 14, 2026).
- **Ingenuity**: ending wording now mentions rotor-blade damage (per project brief; **confirm wording on the NASA page**).
- Added fields (`objectType`, `timeline`, `storyMode`, `locationNote`, …). `model.file` (.glb paths that did not exist) replaced by `model.type = "procedural"`.

## Accessibility & performance
Skip link, semantic landmarks, native `<dialog>` (focus trap, Esc to close, focus returns to opener), visible focus rings, ≥44px targets, `aria-pressed` filters, `aria-live` regions, keyboard list of every explorer (the canvas is not the only way in), `prefers-reduced-motion` (no auto-rotation, instant camera moves). Pixel ratio is capped (1.5 on touch devices); render loops pause when the view or tab is hidden; one shared WebGL context for previews; listeners and GPU objects are disposed on `pagehide`.

The header language control switches the guided story narration between English and Arabic, sets the page direction and stores the choice locally. Browser SpeechSynthesis uses `en-US` and `ar-EG`. Story Mode asks two source-indexed quiz questions for each explorer and its finale offers a printable summary. The app registers a same-origin service worker on HTTP(S); the first visit must be online to install its cache. Playwright/axe and Lighthouse commands are defined in `package.json` and `lighthouserc.json`; install the listed development dependencies before running them.

## Asset credits
All 3D models and planet textures are generated in code by ATHAR (simplified illustrations, **not NASA models**). Three.js (MIT, `vendor/THREE_LICENSE.txt`). Fonts: Atkinson Hyperlegible and Space Grotesk (SIL OFL, via Google Fonts). `docs/references/` holds the two mood-board images supplied for the brief; they are not used on the site.

## Known limitations
See `docs/QA_CHECKLIST.md` (what was and was not tested) and the list at the bottom of that file.

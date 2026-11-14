// ATHAR — app logic. All story content is rendered from data/characters.json (nothing hardcoded per character).
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const S = { chars: [], worlds: null, order: [], view: null, step: 0, scene: null, scenePromise: null, preview: null, previewPromise: null, previewOK: null, webgl: null, current: null, lastFocus: null, locale: 'en', i18n: {}, ar: {}, quizScore: 0, quizAnswered: new Set(), starfield: null };
const tx = key => S.i18n[key] || key;
const ui = key => S.ar.ui?.[key] || key;
function localizedRecord(c) {
  if (S.locale !== 'ar') return c;
  const t = S.ar.records?.[c.id];
  return t ? { ...c, ...t, story: S.ar.story?.[c.id] || c.story } : c;
}
const staticLabels = {
  'a.skip':'skip','#boot p':'waking','#app-error h2':'appError','#app-error .muted':'loadHelp',
  'nav a[data-nav="home"]':'home','nav a[data-nav="story"]':'story','nav a[data-nav="explore"]':'garden','#open-credits':'credits',
  '.brand-text small':'brandSub','.eyebrow':'heroEyebrow','.hero h1 em':'heroTitle','.lede':'heroLede',
  '.cta a[href="#story"]':'startStory','.cta a[href="#explore"]':'exploreGarden','.cta-note':'ctaNote',
  '.features>div:nth-child(1) h2':'schoolTitle','.features>div:nth-child(1) p':'schoolText','.features>div:nth-child(2) h2':'worldsTitle','.features>div:nth-child(2) p':'worldsText','.features>div:nth-child(3) h2':'voicesTitle','.features>div:nth-child(3) p':'voicesText',
  '#story-page-title':'storyPageTitle','#stage-hint':'dragModel','#story-back':'back','#story-next':'next',
  '#explore-title':'exploreTitle','.hints li:nth-child(1)':'dragRotate','.hints li:nth-child(2)':'zoom','.hints li:nth-child(3)':'tapLearn',
  '.filters [data-filter="all"]':'all','.filters [data-filter="moon"]':'moon','.filters [data-filter="mars"]':'mars','.filters [data-filter="deep_space"]':'deepSpace','#reset-cam':'resetView',
  '.scale-note':'scaleNote','#gl-loading-msg':'buildingSky','#gl-fallback h2':'no3d','#gl-fallback-msg':'fallbackText','#gl-fallback a':'startStoryFallback',
  '.foot>p:first-child':'footerNote','#open-credits-2':'creditsButton'
};
let staticDefaults, attributeDefaults, descriptionDefault;
function translateStatic() {
  if (!staticDefaults) staticDefaults = new Map(Object.entries(staticLabels).map(([selector]) => { const el = $(selector); return [selector, el ? { html: el.innerHTML, aria: el.getAttribute('aria-label'), placeholder: el.getAttribute('placeholder') } : null]; }));
  if (!attributeDefaults) attributeDefaults = new Map(['nav','.brand','#steles','#story-dots','.hints','.filters','#explorer-list'].map(selector => [selector, $(selector)?.getAttribute('aria-label')]));
  for (const [selector, key] of Object.entries(staticLabels)) {
    const el = $(selector), base = staticDefaults.get(selector); if (!el || !base) continue;
    if (S.locale === 'ar') {
      const value = ui(key);
      if (selector === '.brand') el.setAttribute('aria-label', value);
      else if (selector === '#app-error .muted') el.textContent = value;
      else if (selector === '.cta a[href="#story"]') el.innerHTML = `${value} <span aria-hidden="true">▸</span>`;
      else if (selector === '.cta-note') el.innerHTML = `<b>${ui('startStory')}</b> ${value.replace(/^ابدأ القصة\s*/, '')}`;
      else if (selector === '.foot>p:first-child') el.innerHTML = `<b>ATHAR</b> ${value}`;
      else if (selector === '#gl-fallback a') el.textContent = value;
      else if (selector === '#story-next') el.textContent = value;
      else el.textContent = value;
    } else {
      el.innerHTML = base.html;
      if (base.aria == null) el.removeAttribute('aria-label'); else el.setAttribute('aria-label', base.aria);
      if (base.placeholder == null) el.removeAttribute('placeholder'); else el.setAttribute('placeholder', base.placeholder);
    }
  }
  const attrs = [['nav','aria-label','mainNav'],['.brand','aria-label','brandLabel'],['#steles','aria-label','fourExplorers'],['#story-dots','aria-label','storySteps'],['.hints','aria-label','controls'],['.filters','aria-label','showWorld'],['#explorer-list','aria-label','explorersList']];
  for (const [selector, attr, key] of attrs) { const el = $(selector); if (!el) continue; if (S.locale === 'ar') el.setAttribute(attr, ui(key)); else { const base = attributeDefaults.get(selector); if (base == null) el.removeAttribute(attr); else el.setAttribute(attr, base); } }
  document.title = S.locale === 'ar' ? ui(S.view === 'story' ? 'titleStory' : S.view === 'explore' ? 'titleExplore' : 'titleHome') : ({home:'ATHAR — Every Mission Leaves a Mark',story:'The Story · ATHAR',explore:'Explore the Garden · ATHAR'}[S.view || 'home']);
  const desc = $('meta[name="description"]'); if (desc) { descriptionDefault ??= desc.content; desc.content = S.locale === 'ar' ? 'حديقة تفاعلية تذكارية لمركبات ومسابير ناسا الحقيقية التي استكشفت المريخ والقمر والفضاء البعيد. مشروع تعليمي مستقل.' : descriptionDefault; }
}
function setLocale(lang) {
  S.locale = lang === 'ar' ? 'ar' : 'en'; document.documentElement.lang = S.locale; document.documentElement.dir = S.locale === 'ar' ? 'rtl' : 'ltr';
  S.i18n = S.locale === 'ar' ? S.ar : S.en;
  document.body.classList.toggle('rtl', S.locale === 'ar');
  const b = $('#language-toggle'); if (b) { b.textContent = tx('switch'); b.lang = S.locale === 'ar' ? 'en' : 'ar'; b.setAttribute('aria-label', `${tx('switch')} — ${S.locale === 'ar' ? ui('switchToEnglish') : 'Switch to Arabic'}`); }
  try { localStorage.setItem('athar-language', S.locale); } catch {}
  translateStatic();
  if (S.view === 'story' && steps.length) showStep(S.step, false);
  if (S.view === 'home' && S.chars.length) renderSteles();
  if (S.view && S.chars.length) buildExploreUI();
  if (S.scene?.updateLocalization) S.scene.updateLocalization(S.order.map(localizedRecord), S.worlds, S.locale === 'ar' ? S.ar.worlds : null);
  const worldChipEl = $('#world-chip');
  if (worldChipEl && !worldChipEl.hidden && worldChipEl.dataset.worldId) {
    const world = S.worlds?.worlds.find(item => item.id === worldChipEl.dataset.worldId);
    if (world) worldChip(world);
  }
  if ($('#record')?.open && S.current) openRecord(S.current, null, true);
  if ($('#credits')?.open) openCredits();
}

/* ---------- helpers ---------- */
function webglOK() {
  if (S.webgl != null) return S.webgl;
  try { const c = document.createElement('canvas'); S.webgl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { S.webgl = false; }
  return S.webgl;
}
const ICONS = {
  'pioneer-10': '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 20c8 12 24 12 32 0z"/><path d="M24 26v10M16 40h16M24 20V9"/><circle cx="24" cy="8" r="2"/></svg>',
  opportunity: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 22h28v7H10zM14 22l3-6h14l3 6M24 16V8"/><circle cx="14" cy="36" r="4"/><circle cx="24" cy="36" r="4"/><circle cx="34" cy="36" r="4"/></svg>',
  ingenuity: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 12h36M24 12v8"/><rect x="17" y="20" width="14" height="10" rx="2"/><path d="M15 38l4-8M33 38l-4-8"/></svg>',
  eagle: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 18l4-6h10l4 6v12H15z"/><path d="M20 30l-4 10M28 30l4 10M24 12V6"/><circle cx="24" cy="22" r="3"/></svg>'
};
const yearsOf = c => c.endYear && c.endYear !== c.launchYear ? `${c.launchYear ?? '—'} → ${c.endYear}` : `${c.launchYear}`;
const accent = c => c.colors?.accent || '#5eead4';
/* ---------- speech ---------- */
const Speech = {
  ok: 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function', playing: false, lang: 'en-US', current: null,
  speak(text, onend, onboundary) {
    if (!this.ok) return false;
    this.stop();
    try {
      const utterance = new SpeechSynthesisUtterance(text); this.current = utterance;
      utterance.lang = this.lang; utterance.rate = 0.95; this.playing = true;
      utterance.onboundary = event => { if (Number.isFinite(event.charIndex)) onboundary?.(event.charIndex, event); };
      utterance.onend = () => { if (this.current !== utterance) return; this.current = null; this.playing = false; onend?.(); };
      utterance.onerror = () => { if (this.current !== utterance) return; this.current = null; this.playing = false; onend?.(); };
      speechSynthesis.speak(utterance); return true;
    } catch { this.current = null; this.playing = false; return false; }
  },
  stop() { if (this.ok) speechSynthesis.cancel(); this.current = null; this.playing = false; }
};

/* ---------- word-span narration helpers ---------- */
/**
 * Build an array of word tokens from plain text, preserving whitespace structure.
 * Each token: { text, startIndex, endIndex, isWhitespace }
 */
function tokenizeWords(text) {
  const tokens = [];
  // Split on whitespace boundaries, keeping the separators so we can rebuild positions.
  const re = /(\S+|\s+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const isWhitespace = /^\s+$/.test(m[0]);
    tokens.push({ text: m[0], startIndex: m.index, endIndex: m.index + m[0].length, isWhitespace });
  }
  return tokens;
}

/**
 * Render the narrative text into word-level <span> elements inside container.
 * Non-whitespace words are hidden initially; whitespace runs are always visible
 * (they carry newlines / spaces that keep layout correct).
 * Returns the array of word-span elements (non-whitespace only) in order.
 */
function renderWordSpans(container, text) {
  const tokens = tokenizeWords(text);
  const wordSpans = [];
  const frag = document.createDocumentFragment();
  for (const tok of tokens) {
    if (tok.isWhitespace) {
      // Preserve whitespace literally (newlines → line breaks via CSS white-space:pre-line).
      frag.appendChild(document.createTextNode(tok.text));
    } else {
      const span = document.createElement('span');
      span.textContent = tok.text;
      span.className = 'word-hidden';
      span.dataset.start = tok.startIndex;
      span.dataset.end = tok.endIndex;
      wordSpans.push(span);
      frag.appendChild(span);
    }
  }
  container.innerHTML = '';
  container.appendChild(frag);
  container.classList.add('speaking');
  return wordSpans;
}

/**
 * Reveal all word spans whose startIndex <= charIndex (the speech boundary position).
 * Returns the index of the last revealed span.
 */
function revealWordsUpTo(wordSpans, charIndex, lastRevealed) {
  let i = lastRevealed;
  while (i < wordSpans.length && +wordSpans[i].dataset.start <= charIndex) {
    wordSpans[i].classList.replace('word-hidden', 'word-visible');
    i++;
  }
  return i;
}

const RecordNarration = {
  audio: null, soundEnabled: true, active: false, session: 0,
  _wordSpans: [], _cursor: 0,

  /**
   * Stop current narration.
   * reveal:true  → flip all remaining hidden words visible (manual stop / dialog close).
   * reveal:false → leave DOM alone (it is about to be replaced by renderRecord).
   */
  stop({ reveal = true } = {}) {
    this.session++; this.active = false;
    Speech.stop();
    if (reveal) {
      this._wordSpans.forEach(s => { if (s.classList.contains('word-hidden')) s.classList.replace('word-hidden', 'word-visible'); });
      $$('.rec-story-line').forEach(el => el.classList.remove('speaking'));
    }
    this._wordSpans = []; this._cursor = 0;
    const btn = $('#rec-listen');
    if (btn) { btn.textContent = S.locale === 'ar' ? ui('listenStory') : '🔊 Listen to the story'; btn.setAttribute('aria-pressed', 'false'); }
  },

  chime() {
    if (!this.soundEnabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return;
      this.audio ??= new Audio(); if (this.audio.state === 'suspended') this.audio.resume().catch(() => {});
      const now = this.audio.currentTime;
      [659.25, 783.99].forEach((hz, i) => { const osc = this.audio.createOscillator(), gain = this.audio.createGain(); osc.type = 'sine'; osc.frequency.value = hz; gain.gain.setValueAtTime(0.0001, now + i * 0.12); gain.gain.exponentialRampToValueAtTime(0.018, now + i * 0.12 + 0.025); gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.22); osc.connect(gain); gain.connect(this.audio.destination); osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.24); });
    } catch { /* Audio effects are optional; narration remains available. */ }
  },

  start(c) {
    // Discard any in-flight session; leave its DOM alone — renderRecord already replaced it.
    this.stop({ reveal: false });
    const session = ++this.session;

    const container = $('#rec-story-line'); if (!container) return;
    const story = S.locale === 'ar' ? (S.ar.story?.[c.id] || c.story) : c.story;
    const narrativeText = [story.intro, ...story.paragraphs, story.farewell].filter(Boolean).join('\n\n');

    // Store raw text so stop({reveal:true}) has something to work with.
    container.dataset.fullText = narrativeText;

    // Build word-span DOM — every word starts invisible.
    const wordSpans = renderWordSpans(container, narrativeText);
    this._wordSpans = wordSpans; this._cursor = 0; this.active = true;

    const btn = $('#rec-listen');
    if (btn) { btn.textContent = S.locale === 'ar' ? ui('stopNarration') : '⏹ Stop narration'; btn.setAttribute('aria-pressed', 'true'); }
    this.chime();

    // ── finish ────────────────────────────────────────────────────────────────
    const finish = () => {
      if (session !== this.session) return;
      this.active = false;
      wordSpans.forEach(s => { if (s.classList.contains('word-hidden')) s.classList.replace('word-hidden', 'word-visible'); });
      container.classList.remove('speaking');
      const b = $('#rec-listen'); if (b) { b.textContent = S.locale === 'ar' ? ui('listenAgain') : '↻ Listen again'; b.setAttribute('aria-pressed', 'false'); }
    };

    // ── onboundary — the ONLY source of word-by-word reveals ─────────────────
    const onSpeechBoundary = charIndex => {
      if (!this.active || session !== this.session) return;
      this._cursor = revealWordsUpTo(wordSpans, charIndex, this._cursor);
    };

    if (!Speech.ok) { finish(); return; }
    Speech.lang = S.locale === 'ar' ? 'ar-EG' : 'en-US';
    if (!Speech.speak(narrativeText, finish, onSpeechBoundary)) { finish(); return; }

    // Browsers without boundary events leave the text hidden until onend reveals it.
  },

  dispose() {
    this.stop({ reveal: false });
    try { this.audio?.close?.(); } catch {}
    this.audio = null;
  }
};

/* ---------- boot ---------- */
async function boot() {
  try {
    const [c, w, en, ar] = await Promise.all([fetch('data/characters.json'), fetch('data/worlds.json'), fetch('data/i18n/en.json'), fetch('data/i18n/ar.json')]);
    if (!c.ok || !w.ok) throw new Error(`Could not load story data (HTTP ${c.status}/${w.status}).`);
    S.chars = await c.json(); S.worlds = await w.json(); S.i18n = await en.json(); S.en = S.i18n; S.ar = await ar.json();
    try { S.locale = localStorage.getItem('athar-language') === 'ar' ? 'ar' : 'en'; } catch { S.locale = 'en'; }
    if (!Array.isArray(S.chars) || !S.chars.length) throw new Error('The story data is empty.');
  } catch (e) {
    $('#boot').hidden = true; $('#app-error').hidden = false;
    $('#app-error-msg').textContent = location.protocol === 'file:' ? 'You opened index.html directly from disk (file://).' : String(e.message || e);
    return;
  }
  S.order = [...S.chars].sort((a, b) => (a.launchYear ?? 9999) - (b.launchYear ?? 9999));
  setLocale(S.locale);
  S.starfield = drawStars(); renderSteles(); buildStory(); buildExploreUI(); bindGlobal();
  $('#boot').hidden = true;
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(error => console.error('Could not register the offline app shell.', error));
  }
  route(); addEventListener('hashchange', route);
}

/* ---------- home ---------- */
function renderSteles() {
  $('#steles').innerHTML = S.order.map((raw, i) => { const c = localizedRecord(raw); return `
    <li><button class="stele" type="button" data-id="${esc(c.id)}" style="--accent:${accent(c)};--d:${i * 0.12}s">
      <span class="stele-ico">${ICONS[c.id] || ''}</span>
      <strong>${esc(c.name)}</strong>
      <span class="stele-type">${esc(c.objectType)}</span>
      <span class="stele-years">${esc(yearsOf(c))}</span>
      <span class="stele-world">${esc(c.worldLabel)}</span>
    </button></li>`; }).join('');
  $$('.stele').forEach(b => b.addEventListener('click', () => openRecord(b.dataset.id, b)));
}
function drawStars() {
  const canvas = $('#stars'), hero = canvas.parentElement, ctx = canvas.getContext('2d');
  if (!ctx) return { setActive() {}, dispose() {} };
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQuery = matchMedia('(max-width: 700px)');
  const colors = ['#ffffff', '#dceaff', '#a8ddff', '#a5fff0'];
  let width = 0, height = 0, dpr = 1, stars = [], meteor = null, nextMeteorAt = 0;
  let frame = 0, active = false, disposed = false, lastFrame = 0;
  let pointerX = 0, pointerY = 0, easedX = 0, easedY = 0;

  const random = (min, max) => min + Math.random() * (max - min);
  const motionAllowed = () => !motionQuery.matches;
  const createStars = () => {
    const lowPower = mobileQuery.matches || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4);
    const maxStars = lowPower ? 220 : 420;
    const count = Math.min(maxStars, Math.max(lowPower ? 90 : 180, Math.round(width * height / 2200)));
    stars = Array.from({ length: count }, (_, i) => {
      const layer = i < count * 0.56 ? 0 : i < count * 0.91 ? 1 : 2;
      return {
        x: random(0, width), y: random(0, height),
        radius: random(layer === 2 ? 0.75 : 0.3, layer === 2 ? 1.55 : layer === 1 ? 1.1 : 0.85),
        alpha: random(layer === 0 ? 0.24 : layer === 1 ? 0.34 : 0.5, layer === 0 ? 0.55 : layer === 1 ? 0.72 : 0.92),
        speed: random([0.8, 2.3, 6][layer], [2.4, 6.2, 11][layer]),
        drift: random(-0.45, 0.45) * [0.2, 0.55, 1][layer],
        parallax: [2, 5, 9][layer],
        phase: random(0, Math.PI * 2), twinkle: random(0.06, 0.25),
        rate: random(0.45, 1.2), color: colors[Math.floor(Math.random() * colors.length)],
        glow: Math.random() < 0.018
      };
    });
  };
  const resize = () => {
    if (disposed) return;
    const rect = hero.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (width === rect.width && height === rect.height && dpr === nextDpr) return;
    width = rect.width; height = rect.height; dpr = nextDpr;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createStars();
    render(performance.now(), 0, false);
  };
  const drawMeteor = (now, delta) => {
    if (!meteor && now >= nextMeteorAt) {
      const speed = random(250, 330), angle = Math.PI * random(0.2, 0.32);
      meteor = {
        x: random(width * 0.35, width + 60), y: random(-30, height * 0.36),
        vx: -Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        length: random(75, 135), started: now, duration: random(650, 1050)
      };
    }
    if (!meteor) return;
    const elapsed = now - meteor.started;
    if (elapsed >= meteor.duration) {
      meteor = null; nextMeteorAt = now + random(18000, 34000); return;
    }
    meteor.x += meteor.vx * delta; meteor.y += meteor.vy * delta;
    const fade = Math.min(1, elapsed / 140, (meteor.duration - elapsed) / 220);
    const tailX = meteor.x - meteor.vx / Math.hypot(meteor.vx, meteor.vy) * meteor.length;
    const tailY = meteor.y - meteor.vy / Math.hypot(meteor.vx, meteor.vy) * meteor.length;
    const trail = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
    trail.addColorStop(0, 'rgba(177,220,255,0)');
    trail.addColorStop(1, 'rgba(207,239,255,0.72)');
    ctx.globalAlpha = Math.max(0, fade) * 0.7;
    ctx.strokeStyle = trail; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(meteor.x, meteor.y); ctx.stroke();
    ctx.globalAlpha = 1;
  };
  function render(now, delta, moving) {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const ease = 1 - Math.exp(-delta * 2);
    easedX += (pointerX - easedX) * ease; easedY += (pointerY - easedY) * ease;
    for (const star of stars) {
      if (moving) {
        star.y += star.speed * delta;
        star.x += star.drift * star.speed * delta;
        if (star.y > height + star.radius) { star.y = -star.radius; star.x = random(0, width); }
        if (star.x < -star.radius) star.x = width + star.radius;
        else if (star.x > width + star.radius) star.x = -star.radius;
      }
      const x = star.x + easedX * star.parallax, y = star.y + easedY * star.parallax;
      const twinkle = moving ? 1 - star.twinkle / 2 + Math.sin(now * 0.001 * star.rate + star.phase) * star.twinkle / 2 : 1;
      const alpha = Math.max(0, Math.min(1, star.alpha * twinkle));
      if (star.glow) {
        ctx.globalAlpha = alpha * 0.09; ctx.fillStyle = star.color;
        ctx.beginPath(); ctx.arc(x, y, star.radius * 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = alpha; ctx.fillStyle = star.color;
      ctx.beginPath(); ctx.arc(x, y, star.radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (moving) drawMeteor(now, delta);
  }
  const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; lastFrame = 0; };
  const animate = now => {
    frame = 0;
    if (disposed || !active || document.hidden || !motionAllowed()) return;
    if (lastFrame && now - lastFrame < 16) { frame = requestAnimationFrame(animate); return; }
    const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
    lastFrame = now; render(now, delta, true);
    frame = requestAnimationFrame(animate);
  };
  const start = () => {
    if (disposed || !active || document.hidden || !motionAllowed() || frame) return;
    lastFrame = 0; meteor = null; nextMeteorAt = performance.now() + random(18000, 34000);
    frame = requestAnimationFrame(animate);
  };
  const setActive = value => {
    active = value;
    if (active && motionAllowed() && !document.hidden) start();
    else {
      stop();
      if (!motionAllowed()) { easedX = 0; easedY = 0; render(performance.now(), 0, false); }
    }
    if (active) resize();
  };
  const onPointerMove = event => {
    if (event.pointerType !== 'mouse') return;
    const rect = hero.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width - 0.5;
    pointerY = (event.clientY - rect.top) / rect.height - 0.5;
  };
  const onPointerLeave = () => { pointerX = 0; pointerY = 0; };
  const onVisibilityChange = () => document.hidden ? stop() : start();
  const onMotionChange = () => setActive(active);
  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(hero);
  if (!resizeObserver) window.addEventListener('resize', resize);
  hero.addEventListener('pointermove', onPointerMove, { passive: true });
  hero.addEventListener('pointerleave', onPointerLeave, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  motionQuery.addEventListener?.('change', onMotionChange);
  resize();
  if (motionQuery.matches) render(performance.now(), 0, false);

  return {
    setActive,
    dispose() {
      disposed = true; stop(); resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', resize);
      hero.removeEventListener('pointermove', onPointerMove);
      hero.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      motionQuery.removeEventListener?.('change', onMotionChange);
    }
  };
}

/* ---------- routing ---------- */
function route() {
  const [v, arg] = (location.hash.slice(1) || 'home').split('/');
  const view = ['home', 'story', 'explore'].includes(v) ? v : 'home';
  if (S.view === view && !arg) return;
  const prev = S.view; S.view = view; Speech.stop();
  S.starfield?.setActive(view === 'home');
  $$('.view').forEach(el => { el.hidden = el.dataset.view !== view; });
  $$('[data-nav]').forEach(a => a.toggleAttribute('aria-current', a.dataset.nav === view));
  document.title = S.locale === 'ar' ? ui(view === 'home' ? 'titleHome' : view === 'story' ? 'titleStory' : 'titleExplore') : { home: 'ATHAR — Every Mission Leaves a Mark', story: 'The Story · ATHAR', explore: 'Explore the Garden · ATHAR' }[view];
  if (prev === 'explore') S.scene?.stop();
  if (view !== 'story') detachPreview('story');
  if (view === 'home') window.scrollTo(0, 0);
  if (view === 'story') { if (prev !== 'story') S.step = 0; showStep(S.step, false); }
  if (view === 'explore') startExplore(arg);
  if (prev && prev !== view) { const h = $(`#view-${view} [tabindex="-1"]`); h?.focus({ preventScroll: true }); }
}

/* ---------- 3D preview (shared, one WebGL context) ---------- */
async function getPreview() {
  if (!webglOK()) return null;
  if (S.preview) return S.preview;
  S.previewPromise ??= import('./models.js').then(m => { S.preview = new m.Preview(reduced); return S.preview; }).catch(() => (S.previewOK = false, null));
  return S.previewPromise;
}
async function attachPreview(el, id, owner) {
  S.previewOwner = owner; const p = await getPreview();
  if (!p || S.previewOwner !== owner) { if (!p) el.innerHTML = `<div class="icon-fallback" style="--accent:${accent(S.chars.find(c => c.id === id))}">${ICONS[id] || ''}<span>${S.locale === 'ar' ? ui('previewUnavailable') : '3D preview unavailable'}</span></div>`; return; }
  p.attach(el, id);
}
function detachPreview(owner) { if (S.previewOwner === owner) { S.preview?.detach(); S.previewOwner = null; } }

/* ---------- story mode ---------- */
let steps = [];
function buildStory() {
  steps = [{ t: 'intro' }, ...S.order.map(c => ({ t: 'char', c })), { t: 'finale' }];
  $('#story-dots').innerHTML = steps.map((s, i) => {
    const label = S.locale === 'ar'
      ? `${ui('step')} ${i + 1}: ${s.t === 'char' ? localizedRecord(s.c).name : s.t === 'intro' ? ui('welcome') : ui('finish')}`
      : `Step ${i + 1}: ${s.t === 'char' ? s.c.name : s.t === 'intro' ? 'Welcome' : 'Finish'}`;
    return `<li><button type="button" data-step="${i}" aria-label="${esc(label)}"></button></li>`;
  }).join('');
  $$('#story-dots button').forEach(b => b.addEventListener('click', () => showStep(+b.dataset.step)));
  $('#story-back').addEventListener('click', () => showStep(S.step - 1));
  $('#story-next').addEventListener('click', () => { if (S.step >= steps.length - 1) location.hash = 'explore'; else showStep(S.step + 1); });
  addEventListener('keydown', e => {
    if (S.view !== 'story' || $('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    if (e.key === 'ArrowRight') showStep(S.step + 1); if (e.key === 'ArrowLeft') showStep(S.step - 1);
  });
}
function showStep(i, focus = true) {
  S.step = Math.max(0, Math.min(steps.length - 1, i)); const s = steps[S.step], box = $('#story-text'); Speech.stop();
  const stage = $('#story-stage');
  $('#progress-fill').style.width = `${(S.step / (steps.length - 1)) * 100}%`;
  $$('#story-dots button').forEach((b, k) => { b.classList.toggle('on', k === S.step); b.classList.toggle('done', k < S.step); b.toggleAttribute('aria-current', k === S.step); if (S.locale === 'ar') b.setAttribute('aria-label', `${ui('step')} ${k + 1}: ${steps[k].t === 'char' ? localizedRecord(steps[k].c).name : steps[k].t === 'intro' ? ui('welcome') : ui('finish')}`); });
  $('#progress-label').textContent = S.locale === 'ar' ? ui('stepOf').replace('{n}',S.step+1).replace('{total}',steps.length) : `Step ${S.step + 1} of ${steps.length}`;
  $('#story-back').disabled = S.step === 0;
  $('#story-next').innerHTML = S.step === steps.length - 1 ? (S.locale === 'ar' ? ui('exploreArrow') : 'Explore the Garden ▸') : S.step === 0 ? (S.locale === 'ar' ? ui('meetFirst') : 'Meet the first explorer ▸') : (S.locale === 'ar' ? ui('next') : 'Next ▸');
  stage.dataset.mode = s.t;
  if (s.t === 'char') {
    const c = localizedRecord(s.c), src = c.sources?.[0], story = c.story; stage.style.setProperty('--accent', accent(c));
    const n = S.order.findIndex(x => x.id === c.id) + 1;
    box.innerHTML = `
      <p class="kicker">${S.locale === 'ar' ? `${ui('explorer')} ${n} ${ui('of')} ${S.order.length}` : `Explorer ${n} of ${S.order.length}`} · ${esc(c.worldLabel)} · <span class="status">${esc(c.statusLabel)}</span></p>
      <h2 id="story-title" tabindex="-1">${esc(c.name)}</h2>
      <p class="tagline">${esc(c.tagline)}</p>
      <blockquote class="voice"><span class="badge voice-b">${S.locale === 'ar' ? ui('firstVoice') : 'In its own voice · creative narration'}</span>“${esc(story.intro)}”</blockquote>
      <div class="cards2">
        <section class="card"><span class="badge fact-b">${ui('memorableFact')}</span><p>${esc(c.storyMode?.fact || c.funFacts[0])}</p></section>
        <section class="card"><span class="badge sci-b">${ui('takeaway')}</span><p>${esc(c.storyMode?.takeaway || c.whatITaught[0].text)}</p></section>
      </div>
      <ol class="mini-tl" aria-label="${esc(S.locale === 'ar' ? ui('timeline') : 'Timeline')}">${c.timeline.map(t => `<li><b>${esc(t.value)}</b><span>${esc(t.label)}</span></li>`).join('')}</ol>
      <div class="row">
        ${Speech.ok ? `<button type="button" class="btn ghost" id="st-listen">${S.locale === 'ar' ? ui('listen') : '🔊 Listen'}</button>` : ''}
        <button type="button" class="btn ghost" id="st-more">${S.locale === 'ar' ? ui('readRecord') : 'Read the full record'}</button>
        ${src ? `<a class="linklike" href="${esc(src.url)}" target="_blank" rel="noopener">${S.locale === 'ar' ? ui('nasaSource') : 'NASA source ↗'}</a>` : ''}
      </div>`;
    $('#story-preview').innerHTML = ''; attachPreview($('#story-preview'), c.id, 'story'); $('#stage-hint').hidden = false;
    $('#st-more').addEventListener('click', e => openRecord(c.id, e.currentTarget));
    $('#st-listen')?.addEventListener('click', e => toggleSpeech(e.currentTarget, `${story.intro} ${story.paragraphs.join(' ')} ${story.farewell}`, S.locale === 'ar' ? 'ar-EG' : 'en-US'));
    if (Array.isArray(c.quiz) && c.quiz.length) {
      box.insertAdjacentHTML('beforeend', `<section class="quiz card" aria-labelledby="quiz-title"><h3 id="quiz-title">${S.locale === 'ar' ? esc(S.ar.quizTitle) : 'Quick check'}</h3>${c.quiz.map((q,k)=>{const localized=S.locale==='ar'?(S.ar.quiz?.[c.id]?.[k]||q):q, qi=`${c.id}:${k}`;return `<div class="quiz-question"><p>${esc(localized.question)}</p><div class="quiz-options">${localized.options.map((o,j)=>`<button class="chip" type="button" data-qindex="${k}" data-quiz="${j}" ${S.quizAnswered.has(qi)?'disabled':''}>${esc(o)}</button>`).join('')}</div><p class="quiz-result" aria-live="polite"></p></div>`}).join('')}</section>`);
      $$('.quiz [data-quiz]', box).forEach(b=>b.addEventListener('click',()=>{ const k=+b.dataset.qindex, q=c.quiz[k], qi=`${c.id}:${k}`, group=b.closest('.quiz-question'), result=$('.quiz-result',group); if(+b.dataset.quiz===q.answer){if(!S.quizAnswered.has(qi))S.quizScore++;S.quizAnswered.add(qi);result.textContent=S.locale==='ar'?ui('answerCorrect'):'Correct!';$$('[data-quiz]',group).forEach(x=>x.disabled=true);}else result.textContent=S.locale==='ar'?ui('tryAgain'):'Try again'; }));
    }
  } else {
    detachPreview('story'); $('#story-preview').innerHTML = ''; $('#stage-hint').hidden = true; stage.style.setProperty('--accent', '#5eead4');
    if (s.t === 'intro') {
      box.innerHTML = `
        <p class="kicker">${S.locale === 'ar' ? ui('welcome') : 'Welcome to the garden'}</p>
        <h2 id="story-title" tabindex="-1">${S.locale === 'ar' ? ui('introTitle') : 'Four explorers. Four missions. One garden.'}</h2>
        <p class="tagline">${S.locale === 'ar' ? ui('introText') : 'Some missions end quietly: a radio goes silent, a battery fades, a blade breaks. These explorers left something behind anyway, and the science still helps us today.'}</p>
        <div class="cards2">
          <section class="card"><span class="badge fact-b">${S.locale === 'ar' ? ui('verifiedFact') : 'Verified fact'}</span><p>${S.locale === 'ar' ? ui('verifiedFactText') : 'Numbers, dates and results come from NASA sources linked on every record.'}</p></section>
          <section class="card"><span class="badge voice-b">${S.locale === 'ar' ? ui('creativeNarration') : 'Creative narration'}</span><p>${S.locale === 'ar' ? ui('creativeNarrationText') : 'When an explorer says “I”, that is a storytelling voice. Spacecraft don\'t really talk.'}</p></section>
        </div>
        <p class="muted">${S.locale === 'ar' ? ui('keyboardHelp') : 'Use ← → or the buttons below. We go in the order the explorers launched.'}</p>`;
      stage.querySelector('#story-preview').innerHTML = `<div class="intro-art" aria-hidden="true">${S.order.map(c => `<span style="--accent:${accent(c)}">${ICONS[c.id]}</span>`).join('')}</div>`;
    } else {
      box.innerHTML = `
        <p class="kicker">${S.locale === 'ar' ? ui('metThem') : 'You met them all'}</p>
        <h2 id="story-title" tabindex="-1">${S.locale === 'ar' ? ui('allLeaveMark') : 'Every mission leaves a mark'}</h2>
        ${renderMissionTimeline()}
        <ul class="recap">${S.order.map(raw => {const c=localizedRecord(raw); return `<li><button type="button" class="recap-b" data-id="${esc(c.id)}" style="--accent:${accent(c)}"><b>${esc(c.name)}</b><span>${esc(c.storyMode?.takeaway || '')}</span></button></li>`;}).join('')}</ul>
        <div class="row"><a class="btn primary" href="#explore">${S.locale === 'ar' ? ui('exploreArrow') : 'Explore the Garden ▸'}</a><button type="button" class="btn ghost" id="replay">${S.locale === 'ar' ? ui('replay') : '↺ Replay the story'}</button><button type="button" class="btn ghost" id="print-summary">${esc(tx('printSummary'))}</button></div><p class="badge fact-b">${esc(tx('gardenKeeper'))} · ${S.quizScore} ${S.locale === 'ar' ? ui('quizScore') : 'quiz answers correct'}</p>`;
      stage.querySelector('#story-preview').innerHTML = `<div class="intro-art" aria-hidden="true">${S.order.map(c => `<span style="--accent:${accent(c)}">${ICONS[c.id]}</span>`).join('')}</div>`;
      $$('.mission-span', box).forEach(b => b.addEventListener('click', () => openRecord(b.dataset.id, b)));
      $$('.recap-b', box).forEach(b => b.addEventListener('click', () => openRecord(b.dataset.id, b)));
      $('#replay').addEventListener('click', () => showStep(0));
      $('#print-summary').addEventListener('click', () => window.print());
    }
  }
  if (focus && S.view === 'story') $('#story-title')?.focus({ preventScroll: true });
  if (S.view === 'story') $('#story-text').scrollTop = 0;
}
function renderMissionTimeline() {
  const minYear = Math.min(...S.order.map(c => c.launchYear));
  const maxYear = Math.max(...S.order.map(c => c.endYear));
  const span = maxYear - minYear || 1;
  const missions = [...S.order].sort((a, b) => a.launchYear - b.launchYear);
  return `
    <section class="mission-timeline" aria-labelledby="mission-timeline-title">
      <h2 id="mission-timeline-title">${S.locale === 'ar' ? ui('missionAcrossTime') : 'Their missions, across time'}</h2>
      <p class="muted small">${S.locale === 'ar' ? ui('missionTimelineNote') : "Each band runs from launch year to the mission's final recorded year. It does not mean the explorer worked continuously."}</p>
      <ol class="mission-timeline-list">
        ${missions.map(c => {
          const left = ((c.launchYear - minYear) / span) * 100;
          const width = Math.max(1.8, ((c.endYear - c.launchYear) / span) * 100);
          return `<li><button type="button" class="mission-span" data-id="${esc(c.id)}" style="--start:${left}%;--span:${width}%">
            <span class="mission-span-label">${esc(localizedRecord(c).name)}</span>
            <span class="mission-span-track" aria-hidden="true"><span class="mission-span-bar" style="--accent:${accent(c)}"></span></span>
            <span class="mission-span-years">${c.launchYear}–${c.endYear}</span>
          </button></li>`;
        }).join('')}
      </ol>
      <div class="mission-timeline-axis" aria-hidden="true"><span>${minYear}</span><span>${maxYear}</span></div>
    </section>`;
}
function toggleSpeech(btn, text, lang = S.locale === 'ar' ? 'ar-EG' : 'en-US') {
  if (Speech.playing) { Speech.stop(); btn.textContent = S.locale === 'ar' ? ui('listen') : '🔊 Listen'; return; }
  btn.textContent = S.locale === 'ar' ? ui('stop') : '⏹ Stop'; Speech.lang = lang; Speech.speak(text, () => { btn.textContent = S.locale === 'ar' ? ui('listen') : '🔊 Listen'; });
}

/* ---------- record dialog ---------- */
const rec = () => $('#record');
function openRecord(id, opener, force = false) {
  const raw = S.chars.find(x => x.id === id); if (!raw) return; const c = localizedRecord(raw);
  const d = rec();
  // Repeated renders or focus requests for the already-open record must not
  // cancel and restart its speech session.
  if (d.open && S.current === id && !force) return;
  // reveal:false — the innerHTML below replaces the whole dialog body immediately.
  const priorScroll = d.scrollTop;
  RecordNarration.stop({ reveal: false }); S.current = c.id; if (!force) S.lastFocus = opener || document.activeElement;
  S.scene?.focusArtifact?.(id);
  $('#rec-body').innerHTML = renderRecord(c); d.style.setProperty('--accent', accent(c));
  if (!d.open) d.showModal();
  d.scrollTop = force ? priorScroll : 0;
  $('#rec-close').addEventListener('click', () => d.close());
  $('#rec-listen')?.addEventListener('click', () => RecordNarration.active ? RecordNarration.stop() : RecordNarration.start(c));
  const soundButton = $('#rec-sound'); if (soundButton) { soundButton.setAttribute('aria-pressed', String(RecordNarration.soundEnabled)); soundButton.textContent = S.locale === 'ar' ? (RecordNarration.soundEnabled ? ui('soundOn') : ui('soundOff')) : (RecordNarration.soundEnabled ? '♪ Sound effects: on' : '♪ Sound effects: off'); }
  $('#rec-sound')?.addEventListener('click', e => { RecordNarration.soundEnabled = !RecordNarration.soundEnabled; e.currentTarget.setAttribute('aria-pressed', String(RecordNarration.soundEnabled)); e.currentTarget.textContent = S.locale === 'ar' ? (RecordNarration.soundEnabled ? ui('soundOn') : ui('soundOff')) : (RecordNarration.soundEnabled ? '♪ Sound effects: on' : '♪ Sound effects: off'); if (RecordNarration.soundEnabled) RecordNarration.chime(); });
  bindQA(c); attachPreview($('#rec-preview'), c.id, 'record'); $('#rec-title').focus({ preventScroll: true });
  // Use the same real UI action as the visitor: opening a record activates Listen.
  $('#rec-listen')?.click();
}
function renderRecord(c) {
  const story = S.locale === 'ar' ? (S.ar.story?.[c.id] || c.story) : c.story;
  const narrativeText = [story.intro, ...story.paragraphs, story.farewell].filter(Boolean).join('\n\n');
  return `
  <button type="button" class="close" id="rec-close" aria-label="${S.locale === 'ar' ? ui('recordClose') : 'Close story panel'}">✕</button>
  <div class="rec-top">
    <div id="rec-preview" class="rec-preview" role="img" aria-label="${S.locale === 'ar' ? `نموذج ثلاثي الأبعاد قابل للتدوير لـ ${esc(c.name)}. تصوير مبسّط، وليس وفق مقياس حقيقي.` : `Rotatable 3D model of ${esc(c.name)}. Simplified illustration, not to scale.`}"></div>
    <div class="rec-head">
      <p class="kicker">${esc(c.objectType)} · ${esc(c.worldLabel)}</p>
      <h2 id="rec-title" tabindex="-1">${esc(c.name)}</h2>
      <p class="muted">${esc(c.fullName)}</p>
      <p><span class="pill">${esc(c.statusLabel)}</span> <span class="pill alt">${esc(c.objectType)}</span></p>
    </div>
  </div>
  <p class="tagline">${esc(c.tagline)}</p>
  <h3>${S.locale === 'ar' ? ui('timeline') : 'Timeline'}</h3>
  <ol class="timeline">${c.timeline.map(t => `<li><b>${esc(t.value)}</b><span>${esc(t.label)}</span></li>`).join('')}</ol>
  <h3>${S.locale === 'ar' ? ui('missionData') : 'Mission data'}</h3>
  <svg class="data-timeline" viewBox="0 0 640 76" role="img" aria-label="${S.locale === 'ar' ? `خط زمني للمهمة يضم ${c.timeline.length} محطات` : `Mission timeline with ${c.timeline.length} milestones`}"><path d="M30 22 H610" stroke="currentColor" stroke-width="3" opacity=".55"/>${c.timeline.map((t,i)=>{const x=c.timeline.length===1?320:30+i*580/(c.timeline.length-1);return `<circle cx="${x}" cy="22" r="7" fill="var(--accent)"/><text x="${x}" y="51" text-anchor="middle">${esc(t.value.slice(-4))}</text>`}).join('')}</svg>
  <div class="data-stats">${(c.missionData||[]).map(m=>`<article class="data-stat"><b>${esc(m.display)}</b><span>${esc(m.label)}</span><a href="${esc(c.sources[m.sourceIndex]?.url||c.sources[0]?.url||'#')}" target="_blank" rel="noopener">${S.locale === 'ar' ? ui('nasaSource') : 'NASA source ↗'}</a></article>`).join('')}</div>
  ${c.endNote ? `<p class="note">${esc(c.endNote)}</p>` : ''}
  <h3>${S.locale === 'ar' ? ui('where') : 'Where is it?'}</h3>
  <p><b>${esc(c.location)}</b></p><p class="muted">${esc(c.locationNote || '')} ${esc(c.sceneNote || '')}</p>
  <h3>${S.locale === 'ar' ? ui('theStory') : 'The story'}</h3>
  <p class="badge voice-b">${S.locale === 'ar' ? ui('storyVoice') : 'Told in first person · creative narration, not the spacecraft literally speaking'}</p>
  <div class="prose" id="rec-story-text" aria-live="off"><div class="rec-story-line" id="rec-story-line" data-full-text="${esc(narrativeText)}"></div></div>
  <div class="row"><button type="button" class="btn ghost" id="rec-listen" aria-pressed="false">${S.locale === 'ar' ? ui('listenStory') : '🔊 Listen to the story'}</button><button type="button" class="btn ghost" id="rec-sound" aria-pressed="true">${S.locale === 'ar' ? ui('soundOn') : '♪ Sound effects: on'}</button>${Speech.ok ? '' : `<span class="muted">${S.locale === 'ar' ? ui('speechUnavailable') : 'Speech is unavailable; the story will appear as text.'}</span>`}</div>
  <h3>${S.locale === 'ar' ? ui('whatTaught') : 'What it taught us'}</h3>
  <div class="cards">${c.whatITaught.map(t => `<section class="card"><span class="badge sci-b">${S.locale === 'ar' ? ui('science') : 'Science'}</span><h4>${esc(t.title)}</h4><p>${esc(t.text)}</p></section>`).join('')}</div>
  <h3>${S.locale === 'ar' ? ui('funFacts') : 'Fun facts'}</h3>
  <ul class="facts">${c.funFacts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
  <h3>${S.locale === 'ar' ? ui('askNotes') : 'Ask the notes'}</h3>
  <p class="muted small">${S.locale === 'ar' ? ui('notAI') : 'Not an AI. Answers are looked up by keyword from this record’s NASA-sourced notes.'}</p>
  <div class="qa-chips">${c.fallbackAnswers.map((q, i) => `<button type="button" class="chip" data-q="${i}">${esc(q.question)}</button>`).join('')}</div>
  <div class="qa-form"><label for="qa-in" class="sr-only">${S.locale === 'ar' ? ui('typeQuestion') : 'Type a question'}</label><input id="qa-in" type="text" maxlength="120" placeholder="${S.locale === 'ar' ? ui('questionPlaceholder') : 'Type a question, e.g. “why did you stop?”'}" autocomplete="off"><button type="button" class="btn ghost" id="qa-go">${S.locale === 'ar' ? ui('ask') : 'Ask'}</button></div>
  <p id="qa-out" class="qa-out" aria-live="polite"></p>
  <h3>${S.locale === 'ar' ? ui('sources') : 'Sources'}</h3>
  <ul class="sources">${c.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a></li>`).join('')}</ul>
  <p class="muted small">${S.locale === 'ar' ? ui('modelCredit') : '3D model'}: ${esc(c.model.credit)}. ${esc(S.locale === 'ar' ? S.ar.worlds.disclaimer : S.worlds.disclaimer)}</p>`;
}

/* rule-based Q&A: keyword overlap against fallbackAnswers, then aiContext sentences */
const STOP = new Set('a an the is are was were do does did you your i me my of to in on at it its and or for with what why how when where who which that this be been can could will would from about as by'.split(' '));
const SYN = { stop: ['end', 'ended', 'last', 'silent', 'happened'], stopped: ['end', 'ended', 'last', 'silent', 'happened'], die: ['end', 'ended'], died: ['end', 'ended'], broke: ['damage', 'damaged'], broken: ['damage', 'damaged'], crash: ['crashed'], home: ['earth'] };
const toks = s => (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(w => !STOP.has(w) && !'من في على إلى عن ما لماذا أين متى هل أنا أنت هو هي هذا هذه ذلك تلك مع كان كانت'.split(' ').includes(w) && w.length > 1);
const qtoks = s => toks(s).flatMap(w => [w, ...(SYN[w] || [])]);
function answer(c, q) {
  const qt = new Set(qtoks(q)); if (!qt.size) return null;
  let best = { s: 0, a: null };
  for (const f of c.fallbackAnswers) { const s = toks(f.question).filter(t => qt.has(t)).length * 2 + toks(f.answer).filter(t => qt.has(t)).length * 0.5; if (s > best.s) best = { s, a: f.answer, from: 'notes' }; }
  if (best.s >= 2) return best;
  if (S.locale === 'ar') return null;
  const sents = c.aiContext.split(/(?<=[.!?])\s+/); let sb = { s: 0, a: null };
  for (const st of sents) { const s = toks(st).filter(t => qt.has(t)).length; if (s > sb.s) sb = { s, a: st, from: 'fact sheet' }; }
  if (sb.s >= 2) return sb; if (best.s >= 1) return best; return null;
}
function bindQA(c) {
  const out = $('#qa-out'), input = $('#qa-in');
  const show = (q, a) => { out.innerHTML = a ? `<b>${esc(q)}</b><br>${esc(a.a)}<br><small class="muted">${S.locale === 'ar' ? (a.from === 'notes' ? ui('fromNotes') : ui('fromFactSheet')) : (a.from === 'notes' ? 'From the record’s notes' : 'From the NASA-sourced fact sheet')}.</small>` : `<b>${esc(q)}</b><br>${S.locale === 'ar' ? ui('unknownAnswer') : 'I don’t have that in my notes. Try one of the questions above, or check the NASA source below.'}`; };
  $$('.qa-chips .chip').forEach(b => b.addEventListener('click', () => { const f = c.fallbackAnswers[+b.dataset.q]; show(f.question, { a: f.answer, from: 'notes' }); }));
  const go = () => { const q = input.value.trim(); if (q) show(q, answer(c, q)); };
  $('#qa-go').addEventListener('click', go); input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}

/* ---------- explore mode ---------- */
function buildExploreUI() {
  const list = $('#explorer-list'), fl = $('#fallback-list');
  const li = S.order.map(raw => { const c = localizedRecord(raw); return `<li><button type="button" class="chip" data-id="${esc(c.id)}" style="--accent:${accent(c)}">${esc(c.name)} <small>${esc(c.worldLabel)}</small></button></li>`; }).join('');
  list.innerHTML = li;
  fl.innerHTML = S.order.map(raw => { const c = localizedRecord(raw); return `<li><button type="button" class="stele" data-id="${esc(c.id)}" style="--accent:${accent(c)}"><span class="stele-ico">${ICONS[c.id]}</span><strong>${esc(c.name)}</strong><span class="stele-type">${esc(c.objectType)}</span></button></li>`; }).join('');
  $$('#explorer-list button, #fallback-list button').forEach(b => b.addEventListener('click', () => openRecord(b.dataset.id, b)));
  $$('.filters [data-filter]').forEach(b => { if (b.dataset.bound) return; b.dataset.bound = 'true'; b.addEventListener('click', () => { setFilterUI(b.dataset.filter); S.scene?.setFilter(b.dataset.filter); $('#world-chip').hidden = true; }); });
  if (!$('#reset-cam').dataset.bound) { $('#reset-cam').dataset.bound = 'true'; $('#reset-cam').addEventListener('click', () => { setFilterUI('all'); $('#world-chip').hidden = true; S.scene?.reset(); }); }
}
function setFilterUI(f) { $$('.filters [data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === f))); }
function worldChip(w) {
  const wa = S.locale === 'ar' ? S.ar.worlds?.[w.id] : null;
  const world = wa ? { ...w, ...wa } : w;
  const here = S.chars.filter(c => c.destination === w.id).map(localizedRecord);
  const chip = $('#world-chip'); chip.hidden = false;
  chip.dataset.worldId = w.id;
  chip.innerHTML = `<button type="button" class="close" aria-label="${S.locale === 'ar' ? ui('closes') : 'Close'}" id="wc-x">✕</button><h2>${esc(world.name)}</h2><p>${esc(world.blurb)}</p>
    ${here.length ? `<p class="muted small">${S.locale === 'ar' ? ui('explorersHere') : 'Explorers here:'}</p><div class="qa-chips">${here.map(c => `<button type="button" class="chip" data-id="${esc(c.id)}" style="--accent:${accent(c)}">${esc(c.name)}</button>`).join('')}</div>` : `<p class="muted small">${S.locale === 'ar' ? ui('nobodyHere') : 'No explorer of this garden rests here. Look for them on the Moon, Mars and in deep space.'}</p>`}`;
  $('#wc-x').addEventListener('click', () => { chip.hidden = true; }); $$('.chip[data-id]', chip).forEach(b => b.addEventListener('click', () => openRecord(b.dataset.id, b)));
  S.scene?.focusWorld(w.id); if (w.filter) setFilterUI(w.filter);
}
async function startExplore(arg) {
  const loading = $('#gl-loading'), fb = $('#gl-fallback');
  const fallback = msg => { loading.hidden = true; fb.hidden = false; if (msg) $('#gl-fallback-msg').textContent = msg; };
  if (!webglOK()) return fallback(S.locale === 'ar' ? ui('webglUnavailable') : 'Your browser or device can’t run WebGL, so the 3D garden is switched off. The stories still work:');
  try {
    if (!S.scene) {
      loading.hidden = false; fb.hidden = true;
      S.scenePromise ??= import('./scene.js').then(async m => {
        const sc = new m.ExploreScene({ host: $('#gl-host'), labelsHost: $('#labels'), data: S.order.map(localizedRecord), worlds: S.worlds, reduced,
          onArtifact: id => openRecord(id), onWorld: worldChip, onProgress: t => { $('#gl-loading-msg').textContent = S.locale === 'ar' ? 'نضيء النجوم…' : t; },
          onError: e => fallback(S.locale === 'ar' ? `${ui('webglStopped')} (${e.message})` : 'The 3D view stopped (' + e.message + '). Reload to try again, or use the story list:') });
        sc.updateLocalization(S.order.map(localizedRecord), S.worlds, S.locale === 'ar' ? S.ar.worlds : null);
        await sc.init(); return sc;
      });
      S.scene = await S.scenePromise;
    }
    S.scene?.updateLocalization(S.order.map(localizedRecord), S.worlds, S.locale === 'ar' ? S.ar.worlds : null);
    if (S.view !== 'explore') return;
    loading.hidden = true; fb.hidden = true; S.scene.start();
    if (arg && S.chars.some(c => c.id === arg)) openRecord(arg);
  } catch (e) { console.error(e); S.scenePromise = null; fallback(S.locale === 'ar' ? ui('buildSceneError') : 'Something went wrong while building the 3D scene (' + (e.message || e) + '). You can still read every story:'); }
}

/* ---------- credits & globals ---------- */
function openCredits() {
  const d = $('#credits'); if (!d.open) S.lastFocus = document.activeElement;
  const ar = S.locale === 'ar';
  $('#cr-body').innerHTML = `
  <button type="button" class="close" id="cr-close" aria-label="${ar ? ui('creditsClose') : 'Close credits'}">✕</button>
  <h2 id="cr-title" tabindex="-1">${ar ? ui('creditsTitle') : 'Sources & credits'}</h2>
  <p class="note"><b>ATHAR</b> ${ar ? ui('independentProject') : 'is an independent educational project. It is not affiliated with or endorsed by NASA. “NASA” and mission names are used only to describe real missions.'}</p>
  <h3>${ar ? ui('sourcesByExplorer') : 'Sources by explorer'}</h3>
  ${S.order.map(raw => {const c=localizedRecord(raw); return `<h4>${esc(c.name)}</h4><ul class="sources">${c.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a></li>`).join('')}</ul>`;}).join('')}
  <h3>${ar ? ui('factsVersusNarration') : 'Facts vs. narration'}</h3>
  <p>${ar ? ui('factsVersusNarrationText') : 'Dates, numbers and outcomes come from the sources above. First-person text is creative narration written for this project. Details that are unknown are marked as unknown (for example, the final fate of the Apollo 11 ascent stage).'}</p>
  <h3>${ar ? ui('visuals') : '3D &amp; visuals'}</h3>
  <p>${ar ? ui('visualsText') : 'All 3D models and planet textures are generated in code for ATHAR as simplified, not-to-scale illustrations. They are not NASA models.'} ${esc(ar ? S.ar.worlds.disclaimer : S.worlds.disclaimer)}</p>
  <h3>${ar ? ui('openSource') : 'Open-source'}</h3>
  <ul class="sources"><li><a href="https://threejs.org" target="_blank" rel="noopener">Three.js (MIT) ↗</a></li><li><a href="https://fonts.google.com/specimen/Atkinson+Hyperlegible" target="_blank" rel="noopener">Atkinson Hyperlegible, Braille Institute (OFL) ↗</a></li><li><a href="https://fonts.google.com/specimen/Space+Grotesk" target="_blank" rel="noopener">Space Grotesk (OFL) ↗</a></li></ul>`;
  $('#cr-close').addEventListener('click', () => d.close()); if (!d.open) d.showModal(); $('#cr-title').focus({preventScroll:true});
}
function bindGlobal() {
  $('#language-toggle').addEventListener('click', () => { S.i18n = S.locale === 'en' ? S.ar : S.en; setLocale(S.locale === 'en' ? 'ar' : 'en'); });
  $('#open-credits').addEventListener('click', openCredits); $('#open-credits-2').addEventListener('click', openCredits);
  for (const d of $$('dialog')) {
    d.addEventListener('click', e => { if (e.target === d) d.close(); }); // click on backdrop
    d.addEventListener('close', () => {
      Speech.stop(); if (d.id === 'record') { RecordNarration.stop(); detachPreview('record'); if (S.view === 'story' && steps[S.step]?.t === 'char') attachPreview($('#story-preview'), steps[S.step].c.id, 'story'); }
      S.lastFocus?.focus?.({ preventScroll: true });
    });
  }
  addEventListener('pagehide', () => { RecordNarration.dispose(); Speech.stop(); S.scene?.dispose(); S.preview?.dispose(); S.starfield?.dispose(); });
}

if (location.search.includes('debug')) window.__athar = S;
boot();

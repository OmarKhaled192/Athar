// ATHAR — Explore the Garden: Three.js scene (educational visualization, NOT to scale).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { buildPlanetTextures, buildSkyTexture, atmosphere, buildModel, animateModel } from './models.js';

const tick = () => new Promise(r => setTimeout(r, 0));
const CAM_HOME = new THREE.Vector3(0, 6, 36), TARGET_HOME = new THREE.Vector3(0, 2, -4);
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export class ExploreScene {
  constructor(o) {
    Object.assign(this, o); // host, labelsHost, data, worlds, reduced, onArtifact, onWorld, onError, onProgress
    this.items = new Map(); this.pickables = []; this.fly = null; this.running = false; this.raf = 0;
    this.filter = 'all'; this.selected = null; this.pointer = new THREE.Vector2(); this.ray = new THREE.Raycaster();
    this.clock = new THREE.Clock(); this.t = 0; this.tags = new Map(); this.locale = 'en';
  }

  async init() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: !coarse, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.canvas = this.renderer.domElement; this.canvas.setAttribute('aria-label', '3D garden: drag to rotate, scroll or pinch to zoom. Explorers are also listed as buttons.');
    this.canvas.setAttribute('role', 'img'); this.canvas.style.touchAction = 'none';
    this.host.prepend(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1200); this.camera.position.copy(CAM_HOME);
    this.controls = new OrbitControls(this.camera, this.canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.07, enablePan: false, minDistance: 5, maxDistance: 130, rotateSpeed: 0.55, zoomSpeed: 0.7 });
    this.controls.target.copy(TARGET_HOME); this.controls.update();
    this.fresh = true; this.controls.addEventListener('start', () => { this.fly = null; this.fresh = false; });

    this.onProgress?.('Lighting the stars…');
    const sun = new THREE.DirectionalLight(0xfff2e0, 3.1); sun.position.set(-40, 26, 44); this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0x6f86b8, 0.55));

    // sky + stars
    const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.MeshBasicMaterial({ map: buildSkyTexture(), side: THREE.BackSide, depthWrite: false }));
    this.scene.add(sky);
    this.scene.add(this._stars(2200, 0xffffff, 1.5, 3), this._stars(500, 0x9fd9ff, 2.2, 7));

    // worlds
    const W = [
      { id: 'moon', kind: 'moon', r: 4.6, pos: [-16, 0, 0], atm: null },
      { id: 'mars', kind: 'mars', r: 4.1, pos: [16, -0.5, 0], atm: [0xff9a6a, 3.2, 0.55] },
      { id: 'earth', kind: 'earth', r: 3.1, pos: [1, 11, -34], atm: [0x5ab4ff, 2.3, 1.1] }
    ];
    for (const w of W) {
      this.onProgress?.(`Shaping ${w.id === 'moon' ? 'the Moon' : w.id[0].toUpperCase() + w.id.slice(1)}…`); await tick();
      const { map, bump } = buildPlanetTextures(w.kind);
      const mat = new THREE.MeshStandardMaterial({ map, bumpMap: w.kind === 'earth' ? null : bump, bumpScale: w.kind === 'moon' ? 1.6 : 1.1, roughness: w.kind === 'earth' ? 0.7 : 1, metalness: 0 });
      const m = new THREE.Mesh(new THREE.SphereGeometry(w.r, 64, 40), mat); m.position.set(...w.pos); m.rotation.z = 0.1;
      m.userData.pick = { type: 'world', id: w.id }; this.scene.add(m); this.pickables.push(m);
      if (w.atm) { const a = atmosphere(w.r, ...w.atm); a.position.copy(m.position); this.scene.add(a); }
      this.items.set(w.id, { kind: 'world', id: w.id, mesh: m, r: w.r, anchor: m, tagY: -(w.r + 0.5), below: true });
    }
    this.moon = this.items.get('moon'); this.mars = this.items.get('mars');

    // explorers
    const byId = Object.fromEntries(this.data.map(c => [c.id, c]));
    this._addArtifact(byId['pioneer-10'], () => {
      const g = new THREE.Group(); g.position.set(34, 12, -58); g.add(this._model('pioneer-10', 2.6)); this.scene.add(g);
      g.rotation.y = -0.5; return { anchor: g, tagY: 3.4 };
    });
    this._addArtifact(byId['opportunity'], () => this._onSurface('opportunity', this.mars, 0.78, 8, -6, 0.15));
    this._addArtifact(byId['ingenuity'], () => {
      const r = this._onSurface('ingenuity', this.mars, 0.62, 24, 14, 1.15); r.hover = true; return r;
    });
    this._addArtifact(byId['eagle'], () => {
      const piv = new THREE.Group(); piv.position.copy(this.moon.mesh.position); piv.rotation.set(0.5, 0, -0.35); this.scene.add(piv);
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 120 }, (_, i) => new THREE.Vector3(Math.cos(i / 120 * 6.2832) * 7.6, 0, Math.sin(i / 120 * 6.2832) * 7.6))),
        new THREE.LineDashedMaterial({ color: 0xcfd6ff, dashSize: 0.35, gapSize: 0.3, transparent: true, opacity: 0.45 }));
      ring.computeLineDistances(); piv.add(ring);
      const holder = new THREE.Group(); holder.add(this._model('eagle', 0.85)); piv.add(holder);
      return { anchor: holder, tagY: 1.5, orbit: { holder, angle: 2.4, speed: 0.12, r: 7.6 } };
    });

    // Pioneer trail: dashed illustrative path leaving the garden (NOT a real trajectory)
    const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(new THREE.Vector3(1, 11, -34), new THREE.Vector3(18, 14, -48), new THREE.Vector3(34, 12, -58)).getPoints(40)),
      new THREE.LineDashedMaterial({ color: 0x7c9cff, dashSize: 0.6, gapSize: 0.5, transparent: true, opacity: 0.55 })); trail.computeLineDistances(); this.scene.add(trail);

    // world tags (Moon / Mars / Earth)
    for (const w of this.worlds.worlds) if (this.items.has(w.id)) this._tag(w.id, w.name, 'tag-world', () => this.onWorld?.(w));

    this.resizeObs = new ResizeObserver(() => this.resize()); this.resizeObs.observe(this.host); this.resize();
    this._bind(); this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.stop(); this.onError?.(new Error('WebGL context lost')); });
    this._frameOnce();
  }

  _stars(n, color, size, seed) {
    const p = new Float32Array(n * 3); let s = seed * 9973;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) { const u = r() * 2 - 1, a = r() * 6.2832, q = Math.sqrt(1 - u * u), d = 380 + r() * 150; p.set([q * Math.cos(a) * d, u * d, q * Math.sin(a) * d], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false }));
  }

  _model(id, scale) { const m = buildModel(id); m.scale.setScalar(scale); return m; }

  _onSurface(id, world, scale, latDeg, lonDeg, lift) {
    const c = world.mesh.position, face = new THREE.Vector3().subVectors(CAM_HOME, c).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), face).normalize();
    const dir = face.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-lonDeg)).applyAxisAngle(right, THREE.MathUtils.degToRad(-latDeg)).normalize();
    const holder = new THREE.Group(); holder.position.copy(c).addScaledVector(dir, world.r + lift * scale * 0.6);
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    holder.add(this._model(id, scale)); this.scene.add(holder);
    return { anchor: holder, tagY: 1.5 + scale, baseDir: dir, base: holder.position.clone() };
  }

  _addArtifact(c, build) {
    if (!c) return;
    const r = build(); const rec = { kind: 'artifact', id: c.id, data: c, ...r };
    rec.anchor.traverse(o => { if (o.isMesh) { o.userData.pick = { type: 'artifact', id: c.id }; this.pickables.push(o); } });
    // discoverability marker: screen-sized ring (also raycastable → easier on touch)
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    x.strokeStyle = c.colors?.accent || '#5eead4'; x.lineWidth = 4; x.beginPath(); x.arc(32, 32, 26, 0, 6.2832); x.stroke();
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, opacity: 0.9, sizeAttenuation: false }));
    ring.scale.set(0.05, 0.05, 1); ring.userData.pick = { type: 'artifact', id: c.id }; ring.renderOrder = 10;
    rec.anchor.add(ring); this.pickables.push(ring); rec.ring = ring;
    this.items.set(c.id, rec); this._tag(c.id, c.name, 'tag-artifact', () => this.onArtifact?.(c.id), c.colors?.accent);
  }

  _tag(id, label, cls, fn, accent) {
    const b = document.createElement('button'); b.type = 'button'; b.className = `tag ${cls}`; b.textContent = label;
    b.setAttribute('aria-label', cls === 'tag-artifact' ? (this.locale === 'ar' ? `افتح قصة: ${label}` : `Open story: ${label}`) : (this.locale === 'ar' ? `انتقل إلى ${label}` : `Fly to ${label}`));
    if (accent) b.style.setProperty('--accent', accent); b.addEventListener('click', fn);
    this.labelsHost.appendChild(b); this.tags.set(id, b);
  }

  updateLocalization(data, worlds, arabicWorlds) {
    this.locale = arabicWorlds ? 'ar' : 'en';
    this.worlds = arabicWorlds ? { ...worlds, disclaimer: arabicWorlds.disclaimer, worlds: worlds.worlds.map(w => ({ ...w, ...(arabicWorlds[w.id] || {}) })) } : worlds;
    this.canvas?.setAttribute('aria-label', this.locale === 'ar' ? 'حديقة ثلاثية الأبعاد: اسحب للتدوير، ومرّر أو قرّب بإصبعين للتكبير. تظهر أسماء المستكشفين أيضاً كأزرار.' : '3D garden: drag to rotate, scroll or pinch to zoom. Explorers are also listed as buttons.');
    const chars = new Map(data.map(c => [c.id, c]));
    for (const [id, tag] of this.tags) {
      const world = worlds.worlds.find(w => w.id === id);
      const label = (world && arabicWorlds?.[id]?.name) || chars.get(id)?.name || world?.name;
      if (!label) continue;
      tag.textContent = label;
      tag.setAttribute('aria-label', world
        ? (this.locale === 'ar' ? `انتقل إلى ${label}` : `Fly to ${label}`)
        : (this.locale === 'ar' ? `افتح قصة: ${label}` : `Open story: ${label}`));
    }
  }

  _bind() {
    let down = null;
    this._pd = e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    this._pu = e => {
      if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
      if (moved < 7 && dt < 600) { const h = this._hit(e); if (h) this._pickHandle(h); }
    };
    let busy = false;
    this._pm = e => { if (busy || e.buttons || e.pointerType === 'touch') return; busy = true; requestAnimationFrame(() => { busy = false; this.canvas.style.cursor = this._hit(e) ? 'pointer' : 'grab'; }); };
    this.canvas.addEventListener('pointerdown', this._pd); this.canvas.addEventListener('pointerup', this._pu); this.canvas.addEventListener('pointermove', this._pm);
    this._vis = () => { if (document.hidden) this._pause(); else if (this.running) this._loop(); };
    document.addEventListener('visibilitychange', this._vis);
  }
  _hit(e) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects(this.pickables, false).filter(h => h.object.userData.pick);
    if (!hits.length) return null;
    const art = hits.find(h => h.object.userData.pick.type === 'artifact'); // artifacts win over the planet behind them
    return (art || hits[0]).object.userData.pick;
  }
  _pickHandle(p) { if (p.type === 'artifact') this.onArtifact?.(p.id); else { const w = this.worlds.worlds.find(w => w.id === p.id); if (w) this.onWorld?.(w); } }

  /* camera helpers */
  _flyTo(target, dist, dir) {
    const d = (dir || new THREE.Vector3().subVectors(this.camera.position, this.controls.target)).clone().normalize();
    const to = target.clone().addScaledVector(d, dist);
    if (this.reduced) { this.controls.target.copy(target); this.camera.position.copy(to); this.controls.update(); return; }
    this.fresh = false;
    this.fly = { t0: performance.now(), dur: 1100, fromT: this.controls.target.clone(), toT: target.clone(), fromP: this.camera.position.clone(), toP: to };
  }
  _homeDist() { const a = this.camera.aspect; if (a >= 1.2) return 42; return Math.min(122, 27 / (Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * a)); }
  screenPos(id) { const it = this.items.get(id), v = new THREE.Vector3(); it.anchor.getWorldPosition(v); v.project(this.camera); const r = this.canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }
  _homeFly() { this._flyTo(TARGET_HOME, this._homeDist(), CAM_HOME.clone().sub(TARGET_HOME)); }
  reset() { this.setFilter('all'); this.selected = null; }
  focusWorld(id) {
    const it = this.items.get(id); if (!it) return; this.selected = id;
    this._flyTo(it.mesh.position, it.r * 3.6 + 3);
  }
  focusArtifact(id) {
    const it = this.items.get(id); if (!it) return; this.selected = id;
    const p = new THREE.Vector3(); it.anchor.getWorldPosition(p);
    const dir = it.baseDir ? it.baseDir.clone().add(new THREE.Vector3(0, 0.2, 0)) : null;
    this._flyTo(p, id === 'pioneer-10' ? 9 : 6.5, dir);
  }
  setFilter(f) {
    this.filter = f;
    for (const [id, it] of this.items) { const tag = this.tags.get(id); if (!tag) continue; const dest = it.data?.destination; tag.classList.toggle('dim', it.kind === 'artifact' && f !== 'all' && dest !== f); }
    if (f === 'moon') this.focusWorld('moon'); else if (f === 'mars') this.focusWorld('mars');
    else if (f === 'deep_space') { const p = new THREE.Vector3(); this.items.get('pioneer-10').anchor.getWorldPosition(p); this._flyTo(p, 14); }
    else if (this.camera) this._homeFly();
  }

  resize() {
    const w = this.host.clientWidth || 800, h = this.host.clientHeight || 500;
    this.renderer.setSize(w, h, false); this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.camera.aspect = w / h; this.camera.fov = w / h < 0.8 ? 55 : 45; this.camera.updateProjectionMatrix();
    if (this.fresh) { this.camera.position.copy(TARGET_HOME).addScaledVector(CAM_HOME.clone().sub(TARGET_HOME).normalize(), this._homeDist()); this.controls.update(); }
    this._frameOnce();
  }

  /* loop */
  start() { if (this.running) return; this.running = true; this.resize(); this.clock.getDelta(); this._loop(); }
  stop() { this.running = false; this._pause(); }
  _pause() { cancelAnimationFrame(this.raf); this.raf = 0; }
  _loop() { if (this.raf) return; const f = () => { this.raf = requestAnimationFrame(f); this._frame(Math.min(0.05, this.clock.getDelta())); }; this.raf = requestAnimationFrame(f); }
  _frameOnce() { this._frame(0); }
  _frame(dt) {
    if (!this.renderer) return; this.t += dt;
    if (this.fly) {
      const k = Math.min(1, (performance.now() - this.fly.t0) / this.fly.dur), e = ease(k);
      this.controls.target.lerpVectors(this.fly.fromT, this.fly.toT, e); this.camera.position.lerpVectors(this.fly.fromP, this.fly.toP, e);
      if (k >= 1) this.fly = null;
    }
    this.controls.update();
    if (!this.reduced) {
      this.moon.mesh.rotation.y += dt * 0.02; this.mars.mesh.rotation.y += dt * 0.024; this.items.get('earth').mesh.rotation.y += dt * 0.04;
    }
    for (const it of this.items.values()) {
      if (it.kind !== 'artifact') continue;
      const model = it.anchor.children.find(c => c.userData.rotors || c.isGroup);
      if (it.orbit && !this.reduced) { it.orbit.angle += dt * it.orbit.speed; it.orbit.holder.position.set(Math.cos(it.orbit.angle) * it.orbit.r, 0, Math.sin(it.orbit.angle) * it.orbit.r); it.orbit.holder.rotation.y = -it.orbit.angle; }
      else if (it.orbit && it.orbit.holder.position.lengthSq() === 0) it.orbit.holder.position.set(Math.cos(it.orbit.angle) * it.orbit.r, 0, Math.sin(it.orbit.angle) * it.orbit.r);
      if (it.hover && !this.reduced) it.anchor.position.copy(it.base).addScaledVector(it.baseDir, 0.35 + Math.sin(this.t * 1.6) * 0.2);
      if (model) animateModel(model, this.reduced ? 0 : dt);
    }
    this._labels();
    this.renderer.render(this.scene, this.camera);
  }
  _labels() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight, v = new THREE.Vector3();
    for (const [id, it] of this.items) {
      const tag = this.tags.get(id); if (!tag) continue;
      it.anchor.getWorldPosition(v); v.y += it.tagY || 0; v.project(this.camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
      tag.style.display = vis ? '' : 'none';
      const hw = (tag.offsetWidth || 80) / 2 + 4, px = Math.max(hw, Math.min(w - hw, (v.x + 1) / 2 * w));
      tag.style.transform = `translate(-50%,${it.below ? '0' : '-100%'}) translate(${px.toFixed(1)}px,${((1 - v.y) / 2 * h).toFixed(1)}px)`;
    }
  }

  dispose() {
    this.stop(); document.removeEventListener('visibilitychange', this._vis); this.resizeObs?.disconnect();
    this.canvas.removeEventListener('pointerdown', this._pd); this.canvas.removeEventListener('pointerup', this._pu); this.canvas.removeEventListener('pointermove', this._pm);
    this.controls?.dispose();
    this.scene?.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(mm => { mm.map?.dispose?.(); mm.bumpMap?.dispose?.(); mm.dispose?.(); }); });
    this.tags.forEach(t => t.remove()); this.renderer?.dispose(); this.renderer?.forceContextLoss(); this.canvas?.remove();
  }
}

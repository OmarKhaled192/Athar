// ATHAR — procedural models & planet textures (no external assets).
// All models are simplified, educational illustrations — NOT NASA models and NOT to scale.
import * as THREE from 'three';

/* ---------- seamless 3D value noise (for sphere textures) ---------- */
function hash(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const sm = t => t * t * (3 - 2 * t);
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), fx), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), fx), fy),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), fx), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), fx), fy),
    fz);
}
function fbm(x, y, z, oct = 5) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
  return s;
}
function rng(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 1013904223 >>> 0) / 4294967295); }

function makeCraters(n, seed, minR, maxR) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const rad = minR + Math.pow(r(), 2.2) * (maxR - minR);
    out.push({ x: s * Math.cos(th), y: u, z: s * Math.sin(th), r: rad, cos: Math.cos(rad * 1.7) });
  }
  return out;
}
function craterHeight(x, y, z, craters) {
  let h = 0;
  for (const c of craters) {
    const d = x * c.x + y * c.y + z * c.z;
    if (d < c.cos) continue;
    const t = Math.acos(Math.min(1, d)) / c.r;
    if (t < 1) h -= (1 - t * t) * 0.55;
    h += 0.22 * Math.exp(-Math.pow((t - 1) * 3.6, 2));
  }
  return h;
}

/** Build colour + bump canvases for a world. kind: 'moon' | 'mars' | 'earth' */
export function buildPlanetTextures(kind, w = 512, h = 256) {
  const craters = kind === 'moon' ? makeCraters(110, 11, 0.025, 0.2)
    : kind === 'mars' ? makeCraters(40, 7, 0.02, 0.12) : [];
  const col = new ImageData(w, h), bmp = new ImageData(w, h);
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI, cl = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2 - Math.PI;
      const x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      const k = (j * w + i) * 4;
      let R, G, B, H = 0.5;
      if (kind === 'moon') {
        const base = 0.5 + (fbm(x * 6, y * 6, z * 6, 5) - 0.5) * 0.45;
        const maria = Math.max(0, fbm(x * 1.6 + 9, y * 1.6, z * 1.6, 3) - 0.52) * 3.2;
        const ch = craterHeight(x, y, z, craters);
        let v = base * (1 - Math.min(0.55, maria)) + ch * 0.22;
        v = Math.max(0.12, Math.min(0.95, v)) * 232;
        R = v; G = v * 0.99; B = v * 0.96; H = 0.5 + ch * 0.5 + (base - 0.5) * 0.3;
      } else if (kind === 'mars') {
        const n = fbm(x * 4, y * 4, z * 4, 6), big = fbm(x * 1.4 + 3, y * 1.4, z * 1.4, 4);
        const ch = craterHeight(x, y, z, craters);
        const dark = Math.max(0, big - 0.5) * 2.4;
        R = 188 - dark * 85 + (n - 0.5) * 70 + ch * 26;
        G = 98 - dark * 42 + (n - 0.5) * 44 + ch * 16;
        B = 62 - dark * 26 + (n - 0.5) * 30 + ch * 10;
        const cap = Math.abs(lat) - (1.32 + (vnoise(x * 8, y * 8, z * 8) - 0.5) * 0.12);
        if (cap > 0) { const t = Math.min(1, cap * 14); R += (238 - R) * t; G += (232 - G) * t; B += (230 - B) * t; }
        H = 0.5 + ch * 0.5 + (n - 0.5) * 0.6;
      } else { // earth
        const land = fbm(x * 1.7 + 5, y * 1.7, z * 1.7, 6);
        const sea = land < 0.5;
        if (sea) { const d = Math.min(1, (0.5 - land) * 4); R = 14 + (1 - d) * 24; G = 52 + (1 - d) * 70; B = 112 + (1 - d) * 70; }
        else {
          const dry = Math.abs(Math.sin(lat * 1.6)) * 0.5 + fbm(x * 5, y * 5, z * 5, 3) * 0.7;
          const t = Math.min(1, dry);
          R = 52 + t * 120; G = 112 + t * 40 - t * 20; B = 56 + t * 26;
        }
        const ice = Math.abs(lat) - 1.22; if (ice > 0) { const t = Math.min(1, ice * 8); R += (240 - R) * t; G += (246 - G) * t; B += (250 - B) * t; }
        const cl = Math.max(0, fbm(x * 3 + 20, y * 3, z * 3, 5) - 0.52) * 3.2; const c = Math.min(0.9, cl);
        R += (250 - R) * c; G += (252 - G) * c; B += (255 - B) * c;
        H = sea ? 0.5 : 0.5 + (land - 0.5) * 0.8;
      }
      col.data[k] = R; col.data[k + 1] = G; col.data[k + 2] = B; col.data[k + 3] = 255;
      const hv = Math.max(0, Math.min(1, H)) * 255;
      bmp.data[k] = bmp.data[k + 1] = bmp.data[k + 2] = hv; bmp.data[k + 3] = 255;
    }
  }
  const mk = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(img, 0, 0); return c; };
  const map = new THREE.CanvasTexture(mk(col)); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const bump = new THREE.CanvasTexture(mk(bmp));
  return { map, bump };
}

/** Soft nebula sky texture (equirect, drawn on inside of a big sphere). */
export function buildSkyTexture(w = 512, h = 256) {
  const img = new ImageData(w, h);
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI, cl = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2 - Math.PI, x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      const n = Math.max(0, fbm(x * 2.2, y * 2.2, z * 2.2, 5) - 0.42) * 1.9;
      const band = Math.exp(-Math.pow((y + 0.25 * Math.sin(lon * 1.3)) * 3.2, 2));
      const v = Math.min(1, n * (0.35 + band * 0.9));
      const k = (j * w + i) * 4;
      img.data[k] = 4 + v * 70; img.data[k + 1] = 9 + v * 62; img.data[k + 2] = 24 + v * 96; img.data[k + 3] = 255;
    }
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function atmosphere(radius, color, power = 2.6, strength = 1) {
  const m = new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(color) }, p: { value: power }, s: { value: strength } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 c; uniform float p; uniform float s; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-max(dot(vN,vV),0.0),p); gl_FragColor=vec4(c,f*s); }',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.07, 48, 32), m);
}

/* ---------- explorer models ---------- */
const M = {
  gold: () => new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.85, roughness: 0.38 }),
  goldDark: () => new THREE.MeshStandardMaterial({ color: 0x8a6a2b, metalness: 0.7, roughness: 0.5 }),
  white: () => new THREE.MeshStandardMaterial({ color: 0xe8edf6, metalness: 0.2, roughness: 0.55, side: THREE.DoubleSide }),
  metal: () => new THREE.MeshStandardMaterial({ color: 0xaab4c4, metalness: 0.8, roughness: 0.35 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x1b2330, metalness: 0.4, roughness: 0.6 }),
  solar: () => new THREE.MeshStandardMaterial({ color: 0x1d3f8f, metalness: 0.6, roughness: 0.3, emissive: 0x0a1e4a, emissiveIntensity: 0.6 }),
  glass: () => new THREE.MeshStandardMaterial({ color: 0x0b1020, metalness: 0.9, roughness: 0.15 })
};
const mesh = (g, m, pos = [0, 0, 0], rot = [0, 0, 0]) => { const o = new THREE.Mesh(g, m); o.position.set(...pos); o.rotation.set(...rot); return o; };
const cyl = (rt, rb, h, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);

function dish(r, depth = 0.5, mat = M.white()) {
  const a = Math.asin(Math.min(0.99, 0.5 / depth * 1.0)) || 0.9; // cap angle
  const g = new THREE.SphereGeometry(r / Math.sin(a), 32, 8, 0, Math.PI * 2, 0, a);
  g.translate(0, -r / Math.sin(a) * Math.cos(a), 0);   // rim at origin, bowl below (-Y)
  const m = new THREE.Mesh(g, mat); return m;          // opens toward +Y
}

function fit(group, radius = 1) {
  const b = new THREE.Box3().setFromObject(group), s = b.getBoundingSphere(new THREE.Sphere());
  const k = radius / s.radius; group.scale.setScalar(k);
  group.position.sub(s.center.multiplyScalar(k));
  const wrap = new THREE.Group(); wrap.add(group); return wrap;
}

function pioneer() {
  const g = new THREE.Group();
  const d = dish(1.0, 0.45); d.rotation.x = Math.PI / 2; d.position.z = 0.05; g.add(d);           // opens toward +Z
  g.add(mesh(cyl(0.3, 0.3, 0.3, 6), M.goldDark(), [0, 0, -0.18], [Math.PI / 2, 0, 0]));          // hexagonal bus
  g.add(mesh(cyl(0.025, 0.025, 0.95), M.metal(), [0, 0, 0.5], [Math.PI / 2, 0, 0]));            // feed boom
  g.add(mesh(new THREE.SphereGeometry(0.07, 12, 8), M.gold(), [0, 0, 0.98]));
  for (const sx of [-1, 1]) {                                                                     // RTG booms
    g.add(mesh(cyl(0.02, 0.02, 1.5), M.metal(), [sx * 0.95, 0, -0.2], [0, 0, Math.PI / 2]));
    for (const o of [0.7, 1.1]) g.add(mesh(cyl(0.09, 0.09, 0.42), M.dark(), [sx * (0.35 + o) * 1.0 + sx * 0.1, 0, -0.2], [0, 0, Math.PI / 2]));
  }
  g.add(mesh(cyl(0.012, 0.012, 1.3), M.metal(), [0, -0.65, -0.3]));                              // magnetometer boom
  return fit(g, 1);
}

function opportunity() {
  const g = new THREE.Group();
  g.add(mesh(box(0.9, 0.3, 0.7), M.goldDark(), [0, 0.35, 0]));                                    // warm electronics box
  g.add(mesh(box(1.05, 0.04, 0.85), M.solar(), [0, 0.54, 0]));                                    // deck solar panels
  for (const sx of [-1, 1]) {
    g.add(mesh(box(0.05, 0.06, 1.0), M.metal(), [sx * 0.42, 0.22, 0], [0, 0, 0]));              // rocker
    for (const z of [-0.46, 0, 0.46]) g.add(mesh(cyl(0.17, 0.17, 0.12, 20), M.dark(), [sx * 0.52, 0.04 + 0.0, z], [0, 0, Math.PI / 2]));
  }
  g.add(mesh(cyl(0.025, 0.025, 0.55), M.metal(), [-0.3, 0.82, -0.25]));                            // mast
  g.add(mesh(box(0.22, 0.09, 0.09), M.glass(), [-0.3, 1.1, -0.25]));                             // camera head
  const hga = dish(0.14, 0.4, M.white()); hga.position.set(0.3, 0.72, 0.28); hga.rotation.x = -0.5; g.add(hga);
  g.add(mesh(cyl(0.015, 0.015, 0.22), M.metal(), [0.3, 0.6, 0.28]));
  return fit(g, 1);
}

function ingenuity() {
  const g = new THREE.Group(); const rot = new THREE.Group(); rot.name = 'rotors';
  g.add(mesh(box(0.32, 0.3, 0.32), M.gold(), [0, 0.2, 0]));                                       // fuselage
  g.add(mesh(cyl(0.025, 0.025, 0.8), M.metal(), [0, 0.75, 0]));                                    // mast
  g.add(mesh(box(0.9, 0.025, 0.55), M.solar(), [0, 1.18, 0]));                                    // solar panel
  const r1 = new THREE.Group(), r2 = new THREE.Group();
  for (const a of [0, Math.PI]) {
    r1.add(mesh(box(0.62, 0.012, 0.07), M.dark(), [Math.cos(a) * 0.31, 0, Math.sin(a) * 0.31], [0, -a, 0]));
    r2.add(mesh(box(0.62, 0.012, 0.07), M.dark(), [Math.cos(a) * 0.31, 0, Math.sin(a) * 0.31], [0, -a, 0]));
  }
  r1.position.y = 0.98; r2.position.y = 1.04; r1.userData.spin = 1; r2.userData.spin = -1;
  rot.add(r1, r2); g.add(rot);
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {                                   // legs
    const l = mesh(cyl(0.012, 0.012, 0.62), M.metal(), [x * 0.2, -0.05, z * 0.2], [z * 0.38, 0, -x * 0.38]); g.add(l);
  }
  const w = fit(g, 1); w.userData.rotors = [r1, r2]; return w;
}

function eagle() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.62, 0.62, 0.78, 8), M.gold(), [0, 0, 0]));                                      // cabin (octagonal-ish)
  g.add(mesh(cyl(0.64, 0.64, 0.06, 8), M.metal(), [0, 0.42, 0]));
  g.add(mesh(cyl(0.2, 0.24, 0.26, 12), M.metal(), [0, 0.58, 0]));                                  // docking tunnel
  g.add(mesh(cyl(0.2, 0.46, 0.34, 14), M.dark(), [0, -0.56, 0]));                                  // engine cover/bell
  for (const sx of [-1, 1]) g.add(mesh(box(0.2, 0.2, 0.03), M.glass(), [sx * 0.22, 0.12, 0.6], [0.35, sx * 0.25, 0])); // windows
  for (let i = 0; i < 4; i++) {                                                                    // RCS quads
    const a = Math.PI / 4 + i * Math.PI / 2;
    g.add(mesh(box(0.1, 0.22, 0.1), M.metal(), [Math.cos(a) * 0.74, -0.08, Math.sin(a) * 0.74], [0, -a, 0]));
  }
  g.add(mesh(cyl(0.015, 0.015, 0.55), M.metal(), [0.45, 0.78, -0.2], [0, 0, -0.25]));
  const ant = dish(0.22, 0.4, M.white()); ant.position.set(0.55, 1.05, -0.2); ant.rotation.set(0.3, 0, -0.5); g.add(ant);
  const rad = dish(0.1, 0.4, M.white()); rad.position.set(-0.3, 0.72, 0.2); rad.rotation.set(0.4, 0, 0.2); g.add(rad);
  return fit(g, 1);
}

const BUILDERS = { 'pioneer-10': pioneer, opportunity, ingenuity, eagle };
export function buildModel(id) { return (BUILDERS[id] || eagle)(); }

/** Per-frame model animation (e.g., Ingenuity rotors). */
export function animateModel(model, dt) {
  if (model.userData.rotors) for (const r of model.userData.rotors) r.rotation.y += dt * 38 * r.userData.spin;
}

/** Small reusable preview renderer (one WebGL context, moved between containers). */
export class Preview {
  constructor(reduced) {
    this.reduced = reduced;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.domElement.className = 'preview-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50); this.camera.position.set(0, 0.5, 4.4);
    this.scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x2a1a14, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x5eead4, 1.6); rim.position.set(-4, 1, -3); this.scene.add(rim);
    this.pivot = new THREE.Group(); this.scene.add(this.pivot);
    this.model = null; this.raf = 0; this.drag = null; this.yaw = 0.6; this.last = 0; this.el = null; this.ro = null;
    const c = this.renderer.domElement;
    c.addEventListener('pointerdown', e => { this.drag = e.clientX; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', e => { if (this.drag != null) { this.yaw += (e.clientX - this.drag) * 0.012; this.drag = e.clientX; this.renderOnce(); } });
    const up = () => { this.drag = null; }; c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    this._tick = this._tick.bind(this);
  }
  attach(el, id) {
    this.detach(); this.el = el;
    if (this.model) { this.pivot.remove(this.model); }
    this.model = buildModel(id); this.pivot.add(this.model);
    this.model.rotation.x = id === 'eagle' || id === 'ingenuity' ? 0.18 : 0.28;
    el.appendChild(this.renderer.domElement);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el); this.resize();
    if (this.reduced) this.renderOnce(); else { this.last = performance.now(); this.raf = requestAnimationFrame(this._tick); }
  }
  detach() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    if (this.ro) { this.ro.disconnect(); this.ro = null; }
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    this.el = null;
  }
  resize() {
    if (!this.el) return; const w = this.el.clientWidth || 300, h = this.el.clientHeight || 240;
    this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderOnce();
  }
  renderOnce() { if (!this.model) return; this.model.rotation.y = this.yaw; animateModel(this.model, 0); this.renderer.render(this.scene, this.camera); }
  _tick(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    if (this.drag == null) this.yaw += dt * 0.5;
    animateModel(this.model, dt); this.model.rotation.y = this.yaw;
    this.renderer.render(this.scene, this.camera); this.raf = requestAnimationFrame(this._tick);
  }
  dispose() { this.detach(); this.renderer.dispose(); this.renderer.forceContextLoss(); }
}

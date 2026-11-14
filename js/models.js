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
  const panel = new THREE.MeshStandardMaterial({ color: 0xe8d4ae, metalness: .24, roughness: .48, flatShading: true });
  const panelLight = new THREE.MeshStandardMaterial({ color: 0xf5e8ce, metalness: .16, roughness: .52, flatShading: true });
  const foil = new THREE.MeshStandardMaterial({ color: 0xb66b2e, metalness: .56, roughness: .36, flatShading: true });
  const foilBright = new THREE.MeshStandardMaterial({ color: 0xe09b43, metalness: .48, roughness: .38 });
  const charcoal = new THREE.MeshStandardMaterial({ color: 0x292b34, metalness: .52, roughness: .42 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a04c, metalness: .58, roughness: .34 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xaeb5bd, metalness: .78, roughness: .28 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x17243a, metalness: .46, roughness: .16 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x131d30, metalness: .28, roughness: .14 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd991, emissive: 0xffa82f, emissiveIntensity: .18, roughness: .24 });
  const add = (geom, material, pos=[0,0,0], rot=[0,0,0]) => { const o=mesh(geom,material,pos,rot); g.add(o); return o; };
  const ball = (r,material,pos,scale=[1,1,1]) => { const o=add(new THREE.SphereGeometry(r,16,10),material,pos); o.scale.set(...scale); return o; };
  const strut = (a,b,r,material) => { const p=new THREE.Vector3(...a), q=new THREE.Vector3(...b), d=q.clone().sub(p); const o=add(new THREE.CylinderGeometry(r*.8,r,d.length(),10)); o.position.copy(p).add(q).multiplyScalar(.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); return o; };

  // Gold-foil descent section and its angular ascent cabin.
  add(new THREE.CylinderGeometry(.59,.72,.62,8),foil,[0,.05,0]);
  add(new THREE.CylinderGeometry(.72,.72,.08,8),charcoal,[0,-.3,0]);
  add(new THREE.CylinderGeometry(.63,.82,.84,6),panel,[0,.82,0],[0,Math.PI/6,0]);
  add(new THREE.CylinderGeometry(.66,.66,.1,8),gold,[0,1.27,0]);
  // Broad front hatch, windows, and a friendly face on the front cabin panel.
  add(new THREE.BoxGeometry(.76,.53,.055),panelLight,[0,.87,.66]);
  add(new THREE.BoxGeometry(.55,.3,.035),glass,[0,.96,.703]);
  for(const x of [-.18,.18]) { ball(.09,steel,[x,1.0,.738],[1,1,.42]); ball(.054,eye,[x,1.0,.766],[1,1,.45]); ball(.021,glow,[x-.02,1.025,.781],[1,1,.45]); }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.08,.82,.75),new THREE.Vector3(0,.79,.77),new THREE.Vector3(.08,.82,.75)]),12,.012,7,false),charcoal);
  // Faceted side insulation panels and small corner hardware.
  for(let i=0;i<6;i++) {
    const a=i*Math.PI/3+Math.PI/6, x=Math.cos(a)*.7, z=Math.sin(a)*.7;
    add(new THREE.BoxGeometry(.34,.55,.035),i%2?charcoal:panelLight,[x,.82,z],[0,-a,0]);
    ball(.045,gold,[Math.cos(a)*.84,.72,Math.sin(a)*.84]);
  }
  // Shimmering foil facets beneath the crew cabin.
  for(let i=0;i<8;i++) { const a=i*Math.PI/4; add(new THREE.BoxGeometry(.28,.42,.035),i%2?foilBright:foil,[Math.cos(a)*.63,-.02,Math.sin(a)*.63],[0,-a,0]); }
  // Four long landing struts, cross-braces, and round footpads.
  for(let i=0;i<4;i++) {
    const a=Math.PI/4+i*Math.PI/2, sx=Math.cos(a), sz=Math.sin(a);
    const top=[sx*.48,-.14,sz*.48], knee=[sx*.85,-.68,sz*.85], foot=[sx*1.2,-1.27,sz*1.2];
    strut(top,knee,.085,charcoal); ball(.1,gold,knee); strut(knee,foot,.062,foilBright);
    strut([sx*.55,-.35,sz*.55],[sx*1.03,-.35,sz*1.03],.035,steel);
    add(new THREE.CylinderGeometry(.22,.25,.07,16),gold,[foot[0],foot[1]-.05,foot[2]]);
    add(new THREE.CylinderGeometry(.16,.18,.035,16),charcoal,[foot[0],foot[1]-.095,foot[2]]);
  }
  // Ascent engine bell, docking tunnel, antennas, and small dish antennas.
  add(new THREE.CylinderGeometry(.25,.43,.38,12),charcoal,[0,-.55,0]);
  add(new THREE.CylinderGeometry(.22,.22,.32,12),steel,[0,1.47,0]);
  add(new THREE.CylinderGeometry(.055,.08,.25,10),gold,[0,1.73,0]);
  for(const sx of [-1,1]) {
    strut([sx*.34,1.3,-.16],[sx*.56,1.72,-.2],.035,steel);
    const dishPart=dish(.16,.34,panelLight); dishPart.position.set(sx*.58,1.78,-.2); dishPart.rotation.set(.35,0,-sx*.35); g.add(dishPart);
    add(new THREE.BoxGeometry(.16,.22,.14),charcoal,[sx*.72,.54,0],[0,0,sx*.2]);
  }
  add(new THREE.CylinderGeometry(.018,.018,.46,8),steel,[.36,1.55,.2],[0,0,-.18]);
  ball(.035,foilBright,[.4,1.79,.2]);
  return fit(g, 1);
}

const BUILDERS = { 'pioneer-10': characterPioneer, opportunity: characterOpportunity, ingenuity: characterIngenuity, eagle };
export function buildModel(id) { return (BUILDERS[id] || eagle)(); }

/* Character illustration shared by the story, record, and garden renderers. */
function characterIngenuity() {
  const g = new THREE.Group();
  const mat = (color, metalness = 0.16, roughness = 0.48, emissive = 0) => new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: emissive ? 0.16 : 0 });
  const shell = mat(0xe9a24c, 0.34, 0.36), shellLight = mat(0xffc26b, 0.22, 0.42);
  const blue = mat(0x37658e, 0.34, 0.25), glass = mat(0x17314a, 0.18, 0.2);
  const dark = mat(0x20283a, 0.38, 0.46), rubber = mat(0x151b28, 0.08, 0.7);
  const metal = mat(0xb9cad2, 0.72, 0.28), teal = mat(0x42b6a5, 0.25, 0.36);
  const ivory = mat(0xffe5a8, 0.08, 0.28, 0xffb742), orange = mat(0xf07837, 0.18, 0.4);
  const cellMats = [mat(0x183459,0.35,0.32),mat(0x244976,0.35,0.32),mat(0xe89a38,0.25,0.38),mat(0x263b5c,0.35,0.32)];
  const add = (geom, material, pos = [0,0,0], rot = [0,0,0], parent = g) => { const o = new THREE.Mesh(geom, material); o.position.set(...pos); o.rotation.set(...rot); parent.add(o); return o; };
  const block = (w,h,d,r,bevel) => {
    const s = new THREE.Shape();
    s.moveTo(-w/2+r,-h/2); s.lineTo(w/2-r,-h/2); s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
    s.lineTo(w/2,h/2-r); s.quadraticCurveTo(w/2,h/2,w/2-r,h/2); s.lineTo(-w/2+r,h/2);
    s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r); s.lineTo(-w/2,-h/2+r); s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    const depth = Math.max(0.04,d-bevel*2);
    const geom = new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:5});
    geom.translate(0,0,-depth/2); return geom;
  };
  const ball = (radius, material, pos, scale = [1,1,1], parent = g) => { const o = add(new THREE.SphereGeometry(radius,18,12),material,pos,[0,0,0],parent); o.scale.set(...scale); return o; };
  const segment = (a,b,radius,material,parent=g) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = new THREE.Vector3().subVectors(end,start);
    const o = add(new THREE.CylinderGeometry(radius*0.76,radius,delta.length(),12),material,[0,0,0],[0,0,0],parent);
    o.position.copy(start).add(end).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); return o;
  };
  const tube = (points,radius,material,parent=g) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    return add(new THREE.TubeGeometry(curve,24,radius,8,false),material,[0,0,0],[0,0,0],parent);
  };

  // Rounded, friendly body and dark blue face screen.
  add(block(.88,.64,.58,.13,.045),shell,[0,.02,0]);
  add(block(.74,.49,.045,.105,.014),blue,[0,.055,.315]);
  add(block(.64,.39,.025,.082,.01),glass,[0,.06,.344]);
  ball(.052,ivory,[-.145,.115,.37],[1,1.12,.65]); ball(.052,ivory,[.145,.115,.37],[1,1.12,.65]);
  ball(.018,mat(0xffffff,0,0.18),[-.16,.136,.383],[1,1,.6]); ball(.018,mat(0xffffff,0,0.18),[.13,.136,.383],[1,1,.6]);
  const smile = new THREE.CatmullRomCurve3([new THREE.Vector3(-.095,-.045,.375),new THREE.Vector3(0,-.095,.38),new THREE.Vector3(.095,-.045,.375)]);
  add(new THREE.TubeGeometry(smile,18,.012,8,false),ivory);
  // Tiny status lights and cheeks give the face the illustrated expression.
  for (const [x,c] of [[-.24,0x57e5bc],[-.08,0xf6c65d],[.08,0xff785f],[.24,0x67d8c4]]) ball(.028,mat(c,0.1,0.25,c),[x,.36,.31]);
  ball(.045,orange,[-.45,.01,.02],[.65,.8,.65]); ball(.045,orange,[.45,.01,.02],[.65,.8,.65]);
  // Solar array with individual blue and amber photovoltaic cells.
  add(new THREE.BoxGeometry(1.08,.075,.68),dark,[0,.57,0]);
  add(new THREE.BoxGeometry(1.0,.018,.60),metal,[0,.618,0]);
  for(let row=0;row<3;row++) for(let col=0;col<6;col++) {
    const x=-.415+col*.166, z=-.24+row*.16, color=cellMats[(row*5+col*3)%cellMats.length];
    add(new THREE.BoxGeometry(.151,.012,.145),color,[x,.634,z]);
  }
  // Coaxial rotors, orange blade tips, mast collars and antenna cap.
  segment([0,.34,0],[0,.61,0],.04,metal);
  segment([0,.61,0],[0,1.31,0],.038,metal);
  add(new THREE.CylinderGeometry(.105,.11,.08,16),orange,[0,.77,0]);
  const rotorStack = new THREE.Group(); g.add(rotorStack);
  const rotors=[];
  for (let i=0;i<2;i++) {
    const rotor = new THREE.Group(); rotor.position.y=1.22+i*.105; rotor.rotation.y=i*.08; rotor.userData.spin=i===0?1:-1; rotorStack.add(rotor); rotors.push(rotor);
    add(new THREE.CylinderGeometry(.075,.075,.065,16),metal,[0,0,0],[0,0,0],rotor);
    add(new THREE.BoxGeometry(2.15,.045,.105),dark,[0,.018,0],[0,0,0],rotor);
    for(const x of [-.96,.96]) add(new THREE.BoxGeometry(.22,.05,.12),orange,[x,.021,0],[0,0,0],rotor);
    add(new THREE.BoxGeometry(2.04,.012,.035),mat(0x38445a,.15,.5),[0,.044,0],[0,0,0],rotor);
  }
  g.userData.rotors=rotors;
  // Four splayed landing legs with orange joints and broad feet.
  for(const sx of [-1,1]) for(const sz of [-1,1]) {
    const knee=[sx*.48,-.34,sz*.25], shoulder=[sx*.34,-.17,sz*.19], foot=[sx*.68,-.75,sz*.38];
    ball(.105,shellLight,shoulder,[1,.8,1]);
    segment(shoulder,knee,.055,orange); ball(.09,metal,knee,[1,1,1]);
    segment(knee,foot,.045,dark); segment([foot[0],foot[1]+.03,foot[2]],[foot[0],foot[1]-.035,foot[2]],.072,orange);
    ball(.12,rubber,[foot[0],-.79,foot[2]],[1.35,.42,.9]);
  }
  // Visible cable loops on the sides, a small camera cheek, and antenna details.
  for(const sx of [-1,1]) {
    tube([[sx*.4,.2,.08],[sx*.55,.2,.02],[sx*.59,.04,-.03],[sx*.5,-.08,-.08]],.025,teal);
    ball(.06,orange,[sx*.45,.18,.05],[.8,1,1]);
  }
  segment([-.28,.32,-.18],[-.36,.48,-.21],.018,metal);
  ball(.035,orange,[-.36,.49,-.21]);
  return g;
}

/* Friendly Opportunity rover illustration shared by the story, record, and garden. */
function characterOpportunity() {
  const g = new THREE.Group();
  const mat = (color, metalness = .18, roughness = .46) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const gold = mat(0xc9782e,.32,.42), goldLight = mat(0xf0a447,.24,.4), goldDark = mat(0x754321,.3,.5);
  const blue = mat(0x172b52,.42,.3), blueCell = [mat(0x18375c,.4,.3),mat(0x244c78,.4,.3),mat(0x101f3d,.4,.3)];
  const metal = mat(0x9ba8b6,.72,.3), dark = mat(0x252a35,.45,.42), rubber = mat(0x302b2a,.06,.76), glass = mat(0x18263a,.25,.18);
  const ivory = mat(0xffd993,.1,.3), red = mat(0xe85b47,.18,.35), teal = mat(0x4cc7b1,.22,.34);
  const add = (geom, material, pos=[0,0,0], rot=[0,0,0], parent=g) => { const o=new THREE.Mesh(geom,material); o.position.set(...pos); o.rotation.set(...rot); parent.add(o); return o; };
  const ball = (radius,material,pos,scale=[1,1,1]) => { const o=add(new THREE.SphereGeometry(radius,18,12),material,pos); o.scale.set(...scale); return o; };
  const segment = (a,b,radius,material,parent=g) => { const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b), delta=new THREE.Vector3().subVectors(end,start); const o=add(new THREE.CylinderGeometry(radius*.78,radius,delta.length(),12),material,[0,0,0],[0,0,0],parent); o.position.copy(start).add(end).multiplyScalar(.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); return o; };

  // Warm, faceted rover body with a broad dark-blue photovoltaic deck.
  add(new THREE.BoxGeometry(1.45,.5,1.02),gold,[0,.43,0]);
  add(new THREE.BoxGeometry(1.34,.12,.94),goldLight,[0,.72,0]);
  add(new THREE.BoxGeometry(1.28,.055,.88),blue,[0,.81,0]);
  // Fold-out solar wings on both sides, tiled into visible cells.
  for(const sx of [-1,1]) {
    add(new THREE.BoxGeometry(.8,.075,.96),blue,[sx*1.04,.77,0],[0,0,sx*.035]);
    for(let row=0;row<3;row++) for(let col=0;col<3;col++) add(new THREE.BoxGeometry(.23,.018,.27),blueCell[(row+col)%blueCell.length],[sx*(.76+col*.27),.82,-.31+row*.31]);
    add(new THREE.BoxGeometry(.025,.1,1.0),metal,[sx*.65,.79,0]);
  }
  // Six chunky wheels, inner hubs, and raised tread blocks.
  const wheelZ=[-.78,0,.78];
  for(const sx of [-1,1]) for(const z of wheelZ) {
    const wheel=add(new THREE.CylinderGeometry(.28,.28,.19,24),rubber,[sx*.88,.02,z],[0,0,Math.PI/2]);
    add(new THREE.CylinderGeometry(.17,.17,.205,20),dark,[sx*.88,.02,z],[0,0,Math.PI/2]);
    add(new THREE.CylinderGeometry(.105,.105,.218,16),metal,[sx*.88,.02,z],[0,0,Math.PI/2]);
    add(new THREE.CylinderGeometry(.055,.055,.23,12),goldDark,[sx*.88,.02,z],[0,0,Math.PI/2]);
    for(let i=0;i<12;i++) { const a=i*Math.PI/6; add(new THREE.BoxGeometry(.09,.075,.22),dark,[sx*.88,.02+Math.cos(a)*.255,z+Math.sin(a)*.255],[a,0,0]); }
  }
  // Visible rocker-bogie suspension links on each flank.
  for(const sx of [-1,1]) {
    segment([sx*.48,.37,-.05],[sx*.9,.25,-.78],.075,dark);
    segment([sx*.48,.37,-.05],[sx*.9,.2,.78],.075,dark);
    segment([sx*.9,.25,-.78],[sx*.9,.2,.78],.055,metal);
    ball(.12,metal,[sx*.48,.37,-.05]);
  }
  // Mast with two friendly camera eyes and colored instrument housings.
  segment([-.12,.76,.05],[-.12,1.45,.05],.075,metal);
  add(new THREE.BoxGeometry(.7,.42,.28),goldLight,[-.12,1.63,.05]);
  add(new THREE.BoxGeometry(.73,.16,.31),goldDark,[-.12,1.86,.05]);
  for(const x of [-.32,.08]) {
    ball(.145,dark,[x,1.62,.205],[1,1,.5]); ball(.105,glass,[x,1.62,.255],[1,1,.45]);
    ball(.052,metal,[x,1.62,.282],[1,1,.55]); ball(.025,ivory,[x,1.62,.305],[1,1,.5]);
  }
  // Tiny colored status lenses across the top bar.
  for(const [x,c] of [[-.38,red],[-.12,teal],[.17,mat(0xf4c64e,.18,.3)]]) ball(.052,c,[x,1.86,.22],[1,.8,.6]);
  // High-gain dish, antenna, and colorful instrument cluster beside the mast.
  const dish=new THREE.Group(); g.add(dish); dish.position.set(.57,1.12,-.28); dish.rotation.x=-.52;
  add(new THREE.SphereGeometry(.42,24,12,0,Math.PI*2,0,1.15),mat(0xd4b58b,.35,.4),[0,0,0],[0,0,0],dish);
  add(new THREE.SphereGeometry(.35,24,10,0,Math.PI*2,0,1.1),mat(0xe6cfaa,.22,.42),[0,.045,.025],[0,0,0],dish);
  segment([0,.06,.06],[.16,.22,.2],.025,metal,dish);
  segment([.43,.78,-.2],[.43,1.43,-.2],.025,metal); ball(.045,red,[.43,1.45,-.2]);
  add(new THREE.BoxGeometry(.22,.35,.2),teal,[.58,.91,.08]);
  for(let i=0;i<3;i++) ball(.035,[red,ivory,teal][i],[.58,.98-i*.09,.19]);
  // Small articulated sampling arm with a two-prong gripper.
  segment([.58,.39,.48],[.92,.28,.62],.055,metal); ball(.085,teal,[.92,.28,.62]);
  segment([.92,.28,.62],[1.2,.18,.48],.045,goldLight); ball(.075,metal,[1.2,.18,.48]);
  segment([1.2,.18,.48],[1.34,.12,.36],.035,teal);
  segment([1.34,.12,.36],[1.5,.14,.32],.022,dark); segment([1.34,.12,.36],[1.45,.03,.48],.022,dark);
  // Compact front bumper and a warm smile mark make the rover read as a character.
  add(new THREE.BoxGeometry(.58,.08,.08),metal,[0,.36,.54]);
  const smile=new THREE.CatmullRomCurve3([new THREE.Vector3(-.075,.5,.525),new THREE.Vector3(0,.46,.53),new THREE.Vector3(.075,.5,.525)]);
  add(new THREE.TubeGeometry(smile,14,.012,8,false),ivory);
  g.position.y=.14; g.rotation.y=-.3;
  return g;
}

/* Character-style Pioneer 10, borrowing the friendly communication-dish
   silhouette in the supplied Voyager reference while retaining Pioneer details. */
function characterPioneer() {
  const g=new THREE.Group();
  const mat=(color,metalness=.28,roughness=.42)=>new THREE.MeshStandardMaterial({color,metalness,roughness,side:THREE.DoubleSide});
  const gold=mat(0xd59b45,.55,.34), goldLight=mat(0xf0c273,.38,.35), copper=mat(0x96542f,.48,.38);
  const cream=mat(0xf0e4c9,.12,.5), dark=mat(0x222839,.42,.4), metal=mat(0xb2bcc9,.72,.3), blue=mat(0x253b63,.4,.3);
  const glow=mat(0xffd98b,.12,.24), lens=mat(0x18263d,.5,.16), red=mat(0xe75e4d,.22,.32), teal=mat(0x56c8b3,.22,.35);
  const add=(geom,material,pos=[0,0,0],rot=[0,0,0],parent=g)=>{const o=new THREE.Mesh(geom,material);o.position.set(...pos);o.rotation.set(...rot);parent.add(o);return o;};
  const ball=(r,material,pos,scale=[1,1,1])=>{const o=add(new THREE.SphereGeometry(r,18,12),material,pos);o.scale.set(...scale);return o;};
  const rod=(a,b,r,material,parent=g)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);const o=add(new THREE.CylinderGeometry(r*.8,r,d.length(),12),material,[0,0,0],[0,0,0],parent);o.position.copy(p).add(q).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;};

  // Compact instrument bus and dark-blue equipment band behind the dish.
  add(new THREE.CylinderGeometry(.42,.5,.72,10),gold,[0,.13,-.35],[0,0,0]);
  add(new THREE.CylinderGeometry(.48,.48,.12,10),blue,[0,.1,-.35],[0,0,0]);
  add(new THREE.BoxGeometry(.56,.42,.46),goldLight,[0,.23,-.84]);
  for(const [x,c] of [[-.19,red],[0,teal],[.19,glow]]) ball(.055,c,[x,.3,-.595],[1,1,.55]);
  // Large parabolic communication dish faces forward; spokes converge at the feed.
  const reflector=new THREE.Group();g.add(reflector);reflector.position.set(0,.35,.14);reflector.rotation.x=-Math.PI/2;
  add(new THREE.SphereGeometry(.94,32,20,0,Math.PI*2,0,Math.PI/2),goldLight,[0,0,0],[0,0,0],reflector);
  add(new THREE.TorusGeometry(.94,.045,10,48),copper,[0,0,0],[0,0,0],reflector);
  const feed=new THREE.Group();g.add(feed);feed.position.set(0,.35,.18);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;rod([Math.cos(a)*.12,.0,0],[Math.cos(a)*.78,.0,.12],.018,copper,feed);}
  rod([0,0,.04],[0,0,.26],.045,metal,feed);
  ball(.13,copper,[0,.35,.45],[1,1,.7]);ball(.065,goldLight,[0,.35,.5],[1,1,.55]);
  // Bright curious eyes and a small smile sit inside the reflector like the reference.
  for(const x of [-.3,.3]){ball(.19,cream,[x,.48,.19],[1,1,.46]);ball(.13,dark,[x,.48,.265],[1,1,.42]);ball(.085,lens,[x,.48,.31],[1,1,.4]);ball(.031,glow,[x-.025,.515,.34],[1,1,.45]);}
  const smile=new THREE.CatmullRomCurve3([new THREE.Vector3(-.13,.12,.205),new THREE.Vector3(0,.075,.22),new THREE.Vector3(.13,.12,.205)]);
  add(new THREE.TubeGeometry(smile,16,.018,8,false),copper);
  // Mast and small instrument cluster above the bus.
  rod([0,.52,-.45],[0,1.24,-.45],.055,metal);
  add(new THREE.BoxGeometry(.42,.24,.25),goldLight,[0,1.32,-.45]);
  for(const x of [-.12,.12]){ball(.07,lens,[x,1.33,-.305],[1,1,.6]);ball(.027,glow,[x,1.33,-.265],[1,1,.55]);}
  rod([.28,.55,-.52],[.5,.9,-.52],.022,metal);ball(.055,red,[.5,.92,-.52]);
  // Three long antenna booms / tripod supports with articulated joints and feet.
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3+Math.PI/2, start=[Math.cos(a)*.28,-.15,-.35+Math.sin(a)*.28], knee=[Math.cos(a)*.78,-.78,-.35+Math.sin(a)*.78], foot=[Math.cos(a)*1.22,-1.35,-.35+Math.sin(a)*1.22];
    rod(start,knee,.055,dark);ball(.105,goldLight,knee);rod(knee,foot,.04,copper);
    add(new THREE.BoxGeometry(.23,.13,.18),blue,foot);add(new THREE.BoxGeometry(.16,.035,.12),metal,[foot[0],foot[1]-.08,foot[2]]);
  }
  // RTG power boom and two compact generator capsules.
  rod([.38,.15,-.45],[1.03,.3,-.48],.045,metal);ball(.085,teal,[1.03,.3,-.48]);
  rod([1.03,.3,-.48],[1.63,.3,-.48],.035,goldLight);
  for(const x of [1.35,1.62]){
    add(new THREE.CylinderGeometry(.12,.12,.3,12),copper,[x,.3,-.48],[0,0,Math.PI/2]);
    add(new THREE.CylinderGeometry(.13,.13,.045,12),goldLight,[x-.12,.3,-.48],[0,0,Math.PI/2]);
    add(new THREE.CylinderGeometry(.13,.13,.045,12),goldLight,[x+.12,.3,-.48],[0,0,Math.PI/2]);
  }
  // Thin magnetometer boom and a tiny engraved-record medallion on the bus.
  rod([-.3,.06,-.48],[-1.58,-.45,-.48],.025,metal);
  add(new THREE.BoxGeometry(.22,.18,.17),blue,[-1.62,-.48,-.48]);ball(.075,goldLight,[-.15,.18,-.58],[1,1,.22]);
  for(let i=0;i<3;i++)add(new THREE.TorusGeometry(.028+i*.02,.006,6,24),copper,[-.15,.18,-.53-i*.002]);
  g.rotation.y=-.32;
  return g;
}

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
    // Keep the established 3D garden models unchanged. The story and record
    // Preview and garden share the same character-style Pioneer and Mars rovers.
    this.model = buildModel(id);
    if (id === 'opportunity') this.model.scale.setScalar(0.68);
    if (id === 'ingenuity') { this.model.scale.setScalar(0.76); this.model.position.y = 0.3; }
    if (id === 'pioneer-10') this.model.scale.setScalar(0.62);
    this.pivot.add(this.model);
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

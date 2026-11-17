// All character / weapon / boss geometry. Characters are built from primitives,
// vertex-coloured and merged into one mesh each so a whole army is a few draw calls.
// Budget: ~1500 vertices per body, <=150 per leg (bodies are drawn 150-300x instanced).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Cartoon rim light injected into Lambert materials: one pow() per pixel, no extra passes.
export function addRim(mat, strength = 0.42) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
      `outgoingLight += mix(diffuseColor.rgb, vec3(1.0), 0.55) * ${strength.toFixed(2)} * pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 2.6);
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'rim' + strength.toFixed(2);
  return mat;
}

export function tint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
// flat-shaded decor: non-indexed, position+normal(+color)
export function plain(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  return g;
}
function prep(geo, hex) {
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  return tint(geo, hex);
}
// "glow": vertex colour pushed above 1 so the part stays bright/saturated even on the shaded side
function glow(geo, k = 1.7) {
  const a = geo.attributes.color.array;
  for (let i = 0; i < a.length; i++) a[i] *= k;
  return geo;
}
const shade = (hex, f) => new THREE.Color(hex).multiplyScalar(f).getHex();
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const Y_UP = new THREE.Vector3(0, 1, 0);
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export function rod(a, b, r0, r1, hex, seg = 8, open = false) {
  const A = V(a), Bv = V(b), d = Bv.clone().sub(A), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, open);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_UP, d.normalize()));
  g.translate((A.x + Bv.x) / 2, (A.y + Bv.y) / 2, (A.z + Bv.z) / 2);
  return prep(g, hex);
}
// limb segment: open-ended (caps are always hidden inside joints / hands)
const limb = (a, b, r0, r1, hex, seg = 7) => rod(a, b, r0, r1, hex, seg, true);
export function box(w, h, d, x, y, z, hex, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return prep(g, hex);
}
export function ball(r, x, y, z, hex, ws = 10, hs = 8, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.SphereGeometry(r, ws, hs); g.scale(sx, sy, sz); g.translate(x, y, z);
  return prep(g, hex);
}
export function dome(r, x, y, z, hex, ws = 14, hs = 7, sx = 1, sy = 1, sz = 1, cut = 0.52) {
  const g = new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI * cut); g.scale(sx, sy, sz); g.translate(x, y, z);
  return prep(g, hex);
}
export function cyl(rt, rb, h, x, y, z, hex, seg = 12, rx = 0, rz = 0, sz = 1, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); g.scale(1, 1, sz);
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return prep(g, hex);
}
export function cone(r, h, x, y, z, hex, rx = 0, rz = 0, seg = 8) {
  const g = new THREE.ConeGeometry(r, h, seg); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z);
  return prep(g, hex);
}
function torus(R, r, x, y, z, hex, rx = 0, ry = 0, rs = 6, ts = 16, arc = Math.PI * 2, rz = 0) {
  const g = new THREE.TorusGeometry(R, r, rs, ts, arc); if (rz) g.rotateZ(rz); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z);
  return prep(g, hex);
}
// mirror so the weapon sits in the character's right hand (camera looks along +z)
function mirrorX(g) {
  g.scale(-1, 1, 1);
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  return g;
}
const merge = (parts) => mergeGeometries(parts);

// ------------------------------------------------------------ shared body parts
export const SKIN = 0xf6c39b;
const EYE = 0x1a1a24, WHITE = 0xffffff;
const SH = [0.17, 0.81, 0], SHL = [-0.17, 0.81, 0];

// sculpted lathe torso: hips -> waist -> chest -> shoulders; below the belt it takes the trouser colour
const TORSO_PROFILE = [[0, 0.395], [0.09, 0.405], [0.142, 0.44], [0.156, 0.5], [0.15, 0.56], [0.16, 0.65], [0.172, 0.75],
  [0.162, 0.83], [0.118, 0.895], [0.05, 0.925], [0, 0.93]].map(([r, y]) => new THREE.Vector2(r, y));
function torso(col, sx = 1, sz = 0.8, low = null, s = 1) {
  const g = new THREE.LatheGeometry(TORSO_PROFILE, 12);
  g.scale(sx * s, 1, sz * s);
  prep(g, col);
  if (low !== null) {
    const c = new THREE.Color(low), p = g.attributes.position, a = g.attributes.color.array;
    for (let i = 0; i < p.count; i++) if (p.getY(i) <= 0.505) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  }
  return g;
}
// cartoon face: glossy eyes, brows, smile/frown, nose, ears
const HY = 0.955, HR = 0.135;
function head(o = {}) {
  const skin = o.skin ?? SKIN, eye = o.eye ?? EYE, er = o.eyeR ?? 0.022, ey = o.eyeY ?? 0.962, ex = o.eyeX ?? 0.047;
  const p = [ball(HR, 0, HY, 0, skin, 12, 9)];
  if (o.ears !== false) p.push(ball(0.032, -0.132, 0.945, 0, skin, 5, 4, 0.7, 1, 1), ball(0.032, 0.132, 0.945, 0, skin, 5, 4, 0.7, 1, 1));
  const ez = Math.sqrt(HR * HR - ex * ex - (ey - HY) ** 2) - 0.006;
  p.push(ball(er, -ex, ey, ez, eye, 6, 4, 0.85, 1.2, 0.6), ball(er, ex, ey, ez, eye, 6, 4, 0.85, 1.2, 0.6));
  if (o.shine !== false) {
    const hc = o.shineCol ?? WHITE, hs = er * 0.4;
    p.push(ball(hs, -ex + er * 0.35, ey + er * 0.45, ez + er * 0.5, hc, 4, 3), ball(hs, ex + er * 0.35, ey + er * 0.45, ez + er * 0.5, hc, 4, 3));
  }
  if (o.nose !== false) p.push(ball(0.02, 0, 0.932, 0.133, o.noseCol ?? 0xeaa882, 5, 4));
  if (o.brows !== false) {
    const by = o.browY ?? 1.0, a = o.browA ?? 0.18, bc = o.browCol ?? 0x4a2e1e, bz = Math.sqrt(HR * HR - ex * ex - (by - HY) ** 2) + 0.002;
    p.push(box(0.052, 0.015, 0.014, -ex, by, bz, bc, 0, 0, -a), box(0.052, 0.015, 0.014, ex, by, bz, bc, 0, 0, a));
  }
  const m = o.mouth ?? 'smile', mc = o.mouthCol ?? 0x7a2a22;
  if (m === 'smile') p.push(torus(0.024, 0.0065, 0, 0.912, 0.126, mc, 0, 0, 3, 6, Math.PI, Math.PI));
  else if (m === 'frown') p.push(torus(0.022, 0.0065, 0, 0.89, 0.127, mc, 0, 0, 3, 6, Math.PI));
  else if (m === 'line') p.push(box(0.045, 0.011, 0.01, 0, 0.903, 0.127, mc));
  if (o.blush) p.push(ball(0.02, -0.078, 0.925, 0.105, o.blush, 5, 3, 1, 0.55, 0.4), ball(0.02, 0.078, 0.925, 0.105, o.blush, 5, 3, 1, 0.55, 0.4));
  return p;
}
function belt(col, buckle, r = 0.158, y = 0.512) {
  return [cyl(r, r, 0.064, 0, y, 0, col, 12, 0, 0, 0.82, true), box(0.058, 0.046, 0.022, 0, y, r * 0.82 + 0.004, buckle)];
}
function pouch(x, y, z, col, w = 0.06, h = 0.06, ry = 0) {
  return [box(w, h, 0.034, x, y, z, col, 0, ry), box(w + 0.006, h * 0.32, 0.04, x, y + h * 0.38, z + 0.002, shade(col, 0.72), 0, ry)];
}
function pad(x, col, r = 0.085, trim = null, y = 0.8) {
  const p = [dome(r, x, y, 0, col, 8, 4, 1.15, 0.9, 1.1, 0.5)];
  if (trim !== null) p.push(cyl(r * 1.15, r * 1.15, 0.018, x, y, 0, trim, 10, 0, 0, 0.96, true));
  return p;
}
// one arm: shoulder -> elbow -> hand, with cuff and glove/hand
function arm(sh, el, hand, o) {
  const r = o.r ?? 0.047, sleeve = o.sleeve, fore = o.fore ?? sleeve, glove = o.glove ?? SKIN;
  const wrist = lerp3(el, hand, 0.74), p = [
    limb(sh, el, r * 1.04, r * 0.95, sleeve), ball(r * 0.96, el[0], el[1], el[2], o.elbow ?? fore, 5, 4),
    limb(el, wrist, r * 0.94, r * 0.82, fore),
    ball(o.hr ?? 0.044, hand[0], hand[1], hand[2], glove, 6, 5, 1, 0.92, 1.08),
  ];
  if (!o.padded) p.push(ball(r * 1.12, sh[0], sh[1], sh[2], sleeve, 7, 4));
  if (o.cuff !== undefined) p.push(limb(lerp3(el, hand, 0.55), lerp3(el, hand, 0.8), r * 1.04, r * 1.0, o.cuff, 8));
  return p;
}
// two-handed aim pose; grips per weapon tier (before mirror: +x is the gun hand)
const GRIP = [
  { er: [0.21, 0.69, 0.13], hr: [0.085, 0.712, 0.33], el: [-0.09, 0.67, 0.21], hl: [0.035, 0.7, 0.35] }, // pistol: arms out straight
  { er: [0.2, 0.66, 0.09], hr: [0.085, 0.705, 0.235], el: [-0.12, 0.66, 0.23], hl: [0.05, 0.7, 0.44] },   // rifle
  { er: [0.2, 0.66, 0.09], hr: [0.085, 0.705, 0.22], el: [-0.12, 0.64, 0.22], hl: [0.065, 0.655, 0.41] }, // smg foregrip
  { er: [0.2, 0.66, 0.09], hr: [0.085, 0.705, 0.22], el: [-0.12, 0.66, 0.22], hl: [0.055, 0.69, 0.43] },  // plasma
  { er: [0.22, 0.69, 0.1], hr: [0.085, 0.71, 0.25], el: [-0.1, 0.7, 0.24], hl: [0.05, 0.725, 0.43] },    // rocket on shoulder
];
function armsAim(o, g = GRIP[1]) {
  return [...arm(SH, g.er, g.hr, o), ...arm(SHL, g.el, g.hl, o)];
}
// right hand raised high (club / sword), left fist or shield forward
const RAISE = [0.2, 0.93, 0.14];
function armsMelee(o) {
  return [...arm(SH, [0.27, 0.74, 0.05], RAISE, o), ...arm(SHL, [-0.25, 0.67, 0.07], [-0.18, 0.64, 0.21], o)];
}
function shield(col, rim) {
  return [cyl(0.18, 0.18, 0.035, -0.2, 0.64, 0.27, col, 14, Math.PI / 2), torus(0.18, 0.018, -0.2, 0.64, 0.287, rim, 0, 0, 4, 14),
    ball(0.048, -0.2, 0.64, 0.3, rim, 7, 5), box(0.03, 0.26, 0.012, -0.2, 0.64, 0.292, rim), box(0.26, 0.03, 0.012, -0.2, 0.64, 0.292, rim)];
}
function sword(blade, guard, grip = 0x5a3a24) {
  const tilt = 0.32, h = RAISE;
  return [box(0.03, 0.46, 0.075, h[0] - 0.01, h[1] + 0.29, h[2] + 0.09, blade, tilt),
    box(0.012, 0.42, 0.02, h[0] - 0.01, h[1] + 0.28, h[2] + 0.095, shade(blade, 0.8), tilt),
    cone(0.038, 0.06, h[0] - 0.01, h[1] + 0.54, h[2] + 0.175, blade, tilt, 0, 4),
    box(0.16, 0.032, 0.045, h[0], h[1] + 0.055, h[2] + 0.02, guard, tilt), rod([h[0], h[1] - 0.06, h[2] - 0.04], [h[0], h[1] + 0.05, h[2] + 0.015], 0.02, 0.02, grip, 6, true),
    ball(0.028, h[0], h[1] - 0.07, h[2] - 0.045, guard, 6, 4)];
}

// ------------------------------------------------------------ weapons (player tiers)
export function gunParts(t, X = 0.07, Y = 0.735) {
  const dark = 0x3a3f4b, black = 0x1b1d23, wood = 0x9a6230, woodD = 0x6e4220, steel = 0x7d8796;
  switch (t) {
    case 0: return [ // pistol: chunky slide, brown grip, bright orange sights
      box(0.05, 0.058, 0.22, X, Y + 0.03, 0.4, dark), box(0.052, 0.012, 0.2, X, Y + 0.062, 0.4, steel),
      box(0.046, 0.04, 0.17, X, Y - 0.012, 0.39, black), box(0.044, 0.11, 0.055, X, Y - 0.055, 0.325, woodD, -0.22),
      box(0.012, 0.03, 0.05, X, Y - 0.04, 0.37, black), cyl(0.014, 0.014, 0.03, X, Y + 0.03, 0.512, black, 6, Math.PI / 2),
      glow(box(0.016, 0.022, 0.016, X, Y + 0.074, 0.495, 0xff8a1a), 1.6), glow(box(0.03, 0.016, 0.014, X, Y + 0.072, 0.305, 0xffc83a), 1.4)];
    case 1: return [ // battle rifle: wood stock + handguard, curved mag, scope with blue lens
      box(0.05, 0.1, 0.18, X, Y - 0.025, 0.09, wood, 0.12), box(0.054, 0.104, 0.03, X, Y - 0.03, 0.0, woodD, 0.12),
      box(0.058, 0.074, 0.24, X, Y, 0.29, dark), box(0.056, 0.058, 0.17, X, Y - 0.006, 0.5, wood),
      box(0.058, 0.01, 0.17, X, Y + 0.026, 0.5, woodD),
      rod([X, Y + 0.008, 0.58], [X, Y + 0.008, 0.76], 0.015, 0.013, black, 6), cyl(0.022, 0.022, 0.04, X, Y + 0.008, 0.76, black, 6, Math.PI / 2),
      glow(box(0.012, 0.035, 0.012, X, Y + 0.04, 0.735, 0xff8a1a), 1.6),
      box(0.038, 0.12, 0.05, X, Y - 0.085, 0.34, black, 0.35), box(0.032, 0.07, 0.04, X, Y - 0.07, 0.22, black, -0.25),
      rod([X, Y + 0.072, 0.21], [X, Y + 0.072, 0.38], 0.022, 0.024, black, 8), box(0.014, 0.03, 0.03, X, Y + 0.048, 0.29, black),
      glow(cyl(0.024, 0.024, 0.012, X, Y + 0.072, 0.386, 0x4fd8ff, 8, Math.PI / 2), 1.8)];
    case 2: return [ // SMG: drum mag, foregrip, red-dot, orange-ringed compensator
      box(0.016, 0.06, 0.14, X, Y - 0.01, 0.07, black), box(0.05, 0.075, 0.03, X, Y - 0.015, 0.0, black),
      box(0.074, 0.09, 0.3, X, Y, 0.3, 0x2c313b), box(0.076, 0.02, 0.3, X, Y + 0.05, 0.3, black),
      rod([X, Y + 0.012, 0.45], [X, Y + 0.012, 0.66], 0.03, 0.03, 0x3a404c, 8), cyl(0.036, 0.036, 0.08, X, Y + 0.012, 0.7, black, 8, Math.PI / 2),
      glow(torus(0.032, 0.008, X, Y + 0.012, 0.742, 0xff8a1a, 0, 0, 3, 10), 1.6),
      cyl(0.07, 0.07, 0.05, X, Y - 0.075, 0.29, 0x4a515e, 12, 0, Math.PI / 2, 1, false), cyl(0.04, 0.04, 0.056, X, Y - 0.075, 0.29, 0x9aa3b0, 8, 0, Math.PI / 2),
      box(0.036, 0.08, 0.04, X, Y - 0.08, 0.41, black, 0.15), box(0.034, 0.08, 0.04, X, Y - 0.06, 0.2, black, -0.25),
      box(0.04, 0.045, 0.06, X, Y + 0.08, 0.27, black), glow(box(0.03, 0.03, 0.006, X, Y + 0.082, 0.302, 0x6cff6c), 1.8)];
    case 3: return [ // plasma rifle: white shell, blue panels, glowing coils + orb
      box(0.085, 0.1, 0.34, X, Y, 0.3, 0xeef4ff), box(0.07, 0.035, 0.3, X, Y + 0.065, 0.28, 0x1d7bf0),
      box(0.06, 0.08, 0.12, X, Y - 0.01, 0.08, 0xd6e0ee), box(0.065, 0.05, 0.03, X, Y - 0.015, 0.0, 0x1d7bf0),
      rod([X, Y, 0.46], [X, Y, 0.74], 0.034, 0.026, 0x1d7bf0, 10),
      glow(torus(0.05, 0.013, X, Y, 0.53, 0x6ff7ff, 0, 0, 4, 12), 1.6), glow(torus(0.046, 0.013, X, Y, 0.61, 0x6ff7ff, 0, 0, 4, 12), 1.6),
      glow(torus(0.042, 0.013, X, Y, 0.69, 0x6ff7ff, 0, 0, 4, 12), 1.6),
      glow(ball(0.042, X, Y, 0.78, 0xb8fdff, 10, 8), 1.8), glow(box(0.088, 0.026, 0.16, X, Y - 0.025, 0.28, 0x6ff7ff), 1.5),
      glow(cyl(0.022, 0.022, 0.05, X, Y + 0.095, 0.25, 0x6ff7ff, 8, Math.PI / 2), 1.6),
      box(0.04, 0.09, 0.05, X, Y - 0.08, 0.22, 0x2a2e36, 0.25)];
    default: return [ // rocket launcher: olive tube, hazard stripes, red warhead, sight
      rod([X, Y + 0.06, -0.06], [X, Y + 0.06, 0.66], 0.072, 0.072, 0x5b8a3e, 12, true),
      cyl(0.088, 0.088, 0.07, X, Y + 0.06, 0.66, 0x2f4a24, 12, Math.PI / 2), cyl(0.09, 0.075, 0.07, X, Y + 0.06, -0.07, 0x2f4a24, 12, Math.PI / 2),
      cyl(0.074, 0.074, 0.03, X, Y + 0.06, 0.18, 0xffc83a, 12, Math.PI / 2, 0, 1, true), cyl(0.074, 0.074, 0.03, X, Y + 0.06, 0.48, 0xffc83a, 12, Math.PI / 2, 0, 1, true),
      cyl(0.05, 0.05, 0.05, X, Y + 0.06, 0.72, 0xd9dde4, 10, Math.PI / 2), glow(cone(0.052, 0.13, X, Y + 0.06, 0.81, 0xff3a2a, Math.PI / 2, 0, 10), 1.4),
      glow(ball(0.04, X, Y + 0.06, -0.09, 0xffb020, 8, 4, 1, 1, 0.4), 1.3),
      box(0.03, 0.07, 0.08, X - 0.09, Y + 0.1, 0.32, black), glow(box(0.032, 0.03, 0.01, X - 0.09, Y + 0.11, 0.362, 0xff4a3a), 1.6),
      box(0.04, 0.1, 0.05, X, Y - 0.04, 0.26, black, 0.2), box(0.04, 0.1, 0.05, X, Y - 0.03, 0.42, black, -0.1)];
  }
}
export const buildGun = (t) => mirrorX(merge(gunParts(t)));

// ------------------------------------------------------------ player soldier, one look per weapon tier
export function buildSoldier(t) {
  let p;
  if (t === 0) { // recruit: light-blue shirt, baseball cap, rolled sleeves, canteen
    const c = 0x4a9bff, cd = 0x2f7fe6, cap = 0x1f5fc4;
    p = [torso(c, 1, 0.8, 0x2a3f66), box(0.05, 0.035, 0.02, -0.04, 0.858, 0.108, cd, -0.6, 0, 0.5), box(0.05, 0.035, 0.02, 0.04, 0.858, 0.108, cd, -0.6, 0, -0.5),
      ...pouch(-0.075, 0.74, 0.13, cd, 0.06, 0.05), ...pouch(0.075, 0.74, 0.13, cd, 0.06, 0.05),
      ...belt(0x5a4632, 0xd9dde4), cyl(0.045, 0.045, 0.1, -0.15, 0.49, -0.07, 0x5b7a3e, 8), cyl(0.02, 0.02, 0.03, -0.15, 0.555, -0.07, 0x2b2b2b, 6),
      ...armsAim({ sleeve: c, fore: SKIN, cuff: cd, elbow: SKIN, r: 0.045 }, GRIP[0]),
      ...head({ blush: 0xff9a8a }),
      dome(0.148, 0, 0.985, 0, cap, 12, 5, 1, 0.78, 1.02, 0.5), cyl(0.149, 0.149, 0.02, 0, 0.99, 0, 0x16478f, 12, 0, 0, 1.02, true),
      box(0.17, 0.016, 0.11, 0, 0.99, 0.15, 0x16478f, -0.12), ball(0.02, 0, 1.1, 0, 0x16478f, 5, 3),
      glow(box(0.045, 0.045, 0.01, 0, 1.04, 0.142, 0xffc83a, -0.45, 0, Math.PI / 4), 1.3)];
  } else if (t === 1) { // infantry: round helmet w/ band, vest, big backpack + bedroll
    const c = 0x2f8cff, vest = 0x1d5bb8, hel = 0x2a6ad6;
    p = [torso(c, 1, 0.8, 0x2a3f66), box(0.29, 0.21, 0.05, 0, 0.69, 0.115, vest),
      ...pouch(-0.07, 0.635, 0.148, 0x174a99), ...pouch(0.07, 0.635, 0.148, 0x174a99),
      ...belt(0x3a2f28, 0xffc83a), ...pouch(0.12, 0.5, 0.1, 0x6b5a3a, 0.05, 0.05, 0.6),
      box(0.25, 0.28, 0.13, 0, 0.68, -0.17, 0x3d6db8), box(0.26, 0.08, 0.145, 0, 0.8, -0.17, 0x2c5596),
      box(0.18, 0.1, 0.03, 0, 0.6, -0.245, 0x2c5596), box(0.03, 0.3, 0.03, -0.1, 0.7, -0.105, 0x2c3a55), box(0.03, 0.3, 0.03, 0.1, 0.7, -0.105, 0x2c3a55),
      rod([-0.15, 0.87, -0.17], [0.15, 0.87, -0.17], 0.05, 0.05, 0x9a7650, 10),
      ...armsAim({ sleeve: c, cuff: shade(c, 0.75), glove: 0x6b4a32 }, GRIP[1]),
      ...head({ browY: 0.99, browA: 0.22 }),
      dome(0.168, 0, 0.975, 0, hel, 12, 6, 1, 0.88, 1.06), cyl(0.18, 0.186, 0.026, 0, 0.978, 0, shade(hel, 0.75), 10, 0, 0, 1.06),
      cyl(0.17, 0.17, 0.035, 0, 1.03, 0, 0x16478f, 12, 0, 0, 1.06, true),
      glow(box(0.05, 0.05, 0.02, 0, 1.075, 0.152, 0xffc83a, 0.55, 0, Math.PI / 4), 1.3),
      limb([-0.125, 0.98, 0.02], [-0.07, 0.86, 0.08], 0.008, 0.008, 0x3a2f28, 4), limb([0.125, 0.98, 0.02], [0.07, 0.86, 0.08], 0.008, 0.008, 0x3a2f28, 4)];
  } else if (t === 2) { // commando: beret + headset, dark tac vest, bandolier, radio pack
    const c = 0x2364c4, v = 0x1b2a4a, pouchC = 0x26375c, beret = 0x18306a;
    p = [torso(c, 1.04, 0.82, 0x22324f), box(0.3, 0.23, 0.055, 0, 0.68, 0.118, v),
      ...pouch(-0.075, 0.615, 0.15, pouchC, 0.08), ...pouch(0.075, 0.615, 0.15, pouchC, 0.08),
      rod([-0.16, 0.84, 0.115], [0.15, 0.53, 0.135], 0.022, 0.022, 0x6b4a2a, 6, true),
      ...[0, 1, 2, 3].map((i) => glow(box(0.022, 0.045, 0.02, -0.11 + i * 0.07, 0.79 - i * 0.07, 0.14, 0xffc040, 0, 0, 0.78), 1.15)),
      ...belt(0x1b1714, 0x9aa3b0),
      box(0.21, 0.25, 0.12, 0, 0.68, -0.168, 0x2a3a5a),
      glow(box(0.03, 0.02, 0.01, -0.05, 0.62, -0.23, 0x6cff6c), 1.6), glow(box(0.03, 0.02, 0.01, 0.0, 0.62, -0.23, 0xff4a3a), 1.6),
      limb([0.07, 0.8, -0.19], [0.09, 1.2, -0.22], 0.008, 0.005, 0x111111, 4), glow(ball(0.016, 0.09, 1.2, -0.22, 0xff4a3a, 5, 3), 1.4),
      ...pad(-0.17, v, 0.088), ...pad(0.17, v, 0.088),
      ...armsAim({ sleeve: c, cuff: v, glove: 0x23232a, elbow: v, padded: true }, GRIP[2]),
      ...head({ browA: 0.38, browY: 0.997, browCol: 0x2a1a12, mouth: 'line' }),
      dome(0.16, -0.025, 1.005, -0.01, beret, 12, 5, 1.12, 0.62, 1.08, 0.55), torus(0.142, 0.017, 0, 1.0, 0, 0x101a33, Math.PI / 2, 0, 3, 14), glow(box(0.04, 0.045, 0.012, 0.07, 1.04, 0.135, 0xffc83a, -0.35), 1.3),
      ball(0.042, -0.14, 0.955, 0, 0x222222, 6, 4, 0.6, 1, 1), ball(0.042, 0.14, 0.955, 0, 0x222222, 6, 4, 0.6, 1, 1),
      limb([0.15, 0.94, 0.02], [0.07, 0.9, 0.13], 0.007, 0.007, 0x222222, 4)];
  } else if (t === 3) { // plasma trooper: blue undersuit, white armour, glowing visor, jetpack
    const w = 0xeef4ff, blue = 0x1d6fe0, gl = 0x6ff7ff;
    p = [torso(blue, 1, 0.8, 0x1a4fae), box(0.27, 0.21, 0.05, 0, 0.7, 0.118, w), box(0.29, 0.06, 0.05, 0, 0.82, 0.1, w, -0.3),
      glow(box(0.16, 0.018, 0.012, 0, 0.74, 0.146, gl), 1.6), glow(box(0.11, 0.018, 0.012, 0, 0.68, 0.146, gl), 1.6),
      glow(ball(0.024, 0, 0.7, 0.12, gl, 6, 4, 1, 1, 0.8), 1.4),
      ...belt(0x2a2e36, gl), ...pad(-0.18, w, 0.1, blue, 0.81), ...pad(0.18, w, 0.1, blue, 0.81),
      box(0.18, 0.22, 0.07, 0, 0.71, -0.14, 0xcfd8e6),
      cyl(0.055, 0.05, 0.27, -0.075, 0.7, -0.19, w, 10), cyl(0.055, 0.05, 0.27, 0.075, 0.7, -0.19, w, 10),
      cyl(0.057, 0.057, 0.03, -0.075, 0.78, -0.19, blue, 10, 0, 0, 1, true), cyl(0.057, 0.057, 0.03, 0.075, 0.78, -0.19, blue, 10, 0, 0, 1, true),
      cyl(0.04, 0.05, 0.05, -0.075, 0.545, -0.19, 0x2a2e36, 8), cyl(0.04, 0.05, 0.05, 0.075, 0.545, -0.19, 0x2a2e36, 8),
      glow(cone(0.042, 0.12, -0.075, 0.46, -0.19, gl, Math.PI, 0, 7), 1.7), glow(cone(0.042, 0.12, 0.075, 0.46, -0.19, gl, Math.PI, 0, 7), 1.7),
      ...armsAim({ sleeve: blue, cuff: w, glove: 0x2a2e36, elbow: w, padded: true }, GRIP[3]),
      ball(0.168, 0, 0.97, 0, w, 12, 9, 1, 1, 1.03), box(0.2, 0.09, 0.08, 0, 0.955, 0.125, 0x15233a),
      glow(box(0.19, 0.055, 0.04, 0, 0.96, 0.155, gl), 1.5), glow(box(0.05, 0.012, 0.01, -0.05, 0.975, 0.176, WHITE), 1.2),
      box(0.12, 0.04, 0.04, 0, 0.865, 0.13, 0xcfd8e6),
      cyl(0.055, 0.055, 0.03, -0.168, 0.96, 0, blue, 10, 0, Math.PI / 2), cyl(0.055, 0.055, 0.03, 0.168, 0.96, 0, blue, 10, 0, Math.PI / 2),
      glow(cyl(0.022, 0.022, 0.034, 0.168, 0.96, 0, gl, 6, 0, Math.PI / 2), 1.5),
      box(0.035, 0.07, 0.22, 0, 1.13, -0.02, blue)];
  } else { // heavy: bulky navy armour, gold-trimmed pads, amber visor, twin-rocket pack
    const n = 0x1f3f7a, pl = 0x2f5fb0, gold = 0xffc83a;
    p = [torso(n, 1.15, 0.9, 0x1a3466), box(0.34, 0.25, 0.075, 0, 0.69, 0.13, pl), box(0.34, 0.03, 0.08, 0, 0.81, 0.13, gold),
      box(0.12, 0.08, 0.02, 0, 0.7, 0.17, shade(pl, 0.75)), glow(box(0.05, 0.05, 0.01, 0, 0.7, 0.181, gold, 0, 0, Math.PI / 4), 1.2),
      ...pad(-0.2, pl, 0.125, gold, 0.8), ...pad(0.2, pl, 0.125, gold, 0.8),
      ...belt(0x1b1714, gold, 0.178), box(0.07, 0.06, 0.034, -0.1, 0.5, 0.15, 0x2a3a5a), box(0.07, 0.06, 0.034, 0.1, 0.5, 0.15, 0x2a3a5a),
      box(0.28, 0.3, 0.14, 0, 0.7, -0.2, 0x2a3a5a),
      cyl(0.045, 0.045, 0.3, -0.065, 0.74, -0.29, 0x5b8a3e, 8), cyl(0.045, 0.045, 0.3, 0.065, 0.74, -0.29, 0x5b8a3e, 8),
      glow(cone(0.045, 0.1, -0.065, 0.94, -0.29, 0xff4a3a, 0, 0, 8), 1.3), glow(cone(0.045, 0.1, 0.065, 0.94, -0.29, 0xff4a3a, 0, 0, 8), 1.3),
      box(0.26, 0.03, 0.1, 0, 0.66, -0.29, gold),
      ...armsAim({ sleeve: n, cuff: gold, glove: 0x2a2a30, elbow: pl, r: 0.056, hr: 0.052, padded: true }, GRIP[4]),
      ...head({ brows: false, mouth: 'line' }),
      dome(0.175, 0, 0.975, 0, n, 12, 7, 1, 0.98, 1.08, 0.6), cyl(0.18, 0.18, 0.04, 0, 1.05, 0, pl, 12, 0, 0, 1.08, true),
      box(0.25, 0.075, 0.05, 0, 0.962, 0.172, 0x14141a), glow(box(0.22, 0.05, 0.03, 0, 0.965, 0.19, 0xffb020), 1.35),
      box(0.22, 0.065, 0.07, 0, 0.88, 0.11, pl),
      limb([0.12, 1.05, -0.06], [0.14, 1.32, -0.09], 0.008, 0.006, 0x111111, 4), glow(ball(0.018, 0.14, 1.33, -0.09, 0xff4a3a, 5, 3), 1.4)];
  }
  return mirrorX(merge(p));
}

// legs hang down from the hip pivot (y=0 at hip, sole at ~-0.44)
// style: undefined (trousers + boots), 'bone', 'armor', 'robe'
export function buildLeg(pants, boot, knee, style) {
  let p;
  if (style === 'bone') {
    p = [limb([0, 0.02, 0], [0, -0.21, 0.01], 0.026, 0.022, pants, 6), ball(0.036, 0, -0.22, 0.01, pants, 6, 4),
      limb([0, -0.22, 0.01], [0, -0.38, 0], 0.022, 0.02, pants, 6), ball(0.03, 0, -0.39, 0.0, pants, 5, 4),
      box(0.07, 0.035, 0.15, 0, -0.42, 0.03, pants), box(0.08, 0.015, 0.16, 0, -0.44, 0.03, boot)];
  } else if (style === 'armor') {
    p = [rod([0, 0.02, 0], [0, -0.24, 0.0], 0.058, 0.05, pants, 8, true), box(0.11, 0.2, 0.12, 0, -0.29, 0.005, boot),
      ball(0.05, 0, -0.2, 0.052, knee ?? boot, 6, 4, 1.1, 1, 0.7), box(0.125, 0.07, 0.19, 0, -0.395, 0.03, boot),
      box(0.13, 0.025, 0.2, 0, -0.43, 0.03, 0x2a2e36)];
  } else {
    const sole = 0x14110f;
    p = [rod([0, 0.02, 0], [0, -0.3, 0.0], 0.062, 0.05, pants, 8, true),
      box(0.118, 0.12, 0.135, 0, -0.345, 0.005, boot), ball(0.06, 0, -0.39, 0.06, boot, 6, 4, 1, 0.75, 1.15),
      box(0.13, 0.028, 0.215, 0, -0.43, 0.03, sole), box(0.122, 0.022, 0.14, 0, -0.29, 0.005, shade(boot, 0.75))];
    if (knee !== undefined && knee !== null) p.push(box(0.1, 0.075, 0.035, 0, -0.2, 0.054, knee));
  }
  return merge(p);
}
export const SOLDIER_LEGS = [
  [0x2a3f66, 0x4a3426], [0x2a3f66, 0x3a2b22], [0x22324f, 0x1b1714, 0x111418], [0x1a4fae, 0xdfe8f5, 0x6ff7ff], [0x1a3466, 0x14141a, 0xffc83a],
];

// ------------------------------------------------------------ enemies (built facing +z, rendered turned towards the player)
// cheaper rifle baked into enemy bodies (aims straight at the player, bright sight accent)
function enemyRifle(wood, metal, accent, X = 0.07, Y = 0.735) {
  return [box(0.05, 0.095, 0.18, X, Y - 0.025, 0.09, wood, 0.12), box(0.058, 0.074, 0.24, X, Y, 0.29, metal),
    box(0.056, 0.058, 0.16, X, Y - 0.006, 0.5, wood), rod([X, Y + 0.008, 0.58], [X, Y + 0.008, 0.76], 0.016, 0.014, 0x1b1d23, 6),
    box(0.038, 0.12, 0.05, X, Y - 0.085, 0.34, 0x1b1d23, 0.35), box(0.034, 0.06, 0.04, X, Y - 0.065, 0.22, 0x1b1d23, -0.25),
    box(0.03, 0.04, 0.16, X, Y + 0.065, 0.3, 0x1b1d23), glow(box(0.032, 0.032, 0.01, X, Y + 0.065, 0.385, accent), 1.6),
    glow(box(0.014, 0.03, 0.014, X, Y + 0.035, 0.74, accent), 1.4)];
}
const aimArms = (sleeve, glove, cuff, g) => armsAim({ sleeve, glove, cuff, padded: true }, g);
export const ENEMY_MODELS = {
  raider() { // red raider: horned helm, X straps, spiked club raised
    const c = 0xff4a54, strap = 0x3a2228, metal = 0xd8dee6, wood = 0x9a6a3a;
    const h = RAISE;
    return [torso(c, 1.05, 0.82, 0x4a1d29),
      box(0.05, 0.36, 0.03, 0, 0.67, 0.135, strap, 0, 0, 0.6), box(0.05, 0.36, 0.03, 0, 0.67, 0.137, strap, 0, 0, -0.6),
      cyl(0.03, 0.03, 0.02, 0, 0.67, 0.152, metal, 8, Math.PI / 2),
      ...belt(0x2b2024, metal, 0.162), ...pouch(-0.1, 0.5, 0.135, 0x5a3a2a, 0.05, 0.05),
      ...pad(-0.17, strap, 0.095), ...pad(0.17, strap, 0.095),
      cone(0.026, 0.09, -0.2, 0.88, 0, metal, 0, 0.6, 5), cone(0.026, 0.09, 0.2, 0.88, 0, metal, 0, -0.6, 5),
      ...armsMelee({ sleeve: c, glove: 0x3a2228, cuff: strap, padded: true }),
      rod([h[0], h[1] - 0.08, h[2] - 0.03], [h[0] - 0.02, h[1] + 0.36, h[2] + 0.14], 0.024, 0.065, wood, 8),
      ball(0.068, h[0] - 0.02, h[1] + 0.37, h[2] + 0.14, wood, 7, 5),
      cone(0.018, 0.06, h[0] + 0.06, h[1] + 0.32, h[2] + 0.12, metal, 0, -1.4, 4), cone(0.018, 0.06, h[0] - 0.1, h[1] + 0.32, h[2] + 0.12, metal, 0, 1.4, 4),
      cone(0.018, 0.06, h[0] - 0.02, h[1] + 0.3, h[2] + 0.21, metal, 1.4, 0, 4), cone(0.018, 0.06, h[0] - 0.02, h[1] + 0.46, h[2] + 0.16, metal, 0, 0, 4),
      ...head({ ears: false, browA: 0.5, browCol: 0x1a1012, mouth: 'none', nose: false, shineCol: 0xffd0d0 }),
      cyl(0.139, 0.135, 0.085, 0, 0.895, 0, 0x26222c, 12, 0, 0, 1, true),
      dome(0.163, 0, 0.99, 0, 0xb9232f, 12, 6, 1, 0.92, 1.04), cyl(0.17, 0.175, 0.035, 0, 0.99, 0, strap, 12, 0, 0, 1, true),
      box(0.03, 0.09, 0.02, 0, 1.06, 0.15, metal), box(0.032, 0.06, 0.04, 0, 0.955, 0.14, strap),
      cone(0.04, 0.18, -0.175, 1.08, 0, 0xf3ecdc, 0, 0.95, 6), cone(0.04, 0.18, 0.175, 1.08, 0, 0xf3ecdc, 0, -0.95, 6)];
  },
  gunner() { // red rifleman: beanie, vest, moustache, aims forward
    const c = 0xe23b46, v = 0x2b2024;
    return [torso(c, 1, 0.8, 0x2b2f3a), box(0.28, 0.22, 0.05, 0, 0.68, 0.118, v), ...pouch(-0.07, 0.62, 0.148, 0x3a2a30), ...pouch(0.07, 0.62, 0.148, 0x3a2a30),
      box(0.28, 0.03, 0.052, 0, 0.77, 0.12, 0x8a1c26),
      ...belt(0x1b1714, 0xd8dee6), ...pad(-0.17, c, 0.08), ...pad(0.17, c, 0.08),
      ...aimArms(c, 0x2a2228, 0x8a1c26, GRIP[1]), ...enemyRifle(0x7a4a24, 0x2c2f38, 0xff4a3a),
      ...head({ browA: 0.5, browCol: 0x2a1410, mouth: 'frown' }),
      box(0.085, 0.022, 0.016, 0, 0.912, 0.128, 0x3a2420), box(0.03, 0.03, 0.014, -0.04, 0.9, 0.124, 0x3a2420, 0, 0, 0.5), box(0.03, 0.03, 0.014, 0.04, 0.9, 0.124, 0x3a2420, 0, 0, -0.5),
      dome(0.152, 0, 0.985, 0, 0x7a1c26, 12, 6, 1, 1.05, 1.0, 0.55), cyl(0.154, 0.158, 0.06, 0, 0.99, 0, 0x5a141c, 12, 0, 0, 1, true),
      ball(0.04, 0, 1.15, 0, WHITE, 6, 4)];
  },
  nomad() { // desert swordsman: robe, head wrap with veil, curved scimitar raised
    const c = 0xd8b07a, sash = 0xc23a2a, cloth = 0xf1e6cf, h = RAISE, steel = 0xe6ebf0;
    return [torso(c, 1, 0.8), cyl(0.165, 0.25, 0.3, 0, 0.36, 0, c, 12, 0, 0, 0.85, true), cyl(0.252, 0.252, 0.04, 0, 0.225, 0, shade(c, 0.75), 12, 0, 0, 0.85, true),
      box(0.06, 0.3, 0.02, 0, 0.7, 0.13, shade(c, 0.85)), ...belt(sash, 0xffc83a, 0.162), box(0.05, 0.16, 0.02, 0.07, 0.42, 0.15, sash, 0, 0, 0.15),
      ...pad(-0.17, c, 0.08), ...pad(0.17, c, 0.08), ...armsMelee({ sleeve: c, cuff: cloth, glove: 0xd9a070, padded: true }),
      box(0.03, 0.15, 0.07, h[0] - 0.01, h[1] + 0.14, h[2] + 0.04, steel, 0.15), box(0.03, 0.14, 0.07, h[0] - 0.01, h[1] + 0.27, h[2] + 0.1, steel, 0.55),
      box(0.03, 0.12, 0.06, h[0] - 0.01, h[1] + 0.35, h[2] + 0.19, steel, 1.0), cone(0.033, 0.07, h[0] - 0.01, h[1] + 0.39, h[2] + 0.26, steel, 1.3, 0, 4),
      box(0.14, 0.03, 0.04, h[0], h[1] + 0.055, h[2], 0xffc83a, 0.2), ball(0.026, h[0], h[1] - 0.07, h[2] - 0.03, 0xffc83a, 5, 4),
      ...head({ ears: false, skin: 0xd99a68, browA: 0.5, browCol: 0x2a1a12, mouth: 'none', nose: false, eyeY: 0.952 }),
      cyl(0.142, 0.128, 0.075, 0, 0.896, 0, cloth, 12, 0, 0, 1, true), // veil over the lower face
      box(0.07, 0.05, 0.02, 0.05, 0.9, 0.135, 0xd9c9a6, 0, 0, 0.3),
      dome(0.168, 0, 1.0, 0, cloth, 12, 6, 1, 1.0, 1.05, 0.55), torus(0.158, 0.026, 0, 1.008, 0, 0xd9c9a6, Math.PI / 2, 0, 4, 14),
      glow(ball(0.025, 0, 1.035, 0.165, 0x2fbf9f, 6, 4), 1.2), box(0.07, 0.2, 0.03, 0.0, 0.9, -0.15, cloth, -0.3)];
  },
  bandit() { // desert gunslinger: wide hat, bandana, bandolier, double-barrel
    const c = 0xc9925a, vest = 0x6b4426, X = 0.07, Y = 0.735;
    return [torso(c, 1, 0.8, 0x3d5a80), box(0.12, 0.24, 0.05, -0.09, 0.68, 0.11, vest), box(0.12, 0.24, 0.05, 0.09, 0.68, 0.11, vest),
      rod([-0.16, 0.84, 0.12], [0.15, 0.53, 0.13], 0.024, 0.024, 0x3a2418, 6, true),
      ...[0, 1, 2, 3].map((i) => box(0.02, 0.04, 0.02, -0.1 + i * 0.065, 0.78 - i * 0.065, 0.142, 0xe0b040, 0, 0, 0.78)),
      ...belt(0x3a2418, 0xffc83a), ...pad(-0.17, c, 0.078), ...pad(0.17, c, 0.078),
      ...aimArms(c, 0x6b4426, 0x8a6a40, GRIP[1]),
      box(0.05, 0.09, 0.2, X, Y - 0.025, 0.1, 0x7a4a24, 0.12), box(0.058, 0.07, 0.12, X, Y, 0.27, 0x3a3f4b),
      rod([X - 0.015, Y + 0.01, 0.3], [X - 0.015, Y + 0.01, 0.72], 0.019, 0.019, 0x2a2e36, 6), rod([X + 0.015, Y + 0.01, 0.3], [X + 0.015, Y + 0.01, 0.72], 0.019, 0.019, 0x2a2e36, 6),
      box(0.06, 0.04, 0.2, X, Y - 0.02, 0.44, 0x7a4a24), glow(box(0.012, 0.02, 0.012, X, Y + 0.035, 0.7, 0xffc83a), 1.4),
      ...head({ skin: 0xe0a878, browA: 0.5, browCol: 0x2a1410, mouth: 'none', nose: false }),
      dome(HR + 0.005, 0, 0.93, 0, 0xc0392b, 12, 4, 1, 0.7, 1.02, 0.5),
      cyl(0.27, 0.27, 0.02, 0, 1.04, 0, 0x6b4426, 16, 0, 0, 1, false),
      cyl(0.12, 0.145, 0.14, 0, 1.11, 0, 0x7a4f2e, 12),
      cyl(0.147, 0.147, 0.03, 0, 1.06, 0, 0x2b1d18, 12, 0, 0, 1, true), glow(box(0.03, 0.03, 0.01, 0, 1.06, 0.15, 0xffc83a, 0, 0, Math.PI / 4), 1.3)];
  },
  knight() { // armoured knight: purple tabard, plumed great helm, sword raised, shield
    const steel = 0xb8c4d6, tab = 0x6a3db8, gold = 0xffc83a, dk = 0x6a7385;
    return [torso(steel, 1, 0.8, dk), box(0.22, 0.36, 0.03, 0, 0.62, 0.135, tab), box(0.05, 0.16, 0.012, 0, 0.67, 0.152, gold), box(0.12, 0.04, 0.012, 0, 0.71, 0.152, gold),
      ...belt(0x3a3040, gold),
      ...pad(-0.18, steel, 0.11, gold, 0.8), ...pad(0.18, steel, 0.11, gold, 0.8),
      ...armsMelee({ sleeve: steel, glove: dk, elbow: dk, cuff: dk, padded: true }), ...sword(0xe6ebf0, gold), ...shield(tab, gold),
      cyl(0.152, 0.152, 0.24, 0, 0.965, 0, steel, 12, 0, 0, 1, true), dome(0.152, 0, 1.085, 0, steel, 12, 5),
      box(0.2, 0.026, 0.02, 0, 0.985, 0.148, 0x111111), box(0.026, 0.11, 0.02, 0, 0.925, 0.148, 0x111111),
      glow(box(0.06, 0.012, 0.022, -0.05, 0.985, 0.148, 0xff6a3a), 1.5), glow(box(0.06, 0.012, 0.022, 0.05, 0.985, 0.148, 0xff6a3a), 1.5),
      box(0.03, 0.25, 0.02, 0, 1.0, 0.152, shade(steel, 0.8)), torus(0.152, 0.012, 0, 0.86, 0, gold, Math.PI / 2, 0, 3, 14),
      ball(0.06, 0, 1.25, -0.06, 0xa070ff, 6, 4, 0.6, 1, 1.6), ball(0.05, 0, 1.22, -0.17, tab, 6, 4, 0.6, 1, 1.5)];
  },
  frost() { // parka with fur hood, goggles, scarf, ice blaster
    const c = 0xf2f6fb, fur = 0xd9cbb3, X = 0.07, Y = 0.735, ice = 0x8fe3ff;
    return [torso(c, 1.08, 0.86, 0xc7d3e0), box(0.03, 0.3, 0.02, 0, 0.66, 0.14, 0x9fb4c8), ...belt(0x5a6a80, ice, 0.165),
      ...pad(-0.17, c, 0.09), ...pad(0.17, c, 0.09),
      ...aimArms(c, 0x5a6a80, fur, GRIP[3]),
      box(0.08, 0.09, 0.3, X, Y, 0.3, 0xbfe9ff), box(0.084, 0.03, 0.26, X, Y + 0.05, 0.3, 0x5a6a80),
      rod([X, Y, 0.45], [X, Y, 0.68], 0.032, 0.026, 0x5a6a80, 8), glow(cone(0.05, 0.16, X, Y, 0.76, 0xdffbff, Math.PI / 2, 0, 6), 1.5),
      glow(box(0.05, 0.05, 0.05, X, Y + 0.09, 0.26, ice, 0.6, 0.6), 1.5),
      box(0.04, 0.09, 0.05, X, Y - 0.08, 0.22, 0x5a6a80, 0.25),
      ...head({ skin: 0xf1c7a8, browA: 0.4, mouth: 'none', blush: 0xff8f8f, eyeY: 0.95, eyeR: 0.019 }),
      cyl(0.15, 0.14, 0.07, 0, 0.88, 0.0, 0x3fa9ff, 12, 0, 0, 1, true), box(0.05, 0.14, 0.03, 0.06, 0.8, 0.14, 0x3fa9ff, 0, 0, 0.2),
      dome(0.18, 0, 0.95, -0.02, c, 12, 7, 1, 1.05, 1.0, 0.62), torus(0.14, 0.045, 0, 0.95, 0.07, fur, 0, 0, 5, 12),
      box(0.17, 0.025, 0.02, 0, 1.0, 0.128, 0x2a2e36), glow(cyl(0.033, 0.033, 0.03, -0.05, 1.0, 0.135, ice, 6, Math.PI / 2), 1.5),
      glow(cyl(0.033, 0.033, 0.03, 0.05, 1.0, 0.135, ice, 6, Math.PI / 2), 1.5)];
  },
  skeleton() { // bone warrior: ribcage, glowing eye sockets, rusty sword
    const bone = 0xefe8d8, robe = 0x2a2228, rust = 0x9a8a7a;
    return [torso(robe, 0.85, 0.72, 0x3a3236), box(0.24, 0.022, 0.03, 0, 0.6, 0.12, bone), box(0.26, 0.022, 0.03, 0, 0.66, 0.125, bone),
      box(0.25, 0.022, 0.03, 0, 0.72, 0.122, bone), box(0.2, 0.022, 0.03, 0, 0.78, 0.115, bone), box(0.03, 0.24, 0.03, 0, 0.68, 0.13, bone),
      ...belt(0x3a2a2a, 0x8a7a6a, 0.14), ...pad(-0.15, 0x5a4a3a, 0.07), ...pad(0.15, 0x5a4a3a, 0.07),
      cone(0.022, 0.08, -0.16, 0.87, 0, rust, 0, 0.5, 4), cone(0.022, 0.08, 0.16, 0.87, 0, rust, 0, -0.5, 4),
      ...armsMelee({ sleeve: bone, glove: bone, r: 0.028, hr: 0.036, padded: true }), ...sword(rust, 0x5a4a3a, 0x3a2a2a),
      ball(0.14, 0, 0.975, 0, bone, 12, 9, 1, 1, 0.95), box(0.13, 0.07, 0.09, 0, 0.87, 0.05, bone),
      ball(0.04, -0.05, 0.965, 0.105, 0x0d0a0c, 6, 4, 1, 1.05, 0.6), ball(0.04, 0.05, 0.965, 0.105, 0x0d0a0c, 6, 4, 1, 1.05, 0.6),
      glow(ball(0.014, -0.05, 0.965, 0.13, 0xff3a5a, 5, 3), 1.8), glow(ball(0.014, 0.05, 0.965, 0.13, 0xff3a5a, 5, 3), 1.8),
      cone(0.018, 0.04, 0, 0.92, 0.13, 0x0d0a0c, Math.PI, 0, 4),
      box(0.11, 0.012, 0.02, 0, 0.865, 0.095, 0x2a2228), box(0.008, 0.04, 0.022, -0.025, 0.87, 0.096, 0x2a2228), box(0.008, 0.04, 0.022, 0.025, 0.87, 0.096, 0x2a2228),
      dome(0.152, 0, 1.0, 0, 0x3a3236, 12, 5, 1, 0.7, 1), cyl(0.152, 0.152, 0.025, 0, 1.0, 0, 0x5a4a3a, 12, 0, 0, 1, true),
      cone(0.03, 0.12, -0.13, 1.08, 0, rust, 0, 0.8, 5), cone(0.03, 0.12, 0.13, 1.08, 0, rust, 0, -0.8, 5)];
  },
  demon() { // horned demon casting with a fire staff held forward
    const c = 0x8a1c1c, skin = 0xc0392b, horn = 0x1a1416, fire = 0xff7a1a;
    const top = [0.07, 1.06, 0.6];
    return [torso(c, 1, 0.8, 0x2a1416), box(0.28, 0.2, 0.05, 0, 0.69, 0.118, 0x2a1416), glow(box(0.06, 0.06, 0.02, 0, 0.7, 0.146, fire, 0, 0, Math.PI / 4), 1.5),
      ...belt(0x1a1416, fire), cone(0.12, 0.2, 0, 0.42, 0.12, 0x2a1416, 0.15, 0, 4),
      ...pad(-0.17, 0x2a1416, 0.095), ...pad(0.17, 0x2a1416, 0.095),
      cone(0.026, 0.1, -0.2, 0.9, 0, fire, 0, 0.5, 5), cone(0.026, 0.1, 0.2, 0.9, 0, fire, 0, -0.5, 5),
      ...armsAim({ sleeve: c, glove: skin, cuff: 0x2a1416, hr: 0.048, padded: true }, { er: [0.2, 0.66, 0.09], hr: [0.07, 0.75, 0.26], el: [-0.12, 0.7, 0.24], hl: [0.065, 0.84, 0.42] }),
      rod([0.07, 0.6, 0.06], top, 0.022, 0.022, 0x2a1a1a, 6), torus(0.075, 0.012, top[0], top[1], top[2], 0x2a1a1a, 0.75, 0, 3, 10),
      glow(ball(0.065, top[0], top[1] + 0.03, top[2] + 0.03, fire, 8, 6), 1.6), glow(cone(0.04, 0.13, top[0], top[1] + 0.12, top[2] + 0.06, 0xffd23a, 0.4, 0, 6), 1.6),
      ...head({ skin, eye: 0xffe14d, eyeR: 0.026, shine: false, browA: 0.55, browCol: horn, noseCol: 0x9a2a20, ears: false, mouth: 'frown', mouthCol: 0x2a0a0a }),
      cone(0.012, 0.03, -0.022, 0.885, 0.128, WHITE, Math.PI, 0, 4), cone(0.012, 0.03, 0.022, 0.885, 0.128, WHITE, Math.PI, 0, 4),
      cone(0.04, 0.2, -0.11, 1.1, 0, horn, 0, 0.55, 6), cone(0.025, 0.12, -0.18, 1.24, 0, horn, 0, 1.1, 5),
      cone(0.04, 0.2, 0.11, 1.1, 0, horn, 0, -0.55, 6), cone(0.025, 0.12, 0.18, 1.24, 0, horn, 0, -1.1, 5),
      cone(0.06, 0.16, 0, 0.98, -0.1, 0x1a1416, -2.0, 0, 5)];
  },
};
export const ENEMY_LEGS = {
  raider: [0x4a1d29, 0x2b1d18, 0x3a2228], gunner: [0x2b2f3a, 0x1d1a18], nomad: [0xc9a06a, 0x6b4426], bandit: [0x3d5a80, 0x6b4426],
  knight: [0x6a7385, 0xb8c4d6, 0xffc83a, 'armor'], frost: [0xc7d3e0, 0x5a4a3a, 0x9fb4c8], skeleton: [0xefe8d8, 0x3a3236, undefined, 'bone'], demon: [0x2a1416, 0x120c0e],
};
export const buildEnemy = (type) => mirrorX(merge(ENEMY_MODELS[type]()));
export const buildEnemyLeg = (type) => { const l = ENEMY_LEGS[type]; return buildLeg(l[0], l[1], l[2], l[3]); };

// All character / weapon / boss geometry. Characters are built from primitives,
// vertex-coloured and merged into one mesh each so a whole army is a few draw calls.
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
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const Y_UP = new THREE.Vector3(0, 1, 0);
export function rod(a, b, r0, r1, hex, seg = 8) {
  const A = V(a), Bv = V(b), d = Bv.clone().sub(A), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_UP, d.normalize()));
  g.translate((A.x + Bv.x) / 2, (A.y + Bv.y) / 2, (A.z + Bv.z) / 2);
  return prep(g, hex);
}
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
export function cyl(rt, rb, h, x, y, z, hex, seg = 12, rx = 0, rz = 0, sz = 1) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.scale(1, 1, sz);
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return prep(g, hex);
}
export function cone(r, h, x, y, z, hex, rx = 0, rz = 0, seg = 8) {
  const g = new THREE.ConeGeometry(r, h, seg); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z);
  return prep(g, hex);
}
function torus(R, r, x, y, z, hex, rx = 0, ry = 0) {
  const g = new THREE.TorusGeometry(R, r, 6, 16); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z);
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
const EYE = 0x1a1a24;
const SH = [0.168, 0.81, 0];

function torso(col, sx = 1, sz = 0.8, r = 0.165) {
  const g = new THREE.CapsuleGeometry(r, 0.2, 4, 12); g.scale(sx, 1, sz); g.translate(0, 0.66, 0);
  return prep(g, col);
}
function head(o = {}) {
  const skin = o.skin ?? SKIN, eye = o.eye ?? EYE, er = o.eyeR ?? 0.021, ey = o.eyeY ?? 0.965;
  const p = [ball(0.135, 0, 0.955, 0, skin, 14, 12)];
  if (o.ears !== false) p.push(ball(0.03, -0.132, 0.95, 0, skin, 6, 5), ball(0.03, 0.132, 0.95, 0, skin, 6, 5));
  p.push(ball(er, -0.046, ey, 0.123, eye, 6, 5), ball(er, 0.046, ey, 0.123, eye, 6, 5));
  if (o.nose !== false) p.push(ball(0.022, 0, 0.94, 0.135, o.noseCol ?? 0xeaa882, 6, 5));
  if (o.brows) p.push(box(0.06, 0.016, 0.012, -0.047, 1.0, 0.127, o.browCol ?? EYE, 0, 0, -0.45), box(0.06, 0.016, 0.012, 0.047, 1.0, 0.127, o.browCol ?? EYE, 0, 0, 0.45));
  return p;
}
function belt(col, buckle, r = 0.17) {
  return [cyl(r, r, 0.05, 0, 0.5, 0, col, 12, 0, 0, 0.82), box(0.055, 0.042, 0.02, 0, 0.5, r * 0.84, buckle)];
}
function shoulders(col, r = 0.075) {
  return [ball(r, -SH[0], SH[1], 0, col, 8, 6), ball(r, SH[0], SH[1], 0, col, 8, 6)];
}
function armsRifle(col, hand = SKIN, r = 0.047) {
  return [
    rod(SH, [0.18, 0.67, 0.09], r, r * 0.92, col), rod([0.18, 0.67, 0.09], [0.09, 0.72, 0.21], r * 0.92, r * 0.8, col),
    rod([-0.168, 0.81, 0], [-0.13, 0.68, 0.17], r, r * 0.92, col), rod([-0.13, 0.68, 0.17], [0.03, 0.73, 0.35], r * 0.92, r * 0.8, col),
    ball(0.043, 0.09, 0.72, 0.22, hand, 8, 6), ball(0.043, 0.035, 0.735, 0.36, hand, 8, 6),
  ];
}
// right hand raised (club / sword), left fist or shield forward
function armsMelee(col, hand = SKIN, r = 0.05) {
  return [
    rod(SH, [0.25, 0.71, 0.07], r, r * 0.9, col), rod([0.25, 0.71, 0.07], [0.21, 0.86, 0.17], r * 0.9, r * 0.8, col),
    ball(0.046, 0.21, 0.87, 0.18, hand, 8, 6),
    rod([-0.168, 0.81, 0], [-0.23, 0.68, 0.07], r, r * 0.9, col), rod([-0.23, 0.68, 0.07], [-0.17, 0.64, 0.2], r * 0.9, r * 0.8, col),
    ball(0.048, -0.17, 0.64, 0.21, hand, 8, 6),
  ];
}
function shield(col, rim) {
  return [cyl(0.18, 0.18, 0.035, -0.2, 0.64, 0.27, col, 16, Math.PI / 2), torus(0.18, 0.016, -0.2, 0.64, 0.287, rim),
    ball(0.045, -0.2, 0.64, 0.295, rim, 8, 6)];
}
function sword(blade, guard) {
  return [box(0.03, 0.44, 0.07, 0.19, 1.07, 0.245, blade, 0.33), box(0.15, 0.03, 0.04, 0.21, 0.87, 0.18, guard, 0.33),
    ball(0.025, 0.21, 0.82, 0.16, guard, 6, 5)];
}

// ------------------------------------------------------------ weapons (player tiers)
export function gunParts(t, X = 0.07, Y = 0.735) {
  const dark = 0x2f333d, black = 0x17191e, wood = 0x8a5a2b;
  switch (t) {
    case 0: return [box(0.05, 0.06, 0.2, X, Y + 0.01, 0.27, dark), box(0.045, 0.1, 0.05, X, Y - 0.05, 0.2, black, -0.25),
      box(0.03, 0.02, 0.03, X, Y + 0.05, 0.35, black)];
    case 1: return [box(0.05, 0.085, 0.16, X, Y - 0.01, 0.1, wood), box(0.06, 0.075, 0.22, X, Y, 0.28, dark),
      box(0.055, 0.06, 0.16, X, Y - 0.005, 0.47, wood), rod([X, Y + 0.01, 0.54], [X, Y + 0.01, 0.72], 0.016, 0.014, black, 6),
      box(0.04, 0.11, 0.05, X, Y - 0.08, 0.33, black, 0.25), rod([X, Y + 0.065, 0.22], [X, Y + 0.065, 0.38], 0.022, 0.022, black, 8),
      cyl(0.03, 0.03, 0.02, X, Y + 0.065, 0.38, 0x7fd3ff, 8, Math.PI / 2)];
    case 2: return [box(0.045, 0.07, 0.14, X, Y - 0.005, 0.1, black), box(0.075, 0.095, 0.3, X, Y, 0.31, 0x2a2e36),
      box(0.03, 0.02, 0.26, X, Y + 0.058, 0.31, black), rod([X, Y + 0.01, 0.46], [X, Y + 0.01, 0.74], 0.022, 0.022, black, 8),
      cyl(0.034, 0.034, 0.06, X, Y + 0.01, 0.74, black, 8, Math.PI / 2),
      cyl(0.065, 0.065, 0.055, X, Y - 0.07, 0.3, 0x4a505c, 14, 0, Math.PI / 2), box(0.04, 0.08, 0.04, X, Y - 0.07, 0.48, black, -0.3)];
    case 3: return [box(0.085, 0.1, 0.34, X, Y, 0.3, 0xe9f1ff), box(0.06, 0.04, 0.3, X, Y + 0.065, 0.3, 0x1d9bf0),
      rod([X, Y, 0.46], [X, Y, 0.76], 0.034, 0.028, 0x1d9bf0, 10),
      torus(0.052, 0.014, X, Y, 0.56, 0x6ff7ff), torus(0.052, 0.014, X, Y, 0.65, 0x6ff7ff),
      ball(0.04, X, Y, 0.78, 0x9ffcff, 10, 8), box(0.087, 0.03, 0.12, X, Y - 0.02, 0.2, 0x6ff7ff),
      box(0.04, 0.09, 0.05, X, Y - 0.08, 0.22, 0x2a2e36, 0.25)];
    default: return [rod([X, Y + 0.04, -0.04], [X, Y + 0.04, 0.72], 0.075, 0.075, 0x557f3f, 12),
      cyl(0.086, 0.086, 0.06, X, Y + 0.04, 0.7, 0x2f4a24, 12, Math.PI / 2), cyl(0.086, 0.086, 0.06, X, Y + 0.04, -0.02, 0x2f4a24, 12, Math.PI / 2),
      cone(0.058, 0.15, X, Y + 0.04, 0.8, 0xff4a3a, Math.PI / 2, 0, 10),
      box(0.03, 0.06, 0.06, X - 0.08, Y + 0.08, 0.3, black), box(0.04, 0.1, 0.05, X, Y - 0.06, 0.24, black, 0.2),
      box(0.15, 0.025, 0.08, X, Y + 0.04, 0.45, 0xffc83a)];
  }
}
export const buildGun = (t) => mirrorX(merge(gunParts(t)));

// ------------------------------------------------------------ player soldier, one look per weapon tier
export function buildSoldier(t) {
  let p;
  if (t === 0) { // recruit: cap and shirt
    const c = 0x4a9bff;
    p = [torso(c), box(0.11, 0.09, 0.01, 0, 0.71, 0.134, 0xffffff), box(0.04, 0.04, 0.012, 0, 0.71, 0.138, 0x2f8cff),
      ...belt(0x5a4632, 0xc9ccd4), ...shoulders(c), ...armsRifle(c), ...head(),
      dome(0.146, 0, 0.99, 0, 0x2a6fd6, 14, 6, 1, 0.75, 1.02, 0.5), box(0.17, 0.018, 0.1, 0, 0.995, 0.135, 0x1f5fc4, -0.15),
      ball(0.02, 0, 1.1, 0, 0x1f5fc4, 6, 4)];
  } else if (t === 1) { // infantry: helmet, vest, backpack
    const c = 0x2f8cff;
    p = [torso(c), box(0.29, 0.2, 0.05, 0, 0.69, 0.118, 0x1f63c9),
      box(0.075, 0.06, 0.03, -0.07, 0.64, 0.148, 0x1a55ad), box(0.075, 0.06, 0.03, 0.07, 0.64, 0.148, 0x1a55ad),
      ...belt(0x3a2f28, 0xffc83a),
      box(0.24, 0.27, 0.12, 0, 0.69, -0.17, 0x3d6db8), box(0.25, 0.07, 0.135, 0, 0.8, -0.17, 0x2c5596),
      rod([-0.14, 0.87, -0.16], [0.14, 0.87, -0.16], 0.048, 0.048, 0x9a7650),
      ...shoulders(c), ...armsRifle(c), ...head(),
      dome(0.165, 0, 0.985, 0, 0x2369d6, 14, 7, 1, 0.9, 1.06), cyl(0.178, 0.184, 0.03, 0, 0.985, 0, 0x2369d6, 14),
      box(0.05, 0.05, 0.02, 0, 1.06, 0.148, 0xffc83a, 0.5)];
  } else if (t === 2) { // commando: tactical vest, goggles, radio
    const c = 0x2364c4, v = 0x1b2a4a, pouch = 0x26375c;
    p = [torso(c), box(0.3, 0.22, 0.055, 0, 0.68, 0.118, v),
      box(0.07, 0.07, 0.035, -0.08, 0.62, 0.15, pouch), box(0.07, 0.07, 0.035, 0, 0.62, 0.15, pouch), box(0.07, 0.07, 0.035, 0.08, 0.62, 0.15, pouch),
      rod([-0.15, 0.84, 0.11], [0.14, 0.53, 0.13], 0.02, 0.02, 0xd9a53a, 6),
      ...belt(0x1b1714, 0x9aa3b0),
      box(0.2, 0.24, 0.11, 0, 0.68, -0.165, 0x2a3a5a), rod([0.07, 0.8, -0.18], [0.09, 1.15, -0.21], 0.008, 0.006, 0x111111, 4),
      ...shoulders(v), ...armsRifle(c, 0x2a2a30), ...head({ brows: true }),
      dome(0.165, 0, 0.985, 0, 0x1d3d70, 14, 7, 1, 0.9, 1.06), cyl(0.176, 0.18, 0.03, 0, 0.985, 0, 0x1d3d70, 14),
      torus(0.162, 0.012, 0, 1.04, 0, 0x222222, Math.PI / 2),
      cyl(0.034, 0.034, 0.03, -0.05, 1.045, 0.135, 0xffb020, 10, Math.PI / 2), cyl(0.034, 0.034, 0.03, 0.05, 1.045, 0.135, 0xffb020, 10, Math.PI / 2),
      ball(0.04, -0.14, 0.95, 0, 0x222222, 8, 6), ball(0.04, 0.14, 0.95, 0, 0x222222, 8, 6)];
  } else if (t === 3) { // plasma trooper: white armour, glowing visor, jetpack
    const w = 0xeef4ff, cy = 0x1d9bf0, gl = 0x6ff7ff;
    p = [torso(w), box(0.28, 0.22, 0.05, 0, 0.69, 0.118, cy),
      box(0.2, 0.02, 0.012, 0, 0.74, 0.146, gl), box(0.2, 0.02, 0.012, 0, 0.66, 0.146, gl),
      ...belt(0x2a2e36, gl),
      dome(0.09, -0.17, 0.8, 0, w, 10, 5, 1.1, 0.85, 1.1), dome(0.09, 0.17, 0.8, 0, w, 10, 5, 1.1, 0.85, 1.1),
      box(0.18, 0.2, 0.06, 0, 0.72, -0.13, 0xcfd8e6),
      cyl(0.05, 0.05, 0.26, -0.07, 0.7, -0.18, w, 10), cyl(0.05, 0.05, 0.26, 0.07, 0.7, -0.18, w, 10),
      cone(0.05, 0.09, -0.07, 0.53, -0.18, gl, Math.PI), cone(0.05, 0.09, 0.07, 0.53, -0.18, gl, Math.PI),
      ...armsRifle(w, 0x2a2e36),
      ball(0.165, 0, 0.97, 0, w, 14, 12, 1, 1, 1.03),
      box(0.21, 0.07, 0.05, 0, 0.965, 0.14, gl),
      cyl(0.05, 0.05, 0.03, -0.165, 0.96, 0, cy, 10, 0, Math.PI / 2), cyl(0.05, 0.05, 0.03, 0.165, 0.96, 0, cy, 10, 0, Math.PI / 2),
      box(0.03, 0.06, 0.12, 0, 1.13, -0.02, cy)];
  } else { // heavy: bulky armour, red visor, rocket pack
    const n = 0x1f3f7a, pl = 0x2f5fb0, gold = 0xffc83a;
    p = [torso(n, 1.15, 0.9), box(0.34, 0.26, 0.07, 0, 0.69, 0.13, pl), box(0.34, 0.03, 0.074, 0, 0.81, 0.13, gold),
      dome(0.12, -0.19, 0.8, 0, pl, 12, 6, 1, 0.8, 1.1), dome(0.12, 0.19, 0.8, 0, pl, 12, 6, 1, 0.8, 1.1),
      cyl(0.122, 0.122, 0.02, -0.19, 0.8, 0, gold, 12), cyl(0.122, 0.122, 0.02, 0.19, 0.8, 0, gold, 12),
      ...belt(0x1b1714, gold, 0.19),
      box(0.26, 0.28, 0.14, 0, 0.7, -0.19, 0x557f3f),
      cone(0.035, 0.09, -0.06, 0.88, -0.19, 0xff4a3a), cone(0.035, 0.09, 0.06, 0.88, -0.19, 0xff4a3a),
      ...armsRifle(pl, 0x2a2a30, 0.055), ...head(),
      dome(0.172, 0, 0.98, 0, n, 14, 8, 1, 0.95, 1.08, 0.6), box(0.22, 0.06, 0.04, 0, 0.97, 0.135, 0xff4a3a),
      box(0.2, 0.06, 0.06, 0, 0.885, 0.115, pl),
      rod([0.12, 1.05, -0.05], [0.14, 1.32, -0.08], 0.008, 0.006, 0x111111, 4), ball(0.018, 0.14, 1.33, -0.08, 0xff4a3a, 6, 4)];
  }
  return mirrorX(merge(p));
}

export function buildLeg(pants, boot, knee) {
  const p = [box(0.112, 0.3, 0.12, 0, -0.15, 0, pants), box(0.122, 0.13, 0.185, 0, -0.365, 0.028, boot),
    box(0.124, 0.03, 0.19, 0, -0.42, 0.028, 0x1b1714)];
  if (knee !== undefined) p.push(box(0.12, 0.07, 0.04, 0, -0.22, 0.066, knee));
  return merge(p);
}
export const SOLDIER_LEGS = [
  [0x2a3f66, 0x3a2b22], [0x2a3f66, 0x3a2b22], [0x22324f, 0x1b1714, 0x111418], [0xdfe8f5, 0x9aa6b8, 0x6ff7ff], [0x1f3f7a, 0x14141a, 0xffc83a],
];

// ------------------------------------------------------------ enemies
export const ENEMY_MODELS = {
  raider() { // red raider with a club
    const c = 0xff4a54, strap = 0x3a2228, metal = 0xd8dee6;
    return [torso(c, 1.05, 0.82, 0.17),
      box(0.05, 0.36, 0.03, 0, 0.67, 0.135, strap, 0, 0, 0.6), box(0.05, 0.36, 0.03, 0, 0.67, 0.137, strap, 0, 0, -0.6),
      ...belt(0x2b2024, metal, 0.176),
      dome(0.095, -0.17, 0.8, 0, strap, 10, 5, 1, 0.75, 1), dome(0.095, 0.17, 0.8, 0, strap, 10, 5, 1, 0.75, 1),
      cone(0.025, 0.09, -0.19, 0.89, 0, metal, 0, 0.5), cone(0.025, 0.09, 0.19, 0.89, 0, metal, 0, -0.5),
      ...armsMelee(c), rod([0.21, 0.82, 0.16], [0.17, 1.22, 0.3], 0.024, 0.06, 0x9a6a3a), ball(0.062, 0.17, 1.22, 0.3, 0x9a6a3a, 8, 6),
      ...head({ brows: true, ears: false }), cyl(0.139, 0.135, 0.08, 0, 0.9, 0, 0x26222c, 14),
      dome(0.163, 0, 0.99, 0, 0xb9232f, 14, 7, 1, 0.92, 1.04), cyl(0.17, 0.175, 0.035, 0, 0.99, 0, strap, 14),
      cone(0.038, 0.17, -0.17, 1.08, 0, 0xf3ecdc, 0, 0.95), cone(0.038, 0.17, 0.17, 1.08, 0, 0xf3ecdc, 0, -0.95)];
  },
  gunner() { // rifleman in a beanie
    const c = 0xe23b46, v = 0x2b2024;
    return [torso(c), box(0.28, 0.22, 0.05, 0, 0.68, 0.118, v), box(0.07, 0.06, 0.03, 0.07, 0.62, 0.148, 0x3a2a30),
      ...belt(0x1b1714, 0xd8dee6), ...shoulders(c), ...armsRifle(c, 0x2a2228), ...gunParts(1),
      ...head({ brows: true }), box(0.08, 0.02, 0.012, 0, 0.915, 0.13, 0x3a2420),
      dome(0.152, 0, 0.975, 0, 0x7a1c26, 14, 7, 1, 1.08, 1.0, 0.55), cyl(0.153, 0.157, 0.05, 0, 0.98, 0, 0x5a141c, 14),
      ball(0.035, 0, 1.15, 0, 0xffffff, 8, 6)];
  },
  nomad() { // desert swordsman, head wrap and scimitar
    const c = 0xd8b07a, sash = 0xc23a2a, cloth = 0xf1e6cf;
    return [torso(c), cyl(0.17, 0.25, 0.3, 0, 0.38, 0, c, 12, 0, 0, 0.85), ...belt(sash, 0xffc83a, 0.175),
      ...shoulders(c), ...armsMelee(c),
      box(0.03, 0.26, 0.09, 0.2, 1.0, 0.22, 0xe6ebf0, 0.25), box(0.03, 0.22, 0.08, 0.18, 1.22, 0.32, 0xe6ebf0, 0.7),
      box(0.13, 0.03, 0.04, 0.21, 0.87, 0.18, 0xffc83a, 0.3),
      ...head({ brows: true, ears: false }), cyl(0.14, 0.137, 0.09, 0, 0.9, 0, cloth, 14),
      dome(0.168, 0, 0.97, 0, cloth, 14, 7, 1, 1.0, 1.05, 0.55), torus(0.16, 0.025, 0, 1.0, 0, 0xd9c9a6, Math.PI / 2)];
  },
  bandit() { // desert gunslinger: wide hat, bandana, bandolier
    const c = 0xc9925a, vest = 0x6b4426;
    return [torso(c), box(0.12, 0.24, 0.05, -0.09, 0.68, 0.11, vest), box(0.12, 0.24, 0.05, 0.09, 0.68, 0.11, vest),
      rod([-0.15, 0.84, 0.12], [0.14, 0.53, 0.13], 0.022, 0.022, 0x3a2418, 6),
      ...belt(0x3a2418, 0xffc83a), ...shoulders(c), ...armsRifle(c), ...gunParts(1),
      ...head({ brows: true, skin: 0xe0a878 }), cyl(0.14, 0.136, 0.08, 0, 0.9, 0, 0xc0392b, 14),
      cyl(0.27, 0.27, 0.02, 0, 1.04, 0, 0x6b4426, 18), cyl(0.12, 0.145, 0.14, 0, 1.11, 0, 0x7a4f2e, 14),
      cyl(0.147, 0.147, 0.03, 0, 1.06, 0, 0x2b1d18, 14)];
  },
  knight() { // armoured knight with sword and shield
    const steel = 0xb8c4d6, tab = 0x6a3db8, gold = 0xffc83a;
    return [torso(steel), box(0.22, 0.34, 0.03, 0, 0.64, 0.135, tab), box(0.05, 0.16, 0.012, 0, 0.67, 0.152, gold), box(0.12, 0.04, 0.012, 0, 0.7, 0.152, gold),
      ...belt(0x3a3040, gold),
      dome(0.1, -0.18, 0.8, 0, steel, 10, 5, 1.1, 0.8, 1.1), dome(0.1, 0.18, 0.8, 0, steel, 10, 5, 1.1, 0.8, 1.1),
      ...armsMelee(steel, 0x6a7385), ...sword(0xe6ebf0, gold), ...shield(tab, gold),
      cyl(0.15, 0.15, 0.25, 0, 0.97, 0, steel, 14), dome(0.15, 0, 1.095, 0, steel, 14, 6),
      box(0.2, 0.025, 0.02, 0, 0.985, 0.148, 0x111111), box(0.025, 0.12, 0.02, 0, 0.93, 0.148, 0x111111),
      cone(0.04, 0.22, 0, 1.3, -0.03, tab, -0.4)];
  },
  frost() { // parka with fur hood, ice blaster
    const c = 0xf2f6fb, fur = 0xd9cbb3, X = 0.07, Y = 0.735;
    return [torso(c, 1.08, 0.86), box(0.03, 0.3, 0.02, 0, 0.66, 0.14, 0x9fb4c8), ...belt(0x5a6a80, 0x8fe3ff),
      ...shoulders(c, 0.08), ...armsRifle(c, 0x5a6a80, 0.052),
      box(0.08, 0.09, 0.3, X, Y, 0.3, 0xbfe9ff), rod([X, Y, 0.45], [X, Y, 0.7], 0.03, 0.026, 0x8fe3ff), cone(0.045, 0.14, X, Y, 0.77, 0xdffbff, Math.PI / 2),
      box(0.04, 0.09, 0.05, X, Y - 0.08, 0.22, 0x5a6a80, 0.25),
      ...head({ brows: true, skin: 0xf1c7a8 }),
      dome(0.18, 0, 0.95, -0.02, c, 14, 8, 1, 1.05, 1.0, 0.62), torus(0.14, 0.045, 0, 0.95, 0.07, fur),
      cyl(0.034, 0.034, 0.03, -0.05, 1.02, 0.13, 0x3fa9ff, 10, Math.PI / 2), cyl(0.034, 0.034, 0.03, 0.05, 1.02, 0.13, 0x3fa9ff, 10, Math.PI / 2)];
  },
  skeleton() { // bone warrior with rusty sword
    const bone = 0xefe8d8, robe = 0x2a2228;
    return [torso(robe, 0.9, 0.75), box(0.24, 0.022, 0.03, 0, 0.6, 0.125, bone), box(0.26, 0.022, 0.03, 0, 0.66, 0.13, bone),
      box(0.24, 0.022, 0.03, 0, 0.72, 0.125, bone), box(0.03, 0.2, 0.03, 0, 0.66, 0.133, bone),
      ...belt(0x3a2a2a, 0x8a7a6a, 0.15), ...shoulders(bone, 0.055), ...armsMelee(bone, bone, 0.03), ...sword(0x9a8a7a, 0x5a4a3a),
      ball(0.14, 0, 0.965, 0, bone, 14, 12), ball(0.036, -0.048, 0.965, 0.112, 0x0d0a0c, 8, 6), ball(0.036, 0.048, 0.965, 0.112, 0x0d0a0c, 8, 6),
      cone(0.018, 0.04, 0, 0.92, 0.13, 0x0d0a0c, Math.PI), box(0.14, 0.05, 0.09, 0, 0.875, 0.05, bone),
      dome(0.15, 0, 1.0, 0, 0x3a3236, 12, 6, 1, 0.7, 1),
      cone(0.03, 0.12, -0.13, 1.08, 0, 0x8a7a6a, 0, 0.8), cone(0.03, 0.12, 0.13, 1.08, 0, 0x8a7a6a, 0, -0.8)];
  },
  demon() { // horned demon with a fire staff
    const c = 0x8a1c1c, skin = 0xc0392b, horn = 0x1a1416;
    return [torso(c), box(0.28, 0.2, 0.05, 0, 0.69, 0.118, 0x2a1416), box(0.06, 0.06, 0.02, 0, 0.7, 0.146, 0xff7a1a),
      ...belt(0x1a1416, 0xff7a1a),
      dome(0.095, -0.17, 0.8, 0, 0x2a1416, 10, 5, 1, 0.75, 1), dome(0.095, 0.17, 0.8, 0, 0x2a1416, 10, 5, 1, 0.75, 1),
      cone(0.025, 0.1, -0.19, 0.9, 0, 0xff7a1a, 0, 0.5), cone(0.025, 0.1, 0.19, 0.9, 0, 0xff7a1a, 0, -0.5),
      ...armsRifle(c, skin),
      rod([0.06, 0.42, 0.24], [0.08, 1.25, 0.33], 0.022, 0.022, 0x2a1a1a), ball(0.07, 0.08, 1.3, 0.33, 0xff7a1a, 10, 8),
      cone(0.04, 0.14, 0.08, 1.4, 0.33, 0xffd23a), torus(0.08, 0.012, 0.08, 1.3, 0.33, 0x2a1a1a, Math.PI / 2),
      ...head({ skin, eye: 0xffe14d, eyeR: 0.026, brows: true, browCol: horn, noseCol: 0x9a2a20, ears: false }),
      cone(0.04, 0.2, -0.11, 1.1, 0, horn, 0, 0.55), cone(0.025, 0.12, -0.18, 1.24, 0, horn, 0, 1.1),
      cone(0.04, 0.2, 0.11, 1.1, 0, horn, 0, -0.55), cone(0.025, 0.12, 0.18, 1.24, 0, horn, 0, -1.1)];
  },
};
export const ENEMY_LEGS = {
  raider: [0x4a1d29, 0x2b1d18], gunner: [0x2b2f3a, 0x1d1a18], nomad: [0xc9a06a, 0x6b4426], bandit: [0x3d5a80, 0x6b4426],
  knight: [0x9aa6b8, 0x6a7385, 0xb8c4d6], frost: [0xc7d3e0, 0x5a4a3a], skeleton: [0xefe8d8, 0x3a3236], demon: [0x2a1416, 0x120c0e],
};
export const buildEnemy = (type) => mirrorX(merge(ENEMY_MODELS[type]()));
export const buildEnemyLeg = (type) => { const l = ENEMY_LEGS[type]; return buildLeg(l[0], l[1], l[2]); };


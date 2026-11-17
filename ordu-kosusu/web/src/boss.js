// Boss models (one per world). Animated parts: body, legL/legR, armL/armR (pivots).
// Each pivot holds at most two merged meshes (lit + glowing), so a detailed boss costs ~10 draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addRim, plain, box, ball, dome, cyl, cone, rod, tint } from './models.js';

// ------------------------------------------------------------ bosses
export const BOSSES = {
  orc: { name: 'ORK DEVİ' },
  sand: { name: 'KUM DEVİ' },
  yeti: { name: 'YETİ' },
  demon: { name: 'ATEŞ İBLİSİ' },
  gorilla: { name: 'DEV GORİL' },
};

const C = (g, hex) => { if (g.attributes.uv) g.deleteAttribute('uv'); return tint(g, hex); };
const capsule = (r, len, x, y, z, hex, sx = 1, sy = 1, sz = 1) => C(new THREE.CapsuleGeometry(r, len, 5, 14).scale(sx, sy, sz).translate(x, y, z), hex);
const ico = (r, x, y, z, hex, det = 0, sx = 1, sy = 1, sz = 1) => C(new THREE.IcosahedronGeometry(r, det).scale(sx, sy, sz).translate(x, y, z), hex);
const oct = (r, x, y, z, hex, sx = 1, sy = 1, sz = 1, rz = 0, rx = 0) => C(new THREE.OctahedronGeometry(r, 0).scale(sx, sy, sz).rotateZ(rz).rotateX(rx).translate(x, y, z), hex);
const torus = (R, r, x, y, z, hex, rx = 0, ry = 0, sx = 1, sy = 1, sz = 1) => C(new THREE.TorusGeometry(R, r, 6, 20).rotateX(rx).rotateY(ry).scale(sx, sy, sz).translate(x, y, z), hex);
// tapered chain through points (horns, tails, wing bones)
function chain(pts, r0, r1, hex, tip = true) {
  const out = [], n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const ra = r0 + (r1 - r0) * (i / n), rb = r0 + (r1 - r0) * ((i + 1) / n);
    if (tip && i === n - 1) out.push(rod(pts[i], pts[i + 1], ra, 0.005, hex, 8));
    else out.push(rod(pts[i], pts[i + 1], ra, rb, hex, 8));
    if (i > 0) out.push(ball(ra, ...pts[i], hex, 8, 6));
  }
  return out;
}
const mirror = (fn) => [...fn(-1), ...fn(1)];

export function buildBoss(kind) {
  const P = BOSSES[kind];
  const group = new THREE.Group();
  const mat = addRim(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.38);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const own = [mat, glowMat];
  const body = new THREE.Group(); group.add(body);
  const pivot = (x, y) => { const g = new THREE.Group(); g.position.set(x, y, 0); body.add(g); return g; };
  const legL = pivot(-0.6, 2.1), legR = pivot(0.6, 2.1), armL = pivot(-1.5, 4.0), armR = pivot(1.5, 4.0);
  const parts = new Map([body, legL, legR, armL, armR].map((g) => [g, [[], []]]));
  const L = (g, ...gs) => parts.get(g)[0].push(...gs);
  const Gw = (g, ...gs) => parts.get(g)[1].push(...gs);
  const legs = [[legL, -1], [legR, 1]], arms = [[armL, -1], [armR, 1]];

  // ---------------------------------------------------------- shared face pieces
  const eyes = (sclera, pupil, y = 4.82, glow = false) => {
    for (const s of [-1, 1]) {
      L(body, ball(0.17, s * 0.28, y, 0.66, sclera, 12, 10));
      (glow ? Gw : L)(body, ball(0.085, s * 0.27, y - 0.02, 0.81, pupil, 10, 8));
      L(body, box(0.4, 0.1, 0.1, s * 0.28, y + 0.21, 0.73, 0x1d1a24, 0, 0, s * 0.42));
    }
  };
  const mouth = (y, inner, tooth, w = 0.46, z = 0.7) => {
    L(body, ball(1, 0, y, z, inner, 12, 8, w / 2, 0.11, 0.09));
    for (let i = -2; i <= 2; i++) L(body, box(0.07, 0.07, 0.04, i * w * 0.18, y + 0.06, z + 0.08, tooth));
  };

  // ---------------------------------------------------------- per-boss bodies
  if (kind === 'orc') {
    const skin = 0x8fd65e, skinD = 0x72bb4a, tunic = 0xd8343f, iron = 0x7d8796, ironD = 0x4a5260, leather = 0x5a3a24, bone = 0xf3ecdc, fur = 0x7a5a3a;
    L(body,
      capsule(1.05, 1.0, 0, 3.15, 0, tunic, 1.2, 1, 0.9),
      ball(1, 0, 3.5, 0.36, iron, 18, 12, 1.0, 0.82, 0.64),
      box(0.12, 1.1, 0.1, 0, 3.45, 1.0, ironD),
      cyl(1.24, 1.24, 0.42, 0, 2.35, 0, leather, 18),
      ball(0.24, 0, 2.38, 1.2, bone, 12, 10, 1, 1.1, 0.7),
      ball(0.05, -0.08, 2.42, 1.36, 0x2a1a14, 6, 4), ball(0.05, 0.08, 2.42, 1.36, 0x2a1a14, 6, 4),
      box(0.95, 1.0, 0.08, 0, 1.75, 1.1, tunic, -0.1), box(0.97, 0.12, 0.1, 0, 1.28, 1.15, ironD, -0.1),
      box(0.95, 1.0, 0.08, 0, 1.75, -1.02, tunic, 0.1));
    for (const s of [-1, 1]) L(body, box(0.24, 2.6, 0.1, 0, 3.2, 1.06, leather, 0, 0, s * 0.55));
    for (let k = 0; k < 6; k++) { const a = -0.9 + k * 0.36; L(body, ball(0.055, Math.sin(a) * 0.82, 3.5 + Math.cos(a) * 0.52, 0.95, 0xc8d0dc, 6, 4)); }
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; L(body, ico(0.3, Math.cos(a) * 0.85, 4.2 + (k % 2) * 0.06, Math.sin(a) * 0.7, k % 2 ? fur : 0x6a4a2e, 0)); }
    // head
    L(body, ball(0.78, 0, 4.78, 0.05, skin, 18, 14), ball(0.62, 0, 4.45, 0.22, skinD, 14, 10, 1.15, 0.72, 1));
    eyes(0xfff6d0, 0x16233b);
    mouth(4.36, 0x3a1420, 0xf3ecdc, 0.5, 0.82);
    L(body, ball(0.15, 0, 4.66, 0.82, 0x6fb84a, 10, 8, 1.2, 0.9, 1));
    for (const s of [-1, 1]) {
      L(body, cone(0.08, 0.36, s * 0.25, 4.52, 0.86, bone, -0.15, -s * 0.15));
      L(body, cone(0.15, 0.6, s * 0.86, 4.92, 0, skin, 0, -s * 1.25));
      L(body, ball(0.05, s * 0.98, 4.82, 0.1, 0xffc83a, 6, 4));
    }
    // helmet with horns and nose guard
    L(body, dome(0.84, 0, 4.88, 0.02, ironD, 18, 8, 1, 0.92, 1, 0.5), cyl(0.86, 0.86, 0.12, 0, 4.9, 0.02, iron, 18), box(0.12, 0.4, 0.1, 0, 4.85, 0.84, iron));
    L(body, cone(0.12, 0.45, 0, 5.85, 0, iron));
    for (const s of [-1, 1]) L(body, ...chain([[s * 0.6, 5.3, 0], [s * 1.0, 5.55, 0.05], [s * 1.15, 6.0, 0.15], [s * 1.05, 6.4, 0.25]], 0.17, 0.05, bone));
    // pauldrons
    for (const s of [-1, 1]) {
      L(body, dome(0.7, s * 1.42, 4.0, 0, ironD, 16, 8, 1, 0.8, 1, 0.5), dome(0.76, s * 1.42, 3.84, 0, iron, 16, 8, 1, 0.45, 1, 0.5));
      for (let k = -1; k <= 1; k++) L(body, cone(0.11, 0.42, s * 1.42 + k * 0.28, 4.62 - Math.abs(k) * 0.08, 0, bone, 0, -s * 0.25));
    }
    for (const [g, s] of legs) {
      L(g, capsule(0.42, 0.75, 0, -0.7, 0, 0x4a3a40), cyl(0.46, 0.52, 0.8, 0, -1.6, 0, 0x3a2a24, 14), cyl(0.54, 0.54, 0.16, 0, -1.22, 0, fur, 14),
        ball(0.27, 0, -1.0, 0.36, iron, 10, 8, 1, 1, 0.6), dome(0.52, 0, -2.1, 0.22, 0x3a2a24, 14, 8, 1, 0.75, 1.4, 0.5), dome(0.3, 0, -2.1, 0.75, iron, 10, 6, 1, 0.8, 0.8, 0.5));
      void s;
    }
    for (const [g, s] of arms) {
      L(g, capsule(0.31, 1.1, 0, -0.85, 0, skin), cyl(0.38, 0.35, 0.55, 0, -1.45, 0, leather, 14), cyl(0.4, 0.4, 0.1, 0, -1.24, 0, iron, 14), cyl(0.4, 0.4, 0.1, 0, -1.66, 0, iron, 14),
        ball(0.43, 0, -1.97, 0, skin, 14, 10), ball(0.16, -s * 0.2, -1.84, 0.27, skinD, 8, 6));
      for (let k = 0; k < 3; k++) L(g, cone(0.07, 0.24, s * 0.38, -1.3 - k * 0.15, 0, iron, 0, -s * Math.PI / 2));
    }
    // round shield on the left forearm
    L(armL, cyl(0.78, 0.78, 0.12, -0.42, -1.35, 0.05, 0x8a5a33, 18, 0, Math.PI / 2), torus(0.76, 0.06, -0.49, -1.35, 0.05, ironD, 0, Math.PI / 2),
      ball(0.22, -0.5, -1.35, 0.05, iron, 10, 8, 0.6, 1, 1), box(0.06, 1.3, 0.12, -0.49, -1.35, 0.05, ironD));
    // war hammer
    L(armR, cyl(0.11, 0.11, 2.1, 0, -2.65, 0, 0x7a4f2a, 10), cyl(0.13, 0.13, 0.12, 0, -2.4, 0, leather, 10), cyl(0.13, 0.13, 0.12, 0, -2.75, 0, leather, 10),
      box(0.85, 0.85, 1.35, 0, -3.75, 0, iron), box(0.95, 0.95, 0.16, 0, -3.75, 0.55, ironD), box(0.95, 0.95, 0.16, 0, -3.75, -0.55, ironD));
    for (const s of [-1, 1]) for (const z of [-0.3, 0.3]) L(armR, cone(0.13, 0.36, s * 0.58, -3.75, z, 0xc8d0dc, 0, -s * Math.PI / 2));
  } else if (kind === 'sand') {
    const skin = 0xd9a066, skinD = 0xc48a50, vest = 0x2a5aa8, vestD = 0x1f4686, gold = 0xffc83a, goldD = 0xd89a1a, sash = 0xd8343f, pants = 0xf4ecdc, beard = 0x2a1a14;
    L(body,
      capsule(1.05, 1.0, 0, 3.15, 0, skin, 1.2, 1, 0.9),
      ball(1, -0.62, 3.3, 0.3, vest, 14, 12, 0.66, 1.25, 0.68), ball(1, 0.62, 3.3, 0.3, vest, 14, 12, 0.66, 1.25, 0.68),
      box(0.08, 1.9, 0.08, -0.32, 3.3, 0.9, gold, 0, 0, -0.08), box(0.08, 1.9, 0.08, 0.32, 3.3, 0.9, gold, 0, 0, 0.08),
      cyl(1.26, 1.24, 0.5, 0, 2.4, 0, sash, 18), torus(1.24, 0.06, 0, 2.62, 0, gold, Math.PI / 2), torus(1.24, 0.06, 0, 2.17, 0, gold, Math.PI / 2),
      box(0.3, 0.9, 0.08, 0.5, 1.85, 1.12, sash, -0.1, 0, 0.12), box(0.26, 0.8, 0.08, 0.75, 1.9, 1.06, 0xb82a34, -0.1, 0, 0.25),
      cyl(0.36, 0.36, 0.1, 0, 3.55, 1.0, gold, 16, Math.PI / 2), cyl(0.24, 0.24, 0.12, 0, 3.55, 1.04, goldD, 16, Math.PI / 2));
    Gw(body, ball(0.13, 0, 3.55, 1.1, 0xff3b5c, 10, 8));
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; L(body, cone(0.06, 0.2, Math.cos(a) * 0.45, 3.55 + Math.sin(a) * 0.45, 1.0, gold, 0, a - Math.PI / 2)); }
    // head: turban, beard, mustache, earrings
    L(body, ball(0.78, 0, 4.75, 0.05, skin, 18, 14));
    eyes(0xffffff, 0x16233b);
    L(body, ball(0.15, 0, 4.62, 0.8, skinD, 10, 8, 1, 1.2, 1));
    L(body, cone(0.38, 0.8, 0, 3.98, 0.84, beard, Math.PI - 0.35, 0, 10), ball(0.42, 0, 4.36, 0.5, beard, 12, 8, 1.1, 0.6, 0.9));
    for (const s of [-1, 1]) {
      L(body, ...chain([[s * 0.05, 4.5, 0.82], [s * 0.3, 4.46, 0.8], [s * 0.5, 4.56, 0.7], [s * 0.58, 4.72, 0.62]], 0.07, 0.025, beard));
      L(body, torus(0.1, 0.025, s * 0.8, 4.55, 0.05, gold, 0, Math.PI / 2));
    }
    L(body, ball(0.9, 0, 5.18, -0.05, 0xf4ecdc, 16, 12, 1, 0.72, 1), torus(0.8, 0.15, 0, 5.0, 0, 0xe6d8bc, Math.PI / 2), torus(0.7, 0.12, 0, 5.38, -0.05, 0xe6d8bc, Math.PI / 2, 0, 1, 1, 1));
    L(body, cyl(0.22, 0.22, 0.1, 0, 5.12, 0.82, gold, 14, Math.PI / 2 - 0.3));
    Gw(body, ball(0.15, 0, 5.12, 0.88, 0xff3b5c, 10, 8));
    L(body, ...chain([[0, 5.25, 0.78], [0.05, 5.7, 0.7], [0.18, 6.1, 0.5]], 0.09, 0.03, 0xffffff), ball(0.06, 0, 5.3, 0.82, gold, 6, 4));
    // pauldrons: golden suns
    for (const s of [-1, 1]) {
      L(body, dome(0.66, s * 1.42, 4.02, 0, gold, 16, 8, 1, 0.8, 1, 0.5), dome(0.72, s * 1.42, 3.86, 0, goldD, 16, 8, 1, 0.4, 1, 0.5));
      for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k / 6) * Math.PI; L(body, cone(0.08, 0.32, s * 1.42 + Math.sin(a) * 0.62, 4.15, Math.cos(a) * 0.62, gold, Math.cos(a) * 1.3, -Math.sin(a) * 1.3)); }
    }
    for (const [g, s] of legs) {
      L(g, capsule(0.5, 0.6, 0, -0.85, 0, pants, 1, 1, 1), cyl(0.36, 0.34, 0.25, 0, -1.6, 0, gold, 14),
        cyl(0.34, 0.4, 0.4, 0, -1.85, 0, 0xb82a34, 14), dome(0.48, 0, -2.1, 0.2, 0xb82a34, 14, 8, 1, 0.7, 1.45, 0.5));
      L(g, ...chain([[0, -1.95, 0.75], [0, -1.85, 0.95], [0, -1.6, 1.0]], 0.13, 0.04, gold));
      void s;
    }
    for (const [g, s] of arms) {
      L(g, capsule(0.3, 1.1, 0, -0.85, 0, skin), torus(0.32, 0.06, 0, -0.55, 0, gold, Math.PI / 2), cyl(0.37, 0.34, 0.5, 0, -1.45, 0, gold, 14), cyl(0.39, 0.39, 0.08, 0, -1.25, 0, goldD, 14),
        ball(0.42, 0, -1.95, 0, skin, 14, 10), ball(0.15, -s * 0.2, -1.84, 0.26, skinD, 8, 6));
      Gw(g, ball(0.07, s * 0.36, -1.45, 0, 0x3fd0ff, 8, 6));
    }
    // golden flanged mace
    L(armR, cyl(0.11, 0.11, 2.0, 0, -2.6, 0, 0x7a4f2a, 10), torus(0.13, 0.04, 0, -2.3, 0, gold, Math.PI / 2), torus(0.13, 0.04, 0, -2.9, 0, gold, Math.PI / 2),
      ball(0.55, 0, -3.85, 0, gold, 16, 12), cone(0.18, 0.5, 0, -4.55, 0, goldD, Math.PI));
    for (let k = 0; k < 6; k++) L(armR, box(0.1, 0.8, 0.5, 0, -3.85, 0, goldD).translate(0, 3.85, 0).rotateY(k * Math.PI / 3).translate(0, -3.85, 0).translate(Math.sin(k * Math.PI / 3) * 0.48, 0, Math.cos(k * Math.PI / 3) * 0.48));
    Gw(armR, ball(0.12, 0, -3.85, 0.56, 0x3fd0ff, 8, 6), ball(0.12, 0, -3.85, -0.56, 0x3fd0ff, 8, 6));
  } else if (kind === 'yeti') {
    const fur = 0xf2f6fb, furS = 0xd6e2f0, skin = 0x9fd3ff, skinD = 0x6fa8d8, ice = 0x8fe3ff, horn = 0xe8dcc0, claw = 0x3a4a60;
    L(body, capsule(1.05, 1.0, 0, 3.15, 0, fur, 1.25, 1, 0.95), ball(1, 0, 3.15, 0.45, skin, 16, 12, 0.75, 0.95, 0.6));
    // shaggy fur clumps around the torso silhouette
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2, y = 2.3 + (k % 3) * 0.75;
      if (Math.cos(a) > 0.55 && y > 2.6) continue;
      L(body, ico(0.42, Math.sin(a) * 1.15, y, Math.cos(a) * 0.82, k % 2 ? fur : furS, 0));
    }
    for (let k = 0; k < 7; k++) L(body, ico(0.26, -0.75 + k * 0.25, 2.0 - (k % 2) * 0.12, 0.85, k % 2 ? fur : furS, 0, 1, 1.4, 1));
    L(body, cyl(1.22, 1.22, 0.24, 0, 2.45, 0, 0x5a7aa0, 16));
    Gw(body, oct(0.2, 0, 2.45, 1.22, ice, 1, 1.4, 0.6));
    // head: blue face, fur hood, horns, fangs
    L(body, ball(0.78, 0, 4.75, 0.05, skin, 18, 14), ball(0.6, 0, 4.42, 0.25, skinD, 14, 10, 1.15, 0.68, 1));
    eyes(0xffffff, 0x16233b, 4.85);
    mouth(4.36, 0x1d2a44, 0xffffff, 0.56, 0.82);
    L(body, ball(0.14, 0, 4.66, 0.82, 0x3d6fa8, 10, 8, 1.3, 0.9, 1));
    for (const s of [-1, 1]) L(body, cone(0.08, 0.3, s * 0.22, 4.3, 0.86, 0xffffff, Math.PI - 0.15, 0));
    for (const [x, y, z, r] of [[0, 5.35, -0.1, 0.55], [-0.5, 5.18, -0.05, 0.45], [0.5, 5.18, -0.05, 0.45], [0, 5.0, -0.5, 0.62], [-0.32, 5.48, 0.22, 0.32], [0.32, 5.48, 0.22, 0.32], [0, 5.55, 0.25, 0.3], [-0.72, 4.75, -0.1, 0.36], [0.72, 4.75, -0.1, 0.36]]) L(body, ico(r, x, y, z, fur, 1));
    for (const s of [-1, 1]) L(body, ...chain([[s * 0.6, 5.35, 0], [s * 1.0, 5.45, -0.1], [s * 1.2, 5.85, 0.0], [s * 1.12, 6.25, 0.15]], 0.15, 0.05, horn));
    // icy shoulders
    for (const s of [-1, 1]) {
      L(body, ico(0.62, s * 1.42, 4.05, 0, fur, 1, 1, 0.85, 1), ico(0.42, s * 1.6, 3.75, 0.2, furS, 0));
      Gw(body, oct(0.18, s * 1.35, 4.65, 0, ice, 1, 3, 1, -s * 0.2), oct(0.15, s * 1.7, 4.5, -0.1, 0xc8f3ff, 1, 2.6, 1, -s * 0.6), oct(0.13, s * 1.15, 4.5, 0.25, 0x7fd8ff, 1, 2.4, 1, s * 0.2, 0.3));
    }
    for (const [g] of legs) {
      L(g, capsule(0.48, 0.7, 0, -0.8, 0, fur), ico(0.42, 0, -1.3, 0.15, furS, 0), ico(0.4, 0.15, -1.55, -0.1, fur, 0),
        dome(0.58, 0, -2.1, 0.22, skin, 14, 8, 1, 0.6, 1.5, 0.5));
      for (let k = -1; k <= 1; k++) L(g, cone(0.08, 0.26, k * 0.22, -1.98, 0.98, claw, Math.PI / 2));
    }
    for (const [g, s] of arms) {
      L(g, capsule(0.34, 1.1, 0, -0.85, 0, fur), ico(0.36, s * 0.08, -1.0, 0.05, furS, 0), ico(0.4, 0, -1.45, 0, fur, 0),
        ball(0.44, 0, -1.97, 0, skin, 14, 10));
      for (let k = -1; k <= 1; k++) L(g, cone(0.06, 0.22, k * 0.18, -2.3, 0.22, claw, Math.PI - 0.6));
    }
    // ice club
    L(armR, cyl(0.12, 0.12, 2.1, 0, -2.65, 0, 0x6a4a30, 10), torus(0.14, 0.04, 0, -2.4, 0, 0x5a7aa0, Math.PI / 2));
    L(armR, oct(0.55, 0, -3.95, 0, ice, 1, 1.8, 1), oct(0.4, 0.35, -3.75, 0.2, 0xb0ecff, 1, 1.9, 1, -0.5), oct(0.38, -0.3, -3.8, -0.2, 0x7fd8ff, 1, 1.8, 1, 0.5),
      oct(0.32, 0, -3.7, 0.42, 0xc8f3ff, 1, 1.8, 1, 0, 0.5), oct(0.3, 0, -3.7, -0.42, 0x9fe6ff, 1, 1.8, 1, 0, -0.5));
    Gw(armR, oct(0.3, 0, -4.0, 0, 0xe6faff, 1, 2.2, 1));
  } else if (kind === 'gorilla') {
    const fur = 0x4a4a56, furD = 0x3a3a44, silver = 0x9a9aa6, face = 0x6a5a58, faceD = 0x54464a, stone = 0x8a9488, stoneD = 0x6e786c, moss = 0x4f9a3a, mossL = 0x6cc04c, rune = 0x9aff5a, vineC = 0x3f7a2a;
    // hunched torso, silver back, big chest
    L(body, capsule(1.08, 1.0, 0, 3.1, -0.05, fur, 1.32, 1, 1.0), ball(1, 0, 3.95, -0.45, silver, 16, 12, 1.15, 0.7, 0.75),
      ball(1, 0, 3.15, 0.42, face, 16, 12, 0.92, 1.0, 0.62), ball(1, 0, 2.35, 0.3, faceD, 14, 10, 0.75, 0.45, 0.6));
    for (let k = 0; k < 10; k++) { const a = Math.PI * 0.6 + (k / 9) * Math.PI * 0.8; L(body, ico(0.36, Math.cos(a) * 1.3, 2.4 + (k % 3) * 0.6, Math.sin(a) * 0.9 - 0.05, k % 2 ? fur : furD, 0)); }
    // mossy stone chest plate with glowing rune, vine belt
    L(body, ball(1, 0, 3.55, 0.5, stone, 7, 5, 0.85, 0.6, 0.55), C(new THREE.DodecahedronGeometry(0.5, 0).scale(1.4, 0.35, 0.8).translate(0, 4.05, 0.62), moss),
      torus(1.26, 0.09, 0, 2.3, 0, vineC, Math.PI / 2, 0, 1, 1, 0.8), ico(0.14, 0.5, 2.25, 1.0, 0xff5a3a, 0), ico(0.12, 0.62, 2.18, 0.95, 0xffd23a, 0));
    Gw(body, ...[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => box(0.06, 0.34, 0.04, sx * 0.12, 3.55 + sy * 0.12, 1.04, rune, 0, 0, sx * sy * 0.785)), ball(0.07, 0, 3.55, 1.04, rune, 8, 6));
    // head: brow ridge, sagittal crest, muzzle, glowing eyes, fangs
    L(body, ball(0.78, 0, 4.72, 0.0, fur, 18, 14), ball(0.55, 0, 5.15, -0.15, furD, 12, 8, 0.6, 1.0, 1.1),
      ball(1, 0, 4.78, 0.42, face, 16, 12, 0.6, 0.48, 0.5), ball(1, 0, 4.4, 0.5, face, 14, 10, 0.55, 0.38, 0.5),
      box(0.95, 0.2, 0.3, 0, 5.0, 0.62, faceD), ball(0.07, -0.1, 4.6, 0.98, 0x1a1418, 6, 4), ball(0.07, 0.1, 4.6, 0.98, 0x1a1418, 6, 4),
      ball(1, 0, 4.32, 0.92, 0x2a1418, 12, 8, 0.28, 0.09, 0.06));
    for (const s of [-1, 1]) {
      L(body, ball(0.13, s * 0.25, 4.84, 0.8, 0x1a1418, 10, 8), cone(0.06, 0.24, s * 0.16, 4.3, 0.95, 0xf3ecdc, Math.PI - 0.1), ball(0.15, s * 0.72, 4.82, -0.05, faceD, 8, 6, 0.6, 1, 1));
    }
    Gw(body, ball(0.07, -0.25, 4.84, 0.92, 0xd8ff5a, 8, 6), ball(0.07, 0.25, 4.84, 0.92, 0xd8ff5a, 8, 6));
    // mossy stone pauldrons
    for (const s of [-1, 1]) {
      L(body, C(new THREE.DodecahedronGeometry(0.7, 0).scale(1, 0.62, 1).translate(s * 1.45, 4.05, 0), stone), C(new THREE.DodecahedronGeometry(0.6, 0).scale(1.05, 0.3, 1).translate(s * 1.45, 4.42, 0), moss),
        C(new THREE.DodecahedronGeometry(0.35, 0).translate(s * 1.75, 3.75, 0.35), stoneD), ico(0.12, s * 1.3, 4.6, 0.3, mossL, 0), ico(0.1, s * 1.62, 4.55, -0.25, mossL, 0));
      L(body, rod([s * 1.0, 4.4, 0.75], [s * 0.2, 2.5, 1.05], 0.07, 0.07, vineC));
    }
    // short thick legs
    for (const [g] of legs) {
      L(g, capsule(0.48, 0.7, 0, -0.75, 0, fur), ico(0.42, 0, -1.25, 0.1, furD, 0), cyl(0.5, 0.55, 0.6, 0, -1.65, 0, fur, 12),
        dome(0.58, 0, -2.1, 0.25, face, 14, 8, 1, 0.6, 1.5, 0.5));
      for (let k = -1; k <= 1; k++) L(g, ball(0.13, k * 0.24, -2.0, 0.95, faceD, 8, 6));
      L(g, C(new THREE.DodecahedronGeometry(0.32, 0).scale(1, 0.8, 0.6).translate(0, -1.0, 0.42), stone));
    }
    // long heavy arms with stone bracers and huge knuckles
    for (const [g, s] of arms) {
      L(g, capsule(0.4, 1.0, 0, -0.85, 0, fur), ico(0.38, s * 0.1, -0.5, -0.1, furD, 0), cyl(0.44, 0.4, 0.55, 0, -1.45, 0, stone, 7), cyl(0.46, 0.46, 0.1, 0, -1.25, 0, moss, 7),
        ball(0.5, 0, -1.98, 0.05, face, 14, 10, 1, 0.9, 1.05));
      for (let k = -1; k <= 1; k++) L(g, ball(0.14, k * 0.2, -2.12, 0.42, faceD, 8, 6));
      Gw(g, box(0.06, 0.3, 0.04, s * 0.05, -1.45, 0.43, rune));
    }
    // log club with a vine-bound boulder head
    L(armR, cyl(0.17, 0.2, 2.1, 0, -2.65, 0, 0x6a4a2e, 8), torus(0.2, 0.05, 0, -2.3, 0, vineC, Math.PI / 2), torus(0.2, 0.05, 0, -2.85, 0, vineC, Math.PI / 2),
      C(new THREE.DodecahedronGeometry(0.72, 0).scale(1.05, 1, 1.15).translate(0, -3.8, 0), stone), C(new THREE.DodecahedronGeometry(0.55, 0).scale(1.2, 0.4, 1.2).translate(0, -3.4, 0), moss),
      torus(0.7, 0.06, 0, -3.8, 0, vineC, 0, Math.PI / 2), torus(0.68, 0.06, 0, -3.8, 0, vineC, Math.PI / 2 - 0.3));
    for (const [x, z] of [[0.6, 0.3], [-0.6, -0.2], [0, 0.75], [0, -0.75]]) L(armR, cone(0.1, 0.32, x, -3.85, z, stoneD, z ? Math.sign(z) * Math.PI / 2 : 0, x ? -Math.sign(x) * Math.PI / 2 : 0));
    Gw(armR, box(0.05, 0.4, 0.05, 0.62, -3.8, 0.18, rune, 0, 0, 0.3), box(0.05, 0.4, 0.05, -0.62, -3.8, -0.1, rune, 0, 0, -0.3));
  } else {
    const skin = 0xc0392b, skinD = 0x8a2418, armor = 0x2a1c22, armorE = 0x4a3238, horn = 0x1a1416, memb = 0x6a1a22, lava = 0xff7a1a, hot = 0xffc23a;
    L(body,
      capsule(1.05, 1.0, 0, 3.15, 0, skin, 1.2, 1, 0.9),
      ball(1, 0, 3.55, 0.34, armor, 18, 12, 1.05, 0.78, 0.66), box(1.4, 0.12, 0.1, 0, 3.0, 0.92, armorE),
      cyl(1.26, 1.24, 0.46, 0, 2.38, 0, armor, 18),
      box(0.95, 1.05, 0.08, 0, 1.72, 1.1, armor, -0.1), box(0.95, 1.05, 0.08, 0, 1.72, -1.04, armor, 0.1));
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) L(body, box(0.5, 0.12, 0.12, s * 0.42, 2.65 + k * 0.17, 0.93 - k * 0.01, skinD));
    Gw(body, ball(0.15, 0, 3.6, 0.98, hot, 10, 8, 1, 1.2, 0.4), box(0.05, 0.42, 0.04, -0.2, 3.86, 0.96, lava, 0, 0, 0.7), box(0.05, 0.42, 0.04, 0.2, 3.86, 0.96, lava, 0, 0, -0.7), box(0.06, 0.4, 0.04, -0.3, 3.45, 0.98, hot, 0, 0, 0.5), box(0.06, 0.4, 0.04, 0.3, 3.45, 0.98, hot, 0, 0, -0.5),
      box(1.2, 0.07, 0.05, 0, 2.38, 1.265, lava), ball(0.18, 0, 2.38, 1.27, hot, 10, 8, 1, 1, 0.5), box(0.8, 0.06, 0.05, 0, 1.3, 1.17, lava, -0.1));
    // skull buckle
    L(body, ball(0.2, 0, 2.38, 1.2, 0xe8dcc8, 10, 8, 1, 1.1, 0.6));
    // head: horns, glowing eyes, fangs, beard spikes
    L(body, ball(0.78, 0, 4.75, 0.05, skin, 18, 14), ball(0.6, 0, 4.42, 0.24, skinD, 14, 10, 1.1, 0.7, 1));
    for (const s of [-1, 1]) {
      L(body, ball(0.17, s * 0.28, 4.82, 0.66, 0x1a0a0a, 12, 10));
      L(body, box(0.42, 0.11, 0.1, s * 0.28, 5.02, 0.74, 0x1a0a0a, 0, 0, s * 0.5));
      L(body, cone(0.07, 0.28, s * 0.2, 4.36, 0.88, 0xf3ecdc, Math.PI - 0.1));
      L(body, cone(0.16, 0.55, s * 0.82, 4.95, -0.05, skinD, 0, -s * 1.35));
    }
    Gw(body, ball(0.11, -0.28, 4.81, 0.79, hot, 10, 8, 1.2, 0.8, 0.6), ball(0.11, 0.28, 4.81, 0.79, hot, 10, 8, 1.2, 0.8, 0.6), ball(1, 0, 4.4, 0.83, lava, 12, 8, 0.26, 0.09, 0.07));
    L(body, cone(0.12, 0.35, 0, 4.1, 0.55, horn, Math.PI + 0.4));
    for (const s of [-1, 1]) {
      L(body, ...chain([[s * 0.45, 5.3, 0.1], [s * 0.95, 5.55, 0.15], [s * 1.35, 5.6, 0.05], [s * 1.55, 6.05, -0.05], [s * 1.45, 6.6, 0.0]], 0.24, 0.06, horn));
      L(body, ...chain([[s * 0.2, 5.45, 0.4], [s * 0.3, 5.85, 0.45], [s * 0.25, 6.1, 0.55]], 0.09, 0.02, horn));
    }
    // spiked pauldrons with glowing rims
    for (const s of [-1, 1]) {
      L(body, dome(0.7, s * 1.42, 4.02, 0, armor, 16, 8, 1, 0.85, 1, 0.5), dome(0.76, s * 1.42, 3.86, 0, armorE, 16, 8, 1, 0.42, 1, 0.5));
      for (let k = -1; k <= 1; k++) L(body, cone(0.13, 0.6, s * 1.42 + k * 0.3, 4.72 - Math.abs(k) * 0.12, 0, horn, 0, -s * 0.3 - k * 0.2));
      Gw(body, torus(0.74, 0.035, s * 1.42, 3.88, 0, lava, Math.PI / 2));
    }
    // bat wings on the back
    for (const s of [-1, 1]) {
      const root = [s * 0.6, 4.1, -0.8], elbow = [s * 1.9, 5.4, -1.3], tip = [s * 3.4, 6.2, -1.1];
      L(body, ...chain([root, elbow, tip], 0.12, 0.04, armor));
      const f1 = [s * 2.9, 3.2, -1.3], f2 = [s * 2.0, 2.7, -1.2];
      L(body, ...chain([elbow, f1], 0.07, 0.02, armor), ...chain([elbow, f2], 0.07, 0.02, armor));
      const memG = new THREE.BufferGeometry();
      const pts = [root, elbow, f2, elbow, tip, f1, elbow, f1, f2, root, f2, [s * 0.7, 3.1, -0.9]];
      memG.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
      memG.computeVertexNormals();
      L(body, C(memG, memb));
      const back = memG.clone(); back.translate(0, 0, 0.0); const idx = back.attributes.position.array;
      for (let i = 0; i < idx.length; i += 9) for (let k = 0; k < 3; k++) { const t = idx[i + 3 + k]; idx[i + 3 + k] = idx[i + 6 + k]; idx[i + 6 + k] = t; }
      back.computeVertexNormals();
      L(body, C(back, memb));
    }
    // tail
    L(body, ...chain([[0, 2.2, -0.9], [0, 1.6, -1.6], [0.4, 1.0, -2.1], [0.9, 0.9, -2.4], [1.3, 1.3, -2.5]], 0.14, 0.05, skinD, false), cone(0.22, 0.4, 1.4, 1.5, -2.5, horn, 0, -0.6, 4));
    for (const [g] of legs) {
      L(g, capsule(0.42, 0.75, 0, -0.7, 0, skinD), cyl(0.47, 0.52, 0.85, 0, -1.6, 0, armor, 14), ball(0.3, 0, -1.05, 0.34, armorE, 10, 8, 1, 1, 0.6),
        cone(0.1, 0.4, 0, -0.95, 0.6, horn, Math.PI / 2), dome(0.52, 0, -2.1, 0.22, armor, 14, 8, 1, 0.75, 1.4, 0.5));
      Gw(g, box(0.06, 0.5, 0.04, 0, -1.6, 0.49, lava));
      for (let k = -1; k <= 1; k++) L(g, cone(0.07, 0.25, k * 0.2, -1.95, 0.95, horn, Math.PI / 2));
    }
    for (const [g, s] of arms) {
      L(g, capsule(0.32, 1.1, 0, -0.85, 0, skin), cyl(0.39, 0.35, 0.6, 0, -1.45, 0, armor, 14), ball(0.43, 0, -1.97, 0, skin, 14, 10));
      for (let k = 0; k < 3; k++) L(g, cone(0.08, 0.32, s * 0.38, -1.3 - k * 0.16, 0, horn, 0, -s * Math.PI / 2));
      Gw(g, torus(0.37, 0.03, 0, -1.2, 0, lava, Math.PI / 2), torus(0.37, 0.03, 0, -1.72, 0, lava, Math.PI / 2));
      for (let k = -1; k <= 1; k++) L(g, cone(0.05, 0.22, k * 0.18, -2.32, 0.2, 0x1a1416, Math.PI - 0.6));
    }
    // lava hammer
    L(armR, cyl(0.11, 0.11, 2.1, 0, -2.65, 0, 0x2a2228, 10), torus(0.14, 0.04, 0, -2.4, 0, armorE, Math.PI / 2),
      box(0.95, 0.95, 1.4, 0, -3.75, 0, 0x2a2228), box(1.0, 1.0, 0.14, 0, -3.75, 0.58, armorE), box(1.0, 1.0, 0.14, 0, -3.75, -0.58, armorE),
      cone(0.32, 0.6, 0, -3.75, 1.0, horn, Math.PI / 2), cone(0.32, 0.6, 0, -3.75, -1.0, horn, -Math.PI / 2));
    Gw(armR, box(0.97, 0.22, 1.0, 0, -3.75, 0, lava), box(0.22, 0.97, 1.0, 0, -3.75, 0, hot));
  }

  for (const [g, [lit, glw]] of parts) {
    if (lit.length) { const geo = mergeGeometries(lit.map(plain)); own.push(geo); g.add(new THREE.Mesh(geo, mat)); }
    if (glw.length) { const geo = mergeGeometries(glw.map(plain)); own.push(geo); g.add(new THREE.Mesh(geo, glowMat)); }
  }
  return { group, body, legL, legR, armL, armR, flashMats: [mat], name: P.name, own };
}

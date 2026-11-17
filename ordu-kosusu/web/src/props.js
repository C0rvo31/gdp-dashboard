// Level props: gate frames, wall tops, crate trims, coins, saw tracks, finish line and boss arena.
// Everything is vertex-coloured and merged so each prop family is one or two draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tint, plain, addRim } from './models.js';

const F = (g, hex) => tint(plain(g), hex);
const M = (parts) => mergeGeometries(parts.filter(Boolean));
const box = (w, h, d, x, y, z, hex) => F(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);

// shared materials (live for the whole session; never disposed per level)
export const PMAT = {
  solid: addRim(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.3),
  flat: addRim(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.3),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  coin: addRim(new THREE.MeshPhongMaterial({ vertexColors: true, emissive: 0x5a3800, specular: 0xfff0b0, shininess: 60 }), 0.55),
};

// per-world prop palette
const STYLE = {
  meadow: { post: 0xffffff, stripe: 0x3d8bff, beam: 0x27324a, light: 0xffe066, light2: 0xffffff, cap: 0xd8d2c4, pillar: 0xb8b0a0, top: 'grass',
    banner: 0xd8343f, banner2: 0xffd23a, pole: 0x8a5a33, stone: 0xbab2a2, stone2: 0x9a927f, floor: 0xc9b98f, flame: [0xff8a2a, 0xffe07a] },
  desert: { post: 0xfff3e0, stripe: 0xff8a3d, beam: 0x5a3a20, light: 0xffc83a, light2: 0xfff3e0, cap: 0xf3dfb5, pillar: 0xcf9f62, top: 'crenel',
    banner: 0x2a5aa8, banner2: 0xffc83a, pole: 0x8a5a33, stone: 0xdcb47c, stone2: 0xc49a60, floor: 0xe8c890, flame: [0xff8a2a, 0xffe07a] },
  snow: { post: 0xffffff, stripe: 0x3d8bff, beam: 0x2a3e5c, light: 0x9fe6ff, light2: 0xffffff, cap: 0xffffff, pillar: 0x9cc4e4, top: 'snow',
    banner: 0x2a6fd8, banner2: 0xffffff, pole: 0x6a4a30, stone: 0xbfdcf2, stone2: 0x9cc0de, floor: 0xd8ecfa, flame: [0x6fd0ff, 0xe6faff] },
  lava: { post: 0x3a3036, stripe: 0xff6a1a, beam: 0x1a1418, light: 0xff7a1a, light2: 0xffc23a, cap: 0x2a2228, pillar: 0x1e181c, top: 'spikes',
    banner: 0x8a1a1a, banner2: 0xff7a1a, pole: 0x2a2228, stone: 0x3a3038, stone2: 0x2a2228, floor: 0x2e2428, flame: [0xff5a10, 0xffc23a] },
};
const st = (th) => STYLE[th.key] || STYLE.meadow;

// ------------------------------------------------------------ gates
// Frame for a gate centred at x=0 with posts at -half, 0, +half (panels hang between them).
export function gateFrame(th, half) {
  const S = st(th), solid = [], glow = [];
  for (const px of [-half, 0, half]) {
    solid.push(box(0.64, 0.3, 0.64, px, 0.15, 0, 0x3c4458));
    solid.push(F(new THREE.CylinderGeometry(0.15, 0.17, 2.9, 12).translate(px, 1.6, 0), S.post));
    for (const y of [0.75, 1.45, 2.15]) solid.push(F(new THREE.CylinderGeometry(0.175, 0.175, 0.18, 12).translate(px, y, 0), S.stripe));
    solid.push(F(new THREE.CylinderGeometry(0.22, 0.2, 0.2, 12).translate(px, 3.16, 0), 0x3c4458));
    glow.push(F(new THREE.IcosahedronGeometry(px === 0 ? 0.22 : 0.18, 1).translate(px, 3.4, 0), S.light));
  }
  // top beam with marquee bulbs
  solid.push(box(half * 2 + 0.3, 0.28, 0.26, 0, 2.93, 0, S.beam));
  solid.push(box(half * 2 + 0.36, 0.06, 0.3, 0, 3.08, 0, S.stripe));
  let n = 0;
  for (let x = -half + 0.45; x <= half - 0.44; x += 0.5) {
    if (Math.abs(x) < 0.3) continue;
    const c = n++ % 2 ? S.light : S.light2;
    glow.push(F(new THREE.IcosahedronGeometry(0.065, 0).translate(x, 2.93, -0.15), c));
    glow.push(F(new THREE.IcosahedronGeometry(0.065, 0).translate(x, 2.93, 0.15), c));
  }
  return { solid: M(solid), glow: M(glow) };
}

// ------------------------------------------------------------ walls
// Decoration for a wall box of size w x h x d centred at the origin (front face at z=-d/2).
// labelW: width of the label plane on the front face, kept clear of front-facing details.
export function wallDeco(th, w, h, d, labelW) {
  const S = st(th), solid = [], glow = [];
  const top = h / 2, lx = labelW / 2 + 0.05;
  // end pillars (flush with the front so the label stays in front of them)
  for (const s of [-1, 1]) {
    const px = s * (w / 2 - 0.17);
    solid.push(box(0.36, h + 0.38, d + 0.12, px, 0.19, 0.06, S.pillar));
    solid.push(box(0.46, 0.12, d + 0.24, px, top + 0.4, 0.06, S.cap));
    if (S.top === 'grass') solid.push(F(new THREE.ConeGeometry(0.28, 0.32, 4).rotateY(Math.PI / 4).translate(px, top + 0.62, 0.06), 0xc94a3a));
    else if (S.top === 'crenel') solid.push(box(0.3, 0.3, 0.3, px, top + 0.61, 0.06, S.cap));
    else if (S.top === 'snow') solid.push(F(new THREE.IcosahedronGeometry(0.22, 1).scale(1.1, 0.7, 1.1).translate(px, top + 0.55, 0.06), 0xffffff));
    else { solid.push(F(new THREE.ConeGeometry(0.13, 0.5, 6).translate(px, top + 0.71, 0.06), 0x5a5058)); glow.push(F(new THREE.IcosahedronGeometry(0.1, 0).translate(px, top + 0.5, -d / 2 - 0.02), 0xff7a1a)); }
  }
  const span = w - 0.7;
  if (S.top === 'grass') {
    solid.push(box(span, 0.14, d + 0.14, 0, top + 0.07, 0, S.cap));
    for (let x = -span / 2 + 0.25; x < span / 2 - 0.1; x += 0.42) {
      const k = Math.round(x * 10);
      solid.push(F(new THREE.ConeGeometry(0.06, 0.26, 3).translate(x, top + 0.26, (k % 3) * 0.12 - 0.12), k % 2 ? 0x5aae40 : 0x74cc52));
      if (k % 4 === 0) solid.push(F(new THREE.IcosahedronGeometry(0.06, 0).translate(x + 0.1, top + 0.22, 0.1), k % 8 ? 0xff7eb6 : 0xfff27a));
    }
    solid.push(box(span * 0.6, 0.06, d * 0.6, -span * 0.12, top + 0.16, 0.05, 0x6cc04c));
  } else if (S.top === 'crenel') {
    solid.push(box(span, 0.12, d + 0.14, 0, top + 0.06, 0, S.cap));
    for (let x = -span / 2 + 0.3; x < span / 2 - 0.2; x += 0.85) solid.push(box(0.46, 0.36, d + 0.04, x, top + 0.3, 0.02, 0xe6c58e));
  } else if (S.top === 'snow') {
    solid.push(box(span, 0.16, d + 0.18, 0, top + 0.08, 0, 0xffffff));
    for (let x = -span / 2 + 0.3; x < span / 2 - 0.2; x += 0.7) solid.push(F(new THREE.SphereGeometry(0.28, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 0.55, 1.2).translate(x, top + 0.15, 0), 0xf6faff));
    // icicles only outside the label so the numbers stay readable
    for (let x = -span / 2; x < span / 2; x += 0.22) {
      if (Math.abs(x) < lx) continue;
      const l = 0.18 + ((Math.round(x * 50) % 3) + 3) % 3 * 0.1;
      solid.push(F(new THREE.ConeGeometry(0.045, l, 5).rotateX(Math.PI).translate(x, top - l / 2, -d / 2 - 0.06), 0xc8f0ff));
    }
  } else {
    solid.push(box(span, 0.14, d + 0.14, 0, top + 0.07, 0, S.cap));
    glow.push(box(span, 0.05, d + 0.17, 0, top + 0.005, 0, 0xff6a1a));
    for (let x = -span / 2 + 0.25; x < span / 2 - 0.1; x += 0.55) solid.push(F(new THREE.ConeGeometry(0.1, 0.42, 5).translate(x, top + 0.35, 0), 0x6a6068));
  }
  return { solid: M(solid), glow: glow.length ? M(glow) : null };
}

// ------------------------------------------------------------ crates
// Metal corner caps, edge rails and bands around a w x h x d wooden crate.
export function crateTrim(w, h, d) {
  const parts = [], metal = 0x5b6577, rail = 0x6b7587, bolt = 0xd0d7e2;
  const cx = w / 2 - 0.118, cy = h / 2 - 0.118, cz = d / 2 - 0.118;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push(box(0.26, 0.26, 0.26, sx * cx, sy * cy, sz * cz, metal));
    parts.push(F(new THREE.IcosahedronGeometry(0.04, 0).translate(sx * (w / 2 - 0.08), sy * (h / 2 - 0.08), sz * (d / 2 + 0.01)), bolt));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(0.11, h - 0.5, 0.11, sx * (w / 2 - 0.045), 0, sz * (d / 2 - 0.045), rail));
  for (const y of [-0.45, 0.45]) parts.push(box(w + 0.03, 0.1, d + 0.03, 0, y, 0, 0x3c4458));
  return M(parts);
}

// ------------------------------------------------------------ coins (shared geometry, faces +-z)
let coinG = null;
export function coinGeo() {
  if (coinG) return coinG;
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.075 : 0.17;
    if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const sg = () => new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: false });
  coinG = M([
    F(new THREE.CylinderGeometry(0.32, 0.32, 0.07, 22).rotateX(Math.PI / 2), 0xffb81f),
    F(new THREE.TorusGeometry(0.3, 0.042, 6, 22).scale(1, 1, 1.1), 0xffd75a),
    F(sg().translate(0, 0, 0.025), 0xfff0a0),
    F(sg().rotateY(Math.PI).translate(0, 0, -0.025), 0xfff0a0)]);
  return coinG;
}

// ------------------------------------------------------------ saw track (replaces the flat slot)
export function sawTrack(len) {
  const p = [box(len, 0.02, 0.5, 0, 0.01, 0, 0x2a2e38), box(len - 0.3, 0.024, 0.12, 0, 0.012, 0, 0x0b0d12)];
  let k = 0;
  for (let x = -len / 2 + 0.2; x < len / 2 - 0.1; x += 0.4) {
    const c = k++ % 2 ? 0x1b1d22 : 0xffc83a;
    p.push(box(0.4, 0.022, 0.1, x, 0.013, -0.24, c), box(0.4, 0.022, 0.1, x, 0.013, 0.24, c));
  }
  for (const s of [-1, 1]) p.push(box(0.3, 0.05, 0.62, s * (len / 2 - 0.15), 0.025, 0, 0x8d97a6));
  return M(p);
}

// ------------------------------------------------------------ finish line: chequered pylons with flags
export function finishProps(th, half) {
  const solid = [], glow = [], S = st(th);
  for (const s of [-1, 1]) {
    const x = s * (half + 0.75);
    solid.push(box(0.8, 0.25, 0.8, x, 0.12, 0, 0x3c4458));
    for (let i = 0; i < 8; i++) solid.push(box(0.5, 0.5, 0.5, x, 0.5 + i * 0.5, 0, i % 2 ? 0x1b2236 : 0xffffff));
    solid.push(F(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6).translate(x, 4.9, 0), 0xdde3ee));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) solid.push(box(0.36, 0.3, 0.03, x - s * (0.22 + i * 0.36), 5.4 - j * 0.3, 0, (i + j) % 2 ? 0x1b2236 : 0xffffff));
    glow.push(F(new THREE.IcosahedronGeometry(0.16, 1).translate(x, 5.68, 0), S.light));
  }
  return { solid: M(solid), glow: M(glow) };
}

// ------------------------------------------------------------ boss arena (origin = boss start position)
export function arenaProps(th, half) {
  const S = st(th), solid = [], glow = [];
  // floor rings where the fight happens (around 15 units in front of the boss start)
  const ring = (r0, r1, hex, y, segs = 40) => F(new THREE.RingGeometry(r0, r1, segs).rotateX(-Math.PI / 2).translate(0, y, -15), hex);
  solid.push(ring(6.2, 7.0, S.banner, 0.014), ring(4.5, 4.75, S.banner2, 0.014));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    solid.push(F(new THREE.BoxGeometry(0.5, 0.02, 0.5).rotateY(Math.PI / 4).translate(Math.cos(a) * 5.6, 0.016, Math.sin(a) * 5.6 - 15), S.banner2));
  }
  // torches along both sides
  for (const s of [-1, 1]) for (const z of [-24, -16, -8, 0, 8]) {
    const x = s * (half + 1.35);
    solid.push(F(new THREE.DodecahedronGeometry(0.42, 0).scale(1, 0.55, 1).translate(x, 0.15, z), S.stone2));
    solid.push(F(new THREE.CylinderGeometry(0.11, 0.15, 2.3, 7).translate(x, 1.3, z), S.pole));
    solid.push(F(new THREE.CylinderGeometry(0.38, 0.16, 0.36, 9).translate(x, 2.55, z), 0x4a4450));
    glow.push(F(new THREE.ConeGeometry(0.3, 0.85, 7).translate(x, 3.1, z), S.flame[0]));
    glow.push(F(new THREE.ConeGeometry(0.17, 0.55, 7).translate(x, 2.98, z - 0.05), S.flame[1]));
  }
  // banners
  for (const s of [-1, 1]) for (const z of [-20, -4, 6]) {
    const x = s * (half + 2.8);
    solid.push(F(new THREE.CylinderGeometry(0.08, 0.1, 6.2, 7).translate(x, 3.1, z), S.pole));
    solid.push(F(new THREE.ConeGeometry(0.16, 0.4, 6).translate(x, 6.4, z), 0xffc83a));
    solid.push(F(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6).rotateZ(Math.PI / 2).translate(x, 5.7, z - 0.1), S.pole));
    solid.push(box(1.25, 2.6, 0.05, x, 4.35, z - 0.12, S.banner));
    solid.push(box(1.27, 0.22, 0.07, x, 5.45, z - 0.12, S.banner2));
    solid.push(box(1.27, 0.12, 0.07, x, 3.15, z - 0.12, S.banner2));
    solid.push(F(new THREE.ConeGeometry(0.63, 0.55, 3).rotateZ(Math.PI).rotateY(Math.PI / 2).scale(1, 1, 0.08).translate(x, 2.78, z - 0.12), S.banner));
    solid.push(F(new THREE.OctahedronGeometry(0.32, 0).scale(1, 1.3, 0.3).translate(x, 4.4, z - 0.16), S.banner2));
  }
  // great gate behind the boss
  const gz = 11, tw = 2.4, tx = half + 2.2;
  for (const s of [-1, 1]) {
    const x = s * tx;
    solid.push(box(tw + 0.4, 0.6, tw + 0.4, x, 0.3, gz, S.stone2));
    solid.push(box(tw, 8.2, tw, x, 4.4, gz, S.stone));
    for (const y of [2.4, 5.2]) solid.push(box(tw + 0.1, 0.25, tw + 0.1, x, y, gz, S.stone2));
    solid.push(box(tw + 0.4, 0.4, tw + 0.4, x, 8.7, gz, S.stone2));
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) solid.push(box(0.6, 0.6, 0.6, x + ox * (tw / 2 - 0.1), 9.2, gz + oz * (tw / 2 - 0.1), S.stone));
    solid.push(box(0.5, 1.1, 0.05, x, 6.6, gz - tw / 2 - 0.02, 0x1a1418));
    glow.push(box(0.36, 0.95, 0.05, x, 6.55, gz - tw / 2 - 0.04, S.flame[0]));
    // tower torch
    glow.push(F(new THREE.ConeGeometry(0.32, 0.9, 7).translate(x - s * (tw / 2 + 0.25), 4.1, gz - tw / 2 - 0.2), S.flame[0]));
    solid.push(F(new THREE.CylinderGeometry(0.34, 0.14, 0.3, 8).translate(x - s * (tw / 2 + 0.25), 3.55, gz - tw / 2 - 0.2), 0x4a4450));
  }
  solid.push(box(tx * 2 + tw, 1.3, 1.6, 0, 7.6, gz, S.stone2));
  solid.push(box(tx * 2 + tw + 0.2, 0.25, 1.8, 0, 8.3, gz, S.stone));
  solid.push(box(3.0, 1.1, 0.1, 0, 7.6, gz - 0.85, S.banner));
  glow.push(F(new THREE.OctahedronGeometry(0.45, 0).scale(1.6, 1, 0.3).translate(0, 7.6, gz - 0.95), S.banner2));
  return { solid: M(solid), glow: M(glow) };
}

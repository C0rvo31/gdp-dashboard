// World themes: every 10 levels the road moves to a new region with its own
// look, decor, weather, enemy types and boss.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tint, plain } from './models.js';
import { makeCanvas, roundRect, canvasTex } from './util.js';

export const THEMES = [
  {
    key: 'meadow', name: 'ÇAYIR', skyTop: 0x3b97ff, skyBot: 0xcdeeff, fog: 0xcdeeff, fogNear: 48, fogFar: 125,
    hemi: [0xffffff, 0x86a070, 2.3], sun: [0xfff2dc, 2.3], cloud: [0xffffff, 0x8fa6bf],
    ground: ['#8bd862', '#7ccb56', 'rgba(255,255,200,.10)', 'rgba(0,60,0,.08)'], band: 0x6fc24f,
    road: ['#97a2b8', '#f4f7ff', 'rgba(255,255,255,.75)'], curb: ['#ff4f5e', '#ffffff'],
    wall: ['#c9542f', ['#ff8a4c', '#f47a40', '#ff9a5a']], cap: 0xe2dccf,
    near: [['bush', 0.45], ['rock', 0.15], ['flowers1', 0.2], ['flowers2', 0.2]],
    far: [['tree1', 0.33], ['tree2', 0.33], ['tree3', 0.14], ['rock', 0.07], ['bush', 0.07], ['flowers1', 0.06]],
    fence: 'fence', weather: null, melee: 'raider', shooter: 'gunner', boss: 'orc',
  },
  {
    key: 'desert', name: 'ÇÖL', skyTop: 0x3f9cf0, skyBot: 0xfbe6bf, fog: 0xf6e0b6, fogNear: 45, fogFar: 120,
    hemi: [0xfff4e2, 0xc9a46a, 2.3], sun: [0xffe0b0, 2.5], cloud: [0xffffff, 0xb8a890],
    ground: ['#f1d59b', '#e9c98a', 'rgba(255,255,255,.12)', 'rgba(120,80,20,.10)'], band: 0xdcb877,
    road: ['#b9a58c', '#fff4dd', 'rgba(255,244,221,.75)'], curb: ['#ff8a3d', '#fff3e0'],
    wall: ['#a8743a', ['#e9b878', '#dca868', '#f2c88a']], cap: 0xf3dfb5,
    near: [['deadBush', 0.35], ['sandRock', 0.35], ['cactus2', 0.3]],
    far: [['cactus', 0.32], ['palm', 0.26], ['cactus2', 0.14], ['sandRock', 0.18], ['deadBush', 0.1]],
    fence: 'ropeFence', weather: null, melee: 'nomad', shooter: 'bandit', boss: 'sand',
  },
  {
    key: 'snow', name: 'KARLI DAĞ', skyTop: 0x6fa3e0, skyBot: 0xe8f2ff, fog: 0xe3eefa, fogNear: 40, fogFar: 115,
    hemi: [0xf4f8ff, 0x9fb0c8, 2.4], sun: [0xffffff, 2.1], cloud: [0xf2f6fb, 0xa8b8cc],
    ground: ['#f6f9ff', '#e7eef8', 'rgba(255,255,255,.4)', 'rgba(120,150,190,.10)'], band: 0xdbe6f3,
    road: ['#8e9db6', '#ffffff', 'rgba(255,255,255,.8)'], curb: ['#3d8bff', '#ffffff'],
    wall: ['#7fb9e6', ['#d2f0ff', '#bfe6fb', '#e2f6ff']], cap: 0xffffff,
    near: [['snowRock', 0.4], ['iceCrystal', 0.25], ['snowBush', 0.35]],
    far: [['snowPine', 0.42], ['snowPine2', 0.3], ['snowman', 0.1], ['snowRock', 0.12], ['iceCrystal', 0.06]],
    fence: 'woodFence', weather: 'snow', melee: 'knight', shooter: 'frost', boss: 'yeti',
  },
  {
    key: 'lava', name: 'VOLKAN', skyTop: 0x2c1636, skyBot: 0xff8a4a, fog: 0x7a3326, fogNear: 38, fogFar: 110,
    hemi: [0xffc9a0, 0x4a2020, 2.1], sun: [0xffb070, 2.3], cloud: [0x5a4a50, 0x2a1a20],
    ground: ['#3d2c2e', '#352628', 'rgba(255,120,40,.10)', 'rgba(0,0,0,.15)'], band: 0x2a1d1f,
    road: ['#4f4a56', '#ff9a3c', 'rgba(255,154,60,.7)'], curb: ['#ff6a1a', '#2a2228'],
    wall: ['#120e12', ['#3a2c34', '#33262e', '#42323a']], cap: 0xff7a1a,
    near: [['obsidian', 0.35], ['lavaPool', 0.35], ['crystal', 0.3]],
    far: [['deadTree', 0.35], ['obsidian', 0.25], ['volcanoRock', 0.2], ['crystal', 0.12], ['lavaPool', 0.08]],
    fence: 'spikeFence', weather: 'embers', melee: 'skeleton', shooter: 'demon', boss: 'demon',
  },
];
export const themeIndex = (L) => Math.floor((L - 1) / 10) % THEMES.length;
export const themeFor = (L) => THEMES[themeIndex(L)];

// ------------------------------------------------------------ textures (built once per theme, cached)
function speckle(x, w, h, n, a, b) {
  for (let i = 0; i < n; i++) { x.fillStyle = Math.random() < 0.5 ? a : b; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}
export function themeTextures(th, maxAniso) {
  if (th._tex) return th._tex;
  const T = {};
  let c = makeCanvas(256, 256), x = c.getContext('2d');
  x.fillStyle = th.road[0]; x.fillRect(0, 0, 256, 256);
  speckle(x, 256, 256, 900, 'rgba(255,255,255,.05)', 'rgba(0,0,0,.06)');
  x.fillStyle = th.road[1]; x.fillRect(8, 0, 9, 256); x.fillRect(239, 0, 9, 256);
  x.fillStyle = th.road[2]; x.fillRect(84, 20, 6, 96); x.fillRect(166, 20, 6, 96); x.fillRect(84, 148, 6, 96); x.fillRect(166, 148, 6, 96);
  if (th.key === 'lava') { x.strokeStyle = 'rgba(255,110,30,.35)'; x.lineWidth = 2; for (let i = 0; i < 6; i++) { x.beginPath(); let px = 30 + Math.random() * 200, py = Math.random() * 256; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (Math.random() - 0.5) * 30; py += Math.random() * 25; x.lineTo(px, py); } x.stroke(); } }
  T.road = canvasTex(c, 8); T.road.wrapS = T.road.wrapT = THREE.RepeatWrapping;

  c = makeCanvas(64, 64); x = c.getContext('2d');
  x.fillStyle = th.ground[0]; x.fillRect(0, 0, 64, 32); x.fillStyle = th.ground[1]; x.fillRect(0, 32, 64, 32);
  for (let i = 0; i < 260; i++) { x.fillStyle = Math.random() < 0.5 ? th.ground[2] : th.ground[3]; x.fillRect(Math.random() * 64, Math.random() * 64, 2, 3); }
  if (th.key === 'lava') { x.fillStyle = 'rgba(255,110,30,.5)'; for (let i = 0; i < 5; i++) x.fillRect(Math.random() * 64, Math.random() * 64, 3, 1); }
  T.ground = canvasTex(c); T.ground.wrapS = T.ground.wrapT = THREE.RepeatWrapping;

  c = makeCanvas(64, 32); x = c.getContext('2d');
  x.fillStyle = th.curb[0]; x.fillRect(0, 0, 32, 32); x.fillStyle = th.curb[1]; x.fillRect(32, 0, 32, 32);
  T.curb = canvasTex(c); T.curb.wrapS = T.curb.wrapT = THREE.RepeatWrapping;

  c = makeCanvas(128, 128); x = c.getContext('2d');
  x.fillStyle = th.wall[0]; x.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 4; r++) for (let k = -1; k < 3; k++) {
    const ox = k * 64 + (r % 2 ? 32 : 0) + 3;
    x.fillStyle = th.wall[1][(r + k + 3) % 3];
    roundRect(x, ox, r * 32 + 3, 58, 26, 4); x.fill();
  }
  if (th.key === 'lava') { x.strokeStyle = '#ff7a1a'; x.lineWidth = 2; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(Math.random() * 128, 0); x.lineTo(Math.random() * 128, 64); x.lineTo(Math.random() * 128, 128); x.stroke(); } }
  if (th.key === 'snow') { x.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 8; i++) x.fillRect(Math.random() * 120, Math.random() * 120, 10, 2); }
  T.wall = canvasTex(c); T.wall.wrapS = T.wall.wrapT = THREE.RepeatWrapping;
  void maxAniso;
  th._tex = T;
  return T;
}

// ------------------------------------------------------------ decor geometry (flat shaded, vertex coloured)
export function buildDecor() {
  const F = (geo, hex) => tint(plain(geo), hex);
  const D = {};
  const glow = (g) => { g.userData.glow = true; return g; };
  const trunk = (col = 0x8a5a33) => F(new THREE.CylinderGeometry(0.11, 0.18, 0.95, 6).translate(0, 0.47, 0), col);

  // meadow
  D.tree1 = mergeGeometries([trunk(),
    F(new THREE.IcosahedronGeometry(0.9, 0).translate(0, 1.5, 0), 0x4fb848),
    F(new THREE.IcosahedronGeometry(0.62, 0).translate(0.45, 1.95, 0.15), 0x63c752),
    F(new THREE.IcosahedronGeometry(0.55, 0).translate(-0.4, 2.0, -0.1), 0x58bf4c),
    F(new THREE.IcosahedronGeometry(0.5, 0).translate(0.05, 2.35, 0), 0x76d65e)]);
  D.tree2 = mergeGeometries([trunk(),
    F(new THREE.ConeGeometry(1.0, 1.2, 7).translate(0, 1.25, 0), 0x2b9656),
    F(new THREE.ConeGeometry(0.8, 1.05, 7).translate(0, 1.85, 0), 0x34a862),
    F(new THREE.ConeGeometry(0.55, 0.9, 7).translate(0, 2.4, 0), 0x45bd70)]);
  D.tree3 = mergeGeometries([
    F(new THREE.CylinderGeometry(0.1, 0.16, 0.85, 6).translate(0, 0.42, 0), 0x7a4e2c),
    F(new THREE.DodecahedronGeometry(0.85, 0).scale(1.1, 0.85, 1.1).translate(0, 1.45, 0), 0x5cc24c),
    ...[[0.55, 1.3, 0.5], [-0.5, 1.6, 0.45], [0.2, 1.95, 0.55], [-0.15, 1.15, 0.75], [0.6, 1.7, -0.3]].map(
      (q) => F(new THREE.IcosahedronGeometry(0.11, 0).translate(q[0], q[1], q[2]), 0xff5a4f))]);
  D.rock = mergeGeometries([
    F(new THREE.DodecahedronGeometry(0.55, 0).scale(1.3, 0.7, 1).translate(0, 0.2, 0), 0xb8c0cc),
    F(new THREE.DodecahedronGeometry(0.3, 0).scale(1.2, 0.8, 1).translate(0.6, 0.12, 0.25), 0xa3acba)]);
  D.bush = mergeGeometries([
    F(new THREE.IcosahedronGeometry(0.5, 0).translate(0, 0.3, 0), 0x5cc24c),
    F(new THREE.IcosahedronGeometry(0.38, 0).translate(0.45, 0.25, 0.1), 0x74d15a),
    F(new THREE.IcosahedronGeometry(0.34, 0).translate(-0.4, 0.22, -0.05), 0x6ac955),
    F(new THREE.IcosahedronGeometry(0.1, 0).translate(0.1, 0.72, 0.2), 0xff6fa8),
    F(new THREE.IcosahedronGeometry(0.09, 0).translate(-0.35, 0.5, 0.25), 0xfff07a)]);
  const flower = (petal) => {
    const parts = [F(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4).translate(0, 0.15, 0), 0x3f9a3a),
      F(new THREE.IcosahedronGeometry(0.045, 0).translate(0, 0.31, 0), 0xffd23a)];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      parts.push(F(new THREE.IcosahedronGeometry(0.05, 0).scale(1, 0.5, 1).translate(Math.cos(a) * 0.075, 0.305, Math.sin(a) * 0.075), petal));
    }
    return parts;
  };
  const patch = (cols) => mergeGeometries(cols.flatMap((c, i) => flower(c).map((g) => g.translate([0, 0.35, -0.3, 0.15][i], 0, [0, 0.2, 0.25, -0.35][i]))));
  D.flowers1 = patch([0xff7eb6, 0xffffff, 0xff7eb6, 0xffffff]);
  D.flowers2 = patch([0xb98cff, 0xfff27a, 0xffffff, 0xb98cff]);
  const fence = (post, rail, tip) => mergeGeometries([
    F(new THREE.BoxGeometry(0.12, 0.7, 0.12).translate(0, 0.35, 0), post),
    tip ? F(new THREE.ConeGeometry(0.09, 0.2, 4).rotateY(Math.PI / 4).translate(0, 0.8, 0), tip) : F(new THREE.ConeGeometry(0.09, 0.12, 4).rotateY(Math.PI / 4).translate(0, 0.76, 0), post),
    F(new THREE.BoxGeometry(0.05, 0.09, 2.0).translate(0, 0.28, 1.0), rail),
    F(new THREE.BoxGeometry(0.05, 0.09, 2.0).translate(0, 0.52, 1.0), rail)]);
  D.fence = fence(0xf4ede0, 0xe8dfcf);
  D.woodFence = fence(0x7a5636, 0x8a6442);
  D.spikeFence = fence(0x2a2228, 0x3a3036, 0x8a8f99);
  D.ropeFence = mergeGeometries([
    F(new THREE.CylinderGeometry(0.07, 0.08, 0.8, 6).translate(0, 0.4, 0), 0x8a5a33),
    F(new THREE.CylinderGeometry(0.02, 0.02, 2.0, 4).rotateX(Math.PI / 2).translate(0, 0.6, 1.0), 0xd9c08a),
    F(new THREE.CylinderGeometry(0.02, 0.02, 2.0, 4).rotateX(Math.PI / 2).translate(0, 0.35, 1.0), 0xd9c08a)]);

  // desert
  const cactArm = (s, h) => [
    F(new THREE.CylinderGeometry(0.13, 0.13, 0.45, 7).rotateZ(Math.PI / 2).translate(s * 0.35, h, 0), 0x3fa055),
    F(new THREE.CylinderGeometry(0.13, 0.13, 0.6, 7).translate(s * 0.58, h + 0.28, 0), 0x46ad5c),
    F(new THREE.SphereGeometry(0.13, 7, 4).translate(s * 0.58, h + 0.58, 0), 0x46ad5c)];
  D.cactus = mergeGeometries([
    F(new THREE.CylinderGeometry(0.24, 0.26, 2.2, 8).translate(0, 1.1, 0), 0x3fa055),
    F(new THREE.SphereGeometry(0.24, 8, 4).translate(0, 2.2, 0), 0x46ad5c),
    ...cactArm(1, 1.0), ...cactArm(-1, 1.4),
    F(new THREE.IcosahedronGeometry(0.09, 0).translate(0, 2.45, 0), 0xff5a8a)]);
  D.cactus2 = mergeGeometries([
    F(new THREE.SphereGeometry(0.4, 9, 6).scale(1, 0.8, 1).translate(0, 0.3, 0), 0x4cae5a),
    F(new THREE.IcosahedronGeometry(0.1, 0).translate(0, 0.65, 0), 0xffd23a),
    F(new THREE.SphereGeometry(0.25, 8, 5).scale(1, 0.8, 1).translate(0.45, 0.18, 0.1), 0x58b865)]);
  const palmParts = [];
  for (let i = 0; i < 6; i++) palmParts.push(F(new THREE.CylinderGeometry(0.13, 0.16, 0.5, 6).translate(i * 0.07, 0.25 + i * 0.48, 0), i % 2 ? 0x9a6a3a : 0x8a5a33));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = new THREE.ConeGeometry(0.22, 1.7, 4).rotateZ(Math.PI / 2 + 0.45).scale(1, 0.25, 1).translate(0.8, -0.15, 0).rotateY(a).translate(0.42, 2.95, 0);
    palmParts.push(F(leaf, i % 2 ? 0x3fae4c : 0x52c25a));
  }
  palmParts.push(F(new THREE.IcosahedronGeometry(0.12, 0).translate(0.35, 2.8, 0.1), 0x7a4e2c), F(new THREE.IcosahedronGeometry(0.12, 0).translate(0.5, 2.8, -0.1), 0x7a4e2c));
  D.palm = mergeGeometries(palmParts);
  D.sandRock = mergeGeometries([
    F(new THREE.DodecahedronGeometry(0.7, 0).scale(1.3, 0.8, 1).translate(0, 0.35, 0), 0xd9a066),
    F(new THREE.DodecahedronGeometry(0.4, 0).scale(1.2, 0.9, 1).translate(0.75, 0.2, 0.2), 0xc98f58)]);
  const twigs = [];
  for (let i = 0; i < 6; i++) twigs.push(F(new THREE.CylinderGeometry(0.015, 0.03, 0.6, 4).translate(0, 0.3, 0).rotateZ((i - 2.5) * 0.3).rotateY(i * 1.1), 0x9a7a4a));
  D.deadBush = mergeGeometries(twigs);

  // snow
  const snowPine = (s) => mergeGeometries([trunk(0x6a4a30),
    F(new THREE.ConeGeometry(1.0 * s, 1.2, 7).translate(0, 1.25, 0), 0x2c7a56), F(new THREE.ConeGeometry(0.85 * s, 0.4, 7).translate(0, 1.7, 0), 0xffffff),
    F(new THREE.ConeGeometry(0.8 * s, 1.05, 7).translate(0, 1.85, 0), 0x33885f), F(new THREE.ConeGeometry(0.62 * s, 0.35, 7).translate(0, 2.25, 0), 0xffffff),
    F(new THREE.ConeGeometry(0.55 * s, 0.9, 7).translate(0, 2.4, 0), 0x3b9468), F(new THREE.ConeGeometry(0.3 * s, 0.4, 7).translate(0, 2.75, 0), 0xffffff)]);
  D.snowPine = snowPine(1);
  D.snowPine2 = snowPine(0.8);
  D.snowman = mergeGeometries([
    F(new THREE.IcosahedronGeometry(0.5, 1).translate(0, 0.45, 0), 0xffffff),
    F(new THREE.IcosahedronGeometry(0.36, 1).translate(0, 1.1, 0), 0xffffff),
    F(new THREE.IcosahedronGeometry(0.26, 1).translate(0, 1.58, 0), 0xffffff),
    F(new THREE.ConeGeometry(0.05, 0.25, 6).rotateX(Math.PI / 2).translate(0, 1.58, 0.33), 0xff8a1a),
    F(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 8).translate(0, 1.9, 0), 0x22252c),
    F(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 8).translate(0, 1.78, 0), 0x22252c),
    F(new THREE.TorusGeometry(0.28, 0.06, 4, 10).rotateX(Math.PI / 2).translate(0, 1.36, 0), 0xe0393f),
    F(new THREE.IcosahedronGeometry(0.035, 0).translate(-0.09, 1.65, 0.23), 0x111111), F(new THREE.IcosahedronGeometry(0.035, 0).translate(0.09, 1.65, 0.23), 0x111111),
    F(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4).rotateZ(1.1).translate(0.5, 1.2, 0), 0x7a5636),
    F(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4).rotateZ(-1.1).translate(-0.5, 1.2, 0), 0x7a5636)]);
  D.snowRock = mergeGeometries([
    F(new THREE.DodecahedronGeometry(0.6, 0).scale(1.3, 0.75, 1).translate(0, 0.25, 0), 0x8f9bb0),
    F(new THREE.DodecahedronGeometry(0.5, 0).scale(1.3, 0.35, 1).translate(0, 0.62, 0), 0xffffff)]);
  D.snowBush = mergeGeometries([
    F(new THREE.IcosahedronGeometry(0.5, 0).translate(0, 0.3, 0), 0x3f8a5c),
    F(new THREE.IcosahedronGeometry(0.42, 0).scale(1, 0.4, 1).translate(0, 0.62, 0), 0xffffff),
    F(new THREE.IcosahedronGeometry(0.1, 0).translate(0.3, 0.45, 0.3), 0xe0393f)]);
  D.iceCrystal = glow(mergeGeometries([
    F(new THREE.OctahedronGeometry(0.3, 0).scale(0.6, 2.2, 0.6).translate(0, 0.6, 0), 0x9fe6ff),
    F(new THREE.OctahedronGeometry(0.22, 0).scale(0.6, 2, 0.6).rotateZ(0.5).translate(0.3, 0.4, 0), 0xc8f3ff),
    F(new THREE.OctahedronGeometry(0.18, 0).scale(0.6, 2, 0.6).rotateZ(-0.6).translate(-0.28, 0.35, 0.1), 0x7fd8ff)]));

  // lava
  const branch = (a, h, l) => F(new THREE.CylinderGeometry(0.03, 0.07, l, 5).translate(0, l / 2, 0).rotateZ(0.8).rotateY(a).translate(0, h, 0), 0x2a2026);
  D.deadTree = mergeGeometries([
    F(new THREE.CylinderGeometry(0.1, 0.2, 2.0, 6).translate(0, 1.0, 0), 0x2a2026),
    branch(0, 1.3, 0.8), branch(2.2, 1.6, 0.7), branch(4.1, 1.1, 0.6), branch(1.2, 1.9, 0.5)]);
  D.obsidian = mergeGeometries([
    F(new THREE.DodecahedronGeometry(0.6, 0).scale(1.2, 0.9, 1).translate(0, 0.35, 0), 0x241c26),
    F(new THREE.OctahedronGeometry(0.3, 0).scale(0.7, 1.8, 0.7).translate(0.55, 0.4, 0.1), 0x3a2c48)]);
  D.volcanoRock = mergeGeometries([
    F(new THREE.ConeGeometry(1.6, 2.4, 7).translate(0, 1.2, 0), 0x2e2226),
    F(new THREE.CylinderGeometry(0.42, 0.6, 0.25, 7).translate(0, 2.3, 0), 0xff6a1a)]);
  D.crystal = glow(mergeGeometries([
    F(new THREE.OctahedronGeometry(0.3, 0).scale(0.6, 2.2, 0.6).translate(0, 0.6, 0), 0xc77dff),
    F(new THREE.OctahedronGeometry(0.22, 0).scale(0.6, 2, 0.6).rotateZ(0.5).translate(0.3, 0.4, 0), 0xe0a8ff),
    F(new THREE.OctahedronGeometry(0.18, 0).scale(0.6, 2, 0.6).rotateZ(-0.6).translate(-0.28, 0.35, 0.1), 0x9b59ff)]));
  D.lavaPool = glow(mergeGeometries([
    F(new THREE.CylinderGeometry(1.0, 1.0, 0.04, 9).scale(1.4, 1, 1).translate(0, 0.02, 0), 0xff7a1a),
    F(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 8).scale(1.3, 1, 1).translate(0.2, 0.03, 0.1), 0xffc23a)]));

  D.cloud = mergeGeometries([
    plain(new THREE.IcosahedronGeometry(2.2, 1)),
    plain(new THREE.IcosahedronGeometry(1.7, 1).translate(2.4, -0.3, 0.2)),
    plain(new THREE.IcosahedronGeometry(1.6, 1).translate(-2.3, -0.4, -0.1)),
    plain(new THREE.IcosahedronGeometry(1.3, 1).translate(0.9, 1.1, 0.3))]).scale(1, 0.62, 0.8);

  // saw blade + side posts
  const parts = [tint(plain(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 28).rotateX(Math.PI / 2)), 0xd5dce6),
    tint(plain(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 28).rotateX(Math.PI / 2)), 0xbfc8d4),
    tint(plain(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 14).rotateX(Math.PI / 2)), 0xff4650)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(tint(plain(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 8).rotateX(Math.PI / 2).translate(Math.cos(a) * 0.43, Math.sin(a) * 0.43, 0)), 0x7d8796));
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const t = new THREE.ConeGeometry(0.13, 0.32, 4).rotateZ(-Math.PI / 2 + 0.35);
    t.translate(1.0, 0, 0); t.rotateZ(a);
    parts.push(tint(plain(t), 0xaeb7c4));
  }
  D.saw = mergeGeometries(parts);
  D.sawPost = mergeGeometries([
    tint(plain(new THREE.BoxGeometry(0.35, 1.0, 0.5).translate(0, 0.5, 0)), 0xffc83a),
    tint(plain(new THREE.BoxGeometry(0.37, 0.18, 0.52).translate(0, 0.3, 0)), 0x23262e),
    tint(plain(new THREE.BoxGeometry(0.37, 0.18, 0.52).translate(0, 0.7, 0)), 0x23262e)]);
  return D;
}

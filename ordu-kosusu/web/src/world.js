// World themes: every 10 levels the road moves to a new region with its own
// look, decor, weather, enemy types and boss.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tint, plain } from './models.js';
import { makeCanvas, roundRect, canvasTex, mulberry32 } from './util.js';

export const THEMES = [
  {
    key: 'meadow', name: 'ÇAYIR', skyTop: 0x3b97ff, skyBot: 0xcdeeff, fog: 0xcdeeff, fogNear: 48, fogFar: 125,
    hemi: [0xffffff, 0x86a070, 2.3], sun: [0xfff2dc, 2.3], cloud: [0xffffff, 0x8fa6bf],
    ground: ['#8bd862', '#7ccb56', 'rgba(255,255,200,.10)', 'rgba(0,60,0,.08)'], band: 0x6fc24f,
    road: ['#97a2b8', '#f4f7ff', 'rgba(255,255,255,.75)'], curb: ['#ff4f5e', '#ffffff'],
    wall: ['#c9542f', ['#ff8a4c', '#f47a40', '#ff9a5a']], cap: 0xe2dccf,
    near: [['bush', 0.3], ['rock', 0.1], ['flowers1', 0.15], ['flowers2', 0.15], ['mushroom', 0.1], ['hayBale', 0.1], ['stump', 0.1]],
    far: [['tree1', 0.25], ['tree2', 0.24], ['tree3', 0.12], ['hayBale', 0.08], ['sheep', 0.07], ['rock', 0.06], ['bush', 0.08], ['flowers1', 0.05], ['house', 0.05]],
    big: [['windmill', 0.3], ['house', 0.35], ['hayStack', 0.15], ['treeGroup', 0.2]],
    tiny: [['grassTuft', 0.55], ['pebbles', 0.15], ['flowersTiny', 0.3]],
    river: { sides: [1], base: 15, amp: 3, w: 3.2, bank: 0xe6d699, water: 0x4fb2f0, core: 0x8fd6ff, glow: false },
    skyline: { far: 0x6f9bd6, near: 0x4fa65a, cap: 0xffffff, farShape: 'alps', nearShape: 'hills' },
    fence: 'fence', weather: null, melee: 'raider', shooter: 'gunner', boss: 'orc',
  },
  {
    key: 'desert', name: 'ÇÖL', skyTop: 0x3f9cf0, skyBot: 0xfbe6bf, fog: 0xf6e0b6, fogNear: 45, fogFar: 120,
    hemi: [0xfff4e2, 0xc9a46a, 2.3], sun: [0xffe0b0, 2.5], cloud: [0xffffff, 0xb8a890],
    ground: ['#f1d59b', '#e9c98a', 'rgba(255,255,255,.12)', 'rgba(120,80,20,.10)'], band: 0xdcb877,
    road: ['#b9a58c', '#fff4dd', 'rgba(255,244,221,.75)'], curb: ['#ff8a3d', '#fff3e0'],
    wall: ['#a8743a', ['#e9b878', '#dca868', '#f2c88a']], cap: 0xf3dfb5,
    near: [['deadBush', 0.25], ['sandRock', 0.25], ['cactus2', 0.25], ['camelSkull', 0.1], ['bones', 0.15]],
    far: [['cactus', 0.28], ['palm', 0.18], ['cactus2', 0.12], ['sandRock', 0.15], ['deadBush', 0.07], ['camelSkull', 0.06], ['tent', 0.07], ['bones', 0.07]],
    big: [['pyramid', 0.3], ['dune', 0.3], ['oasis', 0.2], ['mesa', 0.2]],
    tiny: [['pebblesSand', 0.5], ['dryTuft', 0.5]],
    river: null,
    skyline: { far: 0xc98a58, near: 0xe6bd80, cap: null, farShape: 'mesa', nearShape: 'dunes' },
    fence: 'ropeFence', weather: null, melee: 'nomad', shooter: 'bandit', boss: 'sand',
  },
  {
    key: 'snow', name: 'KARLI DAĞ', skyTop: 0x6fa3e0, skyBot: 0xe8f2ff, fog: 0xe3eefa, fogNear: 40, fogFar: 115,
    hemi: [0xf4f8ff, 0x9fb0c8, 2.4], sun: [0xffffff, 2.1], cloud: [0xf2f6fb, 0xa8b8cc],
    ground: ['#f6f9ff', '#e7eef8', 'rgba(255,255,255,.4)', 'rgba(120,150,190,.10)'], band: 0xdbe6f3,
    road: ['#8e9db6', '#ffffff', 'rgba(255,255,255,.8)'], curb: ['#3d8bff', '#ffffff'],
    wall: ['#7fb9e6', ['#d2f0ff', '#bfe6fb', '#e2f6ff']], cap: 0xffffff,
    near: [['snowRock', 0.3], ['iceCrystal', 0.2], ['snowBush', 0.3], ['snowMound', 0.2]],
    far: [['snowPine', 0.36], ['snowPine2', 0.28], ['snowman', 0.08], ['snowRock', 0.1], ['iceCrystal', 0.06], ['igloo', 0.05], ['snowMound', 0.07]],
    big: [['igloo', 0.25], ['cabin', 0.25], ['iceSpikes', 0.25], ['pineGroup', 0.25]],
    tiny: [['snowTuft', 0.6], ['icePebble', 0.4]],
    river: { sides: [-1], base: 14, amp: 3.5, w: 4.2, bank: 0xffffff, water: 0xbfe6fb, core: 0xe6f7ff, glow: true },
    skyline: { far: 0x8aa6cf, near: 0xb4c8e4, cap: 0xffffff, farShape: 'alps', nearShape: 'alps' },
    fence: 'woodFence', weather: 'snow', melee: 'knight', shooter: 'frost', boss: 'yeti',
  },
  {
    key: 'lava', name: 'VOLKAN', skyTop: 0x2c1636, skyBot: 0xff8a4a, fog: 0x7a3326, fogNear: 38, fogFar: 110,
    hemi: [0xffc9a0, 0x4a2020, 2.1], sun: [0xffb070, 2.3], cloud: [0x5a4a50, 0x2a1a20],
    ground: ['#3d2c2e', '#352628', 'rgba(255,120,40,.10)', 'rgba(0,0,0,.15)'], band: 0x2a1d1f,
    road: ['#4f4a56', '#ff9a3c', 'rgba(255,154,60,.7)'], curb: ['#ff6a1a', '#2a2228'],
    wall: ['#120e12', ['#3a2c34', '#33262e', '#42323a']], cap: 0xff7a1a,
    near: [['obsidian', 0.3], ['lavaPool', 0.2], ['crystal', 0.2], ['bonePile', 0.3]],
    far: [['deadTree', 0.3], ['obsidian', 0.18], ['volcanoRock', 0.14], ['crystal', 0.1], ['ruins', 0.1], ['bonePile', 0.12], ['lavaPool', 0.06]],
    big: [['ruins', 0.4], ['volcano', 0.3], ['skullRock', 0.3]],
    tiny: [['ashRock', 0.65], ['ember', 0.35]],
    river: { sides: [-1, 1], base: 14, amp: 2.5, w: 2.6, bank: 0x1a1214, water: 0xff5a10, core: 0xffc23a, glow: true },
    skyline: { far: 0x3a1a22, near: 0x22161a, cap: 0xff6a1a, farShape: 'volcano', nearShape: 'alps' },
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

  // roadside shoulder strip (u across, v along the road)
  c = makeCanvas(64, 128); x = c.getContext('2d');
  const bc = '#' + th.band.toString(16).padStart(6, '0');
  x.fillStyle = bc; x.fillRect(0, 0, 64, 128);
  if (th.key === 'meadow') {
    x.fillStyle = 'rgba(40,110,30,.35)'; x.fillRect(0, 0, 6, 128);
    for (let i = 0; i < 420; i++) { x.fillStyle = ['rgba(30,100,20,.28)', 'rgba(190,255,140,.25)', 'rgba(60,140,40,.3)'][i % 3]; x.fillRect(Math.random() * 64, Math.random() * 128, 1.5, 4 + Math.random() * 4); }
    for (let i = 0; i < 14; i++) { x.fillStyle = ['#ffffff', '#ffe46a', '#ff8ac0'][i % 3]; x.fillRect(8 + Math.random() * 54, Math.random() * 126, 2, 2); }
  } else if (th.key === 'desert') {
    x.strokeStyle = 'rgba(160,110,40,.22)'; x.lineWidth = 2;
    for (let k = 0; k < 12; k++) { x.beginPath(); for (let u = 0; u <= 64; u += 4) x.lineTo(u, k * 11 + Math.sin(u * 0.15 + k) * 3); x.stroke(); }
    speckle(x, 64, 128, 260, 'rgba(255,255,255,.18)', 'rgba(120,70,20,.16)');
    x.fillStyle = 'rgba(120,80,30,.25)'; x.fillRect(0, 0, 5, 128);
  } else if (th.key === 'snow') {
    for (let k = 0; k < 10; k++) { x.fillStyle = 'rgba(140,175,220,.20)'; x.beginPath(); x.ellipse(Math.random() * 64, k * 13, 18, 5, 0, 0, Math.PI * 2); x.fill(); }
    speckle(x, 64, 128, 180, 'rgba(255,255,255,.9)', 'rgba(160,200,255,.35)');
    x.fillStyle = 'rgba(110,150,200,.25)'; x.fillRect(0, 0, 5, 128);
  } else {
    speckle(x, 64, 128, 300, 'rgba(0,0,0,.25)', 'rgba(120,70,60,.2)');
    x.strokeStyle = 'rgba(255,110,30,.75)'; x.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) { x.beginPath(); let px = 8 + Math.random() * 50, py = Math.random() * 128; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (Math.random() - 0.5) * 14; py += 4 + Math.random() * 9; x.lineTo(px, py); } x.stroke(); }
    x.fillStyle = 'rgba(255,90,20,.35)'; x.fillRect(0, 0, 3, 128);
  }
  T.band = canvasTex(c); T.band.wrapS = T.band.wrapT = THREE.RepeatWrapping;
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

  // ---------------------------------------------------------- richer per-world decor
  const M = (parts) => mergeGeometries(parts);
  // lit geometry with an unlit companion drawn at the same instance transforms
  const withGlow = (lit, glowParts) => { lit.userData.glowPart = M(glowParts); return lit; };
  const prism = (w, h, d) => new THREE.CylinderGeometry(1, 1, w, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(1, h / 1.5, d / 1.73).translate(0, h / 3, 0);

  // meadow
  {
    const blades = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      blades.push(F(new THREE.BoxGeometry(0.1, 2.1, 0.06).translate(0, 1.05, 0).rotateZ(a).translate(0, 3.3, 1.12), 0x8a5a33));
      blades.push(F(new THREE.BoxGeometry(0.5, 1.55, 0.03).translate(0.28, 1.25, 0).rotateZ(a).translate(0, 3.3, 1.1), i % 2 ? 0xf8f4ea : 0xe8463e));
    }
    D.windmill = M([
      F(new THREE.CylinderGeometry(0.72, 1.05, 3.4, 8).translate(0, 1.7, 0), 0xf3ead8),
      F(new THREE.CylinderGeometry(1.08, 1.1, 0.3, 8).translate(0, 0.15, 0), 0xa89880),
      F(new THREE.CylinderGeometry(0.8, 0.8, 0.14, 8).translate(0, 3.35, 0), 0x8a5a33),
      F(new THREE.ConeGeometry(0.95, 1.15, 8).translate(0, 4.0, 0), 0xd8443a),
      F(new THREE.BoxGeometry(0.46, 0.8, 0.1).translate(0, 0.42, 1.0), 0x7a4e2c),
      F(new THREE.BoxGeometry(0.3, 0.36, 0.08).translate(0, 2.25, 0.86), 0x4b6fa8),
      F(new THREE.CylinderGeometry(0.16, 0.16, 0.4, 8).rotateX(Math.PI / 2).translate(0, 3.3, 0.95), 0x5a3a24),
      ...blades]);
  }
  const house = (wall, roof) => [
    F(new THREE.BoxGeometry(1.8, 1.2, 1.4).translate(0, 0.6, 0), wall),
    F(prism(2.1, 1.0, 1.8).translate(0, 1.2, 0), roof),
    F(new THREE.BoxGeometry(0.26, 0.7, 0.26).translate(0.5, 2.0, 0.15), 0x9a8a7a),
    F(new THREE.BoxGeometry(0.42, 0.72, 0.06).translate(0, 0.36, 0.71), 0x8a5a33),
    F(new THREE.BoxGeometry(0.36, 0.32, 0.06).translate(-0.55, 0.78, 0.71), 0x8fd0ff),
    F(new THREE.BoxGeometry(0.36, 0.32, 0.06).translate(0.55, 0.78, 0.71), 0x8fd0ff),
    F(new THREE.BoxGeometry(0.06, 0.32, 0.36).translate(0.91, 0.78, 0), 0x8fd0ff),
    F(new THREE.BoxGeometry(1.9, 0.12, 1.5).translate(0, 0.06, 0), 0xb8a890)];
  D.house = M(house(0xf6e7c8, 0xd8443a));
  D.hayBale = M([
    F(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 10).rotateZ(Math.PI / 2).translate(0, 0.45, 0), 0xe8bb4a),
    F(new THREE.CylinderGeometry(0.38, 0.38, 0.82, 10).rotateZ(Math.PI / 2).translate(0, 0.45, 0), 0xffe08a),
    F(new THREE.CylinderGeometry(0.4, 0.4, 0.7, 10).rotateZ(Math.PI / 2).translate(0.2, 0.4, 0.85), 0xe0b048),
    F(new THREE.CylinderGeometry(0.33, 0.33, 0.72, 10).rotateZ(Math.PI / 2).translate(0.2, 0.4, 0.85), 0xffe08a)]);
  D.hayStack = M([
    F(new THREE.CylinderGeometry(1.3, 1.4, 0.7, 9).translate(0, 0.35, 0), 0xd9ae48),
    F(new THREE.ConeGeometry(1.32, 2.0, 9).translate(0, 1.7, 0), 0xf0c75a),
    F(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 5).translate(0, 2.9, 0), 0x8a5a33),
    F(new THREE.TorusGeometry(1.2, 0.05, 3, 12).rotateX(Math.PI / 2).translate(0, 1.0, 0), 0xb8862e)]);
  D.mushroom = M([
    F(new THREE.CylinderGeometry(0.07, 0.09, 0.26, 6).translate(0, 0.13, 0), 0xfff6e6),
    F(new THREE.SphereGeometry(0.22, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1).translate(0, 0.24, 0), 0xe8393f),
    F(new THREE.IcosahedronGeometry(0.04, 0).translate(0.08, 0.4, 0.05), 0xffffff), F(new THREE.IcosahedronGeometry(0.035, 0).translate(-0.1, 0.36, -0.06), 0xffffff),
    F(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 6).translate(0.3, 0.08, 0.15), 0xfff6e6),
    F(new THREE.SphereGeometry(0.14, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1).translate(0.3, 0.15, 0.15), 0xff8a3a)]);
  D.stump = M([
    F(new THREE.CylinderGeometry(0.3, 0.38, 0.4, 8).translate(0, 0.2, 0), 0x8a5a33),
    F(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 8).translate(0, 0.41, 0), 0xe0b47a),
    F(new THREE.CylinderGeometry(0.06, 0.09, 0.5, 5).rotateZ(1.2).translate(0.4, 0.12, 0), 0x7a4e2c),
    F(new THREE.IcosahedronGeometry(0.2, 0).translate(-0.3, 0.12, 0.25), 0x5cc24c)]);
  {
    const legs = [];
    for (const [lx, lz] of [[0.32, 0.2], [0.32, -0.2], [-0.32, 0.2], [-0.32, -0.2]]) legs.push(F(new THREE.CylinderGeometry(0.06, 0.05, 0.42, 5).translate(lx, 0.21, lz), 0x2a2a30));
    D.sheep = M([...legs,
      F(new THREE.IcosahedronGeometry(0.46, 1).scale(1.3, 0.9, 1).translate(0, 0.72, 0), 0xf8f8f2),
      F(new THREE.IcosahedronGeometry(0.22, 1).translate(0.3, 1.05, 0), 0xffffff),
      F(new THREE.BoxGeometry(0.34, 0.3, 0.26).translate(0.72, 0.85, 0), 0x2a2a30),
      F(new THREE.BoxGeometry(0.06, 0.1, 0.18).translate(0.66, 0.98, 0.17), 0x2a2a30), F(new THREE.BoxGeometry(0.06, 0.1, 0.18).translate(0.66, 0.98, -0.17), 0x2a2a30)]);
  }
  D.treeGroup = M([
    D.tree1.clone().scale(1.5, 1.5, 1.5),
    D.tree2.clone().scale(1.3, 1.4, 1.3).translate(1.9, 0, 1.0),
    D.tree1.clone().scale(1.1, 1.2, 1.1).translate(-1.6, 0, 1.3),
    D.tree2.clone().scale(1.2, 1.6, 1.2).translate(-0.6, 0, -1.8)]);
  const tuft = (cols, n = 5, h = 0.38) => {
    const p = [];
    for (let i = 0; i < n; i++) p.push(F(new THREE.ConeGeometry(0.05, h * (0.7 + (i % 3) * 0.2), 3).translate(0, h / 2, 0).rotateZ((i - n / 2) * 0.22).rotateY(i * 1.3).translate((i % 2) * 0.06, 0, (i % 3) * 0.05), cols[i % cols.length]));
    return p;
  };
  D.grassTuft = M([...tuft([0x4f9e38, 0x67c04a, 0x7fd65a]), ...tuft([0x58ad40, 0x74cc52], 4, 0.3).map((g) => g.translate(0.35, 0, 0.2))]);
  D.pebbles = M([
    F(new THREE.DodecahedronGeometry(0.12, 0).scale(1.3, 0.6, 1).translate(0, 0.05, 0), 0xb0b6c0),
    F(new THREE.DodecahedronGeometry(0.08, 0).scale(1.2, 0.6, 1).translate(0.2, 0.03, 0.12), 0x9aa2b0),
    F(new THREE.DodecahedronGeometry(0.06, 0).translate(-0.15, 0.03, 0.1), 0xc8ccd4)]);
  D.flowersTiny = M([...tuft([0x5aae40, 0x6cc04c], 4, 0.25),
    F(new THREE.IcosahedronGeometry(0.06, 0).translate(0.05, 0.28, 0), 0xff7eb6), F(new THREE.IcosahedronGeometry(0.06, 0).translate(-0.12, 0.22, 0.08), 0xfff27a),
    F(new THREE.IcosahedronGeometry(0.055, 0).translate(0.15, 0.2, -0.1), 0xffffff)]);

  // desert
  D.pyramid = M([
    F(new THREE.ConeGeometry(3.0, 3.4, 4).rotateY(Math.PI / 4).translate(0, 1.7, 0), 0xe6c27f),
    F(new THREE.ConeGeometry(0.52, 0.6, 4).rotateY(Math.PI / 4).translate(0, 3.12, 0), 0xffd25a),
    F(new THREE.BoxGeometry(4.4, 0.25, 4.4).translate(0, 0.12, 0), 0xd2aa68),
    F(new THREE.ConeGeometry(1.6, 1.8, 4).rotateY(Math.PI / 4).translate(3.4, 0.9, -3.0), 0xdab570),
    F(new THREE.ConeGeometry(0.28, 0.32, 4).rotateY(Math.PI / 4).translate(3.4, 1.65, -3.0), 0xffd25a)]);
  const halfDome = (r, ws = 10) => new THREE.SphereGeometry(r, ws, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  D.dune = M([
    F(halfDome(1).scale(4.2, 1.1, 2.3), 0xf0cf92),
    F(halfDome(1).scale(2.6, 0.75, 1.7).translate(3.2, 0, 1.6), 0xe6bf7c),
    F(halfDome(1).scale(2.0, 0.55, 1.3).translate(-3.4, 0, -1.2), 0xe9c584)]);
  D.mesa = M([
    F(new THREE.CylinderGeometry(1.35, 1.75, 3.0, 7).translate(0, 1.5, 0), 0xd08850),
    F(new THREE.CylinderGeometry(1.5, 1.35, 0.3, 7).translate(0, 3.12, 0), 0xe6a86c),
    F(new THREE.CylinderGeometry(1.66, 1.68, 0.22, 7).translate(0, 0.8, 0), 0xb4683a),
    F(new THREE.CylinderGeometry(1.52, 1.54, 0.18, 7).translate(0, 1.9, 0), 0xb4683a),
    F(new THREE.DodecahedronGeometry(0.6, 0).scale(1.3, 0.7, 1).translate(1.9, 0.25, 0.6), 0xc98f58)]);
  const bone = (len, x, y, z, ry, col = 0xf3ecdc) => [
    F(new THREE.CylinderGeometry(0.035, 0.035, len, 5).rotateZ(Math.PI / 2).rotateY(ry).translate(x, y, z), col),
    F(new THREE.IcosahedronGeometry(0.06, 0).translate(len / 2, 0, 0).rotateY(ry).translate(x, y, z), col),
    F(new THREE.IcosahedronGeometry(0.06, 0).translate(-len / 2, 0, 0).rotateY(ry).translate(x, y, z), col)];
  const skull = (s, col = 0xf3ecdc, dark = 0x3a2a24) => [
    F(new THREE.IcosahedronGeometry(0.25 * s, 1).scale(1, 0.9, 1.05).translate(0, 0.24 * s, 0), col),
    F(new THREE.BoxGeometry(0.3 * s, 0.14 * s, 0.22 * s).translate(0, 0.1 * s, 0.14 * s), col),
    F(new THREE.IcosahedronGeometry(0.07 * s, 0).translate(-0.09 * s, 0.26 * s, 0.2 * s), dark),
    F(new THREE.IcosahedronGeometry(0.07 * s, 0).translate(0.09 * s, 0.26 * s, 0.2 * s), dark),
    F(new THREE.ConeGeometry(0.035 * s, 0.07 * s, 3).rotateX(Math.PI).translate(0, 0.17 * s, 0.25 * s), dark)];
  D.camelSkull = M([
    ...skull(1.3).map((g) => g.scale(1, 1, 1.25)),
    F(new THREE.ConeGeometry(0.06, 0.5, 6).rotateZ(-1.15).translate(0.36, 0.42, 0), 0xe8dcc0),
    F(new THREE.ConeGeometry(0.06, 0.5, 6).rotateZ(1.15).translate(-0.36, 0.42, 0), 0xe8dcc0),
    ...[0, 1, 2].map((i) => F(new THREE.TorusGeometry(0.3 - i * 0.04, 0.035, 4, 8, Math.PI).rotateY(Math.PI / 2).translate(0, 0, -0.6 - i * 0.22), 0xece2cc)),
    F(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5).rotateX(Math.PI / 2).translate(0, 0.28, -0.82), 0xece2cc)]);
  D.bones = M([...bone(0.5, 0, 0.05, 0, 0.5), ...bone(0.45, 0.05, 0.08, 0.05, -0.6), ...bone(0.35, 0.4, 0.04, 0.3, 1.4)]);
  D.tent = M([
    F(new THREE.ConeGeometry(1.25, 1.6, 6).translate(0, 0.8, 0), 0xc94a3a),
    F(new THREE.ConeGeometry(0.95, 1.2, 6).translate(0, 1.2, 0).scale(1.01, 1, 1.01), 0xf3e2c0),
    F(new THREE.ConeGeometry(0.55, 0.7, 6).translate(0, 1.6, 0).scale(1.02, 1, 1.02), 0xc94a3a),
    F(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4).translate(0, 1.85, 0), 0x6a4a2a),
    F(new THREE.BoxGeometry(0.25, 0.15, 0.02).translate(0.13, 2.05, 0), 0x2a5aa8),
    F(new THREE.ConeGeometry(0.4, 0.8, 3).translate(0, 0.4, 1.0), 0x3a2418)]);
  {
    const small = palmParts.map((g) => g.clone().scale(0.75, 0.75, 0.75));
    D.oasis = M([
      F(new THREE.CylinderGeometry(2.2, 2.3, 0.04, 12).scale(1.35, 1, 1).translate(0, 0.01, 0), 0x8cc066),
      F(new THREE.CylinderGeometry(1.75, 1.75, 0.05, 12).scale(1.35, 1, 1).translate(0, 0.03, 0), 0x3fb0e6),
      F(new THREE.CylinderGeometry(0.9, 0.9, 0.055, 10).scale(1.35, 1, 1).translate(0.4, 0.035, 0.2), 0x6fd0f5),
      ...small.map((g) => g.clone().translate(2.6, 0, -1.2)),
      ...small.map((g) => g.clone().rotateY(2).scale(0.85, 0.9, 0.85).translate(-2.5, 0, 1.0)),
      F(new THREE.DodecahedronGeometry(0.35, 0).scale(1.3, 0.7, 1).translate(1.8, 0.1, 1.6), 0xc98f58),
      F(new THREE.IcosahedronGeometry(0.35, 0).translate(-2.0, 0.25, -1.4), 0x5cb44c)]);
  }
  D.pebblesSand = M([
    F(new THREE.DodecahedronGeometry(0.12, 0).scale(1.3, 0.6, 1).translate(0, 0.05, 0), 0xc99060),
    F(new THREE.DodecahedronGeometry(0.08, 0).scale(1.2, 0.6, 1).translate(0.2, 0.03, 0.12), 0xb8804e)]);
  D.dryTuft = M(tuft([0xc9a85a, 0xb8944a, 0xd8bc70], 6, 0.32));

  // snow
  D.igloo = M([
    F(halfDome(1.25, 12), 0xf4f9ff),
    F(new THREE.TorusGeometry(1.15, 0.04, 3, 18).rotateX(Math.PI / 2).translate(0, 0.42, 0), 0xc8dcf0),
    F(new THREE.TorusGeometry(0.93, 0.04, 3, 18).rotateX(Math.PI / 2).translate(0, 0.82, 0), 0xc8dcf0),
    F(new THREE.TorusGeometry(0.55, 0.04, 3, 14).rotateX(Math.PI / 2).translate(0, 1.12, 0), 0xc8dcf0),
    F(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).translate(0, 0, 1.25), 0xeef5ff),
    F(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).translate(0, 0, 1.72), 0x2a3a50)]);
  D.cabin = withGlow(M([
    F(new THREE.BoxGeometry(1.9, 1.15, 1.5).translate(0, 0.58, 0), 0x7a5232),
    ...[0.22, 0.58, 0.94].map((y) => F(new THREE.BoxGeometry(1.96, 0.1, 1.56).translate(0, y, 0), 0x5e3e24)),
    F(prism(2.3, 1.0, 1.95).translate(0, 1.15, 0), 0x4a3426),
    F(prism(2.36, 0.62, 2.0).translate(0, 1.6, 0), 0xffffff),
    F(new THREE.BoxGeometry(0.28, 0.8, 0.28).translate(-0.55, 2.0, 0.1), 0x8a8a96),
    F(new THREE.BoxGeometry(0.34, 0.12, 0.34).translate(-0.55, 2.42, 0.1), 0xffffff),
    F(new THREE.BoxGeometry(0.44, 0.75, 0.06).translate(0.45, 0.38, 0.77), 0x4a2e1a)]),
  [F(new THREE.BoxGeometry(0.4, 0.34, 0.06).translate(-0.4, 0.62, 0.77), 0xffc95a), F(new THREE.BoxGeometry(0.06, 0.34, 0.4).translate(0.97, 0.62, 0), 0xffc95a)]);
  D.iceSpikes = glow(M([
    F(new THREE.OctahedronGeometry(0.6, 0).scale(0.7, 4.2, 0.7).translate(0, 2.1, 0), 0x9fe6ff),
    F(new THREE.OctahedronGeometry(0.5, 0).scale(0.7, 3.6, 0.7).rotateZ(0.35).translate(0.9, 1.4, 0.3), 0xc8f3ff),
    F(new THREE.OctahedronGeometry(0.45, 0).scale(0.7, 3.2, 0.7).rotateZ(-0.4).translate(-0.85, 1.2, -0.2), 0x7fd8ff),
    F(new THREE.OctahedronGeometry(0.35, 0).scale(0.7, 3.0, 0.7).rotateX(0.4).translate(0.2, 0.9, 0.9), 0xb0ecff),
    F(new THREE.OctahedronGeometry(0.3, 0).scale(0.7, 2.4, 0.7).rotateX(-0.4).translate(-0.2, 0.7, -0.9), 0x8fe0ff)]));
  D.pineGroup = M([
    D.snowPine.clone().scale(1.6, 1.7, 1.6),
    D.snowPine.clone().scale(1.2, 1.3, 1.2).translate(1.9, 0, 0.9),
    D.snowPine2.clone().scale(1.2, 1.2, 1.2).translate(-1.7, 0, 1.2),
    F(halfDome(1, 8).scale(1.2, 0.4, 1).translate(0.4, 0, -1.4), 0xffffff)]);
  D.snowMound = M([
    F(halfDome(1, 8).scale(0.9, 0.38, 0.7), 0xffffff),
    F(halfDome(1, 8).scale(0.55, 0.28, 0.45).translate(0.7, 0, 0.3), 0xf2f7ff),
    F(new THREE.DodecahedronGeometry(0.16, 0).translate(-0.5, 0.1, 0.3), 0x8f9bb0)]);
  D.snowTuft = M([
    F(halfDome(0.22, 6).scale(1.3, 0.6, 1), 0xffffff),
    F(halfDome(0.15, 6).scale(1.2, 0.6, 1).translate(0.3, 0, 0.1), 0xeef4ff)]);
  D.icePebble = M([
    F(new THREE.OctahedronGeometry(0.09, 0).scale(1, 1.6, 1).translate(0, 0.1, 0), 0x9fe0ff),
    F(new THREE.DodecahedronGeometry(0.1, 0).scale(1.3, 0.6, 1).translate(0.18, 0.04, 0.1), 0x9aa8bc)]);

  // lava
  D.ruins = withGlow(M([
    F(new THREE.BoxGeometry(3.4, 0.28, 1.8).translate(0, 0.14, 0), 0x3a3038),
    F(new THREE.CylinderGeometry(0.34, 0.4, 2.8, 8).translate(-1.1, 1.65, 0), 0x52464e),
    F(new THREE.BoxGeometry(0.95, 0.26, 0.95).translate(-1.1, 3.15, 0), 0x463a42),
    F(new THREE.BoxGeometry(0.95, 0.26, 0.95).translate(-1.1, 0.4, 0), 0x463a42),
    F(new THREE.CylinderGeometry(0.34, 0.4, 1.3, 8).translate(1.1, 0.9, 0.1), 0x52464e),
    F(new THREE.BoxGeometry(0.95, 0.26, 0.95).translate(1.1, 0.4, 0.1), 0x463a42),
    F(new THREE.BoxGeometry(1.8, 0.4, 0.8).rotateZ(0.2).translate(-0.4, 3.45, 0), 0x3e3238),
    F(new THREE.CylinderGeometry(0.32, 0.36, 1.6, 8).rotateZ(Math.PI / 2).rotateY(0.4).translate(0.6, 0.5, 1.4), 0x4a3e46),
    F(new THREE.DodecahedronGeometry(0.4, 0).translate(1.7, 0.3, -0.6), 0x2a2026)]),
  [F(new THREE.BoxGeometry(0.06, 1.2, 0.02).rotateZ(0.2).translate(-1.1, 1.6, 0.38), 0xff7a1a),
    F(new THREE.BoxGeometry(0.06, 0.6, 0.02).rotateZ(-0.3).translate(-1.0, 2.3, 0.37), 0xff9a3c),
    F(new THREE.BoxGeometry(2.6, 0.04, 0.06).translate(0, 0.3, 0.91), 0xff6a1a)]);
  D.volcano = withGlow(M([
    F(new THREE.CylinderGeometry(0.9, 4.0, 4.6, 9).translate(0, 2.3, 0), 0x2e2226),
    F(new THREE.CylinderGeometry(4.0, 4.3, 0.4, 9).translate(0, 0.2, 0), 0x241a1e),
    F(new THREE.DodecahedronGeometry(0.8, 0).translate(3.4, 0.4, 1.5), 0x1e161a)]),
  [F(new THREE.CylinderGeometry(0.86, 0.86, 0.1, 9).translate(0, 4.58, 0), 0xffc23a),
    ...[0, 2.1, 4.2].map((a) => F(new THREE.BoxGeometry(0.26, 2.6, 0.1).rotateX(-0.598).translate(0, 3.3, 1.82).rotateY(a), 0xff6a1a))]);
  D.skullRock = withGlow(M([
    F(new THREE.IcosahedronGeometry(1.6, 1).scale(1.1, 1, 1.15).translate(0, 1.7, 0), 0xcfc4b4),
    F(new THREE.BoxGeometry(1.7, 0.7, 1.3).translate(0, 0.45, 0.6), 0xbdb2a2),
    F(new THREE.IcosahedronGeometry(0.48, 0).translate(-0.58, 1.8, 1.42), 0x1a1214),
    F(new THREE.IcosahedronGeometry(0.48, 0).translate(0.58, 1.8, 1.42), 0x1a1214),
    F(new THREE.ConeGeometry(0.2, 0.4, 3).rotateX(Math.PI).translate(0, 1.2, 1.72), 0x1a1214),
    ...[-0.6, -0.3, 0, 0.3, 0.6].map((x) => F(new THREE.BoxGeometry(0.22, 0.3, 0.1).translate(x, 0.82, 1.26), 0xf3ecdc)),
    F(new THREE.DodecahedronGeometry(0.7, 0).translate(1.6, 0.35, -0.8), 0x2a2026)]),
  [F(new THREE.IcosahedronGeometry(0.2, 0).translate(-0.58, 1.8, 1.72), 0xff6a1a), F(new THREE.IcosahedronGeometry(0.2, 0).translate(0.58, 1.8, 1.72), 0xff6a1a)]);
  D.bonePile = M([
    ...skull(1.1, 0xe8dcc8, 0x1a1214).map((g) => g.rotateY(0.4)),
    ...bone(0.55, 0.3, 0.05, -0.2, 0.8, 0xe0d4c0), ...bone(0.5, -0.3, 0.06, 0.1, -0.5, 0xe0d4c0), ...bone(0.4, 0.1, 0.12, 0.35, 1.9, 0xd8ccb8),
    F(new THREE.DodecahedronGeometry(0.2, 0).scale(1.3, 0.6, 1).translate(-0.4, 0.06, -0.35), 0x2a2026)]);
  D.ashRock = M([
    F(new THREE.DodecahedronGeometry(0.16, 0).scale(1.3, 0.6, 1).translate(0, 0.06, 0), 0x2a2026),
    F(new THREE.DodecahedronGeometry(0.1, 0).scale(1.2, 0.7, 1).translate(0.22, 0.04, 0.1), 0x3a2c30)]);
  D.ember = glow(M([
    F(new THREE.DodecahedronGeometry(0.09, 0).scale(1.3, 0.5, 1).translate(0, 0.03, 0), 0xff7a1a),
    F(new THREE.DodecahedronGeometry(0.06, 0).scale(1.2, 0.5, 1).translate(0.18, 0.02, 0.1), 0xffc23a)]));

  D.cloud = mergeGeometries([
    plain(new THREE.IcosahedronGeometry(2.2, 1)),
    plain(new THREE.IcosahedronGeometry(1.7, 1).translate(2.4, -0.3, 0.2)),
    plain(new THREE.IcosahedronGeometry(1.6, 1).translate(-2.3, -0.4, -0.1)),
    plain(new THREE.IcosahedronGeometry(1.3, 1).translate(0.9, 1.1, 0.3))]).scale(1, 0.62, 0.8);

  // saw blade + side posts
  const parts = [F(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 28).rotateX(Math.PI / 2), 0xe2e8f0),
    F(new THREE.TorusGeometry(0.74, 0.035, 4, 28).translate(0, 0, 0.05), 0x8d97a6),
    F(new THREE.TorusGeometry(0.74, 0.035, 4, 28).translate(0, 0, -0.05), 0x8d97a6),
    F(new THREE.CylinderGeometry(0.58, 0.58, 0.13, 28).rotateX(Math.PI / 2), 0xbfc8d4),
    F(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 14).rotateX(Math.PI / 2), 0xff4650),
    F(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 10).rotateX(Math.PI / 2), 0x2a2e38)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(F(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8).rotateX(Math.PI / 2).translate(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0), 0x6d7786));
    parts.push(F(new THREE.BoxGeometry(0.2, 0.07, 0.115).translate(0.66, 0, 0).rotateZ(a + 0.5), 0x5a6474));
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const t = new THREE.ConeGeometry(0.12, 0.3, 4).rotateZ(-Math.PI / 2 + 0.4);
    t.translate(1.0, 0, 0); t.rotateZ(a);
    parts.push(F(t, i % 2 ? 0xc8d0dc : 0xaeb7c4));
  }
  D.saw = mergeGeometries(parts);
  D.sawPost = mergeGeometries([
    F(new THREE.BoxGeometry(0.6, 0.12, 0.7).translate(0, 0.06, 0), 0x3a3f4c),
    F(new THREE.BoxGeometry(0.35, 1.1, 0.5).translate(0, 0.6, 0), 0xffc83a),
    ...[0.32, 0.62, 0.92].map((y) => F(new THREE.BoxGeometry(0.37, 0.12, 0.52).translate(0, y, 0), 0x23262e)),
    F(new THREE.BoxGeometry(0.42, 0.1, 0.56).translate(0, 1.2, 0), 0x3a3f4c),
    F(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 8).translate(0, 1.33, 0), 0xff3b3b),
    F(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6).rotateZ(Math.PI / 2).translate(0, 0.5, 0), 0x8d97a6)]);
  return D;
}

// ------------------------------------------------------------ rivers (lava / water / ice ribbons beside the road)
// Each path: side (-1|1), centre distance from the road axis as a function of z, width.
export function riverPaths(th, rnd) {
  if (!th.river) return [];
  const R = th.river;
  return R.sides.map((side) => {
    const p1 = rnd() * 6.28, p2 = rnd() * 6.28, f1 = 0.035 + rnd() * 0.02, f2 = 0.09 + rnd() * 0.03;
    return { side, w: R.w, cx: (z) => R.base + Math.sin(z * f1 + p1) * R.amp + Math.sin(z * f2 + p2) * R.amp * 0.35 };
  });
}
export function riverBlocked(paths, x, z, margin) {
  for (const r of paths) if (Math.sign(x) === r.side && Math.abs(Math.abs(x) - r.cx(z)) < r.w / 2 + margin) return true;
  return false;
}
// returns { lit, glow } merged ribbon geometries (either may be null)
export function buildRivers(th, paths, z0, z1) {
  if (!paths.length) return { lit: null, glow: null };
  const R = th.river, lit = [], glw = [];
  const ribbon = (out, r, w, y, hex) => {
    const pos = [], col = [], nor = [], c = new THREE.Color(hex);
    for (let z = z0; z < z1; z += 2) {
      const a0 = r.cx(z), a1 = r.cx(z + 2), s = r.side;
      const q = [[s * (a0 - w / 2), z], [s * (a0 + w / 2), z], [s * (a1 + w / 2), z + 2], [s * (a1 - w / 2), z + 2]];
      const tri = s > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      for (const k of tri) { pos.push(q[k][0], y, q[k][1]); nor.push(0, 1, 0); col.push(c.r, c.g, c.b); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    out.push(g);
  };
  for (const r of paths) {
    ribbon(lit, r, r.w + 2.0, -0.035, R.bank);
    ribbon(R.glow ? glw : lit, r, r.w, -0.022, R.water);
    ribbon(R.glow ? glw : lit, r, r.w * 0.38, -0.012, R.core);
  }
  return { lit: lit.length ? mergeGeometries(lit) : null, glow: glw.length ? mergeGeometries(glw) : null };
}

// ------------------------------------------------------------ distant skyline ring (follows the camera)
const SKY_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
function skylineGeo(th) {
  const S = th.skyline, rnd = mulberry32(th.key.length * 977 + th.skyTop % 1013);
  const fog = new THREE.Color(th.fog);
  const pos = [], col = [];
  const layer = (radius, shape, hex, haze, hMin, hMax, nPeaks) => {
    const N = 120, base = new THREE.Color(hex).lerp(fog, haze), mid = base.clone().lerp(fog, 0.35);
    const capC = S.cap != null ? new THREE.Color(S.cap).lerp(fog, shape === 'volcano' ? 0.05 : haze * 0.6) : base;
    const peaks = [];
    const mesa = shape === 'mesa', n = mesa ? 12 : nPeaks;
    for (let i = 0; i < n; i++) peaks.push({ a: rnd() * Math.PI * 2, h: (hMin + rnd() * (hMax - hMin)) * (mesa ? 0.6 : 1), w: mesa ? 0.025 + rnd() * 0.06 : 0.08 + rnd() * 0.16, top: rnd() });
    const hAt = (t) => {
      let h = hMin * 0.35;
      for (const p of peaks) {
        let d = Math.abs(t - p.a); if (d > Math.PI) d = Math.PI * 2 - d;
        let v;
        if (shape === 'mesa') v = p.h * Math.min(1, Math.max(0, (p.w - d) / 0.03));
        else if (shape === 'dunes' || shape === 'hills') v = p.h * Math.pow(Math.max(0, Math.cos(Math.min(1, d / (p.w * 1.6)) * Math.PI / 2)), 1.5);
        else { v = p.h * Math.max(0, 1 - d / p.w); if (shape === 'volcano' && p.top > 0.5) v = Math.min(v, p.h * 0.82); }
        if (v > h) h = v;
      }
      return h + ((shape === 'alps' || shape === 'volcano') ? Math.sin(t * 23) * 0.25 : 0);
    };
    const rows = [-8, 0.5, 0.82, 1];
    const H = [];
    for (let i = 0; i <= N; i++) H.push(hAt((i / N) * Math.PI * 2));
    const capT = hMin + (hMax - hMin) * 0.45;
    const cOf = (r, h) => (r === 0 ? fog : r === 1 ? mid : r === 2 ? base : (h > capT ? capC : base));
    for (let i = 0; i < N; i++) {
      const t0 = (i / N) * Math.PI * 2, t1 = ((i + 1) / N) * Math.PI * 2;
      for (let r = 0; r < 3; r++) {
        const v = [[t0, r, H[i]], [t1, r, H[i + 1]], [t1, r + 1, H[i + 1]], [t0, r + 1, H[i]]];
        for (const k of [0, 1, 2, 0, 2, 3]) {
          const [t, rr, h] = v[k];
          pos.push(Math.sin(t) * radius, rr === 0 ? rows[0] : rows[rr] * h, Math.cos(t) * radius);
          const c = cOf(rr, h); col.push(c.r, c.g, c.b);
        }
      }
    }
  };
  layer(140, S.farShape, S.far, 0.45, 6, 18, 26);
  layer(126, S.nearShape, S.near, 0.2, 2.5, 8.5, 22);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
// Cheap mountain ring: one draw call, unlit, fog baked into the vertex colours.
export function skylineMesh(th) {
  if (!th._sky) th._sky = skylineGeo(th);
  const m = new THREE.Mesh(th._sky, SKY_MAT);
  m.frustumCulled = false;
  m.onBeforeRender = (r, s, cam) => { m.position.set(cam.position.x, 0, cam.position.z); m.updateMatrixWorld(); };
  return m;
}

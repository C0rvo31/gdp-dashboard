import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Sfx } from './audio.js';

const $ = (id) => document.getElementById(id);

// ============================================================ save data
const SAVE_KEY = 'ordu_kosusu_save_v1';
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } }
const save = Object.assign({ level: 1, coins: 0, upStart: 0, upRate: 0, upDmg: 0, sound: true, vibe: true, eco: false }, loadSave());
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

const UPG = { upStart: { base: 40, max: 40 }, upRate: { base: 55, max: 30 }, upDmg: { base: 55, max: 30 } };
const upCost = (k) => Math.round(UPG[k].base * Math.pow(1.42, save[k]));
const startSoldiers = () => 1 + save.upStart;
const rateMul = () => 1 + save.upRate * 0.08;
const dmgMul = () => 1 + save.upDmg * 0.1;

const WEAPONS = [
  { name: 'TABANCA', rate: 2.0, dmg: 1.0, gun: 0x3b3f4a, len: 0.26, bullet: 0xffe14d, bs: 1.0 },
  { name: 'TÜFEK', rate: 3.0, dmg: 1.25, gun: 0x7a4f2a, len: 0.46, bullet: 0xffb020, bs: 1.1 },
  { name: 'MAKİNELİ', rate: 4.6, dmg: 1.4, gun: 0x23262e, len: 0.56, bullet: 0xff8a1a, bs: 1.1 },
  { name: 'PLAZMA', rate: 5.4, dmg: 1.95, gun: 0x1d9bf0, len: 0.6, bullet: 0x6ff7ff, bs: 1.4 },
  { name: 'ROKETATAR', rate: 3.2, dmg: 4.6, gun: 0x41663a, len: 0.74, bullet: 0xff5a3a, bs: 2.0 },
];
const weaponDps = (w) => WEAPONS[w].rate * WEAPONS[w].dmg;

// ============================================================ constants
const HALF = 5;            // road half width
const MAXV = 220;          // visible player soldiers
const GROUP_MAXV = 120;    // visible soldiers per enemy group
const SPACING = 0.34;
const BULLET_SPEED = 46;
const OFF = [];
for (let i = 0; i < 400; i++) {
  const r = SPACING * Math.sqrt(i), a = i * 2.39996323;
  OFF.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
}
const formRadius = (n) => SPACING * Math.sqrt(Math.max(1, n)) + 0.25;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================ renderer / scene
const sfx = new Sfx();
sfx.enabled = save.sound;

const container = $('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: false, powerPreference: 'default' });
container.appendChild(renderer.domElement);
function applyQuality() {
  renderer.setPixelRatio(save.eco ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

const scene = new THREE.Scene();
const SKY_H = 0xcdeeff;
scene.fog = new THREE.Fog(SKY_H, 48, 125);
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 170);

function onResize() {
  applyQuality();
  const a = window.innerWidth / window.innerHeight;
  camera.aspect = a;
  camera.fov = a < 0.75 ? 62 : 48;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

scene.add(new THREE.HemisphereLight(0xffffff, 0x86a070, 2.3));
const sun = new THREE.DirectionalLight(0xfff2dc, 2.3);
sun.position.set(-0.55, 1, -0.45);
scene.add(sun);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(150, 24, 12),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3b97ff) }, bot: { value: new THREE.Color(SKY_H) } },
    vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float vY; void main(){ gl_FragColor = vec4(mix(bot, top, smoothstep(-0.02, 0.55, vY)), 1.0);\n#include <colorspace_fragment>\n}',
  })
);
sky.renderOrder = -10;
scene.add(sky);

// ============================================================ canvas helpers
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function canvasTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t;
}
const FONT = '"Roboto","Segoe UI",system-ui,sans-serif';
function fmt(n) { n = Math.max(0, Math.round(n)); return n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'K' : String(n); }
function strokeText(ctx, text, x, y, size, fill, stroke, sw) {
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = sw; ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

// ---------- shared textures
const TEX = {};
(function buildTextures() {
  // road
  let c = makeCanvas(256, 256), x = c.getContext('2d');
  x.fillStyle = '#97a2b8'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  x.fillStyle = '#f4f7ff'; x.fillRect(8, 0, 9, 256); x.fillRect(239, 0, 9, 256);
  x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(84, 20, 6, 96); x.fillRect(166, 20, 6, 96); x.fillRect(84, 148, 6, 96); x.fillRect(166, 148, 6, 96);
  TEX.road = canvasTex(c); TEX.road.wrapS = TEX.road.wrapT = THREE.RepeatWrapping;
  TEX.road.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // curb
  c = makeCanvas(64, 32); x = c.getContext('2d');
  x.fillStyle = '#ff4f5e'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#ffffff'; x.fillRect(32, 0, 32, 32);
  TEX.curb = canvasTex(c); TEX.curb.wrapS = TEX.curb.wrapT = THREE.RepeatWrapping;

  // blob shadow
  c = makeCanvas(64, 64); x = c.getContext('2d');
  let g = x.createRadialGradient(32, 32, 4, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  TEX.shadow = new THREE.CanvasTexture(c);

  // bricks
  c = makeCanvas(128, 128); x = c.getContext('2d');
  x.fillStyle = '#c9542f'; x.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 4; r++) for (let k = -1; k < 3; k++) {
    const ox = k * 64 + (r % 2 ? 32 : 0) + 3;
    x.fillStyle = ['#ff8a4c', '#f47a40', '#ff9a5a'][(r + k + 3) % 3];
    roundRect(x, ox, r * 32 + 3, 58, 26, 4); x.fill();
  }
  TEX.brick = canvasTex(c); TEX.brick.wrapS = TEX.brick.wrapT = THREE.RepeatWrapping;

  // crate wood
  c = makeCanvas(128, 128); x = c.getContext('2d');
  x.fillStyle = '#d99a55'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#c4823f'; for (let i = 0; i < 4; i++) x.fillRect(0, i * 32 + 30, 128, 3);
  x.strokeStyle = '#8a5424'; x.lineWidth = 14; x.strokeRect(7, 7, 114, 114);
  x.lineWidth = 10; x.beginPath(); x.moveTo(12, 12); x.lineTo(116, 116); x.stroke();
  TEX.wood = canvasTex(c);

  // finish checker
  c = makeCanvas(128, 32); x = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#1b2236' : '#ffffff'; x.fillRect(i * 16, j * 16, 16, 16); }
  TEX.checker = canvasTex(c); TEX.checker.magFilter = THREE.NearestFilter;
})();

// ============================================================ materials & geometry
const MAT = {
  skin: new THREE.MeshLambertMaterial({ color: 0xf6c39b }),
  pBody: new THREE.MeshLambertMaterial({ color: 0x2f8cff }),
  pLeg: new THREE.MeshLambertMaterial({ color: 0x27436d }),
  eBody: new THREE.MeshLambertMaterial({ color: 0xff4650 }),
  eLeg: new THREE.MeshLambertMaterial({ color: 0x6a2232 }),
  gun: new THREE.MeshLambertMaterial({ color: WEAPONS[0].gun }),
  shadow: new THREE.MeshBasicMaterial({ map: TEX.shadow, color: 0x0b1a33, transparent: true, opacity: 0.42, depthWrite: false }),
  road: new THREE.MeshLambertMaterial({ map: TEX.road }),
  curb: new THREE.MeshLambertMaterial({ map: TEX.curb }),
  ground: new THREE.MeshLambertMaterial({ color: 0x84d35e }),
  ground2: new THREE.MeshLambertMaterial({ color: 0x6fc24f }),
  post: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  wood: new THREE.MeshLambertMaterial({ map: TEX.wood }),
  metal: new THREE.MeshLambertMaterial({ color: 0xd5dce6 }),
  hub: new THREE.MeshLambertMaterial({ color: 0xff4650 }),
  slot: new THREE.MeshBasicMaterial({ color: 0x3c4458 }),
  coin: new THREE.MeshLambertMaterial({ color: 0xffc83a, emissive: 0x6a4300 }),
  bullet: new THREE.MeshBasicMaterial({ color: WEAPONS[0].bullet }),
  particle: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  checker: new THREE.MeshLambertMaterial({ map: TEX.checker }),
  decor: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
};

function tint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function plain(geo) { // strip to position+normal for merging
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  return g;
}

const G = {};
(function buildGeometry() {
  const torso = new THREE.CapsuleGeometry(0.17, 0.2, 3, 10); torso.scale(1, 1, 0.82); torso.translate(0, 0.66, 0);
  const helmet = new THREE.SphereGeometry(0.165, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); helmet.translate(0, 0.99, 0);
  const brim = new THREE.CylinderGeometry(0.2, 0.2, 0.035, 12); brim.translate(0, 0.99, 0);
  const armR = new THREE.BoxGeometry(0.09, 0.09, 0.3); armR.rotateY(-0.2); armR.translate(0.15, 0.74, 0.12);
  const armL = new THREE.BoxGeometry(0.09, 0.09, 0.34); armL.rotateY(0.45); armL.translate(-0.07, 0.73, 0.17);
  G.body = mergeGeometries([torso, helmet, brim, armR, armL].map(plain));
  G.head = new THREE.SphereGeometry(0.135, 12, 8); G.head.translate(0, 0.96, 0);
  G.leg = new THREE.BoxGeometry(0.11, 0.42, 0.13); G.leg.translate(0, -0.21, 0);
  G.guns = WEAPONS.map((w) => { const g = new THREE.BoxGeometry(0.075, 0.095, w.len); g.translate(0.05, 0.75, 0.16 + w.len / 2); return g; });
  G.shadow = new THREE.PlaneGeometry(0.62, 0.62); G.shadow.rotateX(-Math.PI / 2); G.shadow.translate(0, 0.012, 0);
  G.bullet = new THREE.BoxGeometry(0.08, 0.08, 0.55);
  G.particle = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  G.coin = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 18); G.coin.rotateX(Math.PI / 2);

  // decor (vertex coloured, flat shaded)
  const trunk = () => tint(plain(new THREE.CylinderGeometry(0.12, 0.17, 0.9, 6).translate(0, 0.45, 0)), 0x8a5a33);
  G.tree1 = mergeGeometries([
    trunk(),
    tint(plain(new THREE.IcosahedronGeometry(0.95, 0).translate(0, 1.55, 0)), 0x4fb848),
    tint(plain(new THREE.IcosahedronGeometry(0.6, 0).translate(0.35, 2.15, 0.1)), 0x66cc55),
  ]);
  G.tree2 = mergeGeometries([
    trunk(),
    tint(plain(new THREE.ConeGeometry(0.95, 1.4, 7).translate(0, 1.4, 0)), 0x2f9f5a),
    tint(plain(new THREE.ConeGeometry(0.7, 1.1, 7).translate(0, 2.1, 0)), 0x3cb46a),
  ]);
  G.rock = tint(plain(new THREE.DodecahedronGeometry(0.55, 0).scale(1.3, 0.7, 1).translate(0, 0.2, 0)), 0xb8c0cc);
  G.bush = mergeGeometries([
    tint(plain(new THREE.IcosahedronGeometry(0.5, 0).translate(0, 0.3, 0)), 0x5cc24c),
    tint(plain(new THREE.IcosahedronGeometry(0.38, 0).translate(0.45, 0.25, 0.1)), 0x74d15a),
    tint(plain(new THREE.IcosahedronGeometry(0.12, 0).translate(0.1, 0.72, 0.2)), 0xff6fa8),
  ]);

  // saw blade
  const parts = [tint(plain(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 28).rotateX(Math.PI / 2)), 0xd5dce6),
    tint(plain(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 14).rotateX(Math.PI / 2)), 0xff4650)];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const t = new THREE.ConeGeometry(0.13, 0.32, 4).rotateZ(-Math.PI / 2 + 0.35);
    t.translate(1.0, 0, 0); t.rotateZ(a);
    parts.push(tint(plain(t), 0xaeb7c4));
  }
  G.saw = mergeGeometries(parts);
})();

// ============================================================ instanced troop renderer
function wRy(a, o, c, s, x, y, z, k) {
  a[o] = c * k; a[o + 1] = 0; a[o + 2] = -s * k; a[o + 3] = 0;
  a[o + 4] = 0; a[o + 5] = k; a[o + 6] = 0; a[o + 7] = 0;
  a[o + 8] = s * k; a[o + 9] = 0; a[o + 10] = c * k; a[o + 11] = 0;
  a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
}
function wLeg(a, o, c, s, cb, sb, x, y, z, k) {
  a[o] = c * k; a[o + 1] = 0; a[o + 2] = -s * k; a[o + 3] = 0;
  a[o + 4] = s * sb * k; a[o + 5] = cb * k; a[o + 6] = c * sb * k; a[o + 7] = 0;
  a[o + 8] = s * cb * k; a[o + 9] = -sb * k; a[o + 10] = c * cb * k; a[o + 11] = 0;
  a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
}

class Troop {
  constructor(max, bodyMat, legMat, withGun) {
    this.max = max; this.n = 0;
    const mk = (geo, mat) => {
      const m = new THREE.InstancedMesh(geo, mat, max);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0; m.frustumCulled = false; scene.add(m);
      return m;
    };
    this.shadow = mk(G.shadow, MAT.shadow);
    this.body = mk(G.body, bodyMat);
    this.head = mk(G.head, MAT.skin);
    this.legL = mk(G.leg, legMat);
    this.legR = mk(G.leg, legMat);
    this.gun = withGun ? mk(G.guns[0], MAT.gun) : null;
    this.meshes = [this.shadow, this.body, this.head, this.legL, this.legR];
    if (this.gun) this.meshes.push(this.gun);
  }
  begin() { this.n = 0; }
  push(x, y, z, ry, swing, k) {
    if (this.n >= this.max || k <= 0.01) return;
    const o = this.n++ * 16, c = Math.cos(ry), s = Math.sin(ry);
    wRy(this.body.instanceMatrix.array, o, c, s, x, y, z, k);
    wRy(this.head.instanceMatrix.array, o, c, s, x, y, z, k);
    if (this.gun) wRy(this.gun.instanceMatrix.array, o, c, s, x, y, z, k);
    wRy(this.shadow.instanceMatrix.array, o, 1, 0, x, 0, z, k);
    const cb = Math.cos(swing), sb = Math.sin(swing), hy = y + 0.45 * k, hx = 0.075 * k;
    wLeg(this.legL.instanceMatrix.array, o, c, s, cb, sb, x - c * hx, hy, z + s * hx, k);
    wLeg(this.legR.instanceMatrix.array, o, c, s, cb, -sb, x + c * hx, hy, z - s * hx, k);
  }
  end() {
    for (const m of this.meshes) {
      m.count = this.n;
      m.instanceMatrix.clearUpdateRanges();
      m.instanceMatrix.addUpdateRange(0, Math.max(1, this.n) * 16);
      m.instanceMatrix.needsUpdate = true;
    }
  }
}

const pTroop = new Troop(MAXV, MAT.pBody, MAT.pLeg, true);
const eTroop = new Troop(360, MAT.eBody, MAT.eLeg, false);

// ============================================================ particles & bullets
const PN = 420;
const P = {
  x: new Float32Array(PN), y: new Float32Array(PN), z: new Float32Array(PN),
  vx: new Float32Array(PN), vy: new Float32Array(PN), vz: new Float32Array(PN),
  life: new Float32Array(PN), max: new Float32Array(PN), size: new Float32Array(PN), grav: new Float32Array(PN), spin: new Float32Array(PN),
  next: 0, top: 0,
  mesh: new THREE.InstancedMesh(G.particle, MAT.particle, PN),
};
P.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
P.mesh.frustumCulled = false;
{ const w = new THREE.Color(1, 1, 1); for (let i = 0; i < PN; i++) P.mesh.setColorAt(i, w); }
P.mesh.count = 0;
scene.add(P.mesh);
const tmpColor = new THREE.Color();
let colorDirty = false;

function burst(x, y, z, hex, count, speed = 4, size = 1, grav = 18, up = 3) {
  tmpColor.setHex(hex);
  for (let n = 0; n < count; n++) {
    const i = P.next; P.next = (P.next + 1) % PN;
    const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.6);
    P.x[i] = x; P.y[i] = y; P.z[i] = z;
    P.vx[i] = Math.cos(a) * sp; P.vz[i] = Math.sin(a) * sp; P.vy[i] = up * (0.5 + Math.random());
    P.max[i] = P.life[i] = 0.45 + Math.random() * 0.4;
    P.size[i] = size * (0.6 + Math.random() * 0.6); P.grav[i] = grav; P.spin[i] = Math.random() * 10;
    P.mesh.setColorAt(i, tmpColor);
    if (i + 1 > P.top) P.top = i + 1;
  }
  colorDirty = true;
}
const CONFETTI = [0xff4f5e, 0xffc83a, 0x2f8cff, 0x3bd16f, 0xb46bff, 0xffffff];
function confetti(x, z, count) {
  for (let n = 0; n < count; n++) {
    const i = P.next; P.next = (P.next + 1) % PN;
    P.x[i] = x + (Math.random() - 0.5) * 9; P.y[i] = 7 + Math.random() * 5; P.z[i] = z + (Math.random() - 0.3) * 10;
    P.vx[i] = (Math.random() - 0.5) * 2; P.vz[i] = (Math.random() - 0.5) * 2; P.vy[i] = -1 - Math.random() * 2;
    P.max[i] = P.life[i] = 2.2 + Math.random() * 1.5; P.size[i] = 0.9; P.grav[i] = 1.2; P.spin[i] = 4 + Math.random() * 8;
    tmpColor.setHex(CONFETTI[n % CONFETTI.length]); P.mesh.setColorAt(i, tmpColor);
    if (i + 1 > P.top) P.top = i + 1;
  }
  colorDirty = true;
}
function updateParticles(dt) {
  const a = P.mesh.instanceMatrix.array;
  let top = 0;
  for (let i = 0; i < P.top; i++) {
    const o = i * 16;
    if (P.life[i] <= 0) { a[o] = a[o + 5] = a[o + 10] = 0; continue; }
    P.life[i] -= dt;
    P.vy[i] -= P.grav[i] * dt;
    P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
    if (P.y[i] < 0.08) { P.y[i] = 0.08; P.vy[i] *= -0.35; P.vx[i] *= 0.7; P.vz[i] *= 0.7; }
    const k = P.size[i] * Math.min(1, (P.life[i] / P.max[i]) * 2.2), r = P.spin[i] * P.life[i];
    const c = Math.cos(r) * k, s = Math.sin(r) * k;
    a[o] = c; a[o + 1] = s; a[o + 2] = 0; a[o + 3] = 0;
    a[o + 4] = -s; a[o + 5] = c; a[o + 6] = 0; a[o + 7] = 0;
    a[o + 8] = 0; a[o + 9] = 0; a[o + 10] = k; a[o + 11] = 0;
    a[o + 12] = P.x[i]; a[o + 13] = P.y[i]; a[o + 14] = P.z[i]; a[o + 15] = 1;
    top = i + 1;
  }
  P.top = top;
  P.mesh.count = top;
  if (top) P.mesh.instanceMatrix.needsUpdate = true;
  if (colorDirty && P.mesh.instanceColor) { P.mesh.instanceColor.needsUpdate = true; colorDirty = false; }
}

const BN = 180;
const B = {
  x: new Float32Array(BN), y: new Float32Array(BN), z: new Float32Array(BN), dmg: new Float32Array(BN), life: new Float32Array(BN),
  next: 0, top: 0, mesh: new THREE.InstancedMesh(G.bullet, MAT.bullet, BN),
};
B.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
B.mesh.frustumCulled = false; B.mesh.count = 0;
scene.add(B.mesh);
function spawnBullet(x, y, z, dmg) {
  const i = B.next; B.next = (B.next + 1) % BN;
  B.x[i] = x; B.y[i] = y; B.z[i] = z; B.dmg[i] = dmg; B.life[i] = 0.55;
  if (i + 1 > B.top) B.top = i + 1;
}

// ============================================================ labels
class CountLabel {
  constructor(color, dark) {
    this.c = makeCanvas(256, 128); this.ctx = this.c.getContext('2d');
    this.color = color; this.dark = dark; this.val = -1;
    this.tex = canvasTex(this.c);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthTest: false, transparent: true, fog: false }));
    this.sprite.scale.set(1.5, 0.75, 1);
    this.sprite.renderOrder = 20;
    scene.add(this.sprite);
  }
  set(v) {
    v = Math.max(0, Math.round(v));
    if (v === this.val) return;
    this.val = v;
    const x = this.ctx, t = fmt(v);
    x.clearRect(0, 0, 256, 128);
    x.font = `900 76px ${FONT}`;
    const w = Math.min(244, Math.max(120, x.measureText(t).width + 60));
    x.fillStyle = this.dark; roundRect(x, 128 - w / 2, 18, w, 96, 30); x.fill();
    x.fillStyle = this.color; roundRect(x, 128 - w / 2, 10, w, 96, 30); x.fill();
    strokeText(x, t, 128, 62, 76, '#ffffff', 'rgba(0,0,0,.18)', 6);
    this.tex.needsUpdate = true;
  }
  dispose() { scene.remove(this.sprite); this.tex.dispose(); this.sprite.material.dispose(); }
}
const squadLabel = new CountLabel('#2f8cff', '#1b5fd1');

// ============================================================ game state
const S = {
  state: 'menu', t: 0, count: 1, weapon: 0, runCoins: 0, shotAcc: 0, fight: null, shake: 0,
  endT: 0, paused: false, collected: 0, startCount: 1, cause: '', deaths: {},
};
const squad = { x: 0, tx: 0, z: 0, speed: 9, sold: [] };
let LV = null; // current level
const camLook = new THREE.Vector3(0, 0, 8);

// ============================================================ level generation
function nice(v) { return v > 20 ? Math.round(v / 5) * 5 : Math.round(v); }
function applyOp(op, n) {
  switch (op.k) {
    case 'add': return n + op.v;
    case 'sub': return n - op.v;
    case 'mul': return n * op.v;
    case 'div': return Math.ceil(n / op.v);
  }
  return n;
}
const opText = (op) => ({ add: '+', sub: '−', mul: '×', div: '÷' }[op.k] + op.v);
const isGood = (op) => op.k === 'add' || op.k === 'mul';

function genLevel(L) {
  const rnd = mulberry32(L * 7919 + 13);
  const R = (a, b) => a + (b - a) * rnd();
  const RI = (a, b) => Math.floor(R(a, b + 1));
  const chance = (p) => rnd() < p;
  const pick = (arr) => arr[RI(0, arr.length - 1)];
  const spec = { gates: [], blocks: [], enemies: [], saws: [], coins: [] };
  let E = startSoldiers(), W = 0;
  const mult = rateMul() * dmgMul();
  const dps = () => E * weaponDps(W) * mult;

  const nSeg = 8 + Math.min(L, 10);
  const plan = new Array(nSeg).fill(null);
  plan[0] = 'gate'; plan[1] = 'wcrate'; plan[2] = 'gate'; plan[3] = 'enemy';
  plan[Math.floor(nSeg * 0.55)] = 'wcrate';
  if (L >= 3) plan[Math.floor(nSeg * 0.8)] = 'wcrate';
  plan[nSeg - 2] = 'gate'; plan[nSeg - 1] = 'enemy';
  const pool = ['gate', 'gate', 'gate', 'enemy', 'enemy', 'wall', 'scrate'];
  if (L >= 2) pool.push('saw', 'wall');
  if (L >= 4) pool.push('saw');
  for (let i = 0; i < nSeg; i++) {
    if (plan[i]) continue;
    let t, guard = 0;
    do { t = pick(pool); } while (t === plan[i - 1] && t !== 'gate' && guard++ < 10);
    plan[i] = t;
  }

  const goodOp = () => {
    if (E < 30 && chance(0.4)) return { k: 'mul', v: E < 8 && chance(0.5) ? 3 : 2 };
    return { k: 'add', v: nice(Math.max(3, E * R(0.4, 1.0) + R(2, 6))) };
  };
  const badOp = () => {
    if (E < 4 || (E > 6 && chance(0.4))) return { k: 'div', v: L > 6 && E > 12 && chance(0.4) ? 3 : 2 };
    return { k: 'sub', v: Math.min(Math.floor(E * 0.6), nice(Math.max(2, E * R(0.25, 0.55)))) };
  };
  let gateNo = 0;

  let z = 26;
  for (const t of plan) {
    if (t === 'gate') {
      const a = goodOp();
      let b = gateNo++ < 2 || chance(0.3) ? goodOp() : badOp();
      if (b.k === a.k && b.v === a.v) b = badOp();
      const ops = chance(0.5) ? [a, b] : [b, a];
      spec.gates.push({ z, ops });
      E = Math.max(applyOp(ops[0], E), applyOp(ops[1], E));
      z += R(22, 27);
    } else if (t === 'enemy') {
      const n = Math.max(3, Math.round(E * R(0.35, 0.62) * (1 + L * 0.03)));
      spec.enemies.push({ z: z + 4, x: n > 25 ? 0 : R(-2.2, 2.2), n });
      E = Math.max(3, E - n * 0.55);
      z += R(26, 30);
    } else if (t === 'wall') {
      const hp = () => Math.max(5, Math.round(dps() * R(1.2, 3.0)));
      const layout = RI(0, 2);
      if (layout === 0) { const s = chance(0.5) ? -1 : 1; spec.blocks.push({ kind: 'wall', x: s * 2, z, w: 6, hp: hp() }); }
      else if (layout === 1) spec.blocks.push({ kind: 'wall', x: 0, z, w: 4, hp: hp() });
      else { spec.blocks.push({ kind: 'wall', x: -3.35, z, w: 3.3, hp: hp() }); spec.blocks.push({ kind: 'wall', x: 3.35, z, w: 3.3, hp: hp() }); }
      z += R(24, 28);
    } else if (t === 'wcrate' || t === 'scrate') {
      const x = pick([-2.6, 0, 2.6]);
      if (t === 'wcrate' && W < WEAPONS.length - 1) {
        spec.blocks.push({ kind: 'weapon', x, z, w: 1.5, hp: Math.max(6, Math.round(dps() * R(1.0, 1.7))), tier: W + 1 });
        W++;
      } else {
        const v = nice(Math.round(E * 0.4) + 5);
        spec.blocks.push({ kind: 'soldier', x, z, w: 1.5, hp: Math.max(5, Math.round(dps() * R(1.2, 2.0))), v });
        E += v * 0.7;
      }
      z += R(22, 26);
    } else if (t === 'saw') {
      const n = L >= 5 && chance(0.5) ? 2 : 1;
      for (let j = 0; j < n; j++) spec.saws.push({ z: z + j * 7, amp: 3.4, speed: R(0.9, 1.4) + Math.min(L, 15) * 0.025, ph: R(0, 6.28) });
      z += 22 + (n - 1) * 7;
    }
    if (chance(0.7)) {
      const cz = z - R(9, 12), cx = R(-3, 3), curve = R(-1.5, 1.5);
      for (let k = 0; k < 7; k++) spec.coins.push({ x: clamp(cx + Math.sin(k * 0.6) * curve, -4, 4), z: cz + k * 1.1 });
    }
  }
  spec.end = z;
  spec.bossLine = z + 6;
  spec.bossZ = spec.bossLine + 24;
  spec.bossHp = Math.max(30, Math.round(dps() * (5 + Math.min(L, 12) * 0.45)));
  spec.enemyHp = 1 + (L - 1) * 0.12;
  spec.speed = 8.6 + Math.min(L, 10) * 0.15;
  return spec;
}

// ============================================================ level building
function gateTexture(op) {
  const c = makeCanvas(512, 256), x = c.getContext('2d'), good = isGood(op);
  const g = x.createLinearGradient(0, 0, 0, 256);
  if (good) { g.addColorStop(0, 'rgba(90,180,255,.85)'); g.addColorStop(1, 'rgba(30,120,255,.6)'); }
  else { g.addColorStop(0, 'rgba(255,110,110,.85)'); g.addColorStop(1, 'rgba(235,40,60,.6)'); }
  x.fillStyle = g; roundRect(x, 8, 8, 496, 240, 34); x.fill();
  x.lineWidth = 12; x.strokeStyle = 'rgba(255,255,255,.95)'; roundRect(x, 8, 8, 496, 240, 34); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.18)'; roundRect(x, 26, 22, 460, 70, 26); x.fill();
  strokeText(x, opText(op), 256, 136, 150, '#ffffff', good ? '#1b5fd1' : '#a8162c', 14);
  return canvasTex(c);
}

function drawGunIcon(x, cx, cy, s, color) {
  x.save(); x.translate(cx, cy); x.scale(s, s); x.fillStyle = color;
  roundRect(x, -46, -12, 92, 22, 6); x.fill();
  x.fillRect(-46, -20, 36, 10);
  x.beginPath(); x.moveTo(-34, 8); x.lineTo(-14, 8); x.lineTo(-20, 40); x.lineTo(-40, 40); x.closePath(); x.fill();
  x.fillRect(30, -16, 10, 6);
  x.restore();
}
function drawSoldierIcon(x, cx, cy, s) {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  x.fillStyle = '#f6c39b'; x.beginPath(); x.arc(0, -22, 16, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#1b5fd1'; x.beginPath(); x.arc(0, -26, 17, Math.PI, 0); x.fill();
  x.fillStyle = '#2f8cff'; roundRect(x, -22, -4, 44, 44, 14); x.fill();
  x.restore();
}

class BlockLabel {
  constructor(block) {
    this.b = block; this.val = -1;
    this.c = makeCanvas(256, block.kind === 'wall' ? 128 : 256); this.ctx = this.c.getContext('2d');
    this.tex = canvasTex(this.c);
  }
  draw() {
    const b = this.b, hp = Math.ceil(Math.max(0, b.hp));
    if (hp === this.val) return;
    this.val = hp;
    const x = this.ctx, W = this.c.width, H = this.c.height;
    x.clearRect(0, 0, W, H);
    if (b.kind === 'wall') {
      strokeText(x, fmt(hp), W / 2, H / 2 + 4, 92, '#ffffff', '#5a1d0c', 16);
    } else {
      x.fillStyle = 'rgba(255,255,255,.92)'; roundRect(x, 14, 14, 228, 228, 30); x.fill();
      if (b.kind === 'weapon') {
        drawGunIcon(x, 128, 86, 1.45, '#' + WEAPONS[b.tier].gun.toString(16).padStart(6, '0'));
        x.font = `900 26px ${FONT}`; x.fillStyle = '#16233b'; x.textAlign = 'center'; x.fillText(WEAPONS[b.tier].name, 128, 152);
      } else {
        drawSoldierIcon(x, 78, 92, 1.25);
        strokeText(x, '+' + b.v, 162, 88, 64, '#2f8cff', '#ffffff', 2);
      }
      x.fillStyle = '#16233b'; roundRect(x, 58, 172, 140, 56, 20); x.fill();
      strokeText(x, fmt(hp), 128, 201, 44, '#ffc83a', '#16233b', 2);
    }
    this.tex.needsUpdate = true;
  }
}

function buildLevel(L) {
  if (LV) disposeLevel();
  const spec = genLevel(L);
  const grp = new THREE.Group();
  scene.add(grp);
  const own = [];
  const keep = (o) => { own.push(o); return o; };
  LV = { L, spec, grp, own, gates: [], blocks: [], enemies: [], saws: [], coins: [], boss: null,
    end: spec.end, bossLine: spec.bossLine, enemyHp: spec.enemyHp, coinMesh: null, lastProg: -1 };

  const len = spec.bossZ + 70;
  // road
  const roadGeo = keep(new THREE.PlaneGeometry(HALF * 2, len));
  roadGeo.rotateX(-Math.PI / 2);
  const uv = roadGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (len / 9));
  const road = new THREE.Mesh(roadGeo, MAT.road);
  road.position.set(0, 0, len / 2 - 30);
  grp.add(road);
  // side curbs
  const curbGeo = keep(new THREE.BoxGeometry(0.4, 0.3, len));
  const cuv = curbGeo.attributes.uv;
  for (let i = 0; i < cuv.count; i++) cuv.setX(i, cuv.getX(i) * (len / 2.4));
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(curbGeo, MAT.curb);
    m.position.set(s * (HALF + 0.2), 0.1, len / 2 - 30);
    grp.add(m);
  }
  // ground
  const gGeo = keep(new THREE.PlaneGeometry(260, len + 120)); gGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(gGeo, MAT.ground); ground.position.set(0, -0.06, len / 2 - 30);
  grp.add(ground);
  // darker grass bands along the road
  const bandGeo = keep(new THREE.PlaneGeometry(3, len)); bandGeo.rotateX(-Math.PI / 2);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(bandGeo, MAT.ground2); m.position.set(s * (HALF + 1.9), -0.04, len / 2 - 30); grp.add(m); }

  // finish line
  const finGeo = keep(new THREE.PlaneGeometry(HALF * 2, 1.4)); finGeo.rotateX(-Math.PI / 2);
  const fin = new THREE.Mesh(finGeo, MAT.checker); fin.position.set(0, 0.01, spec.end + 1); grp.add(fin);

  // decor
  const rnd = mulberry32(L * 31 + 7);
  const decor = { tree1: [], tree2: [], rock: [], bush: [] };
  for (let z = -30; z < len - 20; z += 2.2) {
    for (const s of [-1, 1]) {
      if (rnd() < 0.45) continue;
      const d = HALF + 2.5 + Math.pow(rnd(), 1.6) * 24;
      const r = rnd();
      const type = d < 8.5 ? (r < 0.6 ? 'bush' : 'rock') : r < 0.45 ? 'tree1' : r < 0.85 ? 'tree2' : r < 0.93 ? 'rock' : 'bush';
      decor[type].push([s * d, z + rnd() * 2, 0.75 + rnd() * 0.7, rnd() * 6.28]);
    }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const type in decor) {
    const list = decor[type];
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(G[type], MAT.decor, list.length);
    list.forEach((d, i) => { q.setFromAxisAngle(up, d[3]); sc.setScalar(d[2]); v3.set(d[0], 0, d[1]); m4.compose(v3, q, sc); im.setMatrixAt(i, m4); });
    im.computeBoundingSphere();
    grp.add(im); keep(im);
  }

  // gates
  const panelGeo = keep(new THREE.PlaneGeometry(4.75, 2.3));
  const postGeo = keep(new THREE.CylinderGeometry(0.13, 0.13, 2.9, 10));
  const capGeo = keep(new THREE.SphereGeometry(0.22, 12, 8));
  for (const gs of spec.gates) {
    const g = new THREE.Group(); g.position.z = gs.z; grp.add(g);
    const panels = [];
    gs.ops.forEach((op, i) => {
      const tex = keep(gateTexture(op));
      const mat = keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      const p = new THREE.Mesh(panelGeo, mat);
      p.rotation.y = Math.PI; p.position.set(i === 0 ? -2.5 : 2.5, 1.5, 0);
      g.add(p); panels.push(p);
    });
    for (const px of [-HALF, 0, HALF]) {
      const post = new THREE.Mesh(postGeo, MAT.post); post.position.set(px, 1.45, 0); g.add(post);
      const cap = new THREE.Mesh(capGeo, MAT.post); cap.position.set(px, 2.95, 0); g.add(cap);
    }
    LV.gates.push({ z: gs.z, ops: gs.ops, g, panels, passed: false, t: 0, side: -1 });
  }

  // blocks (walls / crates)
  for (const bs of spec.blocks) {
    const isWall = bs.kind === 'wall';
    const w = bs.w, h = isWall ? 1.5 : 1.5, d = isWall ? 1.0 : 1.5;
    const geo = keep(new THREE.BoxGeometry(w, h, d));
    let mat = MAT.wood;
    if (isWall) {
      const t = keep(TEX.brick.clone()); t.repeat.set(w / 1.5, 1); t.needsUpdate = true;
      mat = keep(new THREE.MeshLambertMaterial({ map: t }));
    }
    const m = new THREE.Mesh(geo, mat);
    m.position.set(bs.x, h / 2, bs.z);
    grp.add(m);
    const b = { ...bs, d, h, hp: bs.hp, max: bs.hp, alive: true, mesh: m, wob: 0 };
    b.label = new BlockLabel(b);
    keep(b.label.tex);
    const lw = isWall ? Math.min(w * 0.9, 2.8) : 1.3, lh = isWall ? lw / 2 : 1.3;
    const lgeo = keep(new THREE.PlaneGeometry(lw, lh));
    const lmat = keep(new THREE.MeshBasicMaterial({ map: b.label.tex, transparent: true, fog: false }));
    const lm = new THREE.Mesh(lgeo, lmat);
    lm.rotation.y = Math.PI; lm.position.set(0, isWall ? 0.05 : 0, -d / 2 - 0.02);
    m.add(lm);
    b.label.draw();
    LV.blocks.push(b);
  }

  // saws
  const slotGeo = keep(new THREE.PlaneGeometry(HALF * 2 - 0.6, 0.42)); slotGeo.rotateX(-Math.PI / 2);
  for (const ss of spec.saws) {
    const slot = new THREE.Mesh(slotGeo, MAT.slot); slot.position.set(0, 0.008, ss.z); grp.add(slot);
    const blade = new THREE.Mesh(G.saw, MAT.decor); blade.position.set(0, 0.5, ss.z); grp.add(blade);
    LV.saws.push({ ...ss, x: 0, blade });
  }

  // enemies
  for (const es of spec.enemies) {
    const g = { x: es.x, z: es.z, count: es.n, sold: [], state: 'idle', alive: true, pool: 0, fightAcc: 0, label: new CountLabel('#ff4650', '#b3202c') };
    syncGroup(g, true);
    LV.enemies.push(g);
  }

  // coins
  LV.coins = spec.coins.map((c) => ({ x: c.x, z: c.z, taken: false }));
  if (LV.coins.length) {
    LV.coinMesh = new THREE.InstancedMesh(G.coin, MAT.coin, LV.coins.length);
    LV.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    LV.coinMesh.frustumCulled = false;
    grp.add(LV.coinMesh); keep(LV.coinMesh);
  }

  // boss
  LV.boss = buildBoss(spec.bossZ, spec.bossHp, L);
  grp.add(LV.boss.group);

  // reset run state
  squad.x = squad.tx = 0; squad.z = 0; squad.speed = spec.speed;
  squad.sold.length = 0;
  S.count = S.startCount = startSoldiers();
  S.deaths = {};
  S.weapon = 0; S.runCoins = 0; S.collected = 0; S.fight = null; S.shotAcc = 0; S.shake = 0;
  setWeaponVisual(0);
  syncSquad(true);
  B.top = 0; B.life.fill(0);
  camera.position.set(0, 7, -8);
  camLook.set(0, 0.8, 4);
}

function disposeLevel() {
  for (const g of LV.enemies) g.label.dispose();
  for (const o of LV.own) if (o.dispose) o.dispose();
  LV.boss.dispose();
  scene.remove(LV.grp);
  LV = null;
}

// ============================================================ boss
function buildBoss(z, hp, L) {
  const s = 1 + Math.min(L, 12) * 0.035;
  const group = new THREE.Group();
  const own = [];
  const mat = (c, e = 0) => { const m = new THREE.MeshLambertMaterial({ color: c, emissive: e }); own.push(m); return m; };
  const geo = (g) => { own.push(g); return g; };
  const red = mat(0xd8343f), dark = mat(0x3b2633), skin = mat(0x9be06a), metal = mat(0xbfc7d3), eye = mat(0xffffff), pupil = mat(0x16233b);
  const flashMats = [red, skin];
  const body = new THREE.Group(); group.add(body);
  const add = (parent, g, m, x, y, zz) => { const mesh = new THREE.Mesh(geo(g), m); mesh.position.set(x, y, zz); parent.add(mesh); return mesh; };

  add(body, new THREE.CapsuleGeometry(1.05, 1.0, 4, 14).scale(1.2, 1, 0.9), red, 0, 3.15, 0);
  add(body, new THREE.CylinderGeometry(1.22, 1.22, 0.38, 16), dark, 0, 2.35, 0);
  add(body, new THREE.BoxGeometry(0.5, 0.42, 0.2), metal, 0, 2.35, 1.12);
  add(body, new THREE.SphereGeometry(0.78, 16, 12), skin, 0, 4.75, 0.05);
  const helm = add(body, new THREE.SphereGeometry(0.84, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), dark, 0, 4.85, 0);
  for (let i = -1; i <= 1; i++) { const sp = add(body, new THREE.ConeGeometry(0.16, 0.55, 8), metal, i * 0.42, 5.75 - Math.abs(i) * 0.15, 0); sp.rotation.z = -i * 0.35; }
  add(body, new THREE.SphereGeometry(0.17, 10, 8), eye, -0.28, 4.82, 0.68);
  add(body, new THREE.SphereGeometry(0.17, 10, 8), eye, 0.28, 4.82, 0.68);
  add(body, new THREE.SphereGeometry(0.08, 8, 6), pupil, -0.28, 4.8, 0.83);
  add(body, new THREE.SphereGeometry(0.08, 8, 6), pupil, 0.28, 4.8, 0.83);
  const browL = add(body, new THREE.BoxGeometry(0.36, 0.09, 0.08), pupil, -0.28, 5.04, 0.74); browL.rotation.z = -0.4;
  const browR = add(body, new THREE.BoxGeometry(0.36, 0.09, 0.08), pupil, 0.28, 5.04, 0.74); browR.rotation.z = 0.4;
  add(body, new THREE.BoxGeometry(0.4, 0.07, 0.06), pupil, 0, 4.48, 0.78);
  helm.scale.set(1, 0.9, 1);

  const limb = (x, y, w, h, m, foot) => {
    const piv = new THREE.Group(); piv.position.set(x, y, 0); body.add(piv);
    add(piv, new THREE.BoxGeometry(w, h, w), m, 0, -h / 2, 0);
    if (foot) add(piv, new THREE.BoxGeometry(w * 1.1, 0.35, w * 1.5), dark, 0, -h + 0.1, 0.15);
    return piv;
  };
  const legL = limb(-0.6, 2.1, 0.8, 2.0, dark, true);
  const legR = limb(0.6, 2.1, 0.8, 2.0, dark, true);
  const armL = limb(-1.5, 4.0, 0.58, 1.8, red, false);
  const armR = limb(1.5, 4.0, 0.58, 1.8, red, false);
  add(armL, new THREE.SphereGeometry(0.42, 12, 8), skin, 0, -1.95, 0);
  add(armR, new THREE.SphereGeometry(0.42, 12, 8), skin, 0, -1.95, 0);
  // hammer
  add(armR, new THREE.CylinderGeometry(0.11, 0.11, 2.0, 8), mat(0x7a4f2a), 0, -2.7, 0);
  const head = add(armR, new THREE.BoxGeometry(1.25, 0.85, 0.85), metal, 0, -3.75, 0);
  head.rotation.y = Math.PI / 2;

  group.scale.setScalar(s);
  group.rotation.y = Math.PI;
  group.position.set(0, 0, z);

  return {
    group, body, legL, legR, armL, armR, flashMats, s,
    x: 0, z, hp, max: hp, state: 'idle', t: 0, atk: 0, flash: 0, hitDone: false,
    dispose() { for (const o of own) o.dispose(); },
  };
}

function setBossFlash(b, v) {
  for (const m of b.flashMats) m.emissive.setRGB(v, v, v);
}

function updateBoss(dt) {
  const b = LV.boss;
  b.t += dt;
  if (b.flash > 0) { b.flash = Math.max(0, b.flash - dt * 8); setBossFlash(b, b.flash * 0.22); }
  if (b.state === 'idle') {
    b.armR.rotation.x = 0.15 + Math.sin(b.t * 2) * 0.05;
    b.body.position.y = Math.sin(b.t * 2) * 0.05;
    return;
  }
  if (b.state === 'dead') {
    b.group.rotation.x = Math.min(1.5, b.group.rotation.x + dt * 2.2);
    b.group.position.y = -Math.max(0, b.t - 0.6) * 2;
    if (b.t > 0.55 && !b.boomed) { b.boomed = true; S.shake = 1; sfx.play('slam'); burst(b.x, 1, b.z + 2, 0xd8343f, 40, 9, 2.2, 16, 9); }
    return;
  }
  const r = formRadius(S.count);
  const reach = r + 2.9 * b.s;
  b.x = lerp(b.x, squad.x, Math.min(1, dt * 0.8));
  b.group.position.x = b.x;
  if (b.state === 'walk') {
    if (b.z - squad.z > reach) {
      b.z -= 2.6 * dt;
      const w = Math.sin(b.t * 5);
      b.legL.rotation.x = w * 0.5; b.legR.rotation.x = -w * 0.5;
      b.armL.rotation.x = -w * 0.35; b.armR.rotation.x = 0.2 + w * 0.2;
      b.body.position.y = Math.abs(w) * 0.12;
    } else { b.state = 'attack'; b.atk = 0; b.hitDone = false; }
  } else if (b.state === 'attack') {
    if (b.z - squad.z > reach + 1.5) { b.state = 'walk'; }
    b.atk += dt;
    const T = 1.55, p = (b.atk % T) / T;
    if (b.atk >= T) { b.atk -= T; b.hitDone = false; }
    let th;
    if (p < 0.45) th = lerp(0.2, 2.7, ease(p / 0.45));
    else if (p < 0.56) th = lerp(2.7, -0.95, (p - 0.45) / 0.11);
    else th = lerp(-0.95, 0.2, ease((p - 0.56) / 0.44));
    b.armR.rotation.x = th;
    b.armL.rotation.x = -th * 0.25;
    b.legL.rotation.x = b.legR.rotation.x = 0;
    b.body.rotation.x = p > 0.45 && p < 0.7 ? 0.12 : 0;
    if (p >= 0.56 && !b.hitDone) {
      b.hitDone = true;
      S.shake = 0.8;
      sfx.play('slam'); vibrate(60);
      const hz = b.z - 3.1 * b.s;
      burst(b.x, 0.2, hz, 0xd9cdb8, 22, 8, 1.6, 20, 2);
      const k = Math.max(2, Math.ceil(S.count * 0.11));
      S.cause = 'boss';
      for (let n = 0; n < k && S.count > 0; n++) killFront();
    }
  }
  b.group.position.z = b.z;
}

function hitBoss(dmg, bx) {
  const b = LV.boss;
  b.hp -= dmg;
  b.flash = 1;
  if (Math.random() < 0.3) burst(bx, 1.5 + Math.random() * 3 * b.s, b.z - 1, 0xffd36b, 2, 3, 0.7, 10, 2);
  if (b.hp <= 0 && b.state !== 'dead') {
    b.hp = 0; b.state = 'dead'; b.t = 0;
    setBossFlash(b, 0);
    sfx.play('break');
    S.state = 'win'; S.endT = 0;
    $('bossBar').classList.add('hidden');
  }
  updateBossBar();
}
function updateBossBar() {
  const b = LV.boss;
  $('bossBar').querySelector('i').style.width = (100 * Math.max(0, b.hp) / b.max).toFixed(1) + '%';
}

// ============================================================ squad management
function syncSquad(instant) {
  const want = Math.min(S.count, MAXV);
  while (squad.sold.length < want) {
    const r = Math.random() * 0.5, a = Math.random() * 6.28;
    squad.sold.push({ x: squad.x + Math.cos(a) * r, z: squad.z + Math.sin(a) * r, k: instant ? 1 : 0, ph: Math.random() * 6.28 });
  }
  while (squad.sold.length > want) {
    const s = squad.sold.pop();
    burst(s.x, 0.6, s.z, 0x2f8cff, 3, 3, 0.8);
  }
  squadLabel.set(S.count);
}
function syncGroup(g, instant) {
  const want = Math.min(g.count, GROUP_MAXV);
  while (g.sold.length < want) {
    const i = g.sold.length;
    g.sold.push({ x: g.x + (OFF[i] ? OFF[i].x : 0), z: g.z - (OFF[i] ? OFF[i].z : 0), k: instant ? 1 : 0, ph: Math.random() * 6.28 });
  }
  while (g.sold.length > want) g.sold.pop();
  g.label.set(g.count);
}

function killSoldier(i) {
  const s = squad.sold[i];
  burst(s.x, 0.6, s.z, 0x2f8cff, 4, 3.5, 0.85);
  squad.sold.splice(i, 1);
  S.count--;
  S.deaths[S.cause] = (S.deaths[S.cause] || 0) + 1;
  sfx.play('lose1');
  if (S.count <= 0) { S.count = 0; squadLabel.set(0); lose(); return; }
  syncSquad(false);
}
function killFront() {
  let best = -1, bz = -1e9;
  for (let i = 0; i < squad.sold.length; i++) if (squad.sold[i].z > bz) { bz = squad.sold[i].z; best = i; }
  if (best >= 0) killSoldier(best);
}
function killEnemy(g, i) {
  const s = g.sold[i];
  if (s) { burst(s.x, 0.6, s.z, 0xff4650, 4, 3.5, 0.85); g.sold.splice(i, 1); }
  g.count--;
  sfx.play('pop');
  if (g.count <= 0) {
    g.count = 0; g.alive = false; g.sold.length = 0; g.label.sprite.visible = false;
    if (S.fight === g) S.fight = null;
    return;
  }
  syncGroup(g, false);
}
function killEnemyFront(g) {
  let best = -1, bz = 1e9;
  for (let i = 0; i < g.sold.length; i++) if (g.sold[i].z < bz) { bz = g.sold[i].z; best = i; }
  killEnemy(g, best);
}

function setWeaponVisual(w) {
  pTroop.gun.geometry = G.guns[w];
  MAT.gun.color.setHex(WEAPONS[w].gun);
  MAT.bullet.color.setHex(WEAPONS[w].bullet);
}

// ============================================================ gameplay update
function changeCount(newCount, good) {
  const diff = newCount - S.count;
  if (diff < 0) S.deaths.gate = (S.deaths.gate || 0) - diff;
  S.count = Math.max(0, newCount);
  if (S.count <= 0) { squadLabel.set(0); for (let i = squad.sold.length - 1; i >= 0; i--) burst(squad.sold[i].x, 0.6, squad.sold[i].z, 0x2f8cff, 2, 3); squad.sold.length = 0; lose(); return; }
  syncSquad(false);
  if (diff > 0) burst(squad.x, 1, squad.z, 0x8fd0ff, Math.min(24, 6 + diff), 4, 0.6, 6, 4);
  sfx.play(good ? 'good' : 'bad');
  vibrate(good ? 15 : 45);
}

function blockDestroyed(b) {
  b.alive = false; b.mesh.visible = false;
  const col = b.kind === 'wall' ? 0xf47a40 : 0xd99a55;
  burst(b.x, 0.8, b.z, col, b.kind === 'wall' ? 26 : 18, 6, 1.6, 18, 6);
  sfx.play('break'); vibrate(25);
  if (b.kind === 'weapon') {
    if (b.tier > S.weapon) { S.weapon = b.tier; setWeaponVisual(S.weapon); }
    toast(WEAPONS[b.tier].name + '!');
    sfx.play('upgrade');
    burst(squad.x, 1.2, squad.z, WEAPONS[b.tier].bullet, 20, 5, 0.6, 5, 5);
  } else if (b.kind === 'soldier') {
    toast('+' + b.v + ' ASKER');
    changeCount(S.count + b.v, true);
  }
}

function updateFormation(dt, running) {
  const n = squad.sold.length, r = formRadius(n);
  const sx = r > 4.3 ? 4.3 / r : 1;
  const k = Math.min(1, dt * 9);
  const lim = HALF - 0.28;
  for (let i = 0; i < n; i++) {
    const s = squad.sold[i];
    s.x += (squad.x + OFF[i].x * sx - s.x) * k;
    s.z += (squad.z + OFF[i].z - s.z) * k;
    if (s.x < -lim) s.x = -lim; else if (s.x > lim) s.x = lim;
    if (s.k < 1) s.k = Math.min(1, s.k + dt * 5);
  }
}

function updateGroups(dt) {
  const rP = formRadius(S.count);
  for (const g of LV.enemies) {
    if (!g.alive) continue;
    const dz = g.z - squad.z;
    if (dz > 60) continue;
    if (g.state === 'idle' && dz < 15 && S.state === 'play') g.state = 'charge';
    const rE = formRadius(g.count);
    if (g.state === 'charge') {
      g.z -= 4.5 * dt;
      g.x += (squad.x - g.x) * Math.min(1, dt * 1.3);
      if (Math.abs(g.z - squad.z) < rP * 0.75 + rE * 0.75 + 0.5 && Math.abs(g.x - squad.x) < rP + rE + 0.3) { g.state = 'fight'; S.fight = g; }
    } else if (g.state === 'fight') {
      g.z = lerp(g.z, squad.z + rP * 0.6, Math.min(1, dt * 3));
      g.x = lerp(g.x, squad.x, Math.min(1, dt * 3));
      g.fightAcc += dt * (12 + Math.min(S.count, g.count) * 1.7);
      while (g.fightAcc >= 1 && g.alive && S.count > 0) {
        g.fightAcc -= 1;
        killEnemyFront(g);
        if (S.state !== 'play' && S.state !== 'boss') break;
        S.cause = 'enemy'; killFront();
        if (S.state !== 'play' && S.state !== 'boss') break;
      }
      if (g.alive) vibrate(8);
    }
    const sx = rE > 4.3 ? 4.3 / rE : 1, k = Math.min(1, dt * 8);
    for (let i = 0; i < g.sold.length; i++) {
      const s = g.sold[i];
      s.x += (g.x + OFF[i].x * sx - s.x) * k;
      s.z += (g.z - OFF[i].z - s.z) * k;
      s.x = clamp(s.x, -HALF + 0.28, HALF - 0.28);
      if (s.k < 1) s.k = Math.min(1, s.k + dt * 5);
    }
  }
}

function updateObstacles(dt) {
  const rP = formRadius(S.count);
  // gates
  for (const g of LV.gates) {
    if (!g.passed && squad.z >= g.z) {
      g.passed = true;
      g.side = squad.x < 0 ? 0 : 1;
      const op = g.ops[g.side];
      toast(opText(op), !isGood(op));
      changeCount(applyOp(op, S.count), isGood(op));
      if (S.state !== 'play') return;
    }
    if (g.passed && g.t < 1) {
      g.t = Math.min(1, g.t + dt * 2.5);
      g.panels.forEach((p, i) => {
        const chosen = i === g.side;
        p.material.opacity = 1 - g.t;
        p.scale.setScalar(chosen ? 1 + g.t * 0.4 : 1 - g.t * 0.5);
      });
    }
  }
  // blocks: soldiers crashing into them
  for (const b of LV.blocks) {
    if (b.wob > 0) { b.wob = Math.max(0, b.wob - dt * 6); const s = 1 + b.wob * 0.06; b.mesh.scale.set(s, s, s); }
    if (!b.alive || Math.abs(b.z - squad.z) > rP + 1.5) continue;
    if (b.kind !== 'wall') {
      // crates are not deadly: running into one just smashes it (no reward)
      if (squad.sold.some((s) => Math.abs(s.z - b.z) < b.d / 2 + 0.15 && Math.abs(s.x - b.x) < b.w / 2 + 0.15)) {
        b.alive = false; b.mesh.visible = false;
        burst(b.x, 0.8, b.z, 0xd99a55, 14, 5, 1.4, 18, 5);
        sfx.play('break'); toast('KAÇTI!', true);
      }
      continue;
    }
    for (let i = squad.sold.length - 1; i >= 0; i--) {
      const s = squad.sold[i];
      if (i >= squad.sold.length) continue;
      if (Math.abs(s.z - b.z) < b.d / 2 + 0.15 && Math.abs(s.x - b.x) < b.w / 2 + 0.15) {
        S.cause = b.kind; killSoldier(i);
        if (S.state !== 'play') return;
        b.hp -= Math.max(3 + S.weapon, b.max / 15);
        b.wob = 1; b.label.draw();
        if (b.hp <= 0) { blockDestroyed(b); break; }
      }
    }
  }
  // saws
  for (const sw of LV.saws) {
    sw.x = Math.sin(S.t * sw.speed + sw.ph) * sw.amp;
    sw.blade.position.x = sw.x;
    sw.blade.rotation.z -= dt * 14;
    if (Math.abs(sw.z - squad.z) > rP + 1.2) continue;
    for (let i = squad.sold.length - 1; i >= 0; i--) {
      const s = squad.sold[i];
      if (i >= squad.sold.length) continue;
      if (Math.abs(s.z - sw.z) < 0.35 && Math.abs(s.x - sw.x) < 0.7) {
        S.cause = 'saw'; killSoldier(i); sfx.play('saw');
        if (S.state !== 'play') return;
      }
    }
  }
  // coins
  const sxr = (rP > 4.3 ? 4.3 : rP) + 0.35;
  for (const c of LV.coins) {
    if (c.taken || Math.abs(c.z - squad.z) > rP + 0.4) continue;
    const dx = (c.x - squad.x) / sxr, dz = (c.z - squad.z) / (rP + 0.4);
    if (dx * dx + dz * dz < 1) {
      c.taken = true; S.runCoins++; S.collected++;
      burst(c.x, 0.8, c.z, 0xffc83a, 4, 2.5, 0.5, 10, 4);
      sfx.play('coin');
      updateCoinsHud();
    }
  }
}

function nearTargets() {
  const list = [];
  const z0 = squad.z - 2, z1 = squad.z + 30;
  for (const b of LV.blocks) if (b.alive && b.z > z0 && b.z < z1) list.push(b);
  for (const g of LV.enemies) if (g.alive && g.z > z0 && g.z < z1 + 2) list.push(g);
  if (S.state === 'boss' && LV.boss.state !== 'dead' && LV.boss.state !== 'idle') list.push(LV.boss);
  return list;
}

function updateShooting(dt) {
  const w = WEAPONS[S.weapon];
  const targets = nearTargets();
  if (S.state === 'play' || S.state === 'boss') {
    const shots = S.count * w.rate * rateMul();
    const dps = shots * w.dmg * dmgMul();
    const vis = Math.min(shots, save.eco ? 22 : 34);
    S.shotAcc += vis * dt;
    const dmg = dps / Math.max(vis, 0.001);
    while (S.shotAcc >= 1) {
      S.shotAcc -= 1;
      const s = squad.sold[(Math.random() * squad.sold.length) | 0];
      if (!s) break;
      spawnBullet(s.x + 0.05, 0.75, s.z + 0.5 + w.len, dmg);
    }
    if (targets.length) sfx.play('shot');
  }
  // move bullets + collisions
  const a = B.mesh.instanceMatrix.array, bs = w.bs;
  let drawn = 0;
  const boss = LV.boss;
  for (let i = 0; i < B.top; i++) {
    if (B.life[i] <= 0) continue;
    B.life[i] -= dt;
    const z0 = B.z[i];
    B.z[i] += BULLET_SPEED * dt;
    const z1 = B.z[i], bx = B.x[i];
    let hit = false;
    for (let t = 0; t < targets.length && !hit; t++) {
      const T = targets[t];
      if (T === boss) {
        if (Math.abs(bx - boss.x) < 1.8 * boss.s && z1 >= boss.z - 1.0) { hitBoss(B.dmg[i], bx); hit = true; }
      } else if (T.sold) {
        if (!T.alive) continue;
        const rr = formRadius(T.count) + 0.5;
        if (Math.abs(bx - T.x) > rr + 0.5 || z1 < T.z - rr - 1 || z0 > T.z + rr + 1) continue;
        for (let j = 0; j < T.sold.length; j++) {
          const e = T.sold[j];
          if (Math.abs(e.x - bx) < 0.38 && e.z > z0 - 0.4 && e.z < z1 + 0.4) {
            T.pool += B.dmg[i];
            let kills = Math.floor(T.pool / LV.enemyHp);
            T.pool -= kills * LV.enemyHp;
            if (kills > 0) { killEnemy(T, j); kills--; }
            while (kills-- > 0 && T.alive) killEnemyFront(T);
            sfx.play('hit');
            hit = true; break;
          }
        }
      } else {
        if (!T.alive) continue;
        if (Math.abs(bx - T.x) < T.w / 2 + 0.05 && z1 >= T.z - T.d / 2 && z0 <= T.z + T.d / 2) {
          T.hp -= B.dmg[i]; T.wob = 1; T.label.draw();
          if (Math.random() < 0.35) burst(bx, 0.6 + Math.random(), T.z - T.d / 2, T.kind === 'wall' ? 0xffb07a : 0xf1c48a, 1, 2.5, 0.6, 10, 2);
          sfx.play('hit');
          if (T.hp <= 0) blockDestroyed(T);
          hit = true;
        }
      }
    }
    if (hit) { B.life[i] = 0; continue; }
    const o = drawn++ * 16;
    a[o] = bs; a[o + 1] = 0; a[o + 2] = 0; a[o + 3] = 0;
    a[o + 4] = 0; a[o + 5] = bs; a[o + 6] = 0; a[o + 7] = 0;
    a[o + 8] = 0; a[o + 9] = 0; a[o + 10] = bs; a[o + 11] = 0;
    a[o + 12] = bx; a[o + 13] = B.y[i]; a[o + 14] = z1; a[o + 15] = 1;
  }
  B.mesh.count = drawn;
  if (drawn) B.mesh.instanceMatrix.needsUpdate = true;
}

function enterBoss() {
  S.state = 'boss';
  const b = LV.boss, w = WEAPONS[S.weapon];
  const dps = S.count * w.rate * w.dmg * rateMul() * dmgMul();
  b.hp = b.max = Math.max(30, Math.round(dps * (6 + Math.min(LV.L, 16) * 0.2)));
  b.state = 'walk';
  $('bossBar').classList.remove('hidden');
  updateBossBar();
  toast('DEV GELİYOR!', true);
  sfx.play('bad');
}

function updatePlay(dt) {
  const rP = formRadius(S.count);
  const lim = Math.max(0, HALF - 0.45 - Math.min(rP, 4.3) * 0.85);
  squad.tx = clamp(squad.tx, -lim, lim);
  squad.x += (squad.tx - squad.x) * Math.min(1, dt * 12);
  if (S.state === 'play') {
    squad.z += squad.speed * (S.fight ? 0.25 : 1) * dt;
    if (squad.z >= LV.bossLine) { squad.z = LV.bossLine; enterBoss(); }
  }
  updateFormation(dt, true);
  updateObstacles(dt);
  if (S.state !== 'play' && S.state !== 'boss') return;
  updateGroups(dt);
  if (S.state !== 'play' && S.state !== 'boss') return;
  const prog = Math.min(1, squad.z / LV.bossLine);
  if (Math.abs(prog - LV.lastProg) > 0.004) { LV.lastProg = prog; $('progress').firstElementChild.style.width = (prog * 100).toFixed(1) + '%'; }
}

// ============================================================ end states
function lose() {
  if (S.state === 'lose') return;
  S.state = 'lose'; S.endT = 0; S.fight = null;
  sfx.play('over'); vibrate(120);
  save.coins += S.runCoins; persist();
  $('lCoins').textContent = S.runCoins;
  updateCoinsHud();
  $('loseSub').textContent = LV.boss.state !== 'idle' ? 'Dev çok güçlüydü!' : 'Ordun dağıldı!';
  $('bossBar').classList.add('hidden');
}
function finishWin() {
  const L = LV.L;
  const reward = 20 + L * 6 + Math.floor(S.count * 0.6) + S.runCoins;
  save.coins += reward; save.level = L + 1; persist();
  $('wSold').textContent = fmt(S.count);
  $('wColl').textContent = S.collected;
  $('wCoins').textContent = reward;
  $('winSub').textContent = 'Seviye ' + L + ' tamamlandı';
  $('winPanel').classList.remove('hidden');
  updateCoinsHud();
  sfx.play('win');
}

// ============================================================ render
function drawTroops() {
  const t = S.t;
  const running = S.state === 'play';
  const cheering = S.state === 'win' && LV.boss.state === 'dead' && LV.boss.t > 0.8;
  pTroop.begin();
  for (const s of squad.sold) {
    let y = 0, sw = 0;
    if (running) { const p = Math.sin(t * 14 + s.ph); y = Math.abs(p) * 0.07; sw = p * 0.7; }
    else if (cheering) { y = Math.abs(Math.sin(t * 7 + s.ph)) * 0.55; sw = 0.3; }
    else y = Math.sin(t * 3 + s.ph) * 0.015 + 0.015;
    pTroop.push(s.x, y, s.z, 0, sw, s.k);
  }
  pTroop.end();
  eTroop.begin();
  for (const g of LV.enemies) {
    if (!g.alive) continue;
    const dz = g.z - squad.z;
    if (dz > 75 || dz < -14) { g.label.sprite.visible = false; continue; }
    const run = g.state !== 'idle';
    for (const s of g.sold) {
      const p = Math.sin(t * (run ? 14 : 3) + s.ph);
      eTroop.push(s.x, run ? Math.abs(p) * 0.07 : 0.015 + p * 0.015, s.z, Math.PI, run ? p * 0.7 : 0, s.k);
    }
    g.label.sprite.visible = true;
    g.label.sprite.position.set(g.x, 2.0, g.z);
  }
  eTroop.end();
  const r = formRadius(S.count);
  squadLabel.sprite.visible = S.count > 0;
  squadLabel.sprite.position.set(squad.x, 1.9 + Math.min(r, 4) * 0.15, squad.z + 0.2);

  // coins
  if (LV.coinMesh) {
    const a = LV.coinMesh.instanceMatrix.array;
    let n = 0;
    const c = Math.cos(t * 4), s = Math.sin(t * 4);
    for (const cn of LV.coins) {
      if (cn.taken) continue;
      const dz = cn.z - squad.z;
      if (dz < -12 || dz > 80) continue;
      wRy(a, n++ * 16, c, s, cn.x, 0.55 + Math.sin(t * 3 + cn.z) * 0.08, cn.z, 1);
    }
    LV.coinMesh.count = n;
    LV.coinMesh.instanceMatrix.needsUpdate = true;
  }
}

function updateCamera(dt) {
  const r = Math.min(formRadius(S.count), 4.5);
  let px, py, pz, lx, ly, lz;
  if (S.state === 'menu') {
    const sway = Math.sin(S.t * 0.4) * 1.2;
    px = sway; py = 5.2; pz = squad.z - 7.2; lx = 0; ly = 1.2; lz = squad.z + 4;
  } else {
    const bossy = S.state === 'boss' || (S.state === 'win' && LV.boss.state === 'dead');
    px = squad.x * 0.45; py = 8.6 + r * 0.8; pz = squad.z - 8.6 - r * 0.7;
    lx = squad.x * 0.3; ly = 0; lz = squad.z + 9;
    if (bossy) { py += 2.5; pz -= 3; lz = squad.z + 13; ly = 1.5; }
  }
  const k = Math.min(1, dt * 4);
  camera.position.x += (px - camera.position.x) * k;
  camera.position.y += (py - camera.position.y) * k;
  camera.position.z += (pz - camera.position.z) * Math.min(1, dt * 8);
  camLook.x += (lx - camLook.x) * k; camLook.y += (ly - camLook.y) * k; camLook.z += (lz - camLook.z) * Math.min(1, dt * 8);
  camera.lookAt(camLook);
  if (S.shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * S.shake * 0.6;
    camera.position.y += (Math.random() - 0.5) * S.shake * 0.6;
    S.shake *= Math.exp(-dt * 7);
  }
  sky.position.copy(camera.position);
}

// ============================================================ main loop
function update(dt) {
  S.t += dt;
  if (S.state === 'play' || S.state === 'boss') {
    updatePlay(dt);
    if (S.state === 'boss' || S.state === 'play') updateBoss(dt);
    if (S.state === 'play' || S.state === 'boss') updateShooting(dt);
  } else {
    if (S.state === 'win') {
      updateBoss(dt);
      updateFormation(dt, false);
      S.endT += dt;
      if (LV.boss.t > 0.9 && !S.confetti) { S.confetti = true; confetti(squad.x, squad.z + 4, 120); }
      if (S.endT > 2.4 && !S.endShown) { S.endShown = true; finishWin(); }
    } else if (S.state === 'lose') {
      S.endT += dt;
      if (S.endT > 1.1 && !S.endShown) { S.endShown = true; $('losePanel').classList.remove('hidden'); }
    } else if (S.state === 'menu') {
      updateBoss(dt);
      updateFormation(dt, false);
    }
    updateShooting(dt);
  }
  for (const sw of LV.saws) if (S.state === 'menu') { sw.x = Math.sin(S.t * sw.speed + sw.ph) * sw.amp; sw.blade.position.x = sw.x; sw.blade.rotation.z -= dt * 14; }
  updateParticles(dt);
  drawTroops();
  updateCamera(dt);
}

let lastT = 0, rafId = 0, running = false;
function frame(now) {
  rafId = requestAnimationFrame(frame);
  const busy = S.state === 'play' || S.state === 'boss' || (S.state === 'win' && !S.endShown);
  const fps = save.eco || !busy ? 30 : 60;
  if (now - lastT < 1000 / fps - 2.5) return;
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  if (!S.paused) update(dt);
  renderer.render(scene, camera);
}
function startLoop() { if (running) return; running = true; lastT = performance.now(); rafId = requestAnimationFrame(frame); }
function stopLoop() { running = false; cancelAnimationFrame(rafId); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopLoop(); sfx.suspend(); }
  else { startLoop(); if (save.sound) sfx.unlock(); }
});

// ============================================================ UI
let toastTimer = 0;
function toast(text, bad) {
  const el = $('toast');
  el.textContent = text;
  el.classList.toggle('bad', !!bad);
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 850);
}
function vibrate(ms) { if (save.vibe && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } }
function updateCoinsHud() { $('coins').textContent = fmt(save.coins + (S.state === 'play' || S.state === 'boss' ? S.runCoins : 0)); }

function refreshMenu() {
  $('lvlPill').textContent = 'SEVİYE ' + save.level;
  updateCoinsHud();
  document.querySelectorAll('.up').forEach((el) => {
    const k = el.dataset.up, lvl = save[k], maxed = lvl >= UPG[k].max, cost = upCost(k);
    el.querySelector('[data-v]').textContent = k === 'upStart' ? startSoldiers() : lvl + 1;
    el.querySelector('[data-c]').textContent = maxed ? 'MAKS' : fmt(cost);
    el.classList.toggle('poor', !maxed && save.coins < cost);
    el.classList.toggle('max', maxed);
  });
}

function showMenu() {
  S.state = 'menu'; S.paused = false; S.endShown = false; S.confetti = false;
  ['winPanel', 'losePanel', 'settings', 'bossBar'].forEach((id) => $(id).classList.add('hidden'));
  $('menu').classList.remove('hidden');
  $('progress').classList.add('hidden');
  buildLevel(save.level);
  refreshMenu();
}

function startRun() {
  if (S.state !== 'menu') return;
  sfx.unlock();
  S.state = 'play'; S.t = 0; S.endShown = false; S.confetti = false;
  $('menu').classList.add('hidden');
  $('progress').classList.remove('hidden');
  $('progress').firstElementChild.style.width = '0%';
  LV.lastProg = 0;
  updateCoinsHud();
  toast('SEVİYE ' + LV.L);
}

document.querySelectorAll('.up').forEach((el) => el.addEventListener('click', (e) => {
  e.stopPropagation();
  sfx.unlock();
  const k = el.dataset.up;
  if (save[k] >= UPG[k].max) return;
  const cost = upCost(k);
  if (save.coins < cost) { sfx.play('bad'); el.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 220 }); return; }
  save.coins -= cost; save[k]++; persist();
  sfx.play('upgrade'); vibrate(20);
  if (k === 'upStart') { S.count = startSoldiers(); syncSquad(false); burst(0, 1, 0, 0x8fd0ff, 14, 4, 0.6, 6, 4); }
  refreshMenu();
}));

function syncToggles() {
  document.querySelectorAll('.tog').forEach((t) => t.classList.toggle('on', !!save[t.dataset.set]));
}
document.querySelectorAll('.tog').forEach((t) => t.addEventListener('click', () => {
  const k = t.dataset.set;
  save[k] = !save[k]; persist();
  if (k === 'sound') { sfx.enabled = save.sound; if (save.sound) sfx.unlock(); }
  if (k === 'eco') onResize();
  sfx.play('click');
  syncToggles();
}));
$('btnGear').addEventListener('click', (e) => {
  e.stopPropagation();
  sfx.unlock();
  syncToggles();
  $('btnHome').classList.toggle('hidden', S.state === 'menu');
  $('settings').classList.remove('hidden');
  S.paused = true;
});
$('btnCloseSet').addEventListener('click', () => { $('settings').classList.add('hidden'); S.paused = false; lastT = performance.now(); });
$('btnHome').addEventListener('click', () => {
  if (S.state === 'play' || S.state === 'boss') { save.coins += S.runCoins; persist(); }
  showMenu();
});
$('btnNext').addEventListener('click', () => { sfx.play('click'); showMenu(); });
$('btnRetry').addEventListener('click', () => { sfx.play('click'); showMenu(); });

// steering: relative horizontal drag anywhere on screen
let dragging = false, lastX = 0;
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button') || e.target.closest('.overlay')) return;
  dragging = true; lastX = e.clientX;
  if (S.state === 'menu') startRun();
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  if (S.state === 'play' || S.state === 'boss') squad.tx += (dx / Math.min(window.innerWidth, 600)) * 13;
});
const endDrag = () => { dragging = false; };
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
window.addEventListener('contextmenu', (e) => e.preventDefault());

// debug / testing hook
window.__G = { S, squad, get LV() { return LV; }, startRun, showMenu, save, step: update };

showMenu();
startLoop();

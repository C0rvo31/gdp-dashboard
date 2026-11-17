import * as THREE from 'three';
import { Sfx } from './audio.js';
import { clamp, lerp, ease, mulberry32, makeCanvas, roundRect, canvasTex, setMaxAniso, FONT, fmt, strokeText } from './util.js';
import { addRim, buildSoldier, buildLeg, SOLDIER_LEGS, buildGun, buildEnemy, buildEnemyLeg } from './models.js';
import { THEMES, themeFor, themeIndex, themeTextures, buildDecor } from './world.js';
import { ETYPES, nice, niceHp, applyOp, opText, isGood, makeOp, genLevel } from './levels.js';
import { buildBoss } from './boss.js';

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
  { name: 'TABANCA', rate: 2.0, dmg: 1.0, len: 0.26, bullet: 0xffe14d, bs: 1.0, icon: '#3b3f4a' },
  { name: 'TÜFEK', rate: 3.0, dmg: 1.25, len: 0.46, bullet: 0xffb020, bs: 1.1, icon: '#7a4f2a' },
  { name: 'MAKİNELİ', rate: 4.6, dmg: 1.4, len: 0.56, bullet: 0xff8a1a, bs: 1.1, icon: '#23262e' },
  { name: 'PLAZMA', rate: 5.4, dmg: 1.95, len: 0.6, bullet: 0x6ff7ff, bs: 1.4, icon: '#1d9bf0' },
  { name: 'ROKETATAR', rate: 3.2, dmg: 4.6, len: 0.74, bullet: 0xff5a3a, bs: 2.0, icon: '#41663a' },
];
const curDps = () => { const w = WEAPONS[S.weapon]; return S.count * w.rate * w.dmg * rateMul() * dmgMul(); };


// ============================================================ constants & formation
const HALF = 5;            // road half width
const MAX_COLS = 6;        // max soldiers side by side, the rest line up behind
const SP = 0.46;           // spacing in the formation
const MAXV = 150;          // visible player soldiers (label shows the real number)
const GROUP_MAXV = 96;     // visible soldiers per enemy group
const BULLET_SPEED = 46;
const EB_SPEED = 17;
const ARM_DIST = 85;       // objects get their numbers when they come this close

function dims(n) {
  n = Math.max(1, Math.min(n, MAXV));
  const cols = Math.min(MAX_COLS, n), rows = Math.ceil(n / cols);
  return { cols, rows, hw: ((cols - 1) / 2) * SP + 0.3, depth: (rows - 1) * SP };
}
function slot(i, n) {
  const cols = Math.min(MAX_COLS, Math.max(1, n));
  const row = (i / cols) | 0, col = i - row * cols, inRow = Math.min(cols, n - row * cols);
  return { x: (col - (inRow - 1) / 2) * SP, z: -row * SP };
}

// ============================================================ renderer / scene
const sfx = new Sfx();
sfx.enabled = save.sound;

const container = $('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: false, powerPreference: 'default' });
container.appendChild(renderer.domElement);
setMaxAniso(renderer.capabilities.getMaxAnisotropy());
function applyQuality() {
  renderer.setPixelRatio(save.eco ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcdeeff, 48, 125);
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

const hemi = new THREE.HemisphereLight(0xffffff, 0x86a070, 2.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.3);
sun.position.set(-0.55, 1, -0.45);
scene.add(sun);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(150, 24, 12),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3b97ff) }, bot: { value: new THREE.Color(0xcdeeff) } },
    vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float vY; void main(){ gl_FragColor = vec4(mix(bot, top, smoothstep(-0.02, 0.55, vY)), 1.0);\n#include <colorspace_fragment>\n}',
  })
);
sky.renderOrder = -10;
scene.add(sky);

// ---------- shared textures
const TEX = {};
(function buildTextures() {
  let c = makeCanvas(64, 64), x = c.getContext('2d');
  let g = x.createRadialGradient(32, 32, 4, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  TEX.shadow = new THREE.CanvasTexture(c);
  TEX.dot = TEX.shadow;

  c = makeCanvas(128, 128); x = c.getContext('2d');
  x.fillStyle = '#d99a55'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#c4823f'; for (let i = 0; i < 4; i++) x.fillRect(0, i * 32 + 30, 128, 3);
  x.strokeStyle = '#8a5424'; x.lineWidth = 14; x.strokeRect(7, 7, 114, 114);
  x.lineWidth = 10; x.beginPath(); x.moveTo(12, 12); x.lineTo(116, 116); x.stroke();
  TEX.wood = canvasTex(c);

  c = makeCanvas(128, 32); x = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#1b2236' : '#ffffff'; x.fillRect(i * 16, j * 16, 16, 16); }
  TEX.checker = canvasTex(c); TEX.checker.magFilter = THREE.NearestFilter;
})();

// ============================================================ materials & geometry
const T0 = themeTextures(THEMES[0]);
const MAT = {
  char: addRim(new THREE.MeshLambertMaterial({ vertexColors: true })),
  gun: addRim(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.3),
  shadow: new THREE.MeshBasicMaterial({ map: TEX.shadow, color: 0x0b1a33, transparent: true, opacity: 0.42, depthWrite: false }),
  road: new THREE.MeshLambertMaterial({ map: T0.road }),
  curb: new THREE.MeshLambertMaterial({ map: T0.curb }),
  ground: new THREE.MeshLambertMaterial({ map: T0.ground }),
  ground2: new THREE.MeshLambertMaterial({ color: 0x6fc24f }),
  post: addRim(new THREE.MeshLambertMaterial({ color: 0xffffff }), 0.25),
  postBase: new THREE.MeshLambertMaterial({ color: 0x3c4458 }),
  wood: addRim(new THREE.MeshLambertMaterial({ map: TEX.wood }), 0.25),
  stone: addRim(new THREE.MeshLambertMaterial({ color: 0xe2dccf }), 0.25),
  slot: new THREE.MeshBasicMaterial({ color: 0x3c4458 }),
  coin: addRim(new THREE.MeshLambertMaterial({ color: 0xffc83a, emissive: 0x6a4300 }), 0.5),
  bullet: new THREE.MeshBasicMaterial({ color: WEAPONS[0].bullet }),
  ebullet: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  particle: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  checker: new THREE.MeshLambertMaterial({ map: TEX.checker }),
  decor: addRim(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.3),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  cloud: new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8fa6bf, flatShading: true, fog: false }),
};

const DECOR = buildDecor();
const G = {
  shadow: new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2).translate(0, 0.012, 0),
  bullet: new THREE.BoxGeometry(0.08, 0.08, 0.55),
  ebullet: new THREE.SphereGeometry(0.1, 8, 6).scale(1, 1, 2.2),
  particle: new THREE.BoxGeometry(0.16, 0.16, 0.16),
  coin: new THREE.CylinderGeometry(0.32, 0.32, 0.08, 18).rotateX(Math.PI / 2),
};
const PLAYER_GEO = [0, 1, 2, 3, 4].map((t) => ({
  body: buildSoldier(t), leg: buildLeg(...SOLDIER_LEGS[t]), gun: buildGun(t),
}));

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
  constructor(max, bodyGeo, legGeo, gunGeo) {
    this.max = max; this.n = 0;
    const mk = (geo, mat) => {
      const m = new THREE.InstancedMesh(geo, mat, max);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0; m.frustumCulled = false; scene.add(m);
      return m;
    };
    this.shadow = mk(G.shadow, MAT.shadow);
    this.body = mk(bodyGeo, MAT.char);
    this.legL = mk(legGeo, MAT.char);
    this.legR = mk(legGeo, MAT.char);
    this.gun = gunGeo ? mk(gunGeo, MAT.gun) : null;
    this.meshes = [this.shadow, this.body, this.legL, this.legR];
    if (this.gun) this.meshes.push(this.gun);
  }
  setGeo(body, leg, gun) {
    this.body.geometry = body; this.legL.geometry = leg; this.legR.geometry = leg;
    if (this.gun && gun) this.gun.geometry = gun;
  }
  begin() { this.n = 0; }
  push(x, y, z, ry, swing, k) {
    if (this.n >= this.max || k <= 0.01) return;
    const o = this.n++ * 16, c = Math.cos(ry), s = Math.sin(ry);
    wRy(this.body.instanceMatrix.array, o, c, s, x, y, z, k);
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

const pTroop = new Troop(MAXV, PLAYER_GEO[0].body, PLAYER_GEO[0].leg, PLAYER_GEO[0].gun);
const ETROOPS = {};
function eTroop(type) {
  if (!ETROOPS[type]) ETROOPS[type] = new Troop(300, buildEnemy(type), buildEnemyLeg(type), null);
  return ETROOPS[type];
}

// ============================================================ particles
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

// ============================================================ bullets (ours and theirs)
function bulletPool(n, geo, mat) {
  const p = {
    n, x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), vx: new Float32Array(n), vz: new Float32Array(n),
    dmg: new Float32Array(n), life: new Float32Array(n), next: 0, top: 0, mesh: new THREE.InstancedMesh(geo, mat, n),
  };
  p.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  p.mesh.frustumCulled = false; p.mesh.count = 0;
  scene.add(p.mesh);
  return p;
}
const B = bulletPool(320, G.bullet, MAT.bullet);
const EB = bulletPool(160, G.ebullet, MAT.ebullet);
function spawnIn(p, x, y, z, vx, vz, dmg, life) {
  const i = p.next; p.next = (p.next + 1) % p.n;
  p.x[i] = x; p.y[i] = y; p.z[i] = z; p.vx[i] = vx; p.vz[i] = vz; p.dmg[i] = dmg; p.life[i] = life;
  if (i + 1 > p.top) p.top = i + 1;
  return i;
}
function clearBullets() { B.top = 0; B.life.fill(0); EB.top = 0; EB.life.fill(0); B.mesh.count = 0; EB.mesh.count = 0; }

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
  draw(force) {
    const b = this.b, hp = Math.ceil(Math.max(0, b.hp));
    if (hp === this.val && !force) return;
    this.val = hp;
    const x = this.ctx, W = this.c.width, H = this.c.height;
    x.clearRect(0, 0, W, H);
    if (b.kind === 'wall') {
      strokeText(x, fmt(hp), W / 2, H / 2 + 4, 92, '#ffffff', '#3a1408', 16);
    } else {
      x.fillStyle = 'rgba(255,255,255,.92)'; roundRect(x, 14, 14, 228, 228, 30); x.fill();
      if (b.kind === 'weapon') {
        const w = WEAPONS[b.tier || 1];
        drawGunIcon(x, 128, 86, 1.45, w.icon);
        x.font = `900 26px ${FONT}`; x.fillStyle = '#16233b'; x.textAlign = 'center'; x.fillText(w.name, 128, 152);
      } else {
        drawSoldierIcon(x, 78, 92, 1.25);
        strokeText(x, '+' + (b.v || 0), 162, 88, 64, '#2f8cff', '#ffffff', 2);
      }
      x.fillStyle = '#16233b'; roundRect(x, 58, 172, 140, 56, 20); x.fill();
      strokeText(x, fmt(hp), 128, 201, 44, '#ffc83a', '#16233b', 2);
    }
    this.tex.needsUpdate = true;
  }
}

// ============================================================ weather (snow / embers)
const WN = 260;
const wPos = new Float32Array(WN * 3);
const wGeo = new THREE.BufferGeometry();
wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
const wMat = new THREE.PointsMaterial({ size: 0.24, map: TEX.dot, transparent: true, depthWrite: false, color: 0xffffff });
const weather = new THREE.Points(wGeo, wMat);
weather.frustumCulled = false; weather.visible = false;
scene.add(weather);
let weatherKind = null;
function resetWeather() {
  for (let i = 0; i < WN; i++) {
    wPos[i * 3] = camera.position.x + (Math.random() - 0.5) * 44;
    wPos[i * 3 + 1] = Math.random() * 18;
    wPos[i * 3 + 2] = camera.position.z - 4 + Math.random() * 64;
  }
}
function updateWeather(dt) {
  if (!weather.visible) return;
  const cx = camera.position.x, cz = camera.position.z, snow = weatherKind === 'snow';
  for (let i = 0; i < WN; i++) {
    const o = i * 3;
    if (snow) { wPos[o + 1] -= (1.4 + (i % 5) * 0.25) * dt; wPos[o] += Math.sin(S.t * 1.3 + i) * 0.5 * dt; if (wPos[o + 1] < 0) wPos[o + 1] += 18; }
    else { wPos[o + 1] += (1.0 + (i % 4) * 0.4) * dt; wPos[o] += Math.sin(S.t * 2 + i) * 0.3 * dt; if (wPos[o + 1] > 14) wPos[o + 1] -= 14; }
    if (wPos[o + 2] < cz - 4) wPos[o + 2] += 64; else if (wPos[o + 2] > cz + 60) wPos[o + 2] -= 64;
    if (wPos[o] < cx - 22) wPos[o] += 44; else if (wPos[o] > cx + 22) wPos[o] -= 44;
  }
  wGeo.attributes.position.needsUpdate = true;
}

// ============================================================ theme
let curTheme = null;
function applyTheme(th) {
  if (curTheme === th) return;
  curTheme = th;
  const T = themeTextures(th);
  MAT.road.map = T.road; MAT.curb.map = T.curb; MAT.ground.map = T.ground;
  MAT.road.needsUpdate = MAT.curb.needsUpdate = MAT.ground.needsUpdate = true;
  MAT.ground2.color.setHex(th.band);
  MAT.stone.color.setHex(th.cap);
  MAT.stone.emissive.setHex(th.key === 'lava' ? 0x6a2000 : 0x000000);
  MAT.cloud.color.setHex(th.cloud[0]); MAT.cloud.emissive.setHex(th.cloud[1]);
  sky.material.uniforms.top.value.setHex(th.skyTop);
  sky.material.uniforms.bot.value.setHex(th.skyBot);
  scene.fog.color.setHex(th.fog); scene.fog.near = th.fogNear; scene.fog.far = th.fogFar;
  hemi.color.setHex(th.hemi[0]); hemi.groundColor.setHex(th.hemi[1]); hemi.intensity = th.hemi[2];
  sun.color.setHex(th.sun[0]); sun.intensity = th.sun[1];
  weatherKind = th.weather;
  weather.visible = !!th.weather;
  if (th.weather === 'snow') { wMat.color.setHex(0xffffff); wMat.size = 0.24; wMat.blending = THREE.NormalBlending; }
  else if (th.weather === 'embers') { wMat.color.setHex(0xff9a3c); wMat.size = 0.18; wMat.blending = THREE.AdditiveBlending; }
  wMat.needsUpdate = true;
  resetWeather();
  document.body.style.background = '#' + th.skyBot.toString(16).padStart(6, '0');
}

// ============================================================ game state
const S = {
  state: 'menu', t: 0, count: 1, weapon: 0, runCoins: 0, shotAcc: 0, rr: 0, fight: null, shake: 0,
  endT: 0, paused: false, collected: 0, cause: '', deaths: {}, freeCam: false,
};
const squad = { x: 0, tx: 0, z: 0, speed: 9, sold: [] };
let LV = null;
const camLook = new THREE.Vector3(0, 0, 8);

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

function buildLevel(L) {
  if (LV) disposeLevel();
  const spec = genLevel(L);
  const th = spec.th;
  applyTheme(th);
  MAT.ebullet.color.setHex(ETYPES[th.shooter].bullet);
  const T = themeTextures(th);
  const grp = new THREE.Group();
  scene.add(grp);
  const own = [];
  const keep = (o) => { own.push(o); return o; };
  LV = { L, th, spec, grp, own, gates: [], blocks: [], enemies: [], saws: [], coins: [], boss: null,
    end: spec.end, bossLine: spec.bossLine, hpMul: spec.hpMul, coinMesh: null, lastProg: -1 };

  const len = spec.bossZ + 70;
  const roadGeo = keep(new THREE.PlaneGeometry(HALF * 2, len)); roadGeo.rotateX(-Math.PI / 2);
  { const uv = roadGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (len / 9)); }
  const road = new THREE.Mesh(roadGeo, MAT.road); road.position.set(0, 0, len / 2 - 30); grp.add(road);
  const curbGeo = keep(new THREE.BoxGeometry(0.4, 0.3, len));
  { const uv = curbGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (len / 2.4)); }
  for (const s of [-1, 1]) { const m = new THREE.Mesh(curbGeo, MAT.curb); m.position.set(s * (HALF + 0.2), 0.1, len / 2 - 30); grp.add(m); }
  const gGeo = keep(new THREE.PlaneGeometry(260, len + 120)); gGeo.rotateX(-Math.PI / 2);
  { const uv = gGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 26, uv.getY(i) * (len + 120) / 8); }
  const ground = new THREE.Mesh(gGeo, MAT.ground); ground.position.set(0, -0.06, len / 2 - 30); grp.add(ground);
  const bandGeo = keep(new THREE.PlaneGeometry(3, len)); bandGeo.rotateX(-Math.PI / 2);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(bandGeo, MAT.ground2); m.position.set(s * (HALF + 1.9), -0.04, len / 2 - 30); grp.add(m); }
  const finGeo = keep(new THREE.PlaneGeometry(HALF * 2, 1.4)); finGeo.rotateX(-Math.PI / 2);
  const fin = new THREE.Mesh(finGeo, MAT.checker); fin.position.set(0, 0.01, spec.end + 1); grp.add(fin);

  // decor
  const rnd = mulberry32(L * 31 + 7);
  const wpick = (list) => { let r = rnd(), acc = 0; for (const [k, w] of list) { acc += w; if (r <= acc) return k; } return list[list.length - 1][0]; };
  const decor = {};
  const put = (type, d) => (decor[type] || (decor[type] = [])).push(d);
  for (let z = -30; z < len - 20; z += 2.2) {
    for (const s of [-1, 1]) {
      if (rnd() < 0.4) continue;
      const d = HALF + 2.6 + Math.pow(rnd(), 1.6) * 24;
      put(d < 8.5 ? wpick(th.near) : wpick(th.far), [s * d, z + rnd() * 2, 0.75 + rnd() * 0.7, rnd() * 6.28]);
    }
  }
  for (let z = -30; z < len - 20; z += 2) { put(th.fence, [-(HALF + 0.95), z, 1, 0]); put(th.fence, [HALF + 0.95, z, 1, 0]); }
  for (let z = -20; z < len + 40; z += 14 + rnd() * 10) {
    const s = rnd() < 0.5 ? -1 : 1;
    put('cloud', [s * (22 + rnd() * 40), z + 20, 1 + rnd() * 1.2, rnd() * 0.6, 16 + rnd() * 14]);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const type in decor) {
    const list = decor[type], geo = DECOR[type];
    const mat = type === 'cloud' ? MAT.cloud : geo.userData.glow ? MAT.glow : MAT.decor;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((d, i) => { q.setFromAxisAngle(up, d[3]); sc.setScalar(d[2]); v3.set(d[0], d[4] || 0, d[1]); m4.compose(v3, q, sc); im.setMatrixAt(i, m4); });
    im.computeBoundingSphere();
    grp.add(im); keep(im);
  }

  // gates
  const panelGeo = keep(new THREE.PlaneGeometry(4.75, 2.3));
  const postGeo = keep(new THREE.CylinderGeometry(0.13, 0.13, 2.9, 10));
  const capGeo = keep(new THREE.SphereGeometry(0.22, 12, 8));
  const baseGeo = keep(new THREE.CylinderGeometry(0.26, 0.3, 0.22, 12));
  for (const gs of spec.gates) {
    const g = new THREE.Group(); g.position.z = gs.z; grp.add(g);
    const panels = gs.defs.map((_, i) => {
      const mat = keep(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      const p = new THREE.Mesh(panelGeo, mat);
      p.rotation.y = Math.PI; p.position.set(i === 0 ? -2.5 : 2.5, 1.5, 0); p.visible = false;
      g.add(p);
      return p;
    });
    for (const px of [-HALF, 0, HALF]) {
      const post = new THREE.Mesh(postGeo, MAT.post); post.position.set(px, 1.45, 0); g.add(post);
      const cap = new THREE.Mesh(capGeo, MAT.post); cap.position.set(px, 2.95, 0); g.add(cap);
      const base = new THREE.Mesh(baseGeo, MAT.postBase); base.position.set(px, 0.11, 0); g.add(base);
    }
    LV.gates.push({ z: gs.z, defs: gs.defs, ops: null, g, panels, passed: false, t: 0, side: -1, armed: false });
  }

  // walls & crates
  for (const bs of spec.blocks) {
    const isWall = bs.kind === 'wall';
    const w = bs.w, h = 1.5, d = isWall ? 1.0 : 1.5;
    const geo = keep(new THREE.BoxGeometry(w, h, d));
    let mat = MAT.wood;
    if (isWall) {
      const t = keep(T.wall.clone()); t.repeat.set(w / 1.5, 1); t.needsUpdate = true;
      mat = keep(addRim(new THREE.MeshLambertMaterial({ map: t }), 0.25));
    }
    const m = new THREE.Mesh(geo, mat);
    m.position.set(bs.x, h / 2, bs.z);
    grp.add(m);
    if (isWall) {
      const cap = new THREE.Mesh(keep(new THREE.BoxGeometry(w + 0.16, 0.16, d + 0.16)), MAT.stone); cap.position.y = h / 2 + 0.08; m.add(cap);
    } else {
      const bandG = keep(new THREE.BoxGeometry(w + 0.04, 0.12, d + 0.04));
      for (const yy of [-0.5, 0.5]) { const band = new THREE.Mesh(bandG, MAT.postBase); band.position.y = yy; m.add(band); }
    }
    const b = { ...bs, d, h, hp: 1, max: 1, alive: true, mesh: m, wob: 0, armed: false };
    b.label = new BlockLabel(b);
    keep(b.label.tex);
    const lw = isWall ? Math.min(w * 0.9, 2.8) : 1.3, lh = isWall ? lw / 2 : 1.3;
    const lm = new THREE.Mesh(keep(new THREE.PlaneGeometry(lw, lh)), keep(new THREE.MeshBasicMaterial({ map: b.label.tex, transparent: true, fog: false })));
    lm.rotation.y = Math.PI; lm.position.set(0, isWall ? 0.05 : 0, -d / 2 - 0.02);
    lm.visible = false; b.labelMesh = lm;
    m.add(lm);
    LV.blocks.push(b);
  }

  // saws
  const slotGeo = keep(new THREE.PlaneGeometry(HALF * 2 - 0.6, 0.42)); slotGeo.rotateX(-Math.PI / 2);
  for (const ss of spec.saws) {
    const slotM = new THREE.Mesh(slotGeo, MAT.slot); slotM.position.set(0, 0.008, ss.z); grp.add(slotM);
    for (const sx of [-1, 1]) { const pst = new THREE.Mesh(DECOR.sawPost, MAT.decor); pst.position.set(sx * (HALF + 0.35), 0, ss.z); grp.add(pst); }
    const blade = new THREE.Mesh(DECOR.saw, MAT.decor); blade.position.set(0, 0.5, ss.z); grp.add(blade);
    LV.saws.push({ ...ss, x: 0, blade });
  }

  // enemy groups (sized when armed)
  for (const es of spec.enemies) {
    const T2 = ETYPES[es.type];
    LV.enemies.push({ type: es.type, T: T2, troop: eTroop(es.type), x: 0, xr: es.xr, z: es.z, f: es.f, count: 0, sold: [], state: 'idle',
      alive: true, armed: false, pool: 0, fightAcc: 0, meleeAcc: 0, shotAcc: 0, hp: T2.hp * spec.hpMul,
      label: new CountLabel(T2.shoots ? '#ff7a1a' : '#ff4650', T2.shoots ? '#b8500c' : '#b3202c') });
  }
  for (const g of LV.enemies) g.label.sprite.visible = false;

  // coins
  LV.coins = spec.coins.map((c) => ({ x: c.x, z: c.z, taken: false }));
  if (LV.coins.length) {
    LV.coinMesh = new THREE.InstancedMesh(G.coin, MAT.coin, LV.coins.length);
    LV.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    LV.coinMesh.frustumCulled = false;
    grp.add(LV.coinMesh); keep(LV.coinMesh);
  }

  // boss
  LV.boss = makeBoss(spec.bossZ, L, th.boss);
  grp.add(LV.boss.group);

  // reset run state
  squad.x = squad.tx = 0; squad.z = 0; squad.speed = spec.speed;
  squad.sold.length = 0;
  S.count = startSoldiers();
  S.deaths = {};
  S.weapon = 0; S.runCoins = 0; S.collected = 0; S.fight = null; S.shotAcc = 0; S.shake = 0;
  setWeaponVisual(0);
  syncSquad(true);
  clearBullets();
  armObjects();
  camera.position.set(0, 7, -8);
  camLook.set(0, 0.8, 4);
}

function disposeLevel() {
  for (const g of LV.enemies) g.label.dispose();
  for (const g of LV.gates) for (const p of g.panels) if (p.material.map) p.material.map.dispose();
  for (const o of LV.own) if (o.dispose) o.dispose();
  for (const o of LV.boss.own) o.dispose();
  scene.remove(LV.grp);
  LV = null;
}

// ---------- arming: decide numbers from the army you actually have
function armObjects() {
  const lim = squad.z + ARM_DIST;
  for (const g of LV.gates) {
    if (g.armed || g.z > lim) continue;
    g.armed = true;
    let a = makeOp(g.defs[0], S.count), b = makeOp(g.defs[1], S.count);
    if (a.k === b.k && a.v === b.v) b = b.k === 'mul' ? { k: 'add', v: nice(S.count + 5) } : { k: b.k, v: b.v + (b.k === 'div' ? 1 : 5) };
    g.ops = [a, b];
    g.panels.forEach((p, i) => { p.material.map = gateTexture(g.ops[i]); p.material.needsUpdate = true; p.visible = true; });
  }
  const w = WEAPONS[S.weapon], dps = curDps(), d = dims(S.count);
  for (const b of LV.blocks) {
    if (b.armed || b.z > lim) continue;
    b.armed = true;
    if (b.kind === 'weapon' && S.weapon >= WEAPONS.length - 1) b.kind = 'soldier';
    if (b.kind === 'weapon') b.tier = S.weapon + 1;
    if (b.kind === 'soldier') b.v = nice(Math.round(S.count * b.vf) + 5);
    const frac = Math.min(1, (b.w + 0.5) / (2 * d.hw));
    b.hp = b.max = Math.max(4, niceHp(dps * frac * b.tf));
    b.label.draw(true); b.labelMesh.visible = true;
    void w;
  }
  for (const g of LV.enemies) {
    if (g.armed || g.z > lim) continue;
    g.armed = true;
    g.count = Math.max(3, Math.min(600, Math.round(S.count * g.f * (g.T.shoots ? 0.7 : 1))));
    // one enemy takes about 1.5 s (x type toughness) of a single soldier's fire
    g.hp = Math.sqrt(g.T.hp) * LV.hpMul * (curDps() / Math.max(1, S.count)) * 1.1;
    const dE = dims(g.count);
    g.x = g.xr * Math.max(0, HALF - 0.4 - dE.hw);
    syncGroup(g, true);
    g.label.sprite.visible = true;
  }
}

// ============================================================ boss
function makeBoss(z, L, kind) {
  const b = buildBoss(kind);
  const s = 1 + Math.min(L, 30) * 0.02;
  b.group.scale.setScalar(s);
  b.group.rotation.y = Math.PI;
  b.group.position.set(0, 0, z);
  return Object.assign(b, { s, x: 0, z, hp: 1, max: 1, state: 'idle', t: 0, atk: 0, flash: 0, hitDone: false, boomed: false });
}
function setBossFlash(b, v) { for (const m of b.flashMats) m.emissive.setRGB(v, v, v); }

function updateBoss(dt) {
  const b = LV.boss;
  b.t += dt;
  if (b.flash > 0) { b.flash = Math.max(0, b.flash - dt * 8); setBossFlash(b, b.flash * 0.1); }
  if (b.state === 'idle') {
    b.armR.rotation.x = 0.15 + Math.sin(b.t * 2) * 0.05;
    b.body.position.y = Math.sin(b.t * 2) * 0.05;
    return;
  }
  if (b.state === 'dead') {
    b.group.rotation.x = Math.min(1.5, b.group.rotation.x + dt * 2.2);
    b.group.position.y = -Math.max(0, b.t - 0.6) * 2;
    if (b.t > 0.55 && !b.boomed) { b.boomed = true; S.shake = 1; sfx.play('slam'); pulse('bad'); burst(b.x, 1, b.z + 2, 0xd8343f, 40, 9, 2.2, 16, 9); }
    return;
  }
  const reach = 3.0 * b.s + 0.4;
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
    if (b.z - squad.z > reach + 1.5) b.state = 'walk';
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
      burst(b.x, 0.2, b.z - 3.1 * b.s, 0xd9cdb8, 22, 8, 1.6, 20, 2);
      S.cause = 'boss';
      const k = Math.max(2, Math.ceil(S.count * 0.11));
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
    const o = slot(squad.sold.length, want);
    squad.sold.push({ x: squad.x + o.x, z: squad.z + o.z, k: instant ? 1 : 0, ph: Math.random() * 6.28,
      jx: (Math.random() - 0.5) * 0.08, jz: (Math.random() - 0.5) * 0.08 });
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
    const o = slot(g.sold.length, want);
    g.sold.push({ x: g.x + o.x, z: g.z - o.z, k: instant ? 1 : 0, ph: Math.random() * 6.28, jx: (Math.random() - 0.5) * 0.08, jz: (Math.random() - 0.5) * 0.08 });
  }
  while (g.sold.length > want) g.sold.pop();
  g.label.set(g.count);
}

function killSoldier(i) {
  const s = squad.sold[i];
  if (!s) return;
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
  const pg = PLAYER_GEO[w];
  pTroop.setGeo(pg.body, pg.leg, pg.gun);
  MAT.bullet.color.setHex(WEAPONS[w].bullet);
}

// ============================================================ gameplay update
function changeCount(newCount, good) {
  const diff = newCount - S.count;
  if (diff < 0) S.deaths.gate = (S.deaths.gate || 0) - diff;
  S.count = Math.max(0, newCount);
  if (S.count <= 0) {
    squadLabel.set(0);
    for (let i = squad.sold.length - 1; i >= 0; i--) burst(squad.sold[i].x, 0.6, squad.sold[i].z, 0x2f8cff, 2, 3);
    squad.sold.length = 0; lose(); return;
  }
  syncSquad(false);
  if (diff > 0) burst(squad.x, 1, squad.z, 0x8fd0ff, Math.min(24, 6 + diff), 4, 0.6, 6, 4);
  sfx.play(good ? 'good' : 'bad');
  vibrate(good ? 15 : 45);
  if (Math.abs(diff) >= 10) pulse(good ? 'good' : 'bad');
}

function blockDestroyed(b, reward) {
  b.alive = false; b.mesh.visible = false;
  const col = b.kind === 'wall' ? 0xf47a40 : 0xd99a55;
  burst(b.x, 0.8, b.z, col, b.kind === 'wall' ? 26 : 18, 6, 1.6, 18, 6);
  sfx.play('break'); vibrate(25);
  if (!reward) return;
  if (b.kind === 'weapon') {
    if (b.tier > S.weapon) {
      S.weapon = b.tier; setWeaponVisual(S.weapon);
      // new uniforms: everyone pops into the new look
      for (const s of squad.sold) s.k = 0.35;
    }
    toast(WEAPONS[b.tier].name + '!');
    sfx.play('upgrade');
    burst(squad.x, 1.2, squad.z, WEAPONS[b.tier].bullet, 24, 5, 0.6, 5, 5);
  } else if (b.kind === 'soldier') {
    toast('+' + b.v + ' ASKER');
    changeCount(S.count + b.v, true);
  }
}

function updateFormation(dt) {
  const n = squad.sold.length, k = Math.min(1, dt * 10), lim = HALF - 0.28;
  const cols = Math.min(MAX_COLS, Math.max(1, n));
  for (let i = 0; i < n; i++) {
    const s = squad.sold[i];
    const row = (i / cols) | 0, col = i - row * cols, inRow = Math.min(cols, n - row * cols);
    const tx = squad.x + (col - (inRow - 1) / 2) * SP + s.jx, tz = squad.z - row * SP + s.jz;
    s.x += (tx - s.x) * k; s.z += (tz - s.z) * k;
    if (s.x < -lim) s.x = -lim; else if (s.x > lim) s.x = lim;
    if (s.k < 1) s.k = Math.min(1, s.k + dt * 5);
  }
}

function updateGroups(dt) {
  const dP = dims(S.count);
  for (const g of LV.enemies) {
    if (!g.alive || !g.armed) continue;
    const dz = g.z - squad.z;
    if (dz > 80) continue;
    const T = g.T, dE = dims(g.count);
    if (g.state === 'idle' && S.state === 'play' && dz < (T.shoots ? 26 : 16)) g.state = T.shoots ? 'advance' : 'charge';
    if (g.state === 'advance') {
      g.z -= 1.2 * dt;
      g.x += (squad.x - g.x) * Math.min(1, dt * 0.5);
      if (dz < 7) g.state = 'charge';
    }
    if (g.state === 'charge') {
      g.z -= T.speed * dt;
      g.x += (squad.x - g.x) * Math.min(1, dt * 1.3);
    }
    if ((g.state === 'charge' || g.state === 'advance') && g.z - squad.z < 0.8 && g.z - squad.z > -dP.depth - 1 && Math.abs(g.x - squad.x) < dP.hw + dE.hw) {
      g.state = 'fight'; S.fight = g;
    }
    g.x = clamp(g.x, -(HALF - 0.4 - dE.hw), HALF - 0.4 - dE.hw);
    if (g.state === 'fight') {
      g.z = lerp(g.z, squad.z + 0.6, Math.min(1, dt * 4));
      g.x = lerp(g.x, squad.x, Math.min(1, dt * 3));
      g.fightAcc += dt * (12 + Math.min(S.count, g.count) * 1.7);
      const melee = Math.pow(T.hp, 0.35);
      while (g.fightAcc >= 1 && g.alive && S.count > 0) {
        g.fightAcc -= 1;
        g.meleeAcc += 1;
        if (g.meleeAcc >= melee) { g.meleeAcc -= melee; killEnemyFront(g); }
        if (!g.alive) break;
        S.cause = 'enemy'; killFront();
        if (S.state !== 'play' && S.state !== 'boss') break;
      }
      if (g.alive) vibrate(8);
    }
    const k = Math.min(1, dt * 8), n = g.sold.length, cols = Math.min(MAX_COLS, Math.max(1, n));
    for (let i = 0; i < n; i++) {
      const s = g.sold[i];
      const row = (i / cols) | 0, col = i - row * cols, inRow = Math.min(cols, n - row * cols);
      s.x += (g.x + (col - (inRow - 1) / 2) * SP + s.jx - s.x) * k;
      s.z += (g.z + row * SP + s.jz - s.z) * k;
      if (s.k < 1) s.k = Math.min(1, s.k + dt * 5);
    }
  }
}

// enemies with guns fire at the front rows of our army
function updateEnemyFire(dt) {
  if (S.state === 'play' || S.state === 'boss') {
    for (const g of LV.enemies) {
      if (!g.alive || !g.armed || !g.T.shoots || g.state === 'fight' || g.state === 'idle') continue;
      const dz = g.z - squad.z;
      if (dz < 1 || dz > 26 || !g.sold.length || !squad.sold.length) continue;
      g.shotAcc += Math.min(g.count * g.T.rate, 14) * dt;
      while (g.shotAcc >= 1) {
        g.shotAcc -= 1;
        const e = g.sold[(Math.random() * Math.min(g.sold.length, 18)) | 0];
        const tgt = squad.sold[(Math.random() * Math.min(squad.sold.length, 12)) | 0];
        const sx = e.x + 0.07, sz = e.z - 0.55;
        const tx = tgt.x + (Math.random() - 0.5) * 0.9, tz = tgt.z + 0.2;
        const dx = tx - sx, dzz = tz - sz, l = Math.hypot(dx, dzz) || 1;
        spawnIn(EB, sx, 0.78, sz, (dx / l) * EB_SPEED, (dzz / l) * EB_SPEED, 1, 2.2);
        burst(sx, 0.8, sz, g.T.bullet, 1, 1.5, 0.45, 2, 0.5);
        if (sfx.throttle('eshot', 110)) sfx.play('hit');
      }
    }
  }
  const a = EB.mesh.instanceMatrix.array, d = dims(S.count);
  let drawn = 0;
  for (let i = 0; i < EB.top; i++) {
    if (EB.life[i] <= 0) continue;
    EB.life[i] -= dt;
    EB.x[i] += EB.vx[i] * dt; EB.z[i] += EB.vz[i] * dt;
    const bx = EB.x[i], bz = EB.z[i];
    if ((S.state === 'play' || S.state === 'boss') && bz < squad.z + 0.6 && bz > squad.z - d.depth - 0.6 && Math.abs(bx - squad.x) < d.hw + 0.4) {
      let hit = -1;
      for (let j = 0; j < squad.sold.length; j++) {
        const s = squad.sold[j];
        if (Math.abs(s.x - bx) < 0.3 && Math.abs(s.z - bz) < 0.4) { hit = j; break; }
      }
      if (hit >= 0) { EB.life[i] = 0; S.cause = 'shot'; killSoldier(hit); continue; }
    }
    if (EB.y[i] <= 0) EB.life[i] = 0;
    const o = drawn * 16, l = Math.hypot(EB.vx[i], EB.vz[i]) || 1;
    wRy(a, o, EB.vz[i] / l, EB.vx[i] / l, bx, EB.y[i], bz, 1);
    drawn++;
  }
  EB.mesh.count = drawn;
  if (drawn) EB.mesh.instanceMatrix.needsUpdate = true;
}

function updateObstacles(dt) {
  const d = dims(S.count);
  const back = squad.z - d.depth - 0.5;
  for (const g of LV.gates) {
    if (!g.passed && g.ops && squad.z >= g.z) {
      g.passed = true;
      g.side = squad.x < 0 ? 0 : 1;
      const op = g.ops[g.side];
      floatText(opText(op), !isGood(op) ? 'bad' : '');
      changeCount(applyOp(op, S.count), isGood(op));
      if (S.state !== 'play') return;
    }
    if (g.passed && g.t < 1) {
      g.t = Math.min(1, g.t + dt * 2.5);
      g.panels.forEach((p, i) => {
        p.material.opacity = 1 - g.t;
        p.scale.setScalar(i === g.side ? 1 + g.t * 0.4 : 1 - g.t * 0.5);
      });
    }
  }
  for (const b of LV.blocks) {
    if (b.wob > 0) { b.wob = Math.max(0, b.wob - dt * 6); const s = 1 + b.wob * 0.06; b.mesh.scale.set(s, s, s); }
    if (!b.alive || b.z > squad.z + 1.5 || b.z < back - 1.5) continue;
    if (b.kind !== 'wall') {
      // crates are not deadly: running into one just smashes it (no reward)
      if (squad.sold.some((s) => Math.abs(s.z - b.z) < b.d / 2 + 0.15 && Math.abs(s.x - b.x) < b.w / 2 + 0.15)) {
        blockDestroyed(b, false);
        toast('KAÇTI!', true);
      }
      continue;
    }
    for (let i = squad.sold.length - 1; i >= 0; i--) {
      const s = squad.sold[i];
      if (!s) continue;
      if (Math.abs(s.z - b.z) < b.d / 2 + 0.15 && Math.abs(s.x - b.x) < b.w / 2 + 0.15) {
        S.cause = 'wall'; killSoldier(i);
        if (S.state !== 'play') return;
        b.hp -= Math.max(3 + S.weapon, b.max / 12);
        b.wob = 1; b.label.draw();
        if (b.hp <= 0) { blockDestroyed(b, true); break; }
      }
    }
  }
  for (const sw of LV.saws) {
    sw.x = Math.sin(S.t * sw.speed + sw.ph) * sw.amp;
    sw.blade.position.x = sw.x;
    sw.blade.rotation.z -= dt * 14;
    if (sw.z > squad.z + 1 || sw.z < back - 1) continue;
    for (let i = squad.sold.length - 1; i >= 0; i--) {
      const s = squad.sold[i];
      if (!s) continue;
      if (Math.abs(s.z - sw.z) < 0.35 && Math.abs(s.x - sw.x) < 0.7) {
        S.cause = 'saw'; killSoldier(i); sfx.play('saw');
        if (S.state !== 'play') return;
      }
    }
  }
  for (const c of LV.coins) {
    if (c.taken || c.z > squad.z + 0.5 || c.z < back - 0.3) continue;
    if (Math.abs(c.x - squad.x) < d.hw + 0.25) {
      c.taken = true; S.runCoins++; S.collected++;
      burst(c.x, 0.8, c.z, 0xffc83a, 4, 2.5, 0.5, 10, 4);
      sfx.play('coin');
      updateCoinsHud();
    }
  }
}

function nearTargets() {
  const list = [];
  const z0 = squad.z - 2, z1 = squad.z + 32;
  for (const b of LV.blocks) if (b.alive && b.armed && b.z > z0 && b.z < z1) list.push(b);
  for (const g of LV.enemies) if (g.alive && g.armed && g.z > z0 && g.z < z1 + 2) list.push(g);
  if (S.state === 'boss' && LV.boss.state !== 'dead' && LV.boss.state !== 'idle') list.push(LV.boss);
  return list;
}

// each soldier fires in turn (round robin) and aims at the nearest enemy in a forward cone
function fireFrom(s, dmg, targets) {
  const w = WEAPONS[S.weapon];
  const gx = s.x - 0.07, gz = s.z + 0.35 + w.len;
  let vx = 0, vz = 1, best = null, bd = 1e9;
  for (const T of targets) {
    if (T === LV.boss) {
      const dz = T.z - gz;
      if (dz > 1 && dz < 34) { const tx = clamp(T.x + (Math.random() - 0.5) * 1.6 * T.s, gx - dz * 0.35, gx + dz * 0.35); best = { x: tx, z: T.z - 0.8 }; bd = -1; }
    } else if (T.sold && bd >= 0) {
      if (T.z - gz > 31 || T.z + 12 < gz) continue;
      for (const e of T.sold) {
        const dz = e.z - gz;
        if (dz < 0.8 || dz > 30) continue;
        const dx = e.x - gx;
        if (Math.abs(dx) > dz * 0.35) continue;
        const sc = Math.abs(dx) * 3 + dz;
        if (sc < bd) { bd = sc; best = e; }
      }
    }
  }
  if (best) { const dx = best.x - gx, dz = best.z - gz, l = Math.hypot(dx, dz); vx = dx / l; vz = dz / l; }
  spawnIn(B, gx, 0.75, gz, vx * BULLET_SPEED, vz * BULLET_SPEED, dmg, 0.62);
}

function updateShooting(dt) {
  const w = WEAPONS[S.weapon];
  const targets = nearTargets();
  if ((S.state === 'play' || S.state === 'boss') && squad.sold.length) {
    const shots = S.count * w.rate * rateMul();
    const vis = Math.min(shots, save.eco ? 60 : 110);
    S.shotAcc += vis * dt;
    const dmg = curDps() / Math.max(vis, 0.001);
    while (S.shotAcc >= 1) {
      S.shotAcc -= 1;
      S.rr = (S.rr + 1) % squad.sold.length;
      fireFrom(squad.sold[S.rr], dmg, targets);
    }
    if (targets.length) sfx.play('shot');
  }
  const a = B.mesh.instanceMatrix.array, bs = w.bs, boss = LV.boss;
  let drawn = 0;
  for (let i = 0; i < B.top; i++) {
    if (B.life[i] <= 0) continue;
    B.life[i] -= dt;
    const z0 = B.z[i];
    B.x[i] += B.vx[i] * dt; B.z[i] += B.vz[i] * dt;
    const z1 = B.z[i], bx = B.x[i];
    let hit = false;
    for (let t = 0; t < targets.length && !hit; t++) {
      const T = targets[t];
      if (T === boss) {
        if (Math.abs(bx - boss.x) < 1.8 * boss.s && z1 >= boss.z - 1.0) { hitBoss(B.dmg[i], bx); hit = true; }
      } else if (T.sold) {
        if (!T.alive) continue;
        const dE = dims(T.count);
        if (Math.abs(bx - T.x) > dE.hw + 0.6 || z1 < T.z - 1 || z0 > T.z + dE.depth + 1) continue;
        for (let j = 0; j < T.sold.length; j++) {
          const e = T.sold[j];
          if (Math.abs(e.x - bx) < 0.36 && e.z > z0 - 0.4 && e.z < z1 + 0.4) {
            T.pool += B.dmg[i];
            let kills = Math.floor(T.pool / T.hp);
            T.pool -= kills * T.hp;
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
          if (T.hp <= 0) blockDestroyed(T, true);
          hit = true;
        }
      }
    }
    if (hit) { B.life[i] = 0; continue; }
    wRy(a, drawn++ * 16, B.vz[i] / BULLET_SPEED, B.vx[i] / BULLET_SPEED, bx, B.y[i], z1, bs);
  }
  B.mesh.count = drawn;
  if (drawn) B.mesh.instanceMatrix.needsUpdate = true;
}

function enterBoss() {
  S.state = 'boss';
  const b = LV.boss;
  b.hp = b.max = Math.max(30, Math.round(curDps() * (9 + Math.min(LV.L, 30) * 0.12)));
  b.state = 'walk';
  $('bossBar').firstChild.nodeValue = b.name;
  $('bossBar').classList.remove('hidden');
  updateBossBar();
  toast(b.name + '!', true);
  sfx.play('bad');
}

function updatePlay(dt) {
  const d = dims(S.count);
  const lim = Math.max(0, HALF - 0.35 - d.hw);
  squad.tx = clamp(squad.tx, -lim, lim);
  squad.x += (squad.tx - squad.x) * Math.min(1, dt * 12);
  if (S.state === 'play') {
    squad.z += squad.speed * (S.fight ? 0.25 : 1) * dt;
    if (squad.z >= LV.bossLine) { squad.z = LV.bossLine; enterBoss(); }
  }
  armObjects();
  updateFormation(dt);
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
  $('loseTip').textContent = loseTip();
  pulse('bad');
  $('loseSub').textContent = LV.boss.state !== 'idle' ? LV.boss.name + ' çok güçlüydü!' : 'Ordun dağıldı!';
  $('bossBar').classList.add('hidden');
}
function finishWin() {
  const L = LV.L;
  const reward = 20 + L * 6 + Math.floor(Math.min(S.count, 400) * 0.6) + S.runCoins;
  save.coins += reward; save.level = L + 1; persist();
  $('wSold').textContent = fmt(S.count);
  $('wColl').textContent = S.collected;
  showStars(S.count >= 30 ? 3 : S.count >= 10 ? 2 : 1);
  countUp($('wCoins'), reward);
  pulse('good');
  $('winSub').textContent = 'Seviye ' + L + ' tamamlandı' + (L % 10 === 0 ? ' · Yeni bölüm açıldı!' : '');
  $('winPanel').classList.remove('hidden');
  updateCoinsHud();
  sfx.play('win');
}

// ============================================================ render helpers
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
  for (const k in ETROOPS) ETROOPS[k].begin();
  for (const g of LV.enemies) {
    if (!g.alive || !g.armed) continue;
    const dz = g.z - squad.z;
    if (dz > 90 || dz < -14) { g.label.sprite.visible = false; continue; }
    const run = g.state === 'charge' || g.state === 'fight' || g.state === 'advance';
    const sp = g.state === 'advance' ? 7 : 14;
    for (const s of g.sold) {
      const p = Math.sin(t * (run ? sp : 3) + s.ph);
      g.troop.push(s.x, run ? Math.abs(p) * 0.07 : 0.015 + p * 0.015, s.z, Math.PI, run ? p * 0.7 : 0, s.k);
    }
    g.label.sprite.visible = true;
    g.label.sprite.position.set(g.x, 2.0, g.z);
  }
  for (const k in ETROOPS) ETROOPS[k].end();
  const d = dims(S.count);
  squadLabel.sprite.visible = S.count > 0;
  squadLabel.sprite.position.set(squad.x, 2.0, squad.z - Math.min(d.depth, 3) * 0.5);

  if (LV.coinMesh) {
    const a = LV.coinMesh.instanceMatrix.array;
    let n = 0;
    const c = Math.cos(t * 4), s = Math.sin(t * 4);
    for (const cn of LV.coins) {
      if (cn.taken) continue;
      const dz = cn.z - squad.z;
      if (dz < -16 || dz > 80) continue;
      wRy(a, n++ * 16, c, s, cn.x, 0.55 + Math.sin(t * 3 + cn.z) * 0.08, cn.z, 1);
    }
    LV.coinMesh.count = n;
    LV.coinMesh.instanceMatrix.needsUpdate = true;
  }
}

function updateCamera(dt) {
  if (S.freeCam) { sky.position.copy(camera.position); return; }
  const d = dims(S.count), depth = Math.min(d.depth, 11);
  let px, py, pz, lx, ly, lz;
  if (S.state === 'menu') {
    const sway = Math.sin(S.t * 0.4) * 1.2;
    px = sway; py = 5.2 + depth * 0.3; pz = squad.z - 7.2 - depth * 0.6; lx = 0; ly = 1.2; lz = squad.z + 4;
  } else {
    const bossy = S.state === 'boss' || (S.state === 'win' && LV.boss.state === 'dead');
    px = squad.x * 0.45; py = 7.8 + depth * 0.45; pz = squad.z - 7.8 - depth * 0.75;
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
    if (S.state === 'play' || S.state === 'boss') updateBoss(dt);
    if (S.state === 'play' || S.state === 'boss') { updateShooting(dt); updateEnemyFire(dt); }
  } else {
    if (S.state === 'win') {
      updateBoss(dt);
      updateFormation(dt);
      S.endT += dt;
      if (LV.boss.t > 0.9 && !S.confetti) { S.confetti = true; confetti(squad.x, squad.z + 4, 120); }
      if (S.endT > 2.4 && !S.endShown) { S.endShown = true; finishWin(); }
    } else if (S.state === 'lose') {
      S.endT += dt;
      if (S.endT > 1.1 && !S.endShown) { S.endShown = true; $('losePanel').classList.remove('hidden'); }
    } else if (S.state === 'menu') {
      updateBoss(dt);
      updateFormation(dt);
      for (const sw of LV.saws) { sw.x = Math.sin(S.t * sw.speed + sw.ph) * sw.amp; sw.blade.position.x = sw.x; sw.blade.rotation.z -= dt * 14; }
    }
    updateShooting(dt);
    updateEnemyFire(dt);
  }
  updateParticles(dt);
  drawTroops();
  updateCamera(dt);
  updateWeather(dt);
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
  toastTimer = setTimeout(() => el.classList.remove('show'), 950);
}
function vibrate(ms) { if (save.vibe && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } }
// CSS-only juice: floating text, full-screen pulse, counter bump
function floatText(text, cls) {
  const host = $('fx');
  while (host.children.length > 4) host.removeChild(host.firstChild);
  const el = document.createElement('div');
  el.className = 'fl ' + (cls || '');
  el.textContent = text;
  el.style.marginLeft = ((Math.random() - 0.5) * 40).toFixed(0) + 'px';
  el.addEventListener('animationend', () => el.remove());
  host.appendChild(el);
}
function pulse(kind) {
  const el = $('pulse');
  el.className = kind || '';
  void el.offsetWidth; el.classList.add('go');
}
let shownCoins = -1;
function updateCoinsHud() {
  const v = save.coins + (S.state === 'play' || S.state === 'boss' ? S.runCoins : 0);
  $('coins').textContent = fmt(v);
  if (shownCoins >= 0 && v > shownCoins) {
    const p = $('coins').parentNode;
    p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump');
  }
  shownCoins = v;
}
function countUp(el, to) {
  // short rAF count-up, only while the win panel is open
  const t0 = performance.now(), dur = 900;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1 && !$('winPanel').classList.contains('hidden')) requestAnimationFrame(tick);
    else el.textContent = to;
  };
  el.textContent = 0;
  requestAnimationFrame(tick);
}
function showStars(n) {
  document.querySelectorAll('#stars svg').forEach((el, i) => {
    el.classList.remove('on', 'off'); void el.getBoundingClientRect();
    el.style.setProperty('--d', (0.25 + i * 0.22) + 's');
    el.classList.add(i < n ? 'on' : 'off');
    if (i < n) setTimeout(() => sfx.play('coin'), 250 + i * 220);
  });
}
function loseTip() {
  const d = Object.assign({}, S.deaths); d[S.cause] = (d[S.cause] || 0) + 1;
  const tips = {
    gate: 'Kırmızı kapılardan kaçın, yeşil kapıları seç!',
    wall: 'Duvarlara çarpma; önce ateşle kır!',
    saw: 'Testerelerin etrafından dolan!',
    shot: 'Düşman ateşinden kaçmak için kenara geç.',
    enemy: 'Daha çok asker topla ve ateş gücünü yükselt!',
    boss: 'Dev için güçlü silah kasalarını kır ve yükseltme al!',
  };
  let best = 'enemy', bv = -1;
  for (const k in tips) if ((d[k] || 0) > bv) { bv = d[k] || 0; best = k; }
  return 'İpucu: ' + tips[bv > 0 ? best : 'enemy'];
}

function refreshMenu() {
  const th = themeFor(save.level), idx = (save.level - 1) % 10;
  $('lvlPill').textContent = 'SEVİYE ' + save.level + ' · ' + th.name;
  $('wName').textContent = th.name;
  $('wLv').textContent = 'SEVİYE ' + save.level;
  const dots = $('dots');
  if (dots.children.length !== 10) { dots.innerHTML = ''; for (let i = 0; i < 10; i++) dots.appendChild(document.createElement('i')); }
  for (let i = 0; i < 10; i++) dots.children[i].className = (i < idx ? 'done' : i === idx ? 'cur' : '') + (i === 9 ? ' boss' : '');
  updateCoinsHud();
  document.querySelectorAll('.up').forEach((el) => {
    const k = el.dataset.up, lvl = save[k], maxed = lvl >= UPG[k].max, cost = upCost(k);
    el.querySelector('[data-v]').textContent = k === 'upStart' ? startSoldiers() : lvl + 1;
    const nx = k === 'upStart' ? (startSoldiers() + 1) + ' asker' : k === 'upRate' ? 'x' + (1 + (lvl + 1) * 0.08).toFixed(2) : 'x' + (1 + (lvl + 1) * 0.1).toFixed(1);
    el.querySelector('[data-n]').textContent = maxed ? 'MAKS' : nx;
    const bars = el.querySelector('.lv');
    if (bars.children.length !== 5) { bars.innerHTML = '<i></i><i></i><i></i><i></i><i></i>'; }
    const fill = Math.ceil(5 * lvl / UPG[k].max);
    for (let i = 0; i < 5; i++) bars.children[i].classList.toggle('on', i < fill);
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
  const L = LV.L;
  toast(L > 1 && (L - 1) % 10 === 0 ? 'YENİ BÖLÜM: ' + LV.th.name : 'SEVİYE ' + L);
  showTutorial();
}

function showTutorial() {
  let seen = false;
  try { seen = !!localStorage.getItem('ordu_tut_v1'); localStorage.setItem('ordu_tut_v1', '1'); } catch (e) { /* ignore */ }
  const old = $('tutorial'); if (old) old.remove();
  if (seen) return;
  const t = document.createElement('div');
  t.id = 'tutorial';
  t.innerHTML = '<div>Orduyu yönlendirmek için sağa sola kaydır</div><div>Silah kasalarını ateşle kır, yeşil kapıları seç!</div>';
  t.addEventListener('animationend', (e) => { if (e.animationName === 'tutOut') t.remove(); });
  document.querySelector('.ui').appendChild(t);
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
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
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

// steering: relative horizontal drag. The camera looks down +z, so screen-right is world -x.
let dragging = false, lastX = 0;
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button') || e.target.closest('.overlay')) return;
  dragging = true; lastX = e.clientX;
  if (S.state === 'menu') startRun();
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  if (S.state === 'play' || S.state === 'boss') squad.tx -= (dx / Math.min(window.innerWidth, 600)) * 13;
});
const endDrag = () => { dragging = false; };
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
window.addEventListener('contextmenu', (e) => e.preventDefault());

// debug / testing hook
window.__G = {
  S, squad, get LV() { return LV; }, startRun, showMenu, save, step: update, camera, dims,
  setWeapon: (w) => { S.weapon = w; setWeaponVisual(w); },
};

showMenu();
startLoop();

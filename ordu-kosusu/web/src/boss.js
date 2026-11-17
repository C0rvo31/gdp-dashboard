// Boss models (one per world). Animated parts: body, legL/legR, armL/armR (pivots).
import * as THREE from 'three';
import { addRim } from './models.js';

// ------------------------------------------------------------ bosses
export const BOSSES = {
  orc: { name: 'ORK DEVİ', skin: 0x9be06a, nose: 0x86c95b, armor: 0xd8343f, dark: 0x3b2633, metal: 0xbfc7d3, helm: 'spiked', hammer: 0xbfc7d3 },
  sand: { name: 'KUM DEVİ', skin: 0xd9a066, nose: 0xc98a50, armor: 0x2a5aa8, dark: 0x4a3020, metal: 0xffc83a, helm: 'turban', hammer: 0xffc83a },
  yeti: { name: 'YETİ', skin: 0x9fd3ff, nose: 0x6fa8d8, armor: 0xf2f6fb, dark: 0xc9d6e6, metal: 0x7fd3ff, helm: 'fur', hammer: 0x8fe3ff },
  demon: { name: 'ATEŞ İBLİSİ', skin: 0xc0392b, nose: 0x9a2a20, armor: 0x2a1c22, dark: 0x3a1a1a, metal: 0xff7a1a, helm: 'horns', hammer: 0x2a2228 },
};

export function buildBoss(kind) {
  const P = BOSSES[kind];
  const group = new THREE.Group();
  const own = [];
  const mat = (c, e = 0) => { const m = addRim(new THREE.MeshLambertMaterial({ color: c, emissive: e }), 0.38); own.push(m); return m; };
  const geo = (g) => { own.push(g); return g; };
  const armor = mat(P.armor), dark = mat(P.dark), skin = mat(P.skin), metal = mat(P.metal), eye = mat(0xffffff), pupil = mat(0x16233b);
  const bone = mat(0xf3ecdc);
  const body = new THREE.Group(); group.add(body);
  const add = (parent, g, m, x, y, zz) => { const mesh = new THREE.Mesh(geo(g), m); mesh.position.set(x, y, zz); parent.add(mesh); return mesh; };

  add(body, new THREE.CapsuleGeometry(1.05, 1.0, 4, 14).scale(1.2, 1, 0.9), armor, 0, 3.15, 0);
  add(body, new THREE.CylinderGeometry(1.22, 1.22, 0.38, 16), dark, 0, 2.35, 0);
  add(body, new THREE.BoxGeometry(0.5, 0.42, 0.2), metal, 0, 2.35, 1.12);
  add(body, new THREE.SphereGeometry(0.78, 16, 12), skin, 0, 4.75, 0.05);
  add(body, new THREE.SphereGeometry(0.17, 10, 8), eye, -0.28, 4.82, 0.68);
  add(body, new THREE.SphereGeometry(0.17, 10, 8), eye, 0.28, 4.82, 0.68);
  const pupilM = kind === 'demon' ? mat(0xffb020, 0x6a3a00) : pupil;
  add(body, new THREE.SphereGeometry(0.08, 8, 6), pupilM, -0.28, 4.8, 0.83);
  add(body, new THREE.SphereGeometry(0.08, 8, 6), pupilM, 0.28, 4.8, 0.83);
  const browL = add(body, new THREE.BoxGeometry(0.36, 0.09, 0.08), pupil, -0.28, 5.04, 0.74); browL.rotation.z = -0.4;
  const browR = add(body, new THREE.BoxGeometry(0.36, 0.09, 0.08), pupil, 0.28, 5.04, 0.74); browR.rotation.z = 0.4;
  add(body, new THREE.BoxGeometry(0.4, 0.07, 0.06), pupil, 0, 4.48, 0.78);
  add(body, new THREE.SphereGeometry(0.13, 10, 8), mat(P.nose), 0, 4.66, 0.8);
  add(body, new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12).rotateX(Math.PI / 2), metal, 0, 3.15, 1.08);

  // headgear per boss type
  if (P.helm === 'spiked') {
    const helm = add(body, new THREE.SphereGeometry(0.84, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), dark, 0, 4.85, 0); helm.scale.set(1, 0.9, 1);
    for (let i = -1; i <= 1; i++) { const sp = add(body, new THREE.ConeGeometry(0.16, 0.55, 8), metal, i * 0.42, 5.75 - Math.abs(i) * 0.15, 0); sp.rotation.z = -i * 0.35; }
  } else if (P.helm === 'turban') {
    const t = add(body, new THREE.SphereGeometry(0.88, 16, 10), mat(0xf4ecdc), 0, 5.15, -0.05); t.scale.set(1, 0.72, 1);
    add(body, new THREE.TorusGeometry(0.8, 0.14, 8, 20).rotateX(Math.PI / 2), mat(0xe6d8bc), 0, 5.0, 0);
    add(body, new THREE.SphereGeometry(0.17, 10, 8), mat(0xff3b5c, 0x400010), 0, 5.12, 0.84);
    add(body, new THREE.ConeGeometry(0.1, 0.4, 6), mat(0xffc83a), 0, 5.45, 0.78);
  } else if (P.helm === 'fur') {
    for (const [x, y, z, r] of [[0, 5.3, -0.1, 0.55], [-0.45, 5.15, -0.05, 0.42], [0.45, 5.15, -0.05, 0.42], [0, 5.0, -0.45, 0.6], [-0.3, 5.42, 0.2, 0.3], [0.3, 5.42, 0.2, 0.3]]) add(body, new THREE.IcosahedronGeometry(r, 1), armor, x, y, z);
    for (const s of [-1, 1]) { const h = add(body, new THREE.ConeGeometry(0.12, 0.5, 8), bone, s * 0.62, 5.45, 0); h.rotation.z = -s * 0.5; }
  } else {
    const helm = add(body, new THREE.SphereGeometry(0.84, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), dark, 0, 4.85, 0); helm.scale.set(1, 0.85, 1);
    for (const s of [-1, 1]) {
      const h1 = add(body, new THREE.ConeGeometry(0.22, 0.7, 10), mat(0x1a1416), s * 0.75, 5.35, 0); h1.rotation.z = -s * 0.9;
      const h2 = add(body, new THREE.ConeGeometry(0.12, 0.55, 10), mat(0x1a1416), s * 1.1, 5.85, 0); h2.rotation.z = -s * 0.15;
    }
  }
  for (const sx of [-1, 1]) {
    const tusk = add(body, new THREE.ConeGeometry(0.07, 0.22, 8), bone, sx * 0.17, 4.56, 0.74); tusk.rotation.x = -0.25;
    if (P.helm !== 'turban') add(body, new THREE.SphereGeometry(0.16, 10, 8), skin, sx * 0.78, 4.78, 0);
    const pad = add(body, new THREE.SphereGeometry(0.66, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark, sx * 1.42, 4.02, 0);
    pad.scale.set(1, 0.8, 1);
    for (let k = -1; k <= 1; k++) { const sp = add(body, new THREE.ConeGeometry(0.11, 0.38, 8), metal, sx * 1.42 + k * 0.28, 4.6 - Math.abs(k) * 0.08, 0); sp.rotation.z = -sx * 0.25; }
    const strap = add(body, new THREE.BoxGeometry(0.26, 2.5, 0.14), dark, 0, 3.15, 0.98); strap.rotation.z = sx * 0.55;
  }

  const limb = (x, y, w, h, m, foot) => {
    const piv = new THREE.Group(); piv.position.set(x, y, 0); body.add(piv);
    add(piv, new THREE.CapsuleGeometry(w / 2, h - w, 4, 12), m, 0, -h / 2, 0);
    if (foot) { const f = add(piv, new THREE.SphereGeometry(w * 0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark, 0, -h - 0.02, 0.18); f.scale.set(1, 0.75, 1.45); }
    return piv;
  };
  const legL = limb(-0.6, 2.1, 0.8, 2.0, dark, true);
  const legR = limb(0.6, 2.1, 0.8, 2.0, dark, true);
  const armL = limb(-1.5, 4.0, 0.58, 1.8, armor, false);
  const armR = limb(1.5, 4.0, 0.58, 1.8, armor, false);
  for (const a of [armL, armR]) {
    add(a, new THREE.SphereGeometry(0.42, 12, 8), skin, 0, -1.95, 0);
    add(a, new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12), metal, 0, -1.55, 0);
  }
  add(armR, new THREE.CylinderGeometry(0.11, 0.11, 2.0, 8), mat(0x7a4f2a), 0, -2.7, 0);
  const hammerM = kind === 'demon' ? mat(0x2a2228, 0x000000) : mat(P.hammer);
  const hh = add(armR, new THREE.BoxGeometry(1.25, 0.85, 0.85), hammerM, 0, -3.75, 0);
  hh.rotation.y = Math.PI / 2;
  if (kind === 'demon') add(armR, new THREE.BoxGeometry(0.9, 0.2, 0.9), mat(0xff7a1a, 0x8a3000), 0, -3.75, 0);

  return { group, body, legL, legR, armL, armR, flashMats: [armor, skin], name: P.name, own };
}

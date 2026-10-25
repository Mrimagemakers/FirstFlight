// An original, generic twin-engine narrow-body airliner (no real manufacturer or airline livery).
// Model space: nose toward -z, origin on the ground below the nose gear-to-main-gear midpoint, metres.
import * as THREE from 'three';
import { body, loftWing, mesh, rod, box, cyl, lathe, sphere, contactShadow } from '../util.js';
import { materials } from '../materials.js';
import { makeLivery } from './livery.js';

const CY = 4.0;      // fuselage centreline height
const RX = 1.98, RY = 2.07;
export const PROFILE = [
  [-18.3, 0.02, 0.02, 3.62], [-18.1, 0.42, 0.42, 3.66], [-17.6, 0.92, 0.98, 3.72], [-16.8, 1.38, 1.46, 3.8], [-15.6, 1.75, 1.85, 3.9],
  [-14.0, 1.95, 2.04, 3.98], [-12.0, RX, RY, CY], [10.0, RX, RY, CY], [12.5, 1.9, 1.95, 4.12], [15.0, 1.6, 1.55, 4.42],
  [17.2, 1.15, 1.02, 4.78], [18.9, 0.62, 0.55, 5.08], [19.8, 0.26, 0.24, 5.25], [20.2, 0.05, 0.05, 5.3],
];
const Z0 = PROFILE[0][0], LEN = PROFILE[PROFILE.length - 1][0] - Z0;

/** Fuselage radius data at a given z (linear interpolation of the profile). */
export function section(z) {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const a = PROFILE[i], b = PROFILE[i + 1];
    if (z >= a[0] && z <= b[0]) { const t = (z - a[0]) / (b[0] - a[0]); return a.map((v, k) => v + (b[k] - v) * t); }
  }
  return PROFILE[PROFILE.length - 1];
}
/** UV coordinate of a point on the skin at height y, side ('right' | 'left'), station z. */
function uvAt(z, y, side) {
  const [, , ry, cy] = section(z);
  const a = Math.acos(THREE.MathUtils.clamp((cy - y) / ry, -1, 1)); // 0 at belly, PI at crown
  const u = side === 'right' ? a / (Math.PI * 2) : 1 - a / (Math.PI * 2);
  return [u, (z - Z0) / LEN];
}

export function buildAirliner(lab, { quality = 'high', accent = '#0f3d5c', accent2 = '#c9964f', cargoOpen = true, name = 'FIRST FLIGHT' } = {}) {
  const M = materials(lab);
  const root = new THREE.Group();
  root.name = 'airliner';

  // ---------------------------------------------------------------- livery texture (windows, doors, titles)
  const W = quality === 'high' ? 2048 : 1024, H = quality === 'high' ? 4096 : 2048;
  const liv = makeLivery({
    W, H, circumference: 12.7, length: LEN, base: '#f4f3ef',
    draw(ctx, api) {
      const P = (z, y, side) => { const [u, v] = uvAt(z, y, side); return [u * W, (1 - v) * H]; };
      const poly = (pts, fill, stroke, lw = 2) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } };
      const rrect = (z0, z1, y0, y1, side, fill, stroke, lw) => {
        const pts = []; const n = 8;
        for (let i = 0; i <= n; i++) pts.push(P(z0 + (z1 - z0) * i / n, y1, side));
        for (let i = 0; i <= n; i++) pts.push(P(z1, y1 - (y1 - y0) * i / n, side));
        for (let i = 0; i <= n; i++) pts.push(P(z1 - (z1 - z0) * i / n, y0, side));
        for (let i = 0; i <= n; i++) pts.push(P(z0, y0 + (y1 - y0) * i / n, side));
        poly(pts, fill, stroke, lw);
      };
      // belly: light grey below the waterline
      for (const side of ['right', 'left']) {
        const pts = [];
        for (let z = Z0; z <= Z0 + LEN; z += 0.25) pts.push(P(z, section(z)[3] - 0.55, side));
        pts.push(side === 'right' ? [0, 0] : [W, 0]); pts.unshift(side === 'right' ? [0, H] : [W, H]);
        poly(pts, '#c9cfd3');
      }
      // skin panel seams and rivet rows (high quality and up)
      if (quality === 'high') {
        ctx.save();
        ctx.strokeStyle = 'rgba(120,128,132,0.28)'; ctx.lineWidth = 1.5;
        for (let z = -15.5; z < 19.5; z += 1.55) { ctx.beginPath(); for (let u = 0; u <= 1.001; u += 0.02) { const pt = [u * W, (1 - (z - Z0) / LEN) * H]; u ? ctx.lineTo(...pt) : ctx.moveTo(...pt); } ctx.stroke(); }
        for (const u of [0.18, 0.33, 0.5, 0.67, 0.82]) { ctx.beginPath(); ctx.moveTo(u * W, (1 - (-15.5 - Z0) / LEN) * H); ctx.lineTo(u * W, (1 - (19.5 - Z0) / LEN) * H); ctx.stroke(); }
        ctx.fillStyle = 'rgba(110,118,122,0.22)';
        for (let z = -15.5; z < 19.5; z += 1.55) for (let u = 0.02; u < 1; u += 0.006) { const [px, py] = [u * W, (1 - (z - Z0) / LEN) * H]; ctx.fillRect(px - 0.8, py + 3, 1.6, 1.6); }
        ctx.restore();
      }
      // cheatline sweeping up towards the tail
      for (const side of ['right', 'left']) {
        const top = [], bottom = [];
        for (let z = -16.6; z <= 19.8; z += 0.25) {
          const [, , , cy] = section(z);
          const rise = Math.max(0, (z - 6) / 14) ** 1.6 * 2.6;
          top.push(P(z, cy - 0.32 + rise, side)); bottom.push(P(z, cy - 0.6 + rise * 0.9, side));
        }
        poly([...top, ...bottom.reverse()], accent);
        const gold = [], gold2 = [];
        for (let z = -16.2; z <= 19.8; z += 0.25) { const [, , , cy] = section(z); const rise = Math.max(0, (z - 6) / 14) ** 1.6 * 2.6; gold.push(P(z, cy - 0.66 + rise * 0.9, side)); gold2.push(P(z, cy - 0.71 + rise * 0.9, side)); }
        poly([...gold, ...gold2.reverse()], accent2);
      }
      // cockpit windscreen and side windows
      for (const side of ['right', 'left']) {
        poly([P(-16.75, 4.55, side), P(-16.2, 4.98, side), P(-15.55, 4.98, side), P(-15.65, 4.5, side)], '#121b22', '#d9dddd', 3);
        poly([P(-15.45, 4.5, side), P(-15.4, 4.98, side), P(-14.75, 4.95, side), P(-14.8, 4.48, side)], '#121b22', '#d9dddd', 3);
        poly([P(-14.6, 4.52, side), P(-14.55, 4.9, side), P(-14.1, 4.88, side), P(-14.1, 4.55, side)], '#121b22', '#d9dddd', 3);
      }
      // front windscreen panes crossing the crown
      {
        const pts = [];
        const zA = -16.85, zB = -16.25;
        for (let u = 0.43; u <= 0.57; u += 0.01) pts.push([u * W, (1 - (zA - Z0 + (Math.abs(u - 0.5) * 2) * 0.3) / LEN) * H]);
        for (let u = 0.57; u >= 0.43; u -= 0.01) pts.push([u * W, (1 - (zB - Z0 + (Math.abs(u - 0.5) * 2) * 0.55) / LEN) * H]);
        poly(pts, '#121b22');
        ctx.strokeStyle = '#d9dddd'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0.5 * W, (1 - (zA - Z0) / LEN) * H); ctx.lineTo(0.5 * W, (1 - (zB - Z0) / LEN) * H); ctx.stroke();
      }
      // rounded window: superellipse in (z, y) metres, with a dark reveal and a sky reflection
      const win = (z, y, w, h, side) => {
        const outline = (sc) => { const pts = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pts.push(P(z + Math.sign(c) * Math.abs(c) ** 0.55 * w / 2 * sc, y + Math.sign(s) * Math.abs(s) ** 0.55 * h / 2 * sc, side)); } return pts; };
        poly(outline(1.18), '#b9c0c4');
        poly(outline(1.0), '#18232a');
        ctx.save(); ctx.beginPath(); outline(1.0).forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.clip();
        const a = P(z, y + h / 2, side), b = P(z, y - h / 2, side);
        const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, 'rgba(140,170,190,0.55)'); g.addColorStop(0.45, 'rgba(40,60,75,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(Math.min(a[0], b[0]) - 40, Math.min(a[1], b[1]) - 40, Math.abs(b[0] - a[0]) + 80, Math.abs(b[1] - a[1]) + 80);
        ctx.restore();
      };
      // passenger windows
      for (const side of ['right', 'left']) {
        for (let z = -11.9; z < 11.6; z += 0.53) {
          if (Math.abs(z - -0.6) < 0.4 || Math.abs(z - 0.35) < 0.3) continue; // overwing exits drawn separately
          win(z + 0.12, 4.325, 0.24, 0.35, side);
        }
        // doors: forward, aft and overwing exits
        for (const [z0, z1] of [[-14.3, -13.45], [13.5, 14.35]]) {
          rrect(z0, z1, 2.98, 4.85, side, null, '#7c8489', 4);
          win(z0 + 0.425, 4.34, 0.22, 0.3, side);
          ctx.fillStyle = '#5f676c';
          const h = P(z1 - 0.12, 3.9, side); ctx.fillRect(h[0] - 6, h[1] - 14, 12, 28);
        }
        for (const z of [-0.95, 0.05]) { rrect(z, z + 0.52, 3.35, 4.62, side, null, '#7c8489', 2.5); win(z + 0.26, 4.325, 0.24, 0.35, side); }
        // titles
        api.side(side, uvAt(-6.5, 5.02, side)[0], (-6.5 - Z0) / LEN, c => {
          c.scale(0.01, 0.01);
          c.fillStyle = accent; c.font = '800 62px system-ui, sans-serif'; c.textAlign = 'center';
          if (c.letterSpacing !== undefined) c.letterSpacing = '2px';
          c.fillText(name, 0, -5);
        });
      }
      // cargo doors on the right (forward + aft)
      rrect(-11.2, -9.4, 2.25, 3.5, 'right', cargoOpen ? '#0b0f12' : null, '#80888d', 3);
      rrect(7.2, 9.0, 2.25, 3.5, 'right', null, '#80888d', 3);
      // registration-free fleet number near the tail
      api.side('right', 0.27, (15.6 - Z0) / LEN, c => { c.scale(0.01, 0.01); c.fillStyle = '#3b4449'; c.font = '600 28px system-ui'; c.textAlign = 'center'; c.fillText('TRAINING FLEET 07', 0, 0); });
      api.side('left', 0.73, (15.6 - Z0) / LEN, c => { c.scale(0.01, 0.01); c.fillStyle = '#3b4449'; c.font = '600 28px system-ui'; c.textAlign = 'center'; c.fillText('TRAINING FLEET 07', 0, 0); });
    },
  });
  const skin = M.paintPlain.clone();
  skin.map = liv.texture;
  skin.normalMap = M.paint.normalMap; skin.normalScale = new THREE.Vector2(0.18, 0.18);
  skin.name = 'airliner-skin';
  const fuselage = mesh(body(PROFILE, { seg: 72, steps: 6 }), skin, root);
  fuselage.name = 'fuselage';
  // pass the nose-cone UV tightness: dedicated radome tint
  // wing-to-body fairing
  const fairing = sphere(root, [2.15, 1.05, 8.2], [0, 2.55, 0.2], new THREE.MeshPhysicalMaterial({ color: 0xc9cfd3, roughness: 0.35, clearcoat: 0.6 }), 40);
  fairing.name = 'fairing';

  // ---------------------------------------------------------------- wings with winglets
  const wingMat = M.wingGrey.clone();
  wingMat.map = (() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
    const x = c.getContext('2d');
    x.fillStyle = '#c3c8cb'; x.fillRect(0, 0, 1024, 1024);
    // polished leading edge (u near 0 and 1)
    x.fillStyle = '#e1e4e5'; x.fillRect(0, 0, 50, 1024); x.fillRect(974, 0, 50, 1024);
    x.strokeStyle = 'rgba(70,78,84,.55)'; x.lineWidth = 3;
    const vline = u => { x.beginPath(); x.moveTo(u * 1024, 0); x.lineTo(u * 1024, 1024); x.stroke(); };
    [0.05, 0.16, 0.29, 0.36, 0.64, 0.71, 0.84, 0.95].forEach(vline);
    // flap / spoiler / aileron segments in the rear upper surface (u 0.36..0.5)
    for (const v of [0.08, 0.3, 0.52, 0.66, 0.9]) { x.beginPath(); x.moveTo(0.29 * 1024, (1 - v) * 1024); x.lineTo(0.5 * 1024, (1 - v) * 1024); x.stroke(); x.beginPath(); x.moveTo(0.5 * 1024, (1 - v) * 1024); x.lineTo(0.71 * 1024, (1 - v) * 1024); x.stroke(); }
    x.fillStyle = 'rgba(90,98,104,.25)'; x.fillRect(0.29 * 1024, (1 - 0.66) * 1024, 0.07 * 1024, 0.58 * 1024);
    // walkway outline near the root
    x.strokeStyle = 'rgba(40,46,50,.6)'; x.lineWidth = 4; x.strokeRect(0.12 * 1024, (1 - 0.2) * 1024, 0.12 * 1024, 0.17 * 1024);
    x.save(); x.translate(0.2 * 1024, (1 - 0.1) * 1024); x.rotate(-Math.PI / 2); x.fillStyle = 'rgba(40,46,50,.8)'; x.font = '700 26px system-ui'; x.textAlign = 'center'; x.fillText('NO STEP', 0, 8); x.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  wingMat.color.set(0xffffff);
  wingMat.normalMap = null;
  for (const dir of [-1, 1]) {
    const tan = Math.tan(THREE.MathUtils.degToRad(27));
    const sec = (x, chord, th) => ({ x: dir * x, y: 2.45 + (x - 1.6) * 0.085, z: -4.6 + (x - 1.6) * tan, chord, thickness: th });
    const wing = mesh(loftWing([sec(1.2, 6.6, 0.14), sec(6.3, 4.4, 0.125), sec(11.5, 2.8, 0.11), sec(16.6, 1.55, 0.1)], { n: 44, camber: 0.025 }), wingMat, root);
    wing.name = 'wing';
    // leading-edge highlight strip
    const tip = sec(16.6, 1.55, 0.1);
    // winglet (blended sharklet)
    const wl = loftWing([0, 0.35, 1].map(t => ({ x: 0 + t * 2.35, y: 0, z: t * 1.25, chord: 1.5 - t * 0.85, thickness: 0.09 })), { n: 24, camber: 0 });
    const winglet = mesh(wl, M.navy, root);
    winglet.position.set(tip.x, tip.y, tip.z);
    winglet.rotation.z = dir > 0 ? Math.PI / 2 - 0.25 : Math.PI / 2 + 0.25;
    // flap track fairings
    for (const x of [4.2, 8.2, 11.6]) {
      const s = sec(x, 0, 0);
      const f = sphere(root, [0.18, 0.22, 1.5], [s.x, s.y - 0.22, s.z + (x < 6 ? 4.4 : x < 10 ? 3.3 : 2.4) + 0.4], wingMat, 16);
      f.name = 'flap-fairing';
    }
    // nav light
    sphere(root, [0.06, 0.06, 0.1], [tip.x + dir * 0.05, tip.y + 0.05, tip.z + 0.05], new THREE.MeshStandardMaterial({ color: dir < 0 ? 0xff3b30 : 0x30d158, emissive: dir < 0 ? 0xaa1208 : 0x0a7a34, roughness: 0.1 }), 10).castShadow = false;
  }

  // ---------------------------------------------------------------- engines (high-bypass turbofans) on pylons
  const nacelleMat = M.paintPlain.clone(); nacelleMat.color.set(0xf1f1ee);
  const lipMat = M.aluminum;
  const engines = [];
  for (const dir of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(dir * 5.75, 1.72, -6.1);
    root.add(g);
    // nacelle lathe profile along +y then rotate so axis = z
    const prof = [[0.83, -2.25], [0.98, -2.15], [1.04, -1.8], [1.06, -1.0], [1.0, 0.2], [0.86, 1.25], [0.78, 1.5]];
    const nac = mesh(lathe(prof, 48), nacelleMat, g);
    nac.rotation.x = Math.PI / 2;
    const lip = mesh(new THREE.TorusGeometry(0.9, 0.075, 16, 48), lipMat, g);
    lip.position.z = -2.22;
    // inner duct
    const duct = mesh(lathe([[0.86, -2.2], [0.82, -1.6], [0.8, -1.2]], 40), new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.5, metalness: 0.6, side: THREE.BackSide }), g);
    duct.rotation.x = Math.PI / 2;
    // fan: spinner + blades
    const fan = new THREE.Group(); fan.position.z = -1.55; g.add(fan);
    const spinner = mesh(lathe([[0, -0.45], [0.12, -0.38], [0.24, -0.18], [0.3, 0.05], [0.3, 0.1]], 32), new THREE.MeshStandardMaterial({ color: 0x1d2226, metalness: 0.8, roughness: 0.3 }), fan);
    spinner.rotation.x = Math.PI / 2;
    const bladeGeo = new THREE.BoxGeometry(0.08, 0.52, 0.015);
    bladeGeo.translate(0, 0.55, 0);
    const blades = new THREE.InstancedMesh(bladeGeo, new THREE.MeshStandardMaterial({ color: 0x8b9399, metalness: 0.9, roughness: 0.25 }), 22);
    const d = new THREE.Object3D();
    for (let i = 0; i < 22; i++) { d.rotation.set(0, 0, (i / 22) * Math.PI * 2); d.rotateY(0.55); d.updateMatrix(); blades.setMatrixAt(i, d.matrix); }
    fan.add(blades);
    const swirl = mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }), fan, { cast: false });
    swirl.position.z = -0.46;
    // core exhaust & plug
    const core = mesh(lathe([[0.62, 0], [0.55, 0.7], [0.42, 1.2]], 32), new THREE.MeshStandardMaterial({ color: 0x5f6468, metalness: 0.85, roughness: 0.4 }), g);
    core.rotation.x = Math.PI / 2; core.position.z = 1.5;
    const plug = mesh(lathe([[0.34, 0], [0.3, 0.4], [0.16, 0.8], [0.02, 1.0]], 24), new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.8, roughness: 0.5 }), g);
    plug.rotation.x = Math.PI / 2; plug.position.z = 2.6;
    // pylon
    const pyl = new THREE.Shape();
    pyl.moveTo(-1.5, 0.86); pyl.lineTo(3.1, 0.86); pyl.quadraticCurveTo(4.2, 0.92, 4.7, 1.18); pyl.lineTo(4.7, 1.34); pyl.lineTo(-0.5, 1.32); pyl.quadraticCurveTo(-1.3, 1.2, -1.5, 0.86); pyl.closePath();
    const pylon = mesh(new THREE.ExtrudeGeometry(pyl, { depth: 0.36, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3 }), nacelleMat, g);
    pylon.rotation.y = -Math.PI / 2; pylon.position.x = 0.18;
    engines.push({ group: g, fan, intake: new THREE.Vector3(dir * 5.75, 1.72, -8.4), exhaust: new THREE.Vector3(dir * 5.75, 1.72, -2.6) });
  }

  // ---------------------------------------------------------------- empennage
  for (const dir of [-1, 1]) {
    const tan = Math.tan(THREE.MathUtils.degToRad(31));
    mesh(loftWing([0.4, 6.4].map((x, i) => ({ x: dir * x, y: 4.95 + (x - 0.4) * 0.1, z: 14.9 + (x - 0.4) * tan, chord: i ? 1.4 : 3.7, thickness: 0.1 })), { n: 32, camber: 0 }), wingMat, root);
  }
  const finTex = (() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
    const x = c.getContext('2d');
    x.fillStyle = accent; x.fillRect(0, 0, 1024, 1024);
    // a stylised upward arrow mark on each side of the fin (u 0..0.5 one side, 0.5..1 the other)
    for (const [u0, flip] of [[0, false], [512, true]]) {
      x.save(); x.translate(u0 + 256, 560); if (flip) x.scale(-1, 1); x.rotate(-Math.PI / 2);
      x.fillStyle = accent2;
      x.beginPath(); x.moveTo(-260, 90); x.lineTo(150, -40); x.lineTo(120, -120); x.lineTo(270, -10); x.lineTo(140, 110); x.lineTo(150, 30); x.lineTo(-250, 140); x.closePath(); x.fill();
      x.fillStyle = '#ffffff'; x.globalAlpha = 0.9;
      x.beginPath(); x.moveTo(-220, 170); x.lineTo(160, 70); x.lineTo(155, 95); x.lineTo(-215, 195); x.closePath(); x.fill();
      x.restore();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  const finMat = M.navy.clone(); finMat.color.set(0xffffff); finMat.map = finTex;
  const finTan = Math.tan(THREE.MathUtils.degToRad(36));
  const fin = mesh(loftWing([0, 0.5, 1].map(t => ({ x: t * 6.3, y: 0, z: 13.6 + t * 6.3 * finTan, chord: 5.6 - t * 3.4, thickness: 0.11 - t * 0.02 })), { n: 36, camber: 0 }), finMat, root);
  fin.rotation.z = Math.PI / 2;
  fin.position.set(0, 5.2, 0);
  fin.name = 'fin';
  // dorsal fillet
  sphere(root, [0.22, 0.6, 3.2], [0, 6.0, 12.6], skin, 20).name = 'dorsal';

  // ---------------------------------------------------------------- landing gear
  const tireMat = M.rubber, hubMat = M.aluminum;
  const wheel = (parent, x, y, z, r, w) => {
    const t = mesh(new THREE.CylinderGeometry(r, r, w, 36), tireMat, parent); t.rotation.z = Math.PI / 2; t.position.set(x, y, z);
    const sidewall = mesh(new THREE.TorusGeometry(r * 0.92, w * 0.32, 10, 36), tireMat, parent); sidewall.rotation.y = Math.PI / 2; sidewall.position.set(x, y, z);
    const hub = mesh(new THREE.CylinderGeometry(r * 0.56, r * 0.56, w * 1.04, 28), hubMat, parent); hub.rotation.z = Math.PI / 2; hub.position.set(x, y, z);
    const cap = mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, w * 1.1, 16), M.steel, parent); cap.rotation.z = Math.PI / 2; cap.position.set(x, y, z);
  };
  const gear = new THREE.Group(); root.add(gear);
  // nose gear
  rod(gear, [0, 2.1, -13.6], [0, 0.42, -13.75], 0.11, M.paintPlain);
  rod(gear, [0, 1.0, -13.7], [0, 0.45, -13.75], 0.14, M.steel);
  rod(gear, [0, 1.8, -13.0], [0, 0.9, -13.7], 0.05, M.steel);
  wheel(gear, -0.27, 0.38, -13.75, 0.38, 0.24); wheel(gear, 0.27, 0.38, -13.75, 0.38, 0.24);
  box(gear, [0.6, 0.06, 0.6], [0, 0.82, -13.75], M.darkMetal);
  // main gear
  const mains = [];
  for (const dir of [-1, 1]) {
    const x = dir * 3.8;
    rod(gear, [x, 2.45, 1.4], [x, 0.6, 1.6], 0.16, M.paintPlain);
    rod(gear, [x, 1.3, 1.55], [x, 0.58, 1.6], 0.19, M.steel);
    rod(gear, [x, 2.3, 0.3], [x, 1.2, 1.5], 0.07, M.steel);
    rod(gear, [x - 0.55, 0.58, 1.6], [x + 0.55, 0.58, 1.6], 0.09, M.steel);
    wheel(gear, x - 0.42, 0.58, 1.6, 0.58, 0.38); wheel(gear, x + 0.42, 0.58, 1.6, 0.58, 0.38);
    // gear door
    box(gear, [0.04, 1.4, 1.2], [x + dir * 0.35, 1.7, 1.1], M.paintPlain);
    mains.push(new THREE.Vector3(x, 0, 1.6));
  }

  // ---------------------------------------------------------------- details: beacons, antennas, APU, probes
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff1a0a, emissiveIntensity: 0.6, roughness: 0.2 });
  const beacons = [sphere(root, [0.09, 0.06, 0.12], [0, CY + RY + 0.02, -1.5], beaconMat, 12), sphere(root, [0.09, 0.06, 0.12], [0, CY - RY - 0.02, -3.5], beaconMat, 12)];
  for (const [z, y, h] of [[-6, CY + RY, 0.45], [2.5, CY + RY, 0.3], [-10, CY - RY, -0.3]]) {
    const a = new THREE.Shape(); a.moveTo(0, 0); a.lineTo(0.35, 0); a.lineTo(0.28, Math.abs(h)); a.lineTo(0.12, Math.abs(h)); a.closePath();
    const m = mesh(new THREE.ExtrudeGeometry(a, { depth: 0.03, bevelEnabled: false }), M.plasticGrey, root);
    m.rotation.y = -Math.PI / 2; m.position.set(0.015, y, z); if (h < 0) m.scale.y = -1;
  }
  cyl(root, 0.2, 0.22, 0.4, [0, 5.3, 20.3], M.darkMetal, [Math.PI / 2, 0, 0], 20); // APU exhaust
  for (const dir of [-1, 1]) rod(root, [dir * 1.15, 3.6, -16.6], [dir * 1.35, 3.55, -16.75], 0.02, M.aluminum); // pitot probes

  // ---------------------------------------------------------------- open forward cargo door (right side)
  let cargoDoor = null;
  if (cargoOpen) {
    const hinge = new THREE.Group();
    hinge.position.set(RX * Math.sin(Math.acos((CY - 3.5) / RY)) + 0.02, 3.5, -10.3);
    root.add(hinge);
    cargoDoor = box(hinge, [0.08, 1.25, 1.8], [0.45, 0.55, 0], M.paintPlain);
    cargoDoor.rotation.z = -1.05;
    cargoDoor.position.set(0.3, 0.3, 0);
    box(hinge, [0.05, 0.9, 0.06], [0.2, 0.2, 0.8], M.steel).rotation.z = -0.9;
  }

  contactShadow(root, 40, 44, [0, 0, 0], 0.42);
  contactShadow(root, 4.5, 4, [0, 0, -13.75], 0.55);
  for (const dir of [-1, 1]) contactShadow(root, 3.2, 3.2, [dir * 3.8, 0, 1.6], 0.65);

  return {
    root, engines, mains, fuselage, skin,
    nose: new THREE.Vector3(0, 0, -18.3),
    noseGear: new THREE.Vector3(0, 0, -13.75),
    doorL1: new THREE.Vector3(-RX, 3.05, -13.9),
    cargoFwd: new THREE.Vector3(RX + 0.1, 2.25, -10.3),
    cargoAft: new THREE.Vector3(RX + 0.1, 2.25, 8.1),
    wingtips: [new THREE.Vector3(-17.1, 3.8, 3.5), new THREE.Vector3(17.1, 3.8, 3.5)],
    tail: new THREE.Vector3(0, 5.3, 20.2),
    beacons,
    setBeacon(on) { beaconMat.emissiveIntensity = on ? 2.5 : 0.4; },
  };
}

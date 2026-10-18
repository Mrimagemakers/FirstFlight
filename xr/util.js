// Shared geometry, material and texture helpers for the First Flight XR lab.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { mergeGeometries };

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Create a mesh, add it to a parent, enable shadows. */
export function mesh(geometry, material, parent, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (parent) parent.add(m);
  return m;
}

export function box(parent, size, pos, mat, rot) {
  const m = mesh(new THREE.BoxGeometry(...size), mat, parent);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return m;
}

export function roundedBox(w, h, d, r = 0.05, seg = 3) {
  // A box with bevelled vertical edges, extruded from a rounded rectangle.
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3);
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * Math.min(r, d / 3), bevelEnabled: true, bevelSize: Math.min(r, d / 3), bevelThickness: Math.min(r, d / 3), bevelSegments: seg, curveSegments: seg * 2 });
  g.center();
  g.computeVertexNormals();
  return g;
}

export function cyl(parent, rTop, rBottom, h, pos, mat, rot, seg = 24) {
  const m = mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat, parent);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return m;
}

/** A cylinder spanning two points. */
export function rod(parent, a, b, r, mat, seg = 12) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const m = mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg), mat, parent);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

export function tube(parent, points, r, mat, seg = 6) {
  const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(c, Math.max(16, points.length * 10), r, seg, false), mat, parent);
}

export function sphere(parent, scale, pos, mat, seg = 24) {
  const m = mesh(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.66)), mat, parent);
  m.scale.set(...scale);
  m.position.set(...pos);
  return m;
}

/** Lathe around Y from [radius,y] pairs. */
export function lathe(points, seg = 32) {
  return new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), seg);
}

/** NACA 4-digit symmetric-ish airfoil, with camber. Returns closed loop of [x(chord 0..1), y]. */
export function airfoil(n = 40, thickness = 0.12, camber = 0.03) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const t = (1 - Math.cos(a)) / 2; // 0 -> 1 -> 0
    const th = 5 * thickness * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1015 * t ** 4);
    const c = camber * Math.sin(Math.PI * t);
    pts.push([t, c + (a <= Math.PI ? th : -th)]);
  }
  return pts;
}

/**
 * Loft a wing between sections. Each section: {x (spanwise), y, z (leading edge), chord, thickness, twist}.
 * Chord runs along +z (towards tail). Produces UVs u=around the foil, v=span. Sections must progress along x.
 */
export function loftWing(sections, { n = 36, camber = 0.03, cap = true } = {}) {
  const pos = [], uv = [], idx = [];
  const foil = airfoil(n, 1, camber);
  const dir = Math.sign(sections[sections.length - 1].x - sections[0].x) || 1;
  const point = (s, t, y) => {
    const tw = s.twist || 0;
    const zc = t * s.chord, yc = y * s.chord * (s.thickness || 0.12);
    return [s.x, s.y + yc * Math.cos(tw) + zc * Math.sin(tw), s.z + zc * Math.cos(tw) - yc * Math.sin(tw)];
  };
  sections.forEach((s, j) => {
    foil.forEach(([t, y], i) => {
      pos.push(...point(s, t, y));
      uv.push(i / n, j / (sections.length - 1));
      if (j < sections.length - 1 && i < n) {
        const k = j * (n + 1) + i;
        if (dir > 0) idx.push(k, k + 1, k + n + 1, k + 1, k + n + 2, k + n + 1);
        else idx.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2);
      }
    });
  });
  if (cap) {
    for (const [j, side] of [[0, -dir], [sections.length - 1, dir]]) {
      const s = sections[j];
      const base = pos.length / 3;
      pos.push(...point(s, 0.4, 0));
      uv.push(0.5, j ? 1 : 0);
      foil.forEach(([t, y]) => { pos.push(...point(s, t, y)); uv.push(0.5, j ? 1 : 0); });
      for (let i = 0; i < n; i++) {
        // the foil loop runs upper LE->TE then lower TE->LE; viewed from +x that is clockwise in (z,y)
        if (side > 0) idx.push(base, base + 1 + i + 1, base + 1 + i);
        else idx.push(base, base + 1 + i, base + 1 + i + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld the leading-edge seam normals so the nose of the airfoil shades smoothly
  const nrm = g.attributes.normal;
  for (let j = 0; j < sections.length; j++) {
    const a = j * (n + 1), b = a + n;
    const v = new THREE.Vector3(nrm.getX(a) + nrm.getX(b), nrm.getY(a) + nrm.getY(b), nrm.getZ(a) + nrm.getZ(b)).normalize();
    nrm.setXYZ(a, v.x, v.y, v.z); nrm.setXYZ(b, v.x, v.y, v.z);
  }
  if (cap) {
    // caps get flat normals
    const total = pos.length / 3;
    const capStart = sections.length * (n + 1);
    for (let i = capStart; i < total; i++) {
      const firstCap = i < capStart + n + 2;
      const side = firstCap ? -dir : dir;
      nrm.setXYZ(i, side, 0, 0);
    }
  }
  return g;
}

/**
 * Fuselage-style body: sweep an ellipse along z. profile: [[z, halfWidth, halfHeight, centreY], ...].
 * UV: u around circumference (0 at bottom, 0.5 top), v along length (0 nose).
 */
export function body(profile, { seg = 48, steps = 4 } = {}) {
  // densify profile with Catmull-Rom interpolation
  const dense = [];
  for (let j = 0; j < profile.length - 1; j++) {
    const p0 = profile[Math.max(0, j - 1)], p1 = profile[j], p2 = profile[j + 1], p3 = profile[Math.min(profile.length - 1, j + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      dense.push(p1.map((_, k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  dense.push(profile[profile.length - 1]);
  const z0 = dense[0][0], z1 = dense[dense.length - 1][0];
  const pos = [], uv = [], idx = [];
  dense.forEach(([z, rx, ry, cy], j) => {
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      // a = 0 at bottom, going up the left (-x) side? use -sin for x so u increases on +x side first
      pos.push(Math.sin(a) * Math.max(rx, 1e-4), cy - Math.cos(a) * Math.max(ry, 1e-4), z);
      uv.push(i / seg, (z - z0) / (z1 - z0));
      if (j < dense.length - 1 && i < seg) {
        const k = j * (seg + 1) + i;
        idx.push(k, k + 1, k + seg + 1, k + 1, k + seg + 2, k + seg + 1);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Canvas helper returning {canvas, ctx, texture}. */
export function canvasTexture(w, h, draw, { srgb = true, repeat, anisotropy = 8 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw?.(ctx, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  if (repeat) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(...repeat); }
  return { canvas, ctx, texture };
}

/** Soft radial gradient texture used for contact shadows and glows. */
let _blob;
export function blobTexture() {
  if (_blob) return _blob;
  _blob = canvasTexture(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  }, { srgb: false }).texture;
  return _blob;
}

/** Ambient-occlusion style soft shadow decal on the ground. */
export function contactShadow(parent, w, d, pos, opacity = 0.55) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos[0], pos[1] + 0.012, pos[2]);
  m.renderOrder = 1;
  parent.add(m);
  return m;
}

/** Deterministic pseudo random. */
export function rand(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Wrap text to lines for canvas drawing. */
export function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  });
}

/** Simple value noise for terrain and scatter. */
export function noise2(x, z) {
  let total = 0, amp = 1;
  for (let o = 0; o < 5; o++) {
    total += (Math.sin(x * 1.7 + Math.cos(z * 0.7)) * Math.cos(z * 1.3 + Math.sin(x * 0.9))) * amp;
    x = x * 2.03 + 4.7; z = z * 2.07 - 3.2; amp *= 0.48;
  }
  return total / 1.9;
}

export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const smooth = THREE.MathUtils.smoothstep;
export const deg = THREE.MathUtils.degToRad;

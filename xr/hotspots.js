// Floating, camera-facing hotspot markers that work with mouse, touch and XR controller rays.
import * as THREE from 'three';

const STYLE = {
  info: { fill: '#1d6f86', glyph: 'i' },
  scenario: { fill: '#d39a3d', glyph: '?' },
  warn: { fill: '#c2463a', glyph: '!' },
  step: { fill: '#173a52', glyph: '' },
  done: { fill: '#2f8f5b', glyph: '✓' },
  tool: { fill: '#6b4fa3', glyph: '⚙' },
};

const iconCache = new Map();
function iconTexture(kind, text = '') {
  const key = kind + '|' + text;
  if (iconCache.has(key)) return iconCache.get(key);
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const x = c.getContext('2d');
  const st = STYLE[kind] || STYLE.info;
  x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 10;
  x.beginPath(); x.arc(64, 64, 46, 0, Math.PI * 2); x.fillStyle = st.fill; x.fill();
  x.shadowBlur = 0;
  x.lineWidth = 6; x.strokeStyle = '#fffaf0'; x.stroke();
  x.fillStyle = '#fffaf0';
  x.font = `700 ${text.length > 1 ? 44 : 56}px system-ui, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text || st.glyph, 64, 67);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  iconCache.set(key, t);
  return t;
}

let ringTex;
function ringTexture() {
  if (ringTex) return ringTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.lineWidth = 6; x.strokeStyle = 'rgba(255,240,210,.9)'; x.stroke();
  ringTex = new THREE.CanvasTexture(c); ringTex.colorSpace = THREE.SRGBColorSpace;
  return ringTex;
}

function labelTexture(text) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  x.font = '600 34px system-ui, sans-serif';
  const w = Math.ceil(x.measureText(text).width) + 44;
  c.width = w; c.height = 64;
  x.font = '600 34px system-ui, sans-serif';
  x.fillStyle = 'rgba(14,26,36,.88)';
  x.beginPath(); x.roundRect(0, 4, w, 56, 28); x.fill();
  x.fillStyle = '#fff6e6'; x.textBaseline = 'middle'; x.fillText(text, 22, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { texture: t, aspect: w / 64 };
}

export class Hotspots {
  constructor(lab) {
    this.lab = lab;
    this.group = new THREE.Group();
    this.group.name = 'hotspots';
    lab.scene.add(this.group);
    this.items = new Map();
    this.hovered = null;
    this.time = 0;
  }

  add({ id, position, kind = 'info', text = '', label = '', onSelect, size = 1, alwaysLabel = false, visible = true }) {
    this.remove(id);
    const root = new THREE.Group();
    root.position.copy(position);
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(kind, text), depthTest: false, transparent: true }));
    icon.renderOrder = 50;
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(), depthTest: false, transparent: true, opacity: 0.6 }));
    ring.renderOrder = 49;
    root.add(ring, icon);
    let tag = null;
    if (label) {
      const l = labelTexture(label);
      tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: l.texture, depthTest: false, transparent: true }));
      tag.userData.aspect = l.aspect;
      tag.renderOrder = 51;
      tag.center.set(0, 0.5);
      tag.visible = alwaysLabel;
      root.add(tag);
    }
    root.visible = visible;
    icon.userData.hotspot = id;
    this.group.add(root);
    const item = { id, root, icon, ring, tag, kind, text, onSelect, size, alwaysLabel, phase: Math.random() * 6 };
    this.items.set(id, item);
    return item;
  }

  setKind(id, kind, text) {
    const it = this.items.get(id);
    if (!it) return;
    it.kind = kind;
    if (text !== undefined) it.text = text;
    it.icon.material.map = iconTexture(kind, it.text);
    it.icon.material.needsUpdate = true;
  }

  setVisible(id, v) { const it = this.items.get(id); if (it) it.root.visible = v; }

  remove(id) {
    const it = this.items.get(id);
    if (!it) return;
    this.group.remove(it.root);
    it.tag?.material.map.dispose();
    this.items.delete(id);
  }

  clear() { [...this.items.keys()].forEach(id => this.remove(id)); this.hovered = null; }

  sprites() { return [...this.items.values()].filter(i => i.root.visible).map(i => i.icon); }

  pick(raycaster) {
    const hit = raycaster.intersectObjects(this.sprites(), false)[0];
    if (!hit) return false;
    const it = this.items.get(hit.object.userData.hotspot);
    it?.onSelect?.(it);
    return true;
  }

  /** Highlight what the ray points at. Returns hit distance (for XR ray length) when asked. */
  hover(raycaster, wantDistance = false) {
    const hit = raycaster.intersectObjects(this.sprites(), false)[0];
    const id = hit?.object.userData.hotspot || null;
    if (this.hovered !== id) {
      if (this.hovered && this.items.get(this.hovered)?.tag && !this.items.get(this.hovered).alwaysLabel) this.items.get(this.hovered).tag.visible = false;
      this.hovered = id;
      if (id && this.items.get(id)?.tag) this.items.get(id).tag.visible = true;
    }
    return wantDistance ? (hit ? hit.distance : null) : !!id;
  }

  update(dt) {
    this.time += dt;
    const cam = this.lab.renderer.xr.isPresenting ? this.lab.renderer.xr.getCamera() : this.lab.camera;
    const camPos = new THREE.Vector3();
    cam.getWorldPosition(camPos);
    const xr = this.lab.renderer.xr.isPresenting;
    for (const it of this.items.values()) {
      if (!it.root.visible) continue;
      const d = camPos.distanceTo(it.root.position);
      // roughly constant on-screen size, clamped so markers stay readable in VR
      const s = THREE.MathUtils.clamp(d * (xr ? 0.05 : 0.042), 0.09, 2.2) * it.size * (this.hovered === it.id ? 1.25 : 1);
      it.icon.scale.setScalar(s);
      const pulse = (this.time * 0.8 + it.phase) % 1;
      it.ring.scale.setScalar(s * (1 + pulse * 0.9));
      it.ring.material.opacity = (1 - pulse) * (it.kind === 'done' ? 0.15 : 0.7);
      it.icon.position.y = Math.sin(this.time * 2 + it.phase) * s * 0.06;
      if (it.tag) {
        it.tag.scale.set(s * 0.55 * it.tag.userData.aspect, s * 0.55, 1);
        it.tag.position.set(s * 0.6, it.icon.position.y, 0);
      }
    }
  }
}

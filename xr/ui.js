// DOM overlay for desktop/mobile plus a mirrored, ray-clickable panel for VR headsets.
import * as THREE from 'three';
import { wrapText } from './util.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UI {
  constructor() {
    this.content = {};
    this.tabs = [];
    this.vr = new VRPanel(this);
    $('panelToggle')?.addEventListener('click', () => document.body.classList.toggle('panel-collapsed'));
  }

  attach(lab) {
    this.lab = lab;
    this.vr.attach(lab);
  }

  setTabs(list) {
    this.tabs = list;
    $('tabs').innerHTML = list.map(t => `<button data-key="${t.key}" title="${esc(t.title)}"><b>${esc(t.num)}</b> ${esc(t.short)}</button>`).join('');
    $('tabs').querySelectorAll('button').forEach(b => (b.onclick = () => this.lab.go(b.dataset.key)));
    this.vr.dirty = true;
  }

  setStation(key) {
    this.station = key;
    $('tabs').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.key === key));
    document.body.dataset.station = key;
    this.vr.dirty = true;
  }

  /**
   * content: { tag, title, text, html, buttons:[{label,onClick,primary,on}], progress:{value,max,label}, foot, tone }
   */
  setPanel(content) {
    this.content = content;
    const p = $('panel');
    p.dataset.tone = content.tone || '';
    $('pTag').textContent = content.tag || '';
    $('pTitle').textContent = content.title || '';
    $('pText').innerHTML = content.html || (content.text ? `<p>${esc(content.text)}</p>` : '');
    const acts = $('pActions');
    acts.innerHTML = '';
    (content.buttons || []).forEach(b => {
      const el = document.createElement('button');
      el.textContent = b.label;
      if (b.primary) el.className = 'primary';
      if (b.on) el.classList.add('on');
      if (b.disabled) el.disabled = true;
      el.onclick = () => b.onClick?.();
      acts.append(el);
    });
    const pr = content.progress;
    $('pProgress').hidden = !pr;
    if (pr) {
      $('pProgress').querySelector('i').style.width = `${Math.round((pr.value / Math.max(1, pr.max)) * 100)}%`;
      $('pProgress').querySelector('span').textContent = pr.label || `${pr.value} / ${pr.max}`;
    }
    $('pFoot').textContent = content.foot || '';
    document.body.classList.remove('panel-collapsed');
    this.vr.dirty = true;
  }

  setHint(text) { $('hint').textContent = text || ''; }

  toast(text, tone = '') {
    const t = $('toast');
    t.textContent = text;
    t.dataset.tone = tone;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
    this.vr.flash(text);
  }

  loading(on, text) {
    const l = $('loading');
    if (text) $('ldText').textContent = text;
    l.classList.toggle('show', on);
  }

  onXR(active, mode) {
    $('vrBtn').textContent = active && mode === 'immersive-vr' ? 'Exit VR' : 'Enter VR';
    $('arBtn').textContent = active && mode === 'immersive-ar' ? 'Exit AR' : 'View in your space';
  }
}

/** A canvas-texture panel that floats near the VR user and mirrors the side panel. */
class VRPanel {
  constructor(ui) {
    this.ui = ui;
    this.W = 1024; this.H = 1240;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    const w = 0.62, h = w * this.H / this.W;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: true, toneMapped: false }));
    this.mesh.renderOrder = 60;
    this.mesh.visible = false;
    this.rects = [];
    this.dirty = true;
    this.hoverIndex = -1;
    this.flashText = '';
    this.flashTime = 0;
  }

  attach(lab) {
    this.lab = lab;
    lab.rig.add(this.mesh);
  }

  visible(v) { this.mesh.visible = v; if (v) this.summon(); }

  /** Place the panel in front of, and slightly left of, the user's gaze. */
  summon() {
    const lab = this.lab;
    if (!lab?.renderer.xr.isPresenting) return;
    const cam = lab.renderer.xr.getCamera();
    const head = new THREE.Vector3(); cam.getWorldPosition(head);
    const q = new THREE.Quaternion(); cam.getWorldQuaternion(q);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q); fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.38);
    const world = head.clone().addScaledVector(fwd, 0.72); world.y = head.y - 0.12;
    const local = lab.rig.worldToLocal(world.clone());
    this.mesh.position.copy(local);
    const lookLocal = lab.rig.worldToLocal(head.clone());
    this.mesh.lookAt(lab.rig.localToWorld(lookLocal.clone()));
    // lookAt on a child uses world coordinates; compensate for rig rotation
    this.mesh.quaternion.premultiply(lab.rig.quaternion.clone().invert());
    this.mesh.updateMatrixWorld();
  }

  flash(text) { this.flashText = text; this.flashTime = 2.6; this.dirty = true; }

  draw() {
    const x = this.ctx, W = this.W, H = this.H, c = this.ui.content || {};
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(14,27,37,0.94)';
    x.beginPath(); x.roundRect(0, 0, W, H, 36); x.fill();
    x.strokeStyle = 'rgba(232,196,130,0.5)'; x.lineWidth = 3; x.stroke();
    this.rects = [];
    // station tabs
    const tabs = this.ui.tabs;
    const tw = (W - 48 - (tabs.length - 1) * 8) / Math.max(1, tabs.length);
    tabs.forEach((t, i) => {
      const r = { x: 24 + i * (tw + 8), y: 24, w: tw, h: 70, action: () => this.lab.go(t.key) };
      const active = t.key === this.ui.station;
      x.fillStyle = active ? '#d6a75f' : (this.hoverIndex === this.rects.length ? '#2c4c60' : '#1d3445');
      x.beginPath(); x.roundRect(r.x, r.y, r.w, r.h, 14); x.fill();
      x.fillStyle = active ? '#13212b' : '#e8eef0';
      x.font = '700 22px system-ui'; x.textAlign = 'center';
      x.fillText(t.num, r.x + r.w / 2, r.y + 30);
      x.font = '500 19px system-ui';
      x.fillText(t.short.slice(0, 11), r.x + r.w / 2, r.y + 56);
      this.rects.push(r);
    });
    x.textAlign = 'left';
    let y = 150;
    x.fillStyle = '#e0b16c'; x.font = '700 24px system-ui';
    x.fillText((c.tag || '').toUpperCase(), 48, y);
    y += 58;
    x.fillStyle = '#ffffff'; x.font = '600 50px system-ui';
    wrapText(x, c.title || '', W - 96).slice(0, 2).forEach(l => { x.fillText(l, 48, y); y += 58; });
    y += 8;
    x.fillStyle = '#c4d3d8'; x.font = '400 30px system-ui';
    const text = c.vrText || c.text || (c.html ? c.html.replace(/<li>/g, '• ').replace(/<\/li>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    const lines = wrapText(x, text, W - 96);
    const buttons = c.buttons || [];
    const rows = Math.ceil(buttons.length / 2);
    const maxLines = Math.max(3, Math.floor((H - y - rows * 92 - 150) / 40));
    lines.slice(0, maxLines).forEach((l, i) => { x.fillText(i === maxLines - 1 && lines.length > maxLines ? l + ' …' : l, 48, y); y += 40; });
    // buttons
    const by = H - 140 - rows * 92;
    buttons.forEach((b, i) => {
      const bw = (W - 96 - 16) / 2;
      const r = { x: 48 + (i % 2) * (bw + 16), y: by + Math.floor(i / 2) * 92, w: bw, h: 76, action: b.disabled ? null : b.onClick };
      const hover = this.hoverIndex === this.rects.length;
      x.fillStyle = b.primary ? (hover ? '#f0c27c' : '#d6a75f') : b.on ? '#3f6b55' : (hover ? '#33566b' : '#22394a');
      x.beginPath(); x.roundRect(r.x, r.y, r.w, r.h, 16); x.fill();
      x.fillStyle = b.primary ? '#13212b' : '#f2f5f5';
      x.font = '600 26px system-ui'; x.textAlign = 'center';
      const label = wrapText(x, b.label, r.w - 24);
      label.slice(0, 2).forEach((l, k) => x.fillText(l, r.x + r.w / 2, r.y + (label.length > 1 ? 32 + k * 30 : 47)));
      x.textAlign = 'left';
      this.rects.push(r);
    });
    // progress
    if (c.progress) {
      const p = c.progress, py = H - 112;
      x.fillStyle = '#20374a'; x.beginPath(); x.roundRect(48, py, W - 96, 16, 8); x.fill();
      x.fillStyle = '#7fd0a8'; x.beginPath(); x.roundRect(48, py, (W - 96) * Math.min(1, p.value / Math.max(1, p.max)), 16, 8); x.fill();
      x.fillStyle = '#c4d3d8'; x.font = '400 24px system-ui'; x.fillText(p.label || `${p.value} / ${p.max}`, 48, py + 50);
    }
    x.fillStyle = '#7f98a2'; x.font = '400 20px system-ui'; x.textAlign = 'right';
    x.fillText("Trigger: select · Grip: bring panel · Right stick: teleport / turn", W - 40, H - 16);
    x.textAlign = 'left';
    if (this.flashTime > 0 && this.flashText) {
      x.fillStyle = 'rgba(214,167,95,0.97)';
      x.beginPath(); x.roundRect(24, 108, W - 48, 64, 14); x.fill();
      x.fillStyle = '#13212b'; x.font = '600 27px system-ui';
      x.fillText(wrapText(x, this.flashText, W - 96)[0] || '', 48, 150);
    }
    this.texture.needsUpdate = true;
    this.dirty = false;
  }

  uvToIndex(uv) {
    const px = uv.x * this.W, py = (1 - uv.y) * this.H;
    return this.rects.findIndex(r => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
  }

  hit(raycaster) {
    if (!this.mesh.visible) return null;
    const h = raycaster.intersectObject(this.mesh, false)[0];
    const idx = h ? this.uvToIndex(h.uv) : -1;
    if (idx !== this.hoverIndex) { this.hoverIndex = idx; this.dirty = true; }
    return h ? h.distance : null;
  }

  pick(raycaster) {
    if (!this.mesh.visible) return false;
    const h = raycaster.intersectObject(this.mesh, false)[0];
    if (!h) return false;
    const idx = this.uvToIndex(h.uv);
    if (idx >= 0) this.rects[idx].action?.();
    return true;
  }

  update(dt) {
    if (this.flashTime > 0) { this.flashTime -= dt; if (this.flashTime <= 0) this.dirty = true; }
    if (this.mesh.visible && this.dirty) this.draw();
  }
}

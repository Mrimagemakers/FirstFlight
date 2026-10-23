// DOM overlay for desktop/mobile plus a mirrored, ray-clickable panel for VR headsets.
import * as THREE from 'three';
import { wrapText } from './util.js';
import { settings, setSetting, onSettings } from './settings.js';

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
    if (this.vr.lastTitle !== content.title) { this.vr.textPage = 0; this.vr.btnPage = 0; this.vr.lastTitle = content.title; }
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

/**
 * The VR menu: a ray-clickable canvas panel. By default it rides on the left controller like a tablet
 * (X shows/hides it, Y opens Stations); it can also float in front of the player (grip brings it back).
 * Pages: Lesson (mirrors the side panel, with paging), Stations, Comfort, plus Exit VR.
 */
const TAB_H = 84, PAD = 40;
class VRPanel {
  constructor(ui) {
    this.ui = ui;
    this.W = 1024; this.H = 1280;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, this.H / this.W), new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: true, toneMapped: false }));
    this.mesh.renderOrder = 60;
    this.mesh.visible = false;
    this.rects = [];
    this.dirty = true;
    this.hoverIndex = -1;
    this.flashText = '';
    this.flashTime = 0;
    this.page = 'lesson';
    this.textPage = 0;
    this.btnPage = 0;
    this.shown = true;      // the player's show/hide choice (X button)
    this.handAnchor = null; // left controller grip, when available
  }

  attach(lab) {
    this.lab = lab;
    lab.rig.add(this.mesh);
    onSettings(k => { if (k === 'panelMode') this.place(); this.dirty = true; });
  }

  get inHand() { return settings.panelMode !== 'float' && !!this.handAnchor; }

  /** Called by the XR controls when the left controller (grip space) connects or disconnects. */
  setHandAnchor(grip) { this.handAnchor = grip; this.place(); }

  visible(v) {
    if (v) { this.shown = true; this.page = 'lesson'; }
    this.mesh.visible = v && this.shown;
    if (v) this.place();
  }

  toggle(page) {
    if (!this.lab?.renderer.xr.isPresenting) return;
    if (page && (!this.mesh.visible || this.page !== page)) { this.page = page; this.shown = true; this.mesh.visible = true; this.place(); }
    else { this.shown = !this.mesh.visible; this.mesh.visible = this.shown; if (this.shown) this.place(); }
    this.dirty = true;
  }

  /** Put the panel on the left hand, or in front of the player's gaze. */
  place() {
    if (this.inHand) {
      if (this.mesh.parent !== this.handAnchor) this.handAnchor.add(this.mesh);
      const w = 0.3;
      this.mesh.scale.setScalar(w);
      this.mesh.position.set(0.03, 0.2, -0.04);
      this.mesh.rotation.set(-0.62, 0.28, 0, 'YXZ');
    } else {
      if (this.mesh.parent !== this.lab.rig) this.lab.rig.add(this.mesh);
      this.mesh.scale.setScalar(0.66);
      this.summon(true);
    }
    this.dirty = true;
  }

  /** Floating mode: place the panel in front of, and slightly left of, the user's gaze. */
  summon(force = false) {
    const lab = this.lab;
    if (!lab?.renderer.xr.isPresenting) return;
    if (this.inHand && !force) { this.toggle(); return; }
    if (this.inHand) return;
    if (!this.mesh.visible && this.shown) this.mesh.visible = true;
    const cam = lab.renderer.xr.getCamera();
    const head = new THREE.Vector3(); cam.getWorldPosition(head);
    const q = new THREE.Quaternion(); cam.getWorldQuaternion(q);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q); fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.3);
    const world = head.clone().addScaledVector(fwd, 0.8); world.y = head.y - 0.1;
    this.mesh.position.copy(lab.rig.worldToLocal(world.clone()));
    this.mesh.lookAt(head);
    this.mesh.quaternion.premultiply(lab.rig.getWorldQuaternion(new THREE.Quaternion()).invert());
    this.mesh.updateMatrixWorld();
  }

  flash(text) { this.flashText = text; this.flashTime = 2.6; this.dirty = true; }

  // ---------------------------------------------------------------- drawing helpers
  button(r, label, { primary = false, on = false, danger = false, size = 30, sub = '' } = {}) {
    const x = this.ctx, hover = this.hoverIndex === this.rects.length;
    x.fillStyle = primary ? (hover ? '#f3c983' : '#d6a75f') : danger ? (hover ? '#9b4a40' : '#7a3b33') : on ? (hover ? '#4d8166' : '#3f6b55') : (hover ? '#36596f' : '#22394a');
    x.beginPath(); x.roundRect(r.x, r.y, r.w, r.h, 18); x.fill();
    if (hover) { x.strokeStyle = '#f2d39d'; x.lineWidth = 4; x.stroke(); }
    x.fillStyle = primary ? '#13212b' : '#f2f5f5';
    x.textAlign = 'center';
    x.font = `600 ${size}px system-ui`;
    const lines = wrapText(x, label, r.w - 28).slice(0, 2);
    const lh = size * 1.15, top = r.y + r.h / 2 - ((lines.length - 1) * lh) / 2 + size * 0.36 - (sub ? 14 : 0);
    lines.forEach((l, k) => x.fillText(l, r.x + r.w / 2, top + k * lh));
    if (sub) { x.font = '400 22px system-ui'; x.fillStyle = primary ? '#3a2c12' : '#a9bcc4'; x.fillText(sub, r.x + r.w / 2, top + lines.length * lh + 4); }
    x.textAlign = 'left';
    this.rects.push(r);
  }

  draw() {
    const x = this.ctx, W = this.W, H = this.H;
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(12,24,33,0.95)';
    x.beginPath(); x.roundRect(0, 0, W, H, 40); x.fill();
    x.strokeStyle = 'rgba(232,196,130,0.55)'; x.lineWidth = 4; x.stroke();
    this.rects = [];
    // top tabs
    const tabs = [['lesson', 'Lesson'], ['stations', 'Stations'], ['comfort', 'Comfort'], ['exit', 'Exit VR']];
    const tw = (W - PAD * 2 - 3 * 12) / 4;
    tabs.forEach(([k, t], i) => {
      const r = { x: PAD + i * (tw + 12), y: 24, w: tw, h: TAB_H, action: () => { if (k === 'exit') this.lab.renderer.xr.getSession()?.end(); else { this.page = k; this.dirty = true; } } };
      this.button(r, t, { primary: this.page === k, danger: k === 'exit', size: 30 });
    });
    if (this.page === 'stations') this.drawStations();
    else if (this.page === 'comfort') this.drawComfort();
    else this.drawLesson();
    // footer: controller reminder
    x.fillStyle = '#8fa6b0'; x.font = '400 23px system-ui'; x.textAlign = 'center';
    const flight = this.ui.station === 'flight';
    x.fillText(flight ? 'Left stick: fly · Right stick: power · A: engine · B: recenter · X: menu' : 'Trigger: select · Right stick: teleport & turn · X: menu · Y: stations', W / 2, H - 24);
    x.textAlign = 'left';
    if (this.flashTime > 0 && this.flashText) {
      x.fillStyle = 'rgba(214,167,95,0.98)';
      x.beginPath(); x.roundRect(PAD - 16, 124, W - PAD * 2 + 32, 76, 16); x.fill();
      x.fillStyle = '#13212b'; x.font = '600 30px system-ui';
      x.fillText(wrapText(x, this.flashText, W - PAD * 2)[0] || '', PAD + 8, 172);
    }
    this.texture.needsUpdate = true;
    this.dirty = false;
  }

  drawLesson() {
    const x = this.ctx, W = this.W, H = this.H, c = this.ui.content || {};
    let y = 160;
    x.fillStyle = '#e0b16c'; x.font = '700 25px system-ui';
    x.fillText((c.tag || '').toUpperCase(), PAD, y);
    y += 60;
    x.fillStyle = '#ffffff'; x.font = '600 48px system-ui';
    wrapText(x, c.title || '', W - PAD * 2).slice(0, 2).forEach(l => { x.fillText(l, PAD, y); y += 56; });
    y += 6;
    // buttons: up to 6 per page, 2 columns (3 when there are many)
    const all = c.buttons || [];
    const per = 6, bp = Math.ceil(all.length / per);
    if (this.btnPage >= bp) this.btnPage = 0;
    const btns = all.slice(this.btnPage * per, this.btnPage * per + per);
    const rows = Math.ceil(btns.length / 2) + (bp > 1 ? 0 : 0);
    const btnTop = H - 92 - (c.progress ? 70 : 0) - rows * 100 - (bp > 1 ? 86 : 0);
    // text, paged
    x.font = '400 33px system-ui';
    const text = c.vrText || c.text || (c.html ? c.html.replace(/<li>/g, '• ').replace(/<\/li>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : '');
    const lines = wrapText(x, text, W - PAD * 2);
    const lh = 44, avail = Math.max(2, Math.floor((btnTop - 70 - y) / lh));
    const pages = Math.max(1, Math.ceil(lines.length / avail));
    if (this.textPage >= pages) this.textPage = 0;
    x.fillStyle = '#d3dfe3';
    lines.slice(this.textPage * avail, this.textPage * avail + avail).forEach(l => { x.fillText(l, PAD, y); y += lh; });
    if (pages > 1) {
      const py = btnTop - 76;
      this.button({ x: PAD, y: py, w: 150, h: 60, action: () => { this.textPage = (this.textPage - 1 + pages) % pages; this.dirty = true; } }, '◀', { size: 30 });
      this.button({ x: W - PAD - 150, y: py, w: 150, h: 60, action: () => { this.textPage = (this.textPage + 1) % pages; this.dirty = true; } }, '▶', { size: 30 });
      x.fillStyle = '#a9bcc4'; x.font = '500 26px system-ui'; x.textAlign = 'center';
      x.fillText(`Page ${this.textPage + 1} of ${pages}`, W / 2, py + 40); x.textAlign = 'left';
    }
    // buttons
    const bw = (W - PAD * 2 - 16) / 2;
    btns.forEach((b, i) => {
      const r = { x: PAD + (i % 2) * (bw + 16), y: btnTop + Math.floor(i / 2) * 100, w: bw, h: 86, action: b.disabled ? null : () => { b.onClick?.(); } };
      this.button(r, b.label, { primary: b.primary, on: b.on, size: 29 });
    });
    if (bp > 1) {
      const r = { x: PAD, y: btnTop + rows * 100, w: W - PAD * 2, h: 72, action: () => { this.btnPage = (this.btnPage + 1) % bp; this.dirty = true; } };
      this.button(r, `More options (${this.btnPage + 1} of ${bp}) ▸`, { size: 27 });
    }
    if (c.progress) {
      const p = c.progress, py = H - 140;
      x.fillStyle = '#20374a'; x.beginPath(); x.roundRect(PAD, py, W - PAD * 2, 16, 8); x.fill();
      x.fillStyle = '#7fd0a8'; x.beginPath(); x.roundRect(PAD, py, (W - PAD * 2) * Math.min(1, p.value / Math.max(1, p.max)), 16, 8); x.fill();
      x.fillStyle = '#c4d3d8'; x.font = '400 25px system-ui'; x.fillText(p.label || `${p.value} / ${p.max}`, PAD, py + 48);
    }
  }

  drawStations() {
    const x = this.ctx, W = this.W;
    x.fillStyle = '#e0b16c'; x.font = '700 25px system-ui'; x.fillText('GO TO A STATION', PAD, 160);
    const tabs = this.ui.tabs;
    const h = 138, gap = 14;
    tabs.forEach((t, i) => {
      const r = { x: PAD, y: 190 + i * (h + gap), w: W - PAD * 2, h, action: () => { this.page = 'lesson'; this.dirty = true; if (t.key !== this.ui.station) this.lab.go(t.key); } };
      this.button(r, `${t.num}  ${t.title || t.short}`, { primary: t.key === this.ui.station, size: 36, sub: t.key === this.ui.station ? 'You are here' : (t.blurb || '') });
    });
    const y = 190 + tabs.length * (h + gap) + 10;
    const bw = (W - PAD * 2 - 16) / 2;
    this.button({ x: PAD, y, w: bw, h: 90, action: () => { this.lab.xr?.recenter(); this.page = 'lesson'; this.dirty = true; } }, 'Recenter me', { size: 30 });
    this.button({ x: PAD + bw + 16, y, w: bw, h: 90, action: () => { this.page = 'lesson'; this.dirty = true; } }, 'Back to lesson', { size: 30 });
  }

  drawComfort() {
    const x = this.ctx, W = this.W;
    x.fillStyle = '#e0b16c'; x.font = '700 25px system-ui'; x.fillText('COMFORT & CONTROLS', PAD, 160);
    const h = settings.seatedOffset || 0;
    const rows = [
      ['Turning', [['snap', 'Snap'], ['smooth', 'Smooth']], 'turnMode'],
      ['Snap angle', [[22.5, '22.5°'], [30, '30°'], [45, '45°'], [90, '90°']], 'snapAngle'],
      ['Moving', [['both', 'Teleport + walk'], ['teleport', 'Teleport only']], 'locomotion'],
      ['Teleport fade', [[true, 'On'], [false, 'Off']], 'teleportFade'],
      ['Menu panel', [['hand', 'On left hand'], ['float', 'Floating']], 'panelMode'],
      ['Button labels', [[true, 'Show'], [false, 'Hide']], 'showHints'],
    ];
    let y = 190;
    rows.forEach(([label, opts, key]) => {
      x.fillStyle = '#e8eef0'; x.font = '600 30px system-ui'; x.fillText(label, PAD, y + 50);
      const left = 330, bw = (W - PAD - left - (opts.length - 1) * 10) / opts.length;
      opts.forEach(([v, t], i) => {
        const r = { x: left + i * (bw + 10), y, w: bw, h: 76, action: () => setSetting(key, v) };
        this.button(r, t, { on: String(settings[key]) === String(v), size: opts.length > 2 ? 26 : 28 });
      });
      y += 96;
    });
    // height
    x.fillStyle = '#e8eef0'; x.font = '600 30px system-ui'; x.fillText('Height', PAD, y + 50);
    x.font = '400 22px system-ui'; x.fillStyle = '#a9bcc4'; x.fillText('Raise if seated', PAD, y + 78);
    const left = 330, bw = (W - PAD - left - 20) / 3;
    this.button({ x: left, y, w: bw, h: 76, action: () => setSetting('seatedOffset', Math.max(-0.5, +(h - 0.1).toFixed(2))) }, '− 10 cm', { size: 28 });
    this.button({ x: left + bw + 10, y, w: bw, h: 76, action: () => setSetting('seatedOffset', 0) }, h ? `${h > 0 ? '+' : ''}${Math.round(h * 100)} cm` : 'Standing', { on: !!h, size: 28 });
    this.button({ x: left + 2 * (bw + 10), y, w: bw, h: 76, action: () => setSetting('seatedOffset', Math.min(0.8, +(h + 0.1).toFixed(2))) }, '+ 10 cm', { size: 28 });
    y += 110;
    this.button({ x: PAD, y, w: W - PAD * 2, h: 80, action: () => { this.page = 'lesson'; this.dirty = true; } }, 'Done', { primary: true, size: 30 });
  }

  uvToIndex(uv) {
    const px = uv.x * this.W, py = (1 - uv.y) * this.H;
    return this.rects.findIndex(r => r.action && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
  }

  hit(raycaster) {
    if (!this.mesh.visible) return null;
    const h = raycaster.intersectObject(this.mesh, false)[0];
    const idx = h ? this.uvToIndex(h.uv) : -1;
    if (idx !== this.hoverIndex) { this.hoverIndex = idx; this.dirty = true; if (idx >= 0) this.lab.xr?.buzz(raycaster.source, 0.18, 12); }
    return h ? h.distance : null;
  }

  pick(raycaster) {
    if (!this.mesh.visible) return false;
    const h = raycaster.intersectObject(this.mesh, false)[0];
    if (!h) return false;
    const idx = this.uvToIndex(h.uv);
    if (idx >= 0) { this.rects[idx].action?.(); this.dirty = true; }
    return true;
  }

  update(dt) {
    if (this.flashTime > 0) { this.flashTime -= dt; if (this.flashTime <= 0) this.dirty = true; }
    if (this.mesh.visible && this.dirty) this.draw();
  }
}

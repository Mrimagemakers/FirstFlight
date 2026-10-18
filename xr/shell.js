// App shell: title screen with an attract camera, station select, pause menu, settings, help and about.
import * as THREE from 'three';
import { settings, setSetting, resetSettings, QUALITY, VERSION } from './settings.js';
import { audio } from './audio.js';

const STATIONS = [
  { key: 'hangar', name: 'Systems lab', blurb: 'Reveal the engine, fuel and electrical systems. Find the missing tool.', img: 'lab-hangar', role: 'Maintenance' },
  { key: 'walkaround', name: 'Preflight walkaround', blurb: 'Eight learning stations around a training airplane.', img: 'lab-walkaround', role: 'Pilot' },
  { key: 'ramp', name: 'Ramp & cargo', blurb: 'Walk Stand 7, collect FOD, see danger zones, solve six scenarios.', img: 'ramp-agent', role: 'Ramp · Cargo' },
  { key: 'cabin', name: 'Cabin safety', blurb: 'Clear the cabin, locate safety equipment, handle cabin scenarios.', img: 'cabin-cleaner', role: 'Cabin · Flight attendant' },
  { key: 'flight', name: 'Fly', blurb: 'Four missions over six realistic regions from a detailed cockpit.', img: 'lab-flight', role: 'Pilot' },
];

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Shell {
  constructor(lab, support) {
    this.lab = lab;
    this.support = support;
    this.root = el('<div id="shell"></div>');
    document.body.append(this.root);
    this.menuBtn = el('<button id="menuBtn" aria-label="Open menu" title="Menu (Esc)">☰ Menu</button>');
    document.querySelector('#top .right').prepend(this.menuBtn);
    this.menuBtn.onclick = () => this.pause();
    addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (this.view) this.close(); else if (!document.body.classList.contains('title')) this.pause();
    });
    document.addEventListener('click', e => { if (e.target.closest('#shell button, #shell [data-act]')) audio.click(); }, true);
  }

  // ---------------------------------------------------------------- title screen + attract camera
  async showTitle() {
    const lab = this.lab;
    document.body.classList.add('title');
    this.view = 'title';
    let last = null; try { last = localStorage.getItem('ff-last-station'); } catch { /* ignore */ }
    const lastSt = STATIONS.find(s => s.key === last);
    this.root.innerHTML = '';
    this.root.append(el(`<section class="title-screen" role="dialog" aria-label="First Flight">
      <div class="t-brand"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 44 L40 26 L37 18 L56 30 L40 42 L41 34 L10 50 Z" fill="currentColor"/><path d="M10 54 L42 40 L42 44 L11 57 Z" fill="currentColor" opacity=".55"/></svg><div><h1>FIRST FLIGHT</h1><p>Aviation careers &amp; flight training · 3D &amp; VR</p></div></div>
      <nav class="t-menu">
        <button class="t-primary" data-act="start">Start training</button>
        ${lastSt ? `<button data-act="continue">Continue · ${esc(lastSt.name)}</button>` : ''}
        ${this.support.vr ? '<button data-act="vr">Enter VR</button>' : ''}
        <button data-act="settings">Settings</button>
        <button data-act="help">How to play</button>
        <a href="index.html" target="_top" data-act="hub">Careers hub ↗</a>
        <button data-act="about">About</button>
      </nav>
      <footer class="t-foot"><span>v${VERSION}</span><span>${this.support.vr ? 'VR headset detected' : 'Works with mouse, touch, gamepad and WebXR headsets'}</span><span>© PenGame Publishing</span></footer>
    </section>`));
    this.bind({ start: () => this.stations(), continue: () => this.launch(lastSt.key), vr: () => { this.launch(last || 'ramp').then(() => lab.startXR('immersive-vr').catch(e => lab.ui.toast('Could not start VR: ' + e.message, 'bad'))); }, settings: () => this.settings('title'), help: () => this.help('title'), about: () => this.about('title') });
    // attract mode: slow cinematic orbit around the airliner at the gate
    if (lab.stationKey !== 'ramp') await lab.go('ramp');
    lab.hotspots.group.visible = false;
    lab.controls.enabled = false;
    const center = new THREE.Vector3(0, 3.2, -4);
    lab.cinematic = (dt, t) => {
      const a = -0.6 + t * 0.045;
      const p = new THREE.Vector3(Math.sin(a) * 44, 9 + Math.sin(t * 0.07) * 4, Math.cos(a) * 44 - 4);
      lab.controls.orbit.enabled = false;
      lab.camera.position.copy(p);
      lab.camera.lookAt(center);
    };
    audio.ambience('title');
  }

  bind(map) {
    this.root.querySelectorAll('[data-act]').forEach(b => { const f = map[b.dataset.act]; if (f) b.addEventListener('click', e => { if (b.tagName === 'A' && b.dataset.act !== 'hub') e.preventDefault(); audio.unlock(); f(); }); });
  }

  endTitle() {
    const lab = this.lab;
    lab.cinematic = null;
    lab.controls.enabled = true;
    lab.hotspots.group.visible = !document.body.classList.contains('photo');
    document.body.classList.remove('title');
  }

  async launch(key) {
    this.endTitle();
    this.close();
    try { localStorage.setItem('ff-last-station', key); } catch { /* ignore */ }
    await this.lab.go(key);
    if (settings.showHints && !this.helped) { this.helped = true; this.lab.ui.toast('Tip: press Esc or ☰ Menu for settings and stations'); }
  }

  // ---------------------------------------------------------------- overlays
  modal(title, body, { back, wide } = {}) {
    this.view = 'modal';
    this.root.querySelector('.modal')?.remove();
    const m = el(`<section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="m-card"><header><h2>${esc(title)}</h2><button class="m-close" data-act="close" aria-label="Close">✕</button></header><div class="m-body"></div></div></section>`);
    m.querySelector('.m-body').append(typeof body === 'string' ? el(`<div>${body}</div>`) : body);
    this.root.append(m);
    m.querySelector('[data-act=close]').onclick = () => (back ? back() : this.close());
    m.addEventListener('click', e => { if (e.target === m) (back ? back() : this.close()); });
    return m;
  }

  close() {
    this.root.querySelector('.modal')?.remove();
    this.view = document.body.classList.contains('title') ? 'title' : null;
  }

  stations() {
    const p = this.lab.progress;
    const done = { hangar: p.tools.length, walkaround: p.walkaround.length, ramp: p.fod.length + p.scenarios.filter(s => s.startsWith('ramp')).length, cabin: p.cabin.length + p.scenarios.filter(s => s.startsWith('cab')).length, flight: p.missions.length };
    const total = { hangar: 1, walkaround: 8, ramp: 16, cabin: 19, flight: 4 };
    const body = el(`<div class="st-grid">${STATIONS.map((s, i) => `<button class="st-card" data-key="${s.key}"><img src="assets/renders/${s.img}.jpg" alt=""><span class="st-num">0${i + 1}</span><span class="st-body"><b>${s.name}</b><small>${s.role}</small><em>${s.blurb}</em><i class="st-bar"><i style="width:${Math.min(100, Math.round(done[s.key] / total[s.key] * 100))}%"></i></i></span></button>`).join('')}</div>`);
    body.querySelectorAll('.st-card').forEach(b => (b.onclick = () => { audio.unlock(); this.launch(b.dataset.key); }));
    this.modal('Choose a training station', body, { wide: true, back: document.body.classList.contains('title') ? () => this.close() : null });
  }

  pause() {
    if (document.body.classList.contains('title')) return;
    const body = el(`<nav class="p-menu">
      <button data-act="resume" class="t-primary">Resume</button>
      <button data-act="stations">Training stations</button>
      <button data-act="settings">Settings</button>
      <button data-act="help">How to play</button>
      <button data-act="about">About &amp; licenses</button>
      <a href="index.html" target="_top">Careers hub ↗</a>
      <button data-act="title">Exit to title</button>
    </nav>`);
    const m = this.modal('Paused', body);
    m.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'resume') this.close();
      if (a === 'stations') this.stations();
      if (a === 'settings') this.settings();
      if (a === 'help') this.help();
      if (a === 'about') this.about();
      if (a === 'title') { this.close(); this.showTitle(); }
    }));
  }

  settings(from) {
    const back = () => (from === 'title' ? this.close() : this.pause());
    const s = settings;
    const opt = (k, list) => list.map(([v, t]) => `<option value="${v}" ${String(s[k]) === String(v) ? 'selected' : ''}>${t}</option>`).join('');
    const body = el(`<form class="settings" onsubmit="return false">
      <fieldset><legend>Graphics</legend>
        <label>Quality<select id="set-quality">${opt('quality', Object.entries(QUALITY).map(([k, q]) => [k, q.label]))}</select></label>
        <label class="chk"><input type="checkbox" id="set-ao" ${s.ao ? 'checked' : ''}> Ambient occlusion</label>
        <label class="chk"><input type="checkbox" id="set-bloom" ${s.bloom ? 'checked' : ''}> Bloom &amp; light glow</label>
        <label class="chk"><input type="checkbox" id="set-flare" ${s.flare ? 'checked' : ''}> Sun lens flare</label>
        <small>Effects apply on screens. Headsets render without post-processing for a steady frame rate.</small>
      </fieldset>
      <fieldset><legend>Audio</legend>
        <label>Master volume<input type="range" id="set-volume" min="0" max="1" step="0.05" value="${s.volume}"></label>
        <label class="chk"><input type="checkbox" id="set-ambience" ${s.ambience ? 'checked' : ''}> Ambient sound</label>
        <label class="chk"><input type="checkbox" id="set-engine" ${s.engine ? 'checked' : ''}> Engine sound when flying</label>
      </fieldset>
      <fieldset><legend>VR comfort</legend>
        <label>Turning<select id="set-turnMode">${opt('turnMode', [['snap', 'Snap turn'], ['smooth', 'Smooth turn']])}</select></label>
        <label>Snap angle<select id="set-snapAngle">${opt('snapAngle', [[22.5, '22.5°'], [30, '30°'], [45, '45°'], [90, '90°']])}</select></label>
        <label>Moving<select id="set-locomotion">${opt('locomotion', [['both', 'Teleport + walk'], ['teleport', 'Teleport only']])}</select></label>
      </fieldset>
      <fieldset><legend>Controls &amp; help</legend>
        <label class="chk"><input type="checkbox" id="set-invertPitch" ${s.invertPitch ? 'checked' : ''}> Invert pitch when flying</label>
        <label class="chk"><input type="checkbox" id="set-showHints" ${s.showHints ? 'checked' : ''}> Show tips</label>
        <button type="button" data-act="reset" class="ghost">Reset all settings</button>
        <button type="button" data-act="progress" class="ghost danger">Reset training progress</button>
      </fieldset>
    </form>`);
    body.querySelectorAll('select, input').forEach(i => i.addEventListener('change', () => {
      const k = i.id.replace('set-', '');
      let v = i.type === 'checkbox' ? i.checked : i.type === 'range' ? +i.value : i.value;
      if (k === 'snapAngle') v = +v;
      setSetting(k, v);
      if (k === 'quality') this.lab.ui.toast('Quality: ' + QUALITY[v].label + '. Some changes apply when a station reloads.');
    }));
    body.querySelector('#set-volume').addEventListener('input', e => setSetting('volume', +e.target.value));
    body.querySelector('[data-act=reset]').onclick = () => { resetSettings(); this.settings(from); };
    let armed = false;
    body.querySelector('[data-act=progress]').onclick = (e) => {
      if (!armed) { armed = true; e.target.textContent = 'Tap again to erase all progress'; return; }
      Object.keys(this.lab.progress).forEach(k => { if (Array.isArray(this.lab.progress[k])) this.lab.progress[k] = []; });
      this.lab.saveProgress();
      e.target.textContent = 'Progress erased';
    };
    this.modal('Settings', body, { back });
  }

  help(from) {
    const back = () => (from === 'title' ? this.close() : this.pause());
    this.modal('How to play', `<div class="help">
      <section><h3>Mouse &amp; keyboard</h3><ul><li><b>Drag</b> to look or orbit; <b>scroll</b> to zoom.</li><li><b>W A S D</b> or <b>arrow keys</b> walk on the ramp and in the cabin. Click the ground to walk there.</li><li><b>Click</b> glowing markers, FOD and litter.</li><li>Flying: <b>arrow keys</b> pitch and bank, <b>+ / −</b> power, <b>Space</b> start/pause, <b>C</b> outside view.</li><li><b>Esc</b> opens this menu.</li></ul></section>
      <section><h3>Touch</h3><ul><li>Drag to look, pinch to zoom, tap to select or walk.</li><li>Use the on-screen pad and power lever to fly.</li></ul></section>
      <section><h3>VR headset</h3><ul><li><b>Trigger</b>: select markers, panel buttons and objects.</li><li><b>Right stick</b>: push forward to aim a teleport, release to jump; left/right to turn.</li><li><b>Left stick</b>: walk.</li><li><b>Grip</b>: bring the lesson panel in front of you.</li><li>Flying: left stick flies, right stick sets power, trigger starts or pauses.</li></ul></section>
      <section><h3>Gamepad</h3><ul><li>Left stick flies; triggers set power; A starts or pauses.</li></ul></section>
    </div>`, { back, wide: true });
  }

  about(from) {
    const back = () => (from === 'title' ? this.close() : this.pause());
    this.modal('About First Flight', `<div class="about">
      <p><b>First Flight</b> v${VERSION} · an aviation careers and training experience by PenGame Publishing, LLC.</p>
      <p>First Flight is an educational simulation. It does not provide flight-training credit, airport access, certification or employment qualification. Follow your employer, airline or instructor and the approved documentation for real procedures.</p>
      <h3>Credits &amp; licenses</h3>
      <ul>
        <li>3D engine: <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> r180 (MIT License).</li>
        <li>WebXR controller models: WebXR Input Profiles (MIT License).</li>
        <li>Sky lighting: HDR images from <a href="https://polyhaven.com" target="_blank" rel="noopener">Poly Haven</a> (CC0).</li>
        <li>Textures, aircraft, vehicles, scenery, sounds and interface: original work for First Flight.</li>
        <li>All aircraft, airlines and liveries are fictional.</li>
      </ul>
      <p><a href="privacy.html" target="_blank" rel="noopener">Privacy policy</a> · <a href="terms.html" target="_blank" rel="noopener">Terms of use</a></p>
    </div>`, { back });
  }
}

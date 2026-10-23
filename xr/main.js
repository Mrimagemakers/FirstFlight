// Boot the First Flight XR training lab.
import { Lab } from './core.js';
import { UI } from './ui.js';
import { Shell } from './shell.js';
import { audio } from './audio.js';
import * as THREE from 'three';

const $ = id => document.getElementById(id);

/** Lazily-loaded station that delegates to the real implementation. */
class Station {
  constructor(title, loader, mode) { this.title = title; this.loader = loader; this.mode = mode; }
  async build(lab) {
    if (!this.shared.impl) {
      const Impl = await this.loader();
      this.shared.impl = new Impl();
      await this.shared.impl.build(lab);
    }
    this.root = this.shared.impl.root;
  }
  get built() { return !!this.shared.impl && !!this.root; }
  set built(v) { /* derived */ }
  get impl() { return this.shared.impl; }
  get xrLocomotion() { return this.impl?.xrLocomotion; }
  get post() { return this.impl?.post; }
  get ambience() { return this.impl?.ambience; }
  enter(lab, opts) { if (this.mode) this.impl.mode = this.mode; return this.impl.enter(lab, opts); }
  exit(lab) { return this.impl?.exit?.(lab); }
  update(dt, t, lab) { return this.impl?.update?.(dt, t, lab); }
  xrSpawn(lab) { return this.impl?.xrSpawn?.(lab); }
  xrBounds(p) { return this.impl?.xrBounds?.(p); }
  xrSelect(c) { return this.impl?.xrSelect?.(c); }
  xrButton(name) { return this.impl?.xrButton?.(name); }
  enterAR(lab) { return this.impl?.enterAR?.(lab); }
  exitAR(lab) { return this.impl?.exitAR?.(lab); }
  onPick(r) { return this.impl?.onPick?.(r); }
}

function station(title, loader, shared, mode) {
  const s = new Station(title, loader, mode);
  s.shared = shared || {};
  return s;
}

THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => { const b = document.querySelector('.ld-bar i'); if (b) { b.style.animation = 'none'; b.style.width = Math.round(loaded / total * 100) + '%'; b.style.transform = 'none'; } };

async function boot() {
  const ui = new UI();
  let lab;
  try {
    lab = new Lab({ host: $('stage'), ui });
  } catch (e) {
    $('ldText').textContent = 'This lab needs WebGL. Try a current browser with hardware acceleration turned on.';
    throw e;
  }
  ui.attach(lab);
  try { if (window.top !== window) document.body.classList.add('embedded'); } catch { document.body.classList.add('embedded'); }
  window.ffLab = lab;
  if (new URLSearchParams(location.search).has('photo')) { document.body.classList.add('photo'); lab.hotspots.group.visible = false; }

  const hangarShared = {};
  const hangar = () => import('./stations/hangar.js').then(m => m.HangarStation);
  lab.register('hangar', station('Systems lab', hangar, hangarShared, 'systems'));
  lab.register('walkaround', station('Preflight walkaround', hangar, hangarShared, 'walkaround'));
  lab.register('ramp', station('Ramp & cargo safety', () => import('./stations/ramp.js').then(m => m.RampStation)));
  lab.register('cabin', station('Cabin safety', () => import('./stations/cabin.js').then(m => m.CabinStation)));
  lab.register('flight', station('Flight', () => import('./stations/flight.js').then(m => m.FlightStation)));
  ui.setTabs([
    { key: 'hangar', num: '01', short: 'Systems lab', title: 'Hangar systems lab', blurb: 'Engine, fuel, electrical and tool control' },
    { key: 'walkaround', num: '02', short: 'Walkaround', title: 'Preflight walkaround', blurb: 'Eight checks around the airplane' },
    { key: 'ramp', num: '03', short: 'Ramp & cargo', title: 'Ramp, cargo and FOD safety', blurb: 'Find FOD, danger zones and scenarios' },
    { key: 'cabin', num: '04', short: 'Cabin', title: 'Cabin safety and appearance', blurb: 'Safety equipment and cabin checks' },
    { key: 'flight', num: '05', short: 'Fly', title: 'Flight practice', blurb: 'Four missions over six regions' },
  ]);

  // ----------------------------------------------------------- XR buttons
  const support = await lab.xrSupport();
  const vr = $('vrBtn');
  if (support.vr) { vr.disabled = false; vr.textContent = 'Enter VR'; }
  else vr.textContent = navigator.xr ? 'No VR headset found' : 'VR not available here';
  vr.title = support.vr ? 'Open this station in your headset' : 'Open this page in a WebXR browser such as the Meta Quest Browser to use VR';
  vr.onclick = () => lab.startXR('immersive-vr').catch(e => ui.toast('Could not start VR: ' + e.message, 'bad'));
  const ar = $('arBtn');
  ar.hidden = !support.ar;
  ar.onclick = async () => { if (!['hangar', 'walkaround'].includes(lab.stationKey)) await lab.go('hangar'); lab.startXR('immersive-ar').catch(e => ui.toast('Could not start AR: ' + e.message, 'bad')); };
  $('fsBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => ui.toast('Full screen is not available here')));

  // ----------------------------------------------------------- choose the first station
  let [key, sub] = (location.hash.slice(1) || '').split(':');
  try {
    const legacy = localStorage.getItem('academy-launch');
    if (legacy && !key) {
      localStorage.removeItem('academy-launch');
      if (legacy === 'flight') key = 'flight';
      else if (legacy === 'preflight') key = 'walkaround';
      else if (['engine', 'fuel', 'electrical', 'airframe'].includes(legacy)) { key = 'hangar'; sub = legacy; }
      else if (['ramp', 'cabin', 'walkaround', 'hangar'].includes(legacy)) key = legacy;
    }
  } catch { /* storage blocked */ }
  const shell = window.ffShell = new Shell(lab, support);
  const photo = document.body.classList.contains('photo');
  const embedded = document.body.classList.contains('embedded');
  if (!lab.stations[key]) {
    if (!embedded && !photo) { await shell.showTitle(); key = null; }
    else key = 'hangar';
  }
  if (key) await lab.go(key, { sub });
  // first user gesture unlocks audio
  addEventListener('pointerdown', () => audio.unlock(), { once: true });
  addEventListener('keydown', () => audio.unlock(), { once: true });
  window.addEventListener('hashchange', () => {
    const [k, s] = location.hash.slice(1).split(':');
    if (lab.stations[k] && (k !== lab.stationKey || s)) { shell.endTitle(); lab.go(k, { sub: s }); }
  });
  window.addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'ff-go' && lab.stations[e.data.key]) { shell.endTitle(); lab.go(e.data.key, { sub: e.data.sub }); }
  });
  document.body.classList.add('ready');
}

boot();

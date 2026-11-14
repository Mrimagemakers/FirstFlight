// Phone VR for simple viewers such as Google Cardboard, and any "VR box" that holds a phone in front of two
// lenses. Works on iPhone and Android without WebXR: the screen is split into a left and a right eye, the
// phone's motion sensors turn your head, and you play with your gaze:
//   • look at a marker or a menu button and hold your gaze for a moment to select it (or press the viewer's
//     button / tap the screen),
//   • press and hold to walk where you look, or tap the floor to walk there,
//   • double-tap to recenter.
// A Bluetooth Xbox or PlayStation controller works too. "Watch" mode is a hands-free guided tour.
import * as THREE from 'three';

const DWELL = 1.4;          // seconds of gaze to select
const PHONE = /Android|iPhone|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && /Safari/.test(navigator.userAgent));

/** True on phones (and iPads) where a Cardboard-style viewer makes sense. */
export function cardboardCapable() {
  return PHONE && ('ontouchstart' in window) && typeof DeviceOrientationEvent !== 'undefined';
}

const zee = new THREE.Vector3(0, 0, 1), euler = new THREE.Euler(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
/** Device orientation (degrees) → camera quaternion, the standard W3C mapping used by three.js. */
function deviceQuat(out, alpha, beta, gamma, orient) {
  const d = THREE.MathUtils.DEG2RAD;
  euler.set(beta * d, alpha * d, -gamma * d, 'YXZ');
  out.setFromEuler(euler);
  out.multiply(q1);
  out.multiply(q0.setFromAxisAngle(zee, -orient * d));
  return out;
}
const yawOf = (q) => { const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q); return Math.atan2(-f.x, -f.z); };
const yawQ = (y) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), y);

export class Cardboard {
  constructor(lab) {
    this.lab = lab;
    this.active = false;
    this.stereo = new THREE.StereoCamera();
    this.stereo.aspect = 0.5;
    this.stereo.eyeSep = 0.064;
    this.device = null;             // last DeviceOrientationEvent values
    this.dq = new THREE.Quaternion();
    this.yaw0 = null;               // calibration: device heading that counts as "straight ahead"
    this.bodyYaw = 0;
    this.lastWalkYaw = null;
    this.ray = new THREE.Raycaster();
    this.center = new THREE.Vector2();
    this.gaze = { key: null, t: 0, cool: 0 };
    this.touch = { down: false, t0: 0, x: 0, y: 0, lastTap: 0, walking: false };
    this.tour = null;
    this.headEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.buildReticle();
    this.buildOverlay();
    this.onOrient = e => { if (e.alpha != null || e.beta != null) this.device = { a: e.alpha || 0, b: e.beta || 0, g: e.gamma || 0 }; };
    // leaving full screen (e.g. the phone's back gesture) leaves phone VR too
    addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) { if (this.active) this.inFull = true; }
      else if (this.active && this.inFull) { this.inFull = false; this.stop(); }
    });
  }

  // ------------------------------------------------------------------ UI
  buildReticle() {
    const g = new THREE.Group();
    const mat = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false, depthWrite: false, toneMapped: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.011, 0.016, 40), mat(0xffffff, 0.9));
    this.fill = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.026, 48, 1, Math.PI / 2, 0.0001), mat(0xf2c879));
    [this.ring, this.fill].forEach(m => { m.renderOrder = 999; g.add(m); });
    g.position.set(0, 0, -1);
    g.visible = false;
    this.reticle = g;
    this.lab.camera.add(g);
  }

  setFill(p) {
    const geo = this.fill.geometry;
    geo.dispose();
    this.fill.geometry = new THREE.RingGeometry(0.016, 0.026, 48, 1, Math.PI / 2, Math.max(0.0001, -Math.PI * 2 * p));
  }

  buildOverlay() {
    const o = document.createElement('div');
    o.id = 'cbOverlay'; o.hidden = true;
    o.innerHTML = `<div class="cb-divider"></div>
      <button class="cb-exit" aria-label="Exit phone VR">✕</button>
      <div class="cb-rotate"><b>Turn your phone sideways</b><span>Put it in your viewer with the screen facing the lenses.</span></div>
      <div class="cb-intro"><div class="cb-card">
        <h2>Phone VR</h2>
        <ul>
          <li><b>Look around</b> by turning your head.</li>
          <li><b>Select</b>: hold the dot on a marker or button, or press your viewer’s button.</li>
          <li><b>Walk</b>: press and hold, or tap the floor where you want to go.</li>
          <li><b>Recenter</b>: double-tap.</li>
          <li>A Bluetooth Xbox or PlayStation controller works too.</li>
        </ul>
        <button class="cb-go">Tap to start</button>
      </div></div>`;
    document.body.append(o);
    this.overlay = o;
    o.querySelector('.cb-exit').addEventListener('click', e => { e.stopPropagation(); this.stop(); });
    o.querySelector('.cb-go').addEventListener('click', e => { e.stopPropagation(); o.classList.remove('intro'); this.recenter(); });
    o.addEventListener('pointerdown', e => this.down(e));
    o.addEventListener('pointerup', e => this.up(e));
    o.addEventListener('pointercancel', () => { this.touch.down = false; this.touch.walking = false; });
    const orient = () => o.classList.toggle('portrait', innerHeight > innerWidth * 1.05);
    addEventListener('resize', orient); orient();
  }

  // ------------------------------------------------------------------ start / stop
  /**
   * Start phone VR. Call straight from a tap: iPhone only lets a page read the motion sensors, and Android
   * only allows full screen, when asked during a user gesture.
   */
  start({ watch = false } = {}) {
    if (this.active) return Promise.resolve();
    const lab = this.lab;
    const perm = (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) ? DeviceOrientationEvent.requestPermission().catch(() => 'denied') : Promise.resolve('granted');
    const de = document.documentElement;
    const fs = de.requestFullscreen ? de.requestFullscreen({ navigationUI: 'hide' }).then(() => { this.wasFull = true; screen.orientation?.lock?.('landscape').catch(() => {}); }).catch(() => {}) : Promise.resolve();
    this.active = true;
    this.watch = watch;
    document.body.classList.add('cardboard');
    this.overlay.hidden = false;
    this.overlay.classList.toggle('intro', !watch);
    addEventListener('deviceorientation', this.onOrient);
    this.saved = { fov: lab.camera.fov, enabled: lab.controls.enabled };
    lab.controls.enabled = false;
    lab.camera.fov = 80; lab.camera.updateProjectionMatrix();
    this.reticle.visible = true;
    this.yaw0 = null; this.lastWalkYaw = null; this.bodyYaw = this.baseYaw(); this.extraYaw = 0;
    lab.ui.vr.visible(true);
    lab.ui.vr.dirty = true;
    lab.resize?.();
    return Promise.all([perm, fs]).then(([p]) => {
      if (p === 'denied') lab.ui.toast('Motion access was declined: look around with a controller or by dragging instead.');
      if (watch) this.startTour();
    });
  }

  stop() {
    if (!this.active) return;
    const lab = this.lab;
    this.active = false;
    this.tour = null;
    document.body.classList.remove('cardboard');
    this.overlay.hidden = true;
    removeEventListener('deviceorientation', this.onOrient);
    this.reticle.visible = false;
    lab.ui.vr.visible(false);
    lab.ui.vr.hoverIndex = -1;
    this.inFull = false;
    lab.controls.enabled = this.saved?.enabled ?? true;
    lab.camera.fov = this.saved?.fov || lab.controls.baseFov || 60; lab.camera.updateProjectionMatrix();
    lab.renderer.setScissorTest(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    this.wasFull = false; this.inFull = false;
    try { screen.orientation?.unlock?.(); } catch { /* not supported */ }
    lab.resize?.();
    if (lab.controls.mode === 'walk') lab.controls.walk.pitch = 0;
  }

  /** Make the current gaze direction "straight ahead". */
  recenter() {
    this.yaw0 = null; this.extraYaw = 0;
    this.bodyYaw = this.lab.controls.mode === 'walk' ? this.lab.controls.walk.yaw : this.baseYaw();
    this.lastWalkYaw = null;
    this.lab.ui.vr.summon(true);
  }

  baseYaw() { return yawOf(this.lab.camera.quaternion); }

  // ------------------------------------------------------------------ head tracking
  /** Head rotation relative to "straight ahead" (no sensor: level, forward). */
  headRel() {
    if (!this.device) return new THREE.Quaternion();
    const orient = screen.orientation?.angle ?? window.orientation ?? 0;
    deviceQuat(this.dq, this.device.a, this.device.b, this.device.g, orient);
    if (this.yaw0 == null) this.yaw0 = yawOf(this.dq);
    return yawQ(-this.yaw0).multiply(this.dq);
  }

  /** Called every frame after the station has placed the camera. */
  update(dt) {
    if (!this.active) return;
    const lab = this.lab, c = lab.controls, cam = lab.camera;
    const head = this.headRel();
    this.headEuler.setFromQuaternion(head, 'YXZ');
    const key = lab.stationKey;

    if (c.mode === 'walk') {
      const w = c.walk;
      // other inputs (controller stick, "next marker", click-to-walk) turn the body
      if (this.lastWalkYaw != null && Math.abs(w.yaw - this.lastWalkYaw) > 1e-5) this.bodyYaw += w.yaw - this.lastWalkYaw;
      cam.quaternion.copy(yawQ(this.bodyYaw)).multiply(head);
      this.headEuler.setFromQuaternion(cam.quaternion, 'YXZ');
      w.yaw = this.headEuler.y; w.pitch = this.headEuler.x;
      this.lastWalkYaw = w.yaw;
      // press-and-hold walks where you look
      if (this.touch.down && performance.now() - this.touch.t0 > 380 && !this.touch.moved) {
        this.touch.walking = true; w.target = null;
        const f = new THREE.Vector3(-Math.sin(w.yaw), 0, -Math.cos(w.yaw));
        w.pos.addScaledVector(f, w.speed * dt);
        if (w.bounds) w.bounds(w.pos);
        cam.position.set(w.pos.x, w.pos.y + w.eye, w.pos.z);
      }
    } else if (c.mode === 'cockpit') {
      if (key === 'flight' && lab.station?.impl?.view === 'chase') cam.quaternion.copy(yawQ(this.baseYaw())).multiply(head);
      else cam.quaternion.multiply(head); // the station has already set the aircraft's attitude
      c.cockpit.yaw = 0; c.cockpit.pitch = 0;
    } else {
      // orbit views: keep the model straight ahead and let the head look around it
      const look = new THREE.Vector3().subVectors(c.orbit.target, cam.position);
      cam.quaternion.copy(yawQ(Math.atan2(-look.x, -look.z) + this.extraYaw)).multiply(head);
    }
    cam.updateMatrixWorld();

    this.placePanel(dt);
    this.gazeSelect(dt);
    this.tour?.update(dt);
  }


  /** Keep the lesson panel within reach: re-centre it when you have looked away from it for a while. */
  placePanel(dt) {
    const lab = this.lab, vr = lab.ui.vr;
    if (!vr.mesh.visible) return;
    if (lab.stationKey === 'flight') {
      // in the aircraft: ride on the right of the instrument panel
      const imp = lab.station?.impl;
      if (imp?.view === 'chase') { vr.mesh.visible = false; return; }
      const eye = lab.camera.getWorldPosition(new THREE.Vector3());
      const q = imp?.plane ? imp.plane.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
      const p = eye.clone().add(new THREE.Vector3(0.42, -0.22, -0.62).applyQuaternion(q));
      vr.mesh.position.copy(lab.rig.worldToLocal(p)); vr.mesh.scale.setScalar(0.42);
      vr.mesh.lookAt(eye); vr.mesh.updateMatrixWorld();
      return;
    }
    const cam = this.lab.camera;
    const eye = cam.getWorldPosition(new THREE.Vector3());
    const toPanel = vr.mesh.getWorldPosition(new THREE.Vector3()).sub(eye);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    toPanel.y = 0; fwd.y = 0;
    const far = toPanel.length() > 2.2;
    const ang = toPanel.angleTo(fwd);
    this.away = (ang > 1.25 || far) ? (this.away || 0) + dt : 0;
    if (this.away > 1.6 || far && this.away > 0.3) { this.away = 0; vr.summon(true); }
  }

  // ------------------------------------------------------------------ gaze + taps
  aim() { this.ray.setFromCamera(this.center, this.lab.camera); return this.ray; }

  /** What the centre dot is on: a menu button, a marker or a clickable object. */
  target() {
    const lab = this.lab, r = this.aim();
    const vr = lab.ui.vr;
    if (vr.hit(r) != null) return vr.hoverIndex >= 0 ? 'panel:' + vr.hoverIndex + ':' + vr.page : null;
    if (lab.hotspots.hover(r)) return 'hot:' + lab.hotspots.hovered;
    const hits = r.intersectObjects(lab.interactive, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.onPick) o = o.parent; if (o && o.visible !== false) return 'obj:' + o.uuid; }
    return null;
  }

  gazeSelect(dt) {
    const g = this.gaze;
    g.cool = Math.max(0, g.cool - dt);
    const key = this.target();
    if (key !== g.key) { g.key = key; g.t = 0; }
    if (key && !g.cool && !this.touch.walking) {
      g.t += dt;
      if (g.t >= DWELL) { this.select(); g.t = 0; g.cool = 1.2; g.key = null; }
    }
    this.setFill(key && !g.cool ? Math.min(1, g.t / DWELL) : 0);
    this.ring.scale.setScalar(key ? 1.5 : 1);
  }

  select() {
    const lab = this.lab;
    const handled = lab.pickRay(this.aim());
    if (handled) lab.gamepad?.rumble?.(0.4, 60);
    return handled;
  }

  down(e) {
    if (this.overlay.classList.contains('intro')) return;
    const t = this.touch;
    t.down = true; t.t0 = performance.now(); t.x = e.clientX; t.y = e.clientY; t.moved = false; t.walking = false;
    this.overlay.setPointerCapture?.(e.pointerId);
    this.overlay.onpointermove = ev => { if (Math.hypot(ev.clientX - t.x, ev.clientY - t.y) > 30) t.moved = true; if (!this.device && t.down) this.dragLook(ev); };
    this.lastDrag = { x: e.clientX, y: e.clientY };
  }

  /** Without motion sensors (desktop testing, or permission declined): drag to look. */
  dragLook(ev) {
    const c = this.lab.controls, dx = ev.clientX - this.lastDrag.x, dy = ev.clientY - this.lastDrag.y;
    this.lastDrag = { x: ev.clientX, y: ev.clientY };
    if (c.mode === 'walk') c.walk.yaw -= dx * 0.004;
    else this.extraYaw -= dx * 0.004;
  }

  up() {
    const t = this.touch;
    if (!t.down) return;
    t.down = false;
    this.overlay.onpointermove = null;
    const quick = performance.now() - t.t0 < 380 && !t.moved;
    const wasWalking = t.walking; t.walking = false;
    if (!quick || wasWalking) return;
    const now = performance.now();
    if (now - t.lastTap < 320) { t.lastTap = 0; this.recenter(); this.lab.ui.toast('Recentered'); return; }
    t.lastTap = now;
    // a single tap selects; on the floor it walks there
    clearTimeout(this.tapTimer);
    this.tapTimer = setTimeout(() => {
      if (this.tour) { this.tour.next(); return; }
      if (this.select()) return;
      const c = this.lab.controls;
      if (this.lab.stationKey === 'flight') { this.lab.station?.impl?.toggleRun?.(); return; }
      if (c.mode !== 'walk') return;
      const r = this.aim(), w = c.walk;
      const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -w.pos.y), p = new THREE.Vector3();
      if (r.ray.intersectPlane(floor, p) && p.distanceTo(w.pos) < 30) w.target = p;
    }, 330);
  }

  // ------------------------------------------------------------------ flying with your head
  /** Tilt your head to bank, look up or down to climb or descend (when no controller is moving). */
  flightInput() {
    if (!this.active || !this.device) return null;
    const e = this.headEuler; // relative to the aircraft
    const dzn = (v, lo, hi) => (Math.abs(v) < lo ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - lo) / (hi - lo)));
    const head = new THREE.Euler().setFromQuaternion(this.headRel(), 'YXZ');
    return { roll: dzn(-head.z, 0.1, 0.45), pitch: dzn(head.x, 0.22, 0.6), throttle: 0.72 };
  }

  // ------------------------------------------------------------------ watch mode
  startTour() {
    const lab = this.lab;
    const items = [...lab.hotspots.items.values()].filter(i => i.root.visible);
    if (!items.length) { lab.ui.toast('Nothing to tour here: look around freely.'); return; }
    const self = this;
    this.tour = {
      i: -1, t: 0, items,
      next() { this.t = 999; },
      update(dt) {
        this.t += dt;
        if (this.t < 11) return;
        this.t = 0; this.i = (this.i + 1) % this.items.length;
        const it = this.items[this.i], c = lab.controls;
        const p = it.root.getWorldPosition(new THREE.Vector3());
        if (c.mode === 'walk') {
          const w = c.walk, d = new THREE.Vector3().subVectors(p, w.pos); d.y = 0;
          const L = d.length();
          if (L > 2.6) w.target = w.pos.clone().addScaledVector(d.normalize(), L - 2.4);
          self.bodyYaw += Math.atan2(-d.x, -d.z) - w.yaw;
        } else if (c.mode === 'orbit') {
          const off = lab.camera.position.clone().sub(c.orbit.target);
          c.flyTo(p.clone().add(off.setLength(Math.min(off.length(), 6))), p, 1.2);
        }
        it.onSelect?.(it);
        lab.ui.toast(`Tour stop ${this.i + 1} of ${this.items.length} · tap for the next stop`);
      },
    };
    this.tour.t = 999;
  }

  // ------------------------------------------------------------------ drawing
  render() {
    const lab = this.lab, r = lab.renderer, cam = lab.camera;
    const size = r.getSize(new THREE.Vector2());
    cam.updateMatrixWorld();
    this.stereo.update(cam);
    r.setScissorTest(true);
    const w = size.x / 2;
    r.setScissor(0, 0, w, size.y); r.setViewport(0, 0, w, size.y); r.render(lab.scene, this.stereo.cameraL);
    r.setScissor(w, 0, w, size.y); r.setViewport(w, 0, w, size.y); r.render(lab.scene, this.stereo.cameraR);
    r.setScissorTest(false);
    r.setViewport(0, 0, size.x, size.y);
  }
}

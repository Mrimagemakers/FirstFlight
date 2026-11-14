// Xbox, PlayStation and other standard game controllers for the 3D lab (screen mode; VR headsets use
// their own controllers). Buttons follow the W3C "standard" layout, which Chrome, Edge, Safari and Firefox
// report for Xbox One/Series, DualShock 4 and DualSense pads over USB or Bluetooth.
//
//  Walking / looking around          Menus and panels              Flying (cockpit)
//  Left stick   move                 D-pad / left stick  move       Left stick   fly
//  Right stick  look                 A / ✕   choose                 RT / LT      power up / down
//  Click L      run                  B / ○   back                   A / ✕        start / pause
//  A / ✕        select (centre dot)  Menu / Options  pause menu     Y / △        cockpit / outside view
//  LT / RT      zoom out / in        LB / RB  previous / next tab   Right stick  look around
//  D-pad ← →    jump to next marker  Y / △   lesson panel           D-pad ↑ ↓    zoom
//  LB / RB      previous / next station
import * as THREE from 'three';

const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, HOME: 16 };
const ORDER = ['hangar', 'walkaround', 'ramp', 'cabin', 'flight'];
const DEAD = 0.16;
const dz = v => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));
const FOCUSABLE = 'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]):not([type=hidden]), [tabindex]:not([tabindex="-1"])';

/** "xbox" | "playstation" | "generic", from the browser's controller name. */
export function padKind(id = '') {
  if (/045e|xbox|xinput|microsoft/i.test(id)) return 'xbox';
  if (/054c|sony|playstation|dualsense|dualshock|^wireless controller/i.test(id)) return 'playstation';
  return 'generic';
}
export const GLYPH = {
  xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', MENU: '☰', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT' },
  playstation: { A: '✕', B: '○', X: '□', Y: '△', MENU: 'Options', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2' },
  generic: { A: 'A', B: 'B', X: 'X', Y: 'Y', MENU: 'Start', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT' },
};

export class GamepadInput {
  constructor(lab, shell) {
    this.lab = lab; this.shell = shell;
    this.prev = [];
    this.index = null;
    this.kind = 'generic';
    this.panelFocus = false;
    this.repeat = { dir: null, t: 0 };
    this.ray = new THREE.Raycaster();
    this.center = new THREE.Vector2(0, 0);
    this.reticle = Object.assign(document.createElement('div'), { id: 'padReticle' });
    document.body.append(this.reticle);
    addEventListener('gamepadconnected', e => this.connect(e.gamepad));
    addEventListener('gamepaddisconnected', e => { if (e.gamepad.index === this.index) { this.index = null; document.body.classList.remove('pad'); this.lab.ui.toast('Controller disconnected'); } });
    // mouse or touch hands control back to the pointer
    addEventListener('pointermove', e => { if (e.pointerType && Math.abs(e.movementX) + Math.abs(e.movementY) > 2) document.body.classList.remove('pad-nav'); }, { passive: true });
    let last = performance.now();
    const loop = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; try { this.poll(dt); } catch (err) { console.warn('[gamepad]', err); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  connect(gp) {
    if (this.index != null && navigator.getGamepads?.()[this.index]) return;
    this.index = gp.index; this.kind = padKind(gp.id);
    this.prev = gp.buttons.map(b => b.pressed);
    document.body.classList.add('pad');
    const g = GLYPH[this.kind];
    const name = this.kind === 'xbox' ? 'Xbox controller' : this.kind === 'playstation' ? 'PlayStation controller' : 'Controller';
    this.lab.ui.toast(`${name} connected · ${g.A} select · ${g.MENU} menu · ${g.LB}/${g.RB} stations`);
    this.rumble(0.4, 120);
  }

  pad() {
    const pads = navigator.getGamepads?.() || [];
    let gp = this.index != null ? pads[this.index] : null;
    if (!gp || !gp.connected) {
      gp = [...pads].find(p => p && p.connected && p.mapping === 'standard') || [...pads].find(p => p && p.connected && p.buttons.length >= 12) || null;
      if (gp) this.connect(gp);
    }
    return gp;
  }

  rumble(strength = 0.5, ms = 80) {
    try { this.pad()?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }); } catch { /* not supported */ }
  }

  poll(dt) {
    if (this.lab.renderer.xr.isPresenting) return;
    const gp = this.pad();
    if (!gp) return;
    const down = gp.buttons.map(b => b.pressed);
    const hit = (i) => down[i] && !this.prev[i];
    const val = (i) => gp.buttons[i]?.value || 0;
    const ax = [dz(gp.axes[0] || 0), dz(gp.axes[1] || 0), dz(gp.axes[2] || 0), dz(gp.axes[3] || 0)];
    const any = down.some(Boolean) || ax.some(Boolean);
    if (any) document.body.classList.add('pad');

    const modal = document.querySelector('#shell .modal');
    const title = document.body.classList.contains('title');
    const ui = modal || (title ? document.querySelector('.title-screen') : null) || (this.panelFocus ? document.getElementById('panel') : null);

    // ------------------------------------------------ phone VR: the floating 3D menu replaces the screen menus
    if (this.lab.cardboard?.active) {
      if (hit(B.MENU)) this.lab.ui.vr.toggle('stations');
      if (hit(B.Y)) this.lab.ui.vr.toggle('lesson');
      if (hit(B.B) && this.lab.ui.vr.page !== 'lesson') { this.lab.ui.vr.page = 'lesson'; this.lab.ui.vr.dirty = true; }
      this.play(gp, down, hit, val, ax, dt, true);
      this.prev = down;
      return;
    }
    // ------------------------------------------------ global buttons
    if (hit(B.MENU)) { if (modal) this.back(modal); else if (!title) this.shell.pause(); }
    if (hit(B.VIEW) && !title && !modal) this.shell.help();

    if (ui) {
      this.navigate(ui, gp, down, hit, ax, dt);
    } else {
      this.play(gp, down, hit, val, ax, dt);
    }
    this.prev = down;
  }

  // ------------------------------------------------------------------ menus
  navigate(root, gp, down, hit, ax, dt) {
    document.body.classList.add('pad-nav');
    this.reticle.hidden = true;
    const items = [...root.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null && !el.closest('[hidden]'));
    if (!items.length) { this.panelFocus = false; return; }
    let cur = document.activeElement;
    if (!items.includes(cur)) { cur = items.find(i => i.classList.contains('t-primary') || i.classList.contains('primary')) || items.find(i => !i.classList.contains('m-close')) || items[0]; cur.focus({ preventScroll: false }); }

    // direction from the d-pad or the left stick, with key-repeat when held
    let dir = down[B.UP] ? 'up' : down[B.DOWN] ? 'down' : down[B.LEFT] ? 'left' : down[B.RIGHT] ? 'right' : null;
    if (!dir && Math.hypot(ax[0], ax[1]) > 0.5) dir = Math.abs(ax[0]) > Math.abs(ax[1]) ? (ax[0] > 0 ? 'right' : 'left') : (ax[1] > 0 ? 'down' : 'up');
    if (dir) {
      const fresh = this.repeat.dir !== dir;
      this.repeat.t = fresh ? 0.38 : this.repeat.t - dt;
      if (fresh || this.repeat.t <= 0) {
        if (!fresh) this.repeat.t = 0.12;
        this.repeat.dir = dir;
        if (!this.adjust(cur, dir)) this.move(items, cur, dir);
      }
    } else this.repeat.dir = null;

    if (hit(B.A)) { this.rumble(0.25, 40); if (cur.tagName === 'INPUT' && cur.type === 'checkbox') cur.click(); else if (cur.tagName === 'SELECT') this.adjust(cur, 'right'); else cur.click(); }
    if (hit(B.B)) {
      if (root.id === 'panel') { this.panelFocus = false; cur.blur(); }
      else if (root.classList.contains('modal')) this.back(root);
    }
    if (hit(B.Y) && root.id === 'panel') { this.panelFocus = false; cur.blur(); }
    // right stick scrolls long panels
    const sc = root.querySelector('.m-card') || root;
    if (Math.abs(ax[3]) > 0) sc.scrollTop += ax[3] * 900 * dt;
  }

  back(modal) { (modal.querySelector('.m-close') || modal.querySelector('[data-act=close]'))?.click(); }

  /** Left/right changes sliders and drop-downs instead of moving focus. */
  adjust(el, dir) {
    if (dir !== 'left' && dir !== 'right') return false;
    const d = dir === 'right' ? 1 : -1;
    if (el.tagName === 'SELECT') {
      el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + d));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el.tagName === 'INPUT' && el.type === 'range') {
      const step = +el.step || (+el.max - +el.min) / 20 || 1;
      el.value = Math.max(+el.min, Math.min(+el.max, +el.value + d * step));
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  /** Move focus to the nearest element in that direction (spatial navigation). */
  move(items, cur, dir) {
    const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, score = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const q = el.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2;
      const dx = x - cx, dy = y - cy;
      const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
      const across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
      if (along <= 4) continue;
      const s = along + across * 2.2;
      if (s < score) { score = s; best = el; }
    }
    if (!best) { // wrap around in lists
      const i = items.indexOf(cur);
      if (dir === 'down' || dir === 'right') best = items[(i + 1) % items.length];
      else best = items[(i - 1 + items.length) % items.length];
    }
    best.focus(); best.scrollIntoView?.({ block: 'nearest' });
    this.rumble(0.12, 25);
  }

  // ------------------------------------------------------------------ gameplay
  play(gp, down, hit, val, ax, dt, phoneVR = false) {
    const lab = this.lab, c = lab.controls, key = lab.stationKey;
    document.body.classList.remove('pad-nav');
    const flying = key === 'flight';
    this.reticle.hidden = phoneVR || flying || !document.body.classList.contains('pad');

    // stations
    if (hit(B.LB) || hit(B.RB)) {
      const i = ORDER.indexOf(key), n = ORDER[(i + (hit(B.RB) ? 1 : ORDER.length - 1)) % ORDER.length];
      this.shell.launch(n);
      return;
    }
    // lesson panel: Y moves focus into its buttons
    if (hit(B.Y) && !flying && !phoneVR) { this.panelFocus = true; document.body.classList.remove('panel-collapsed'); return; }

    if (flying) {
      // the flight station reads the left stick, triggers and A itself
      if (hit(B.Y)) lab.station?.impl?.toggleView?.();
      if (hit(B.X)) this.panelFocus = true;
      if (c.mode === 'cockpit' && !phoneVR) {
        const k = 2.2 * dt * (lab.camera.fov / 60);
        c.cockpit.yaw = THREE.MathUtils.clamp(c.cockpit.yaw - ax[2] * k, -c.cockpit.limits[0], c.cockpit.limits[0]);
        c.cockpit.pitch = THREE.MathUtils.clamp(c.cockpit.pitch - ax[3] * k, -c.cockpit.limits[1], c.cockpit.limits[1]);
        if (hit(B.RS)) { c.cockpit.yaw = 0; c.cockpit.pitch = -0.14; }
      } else if (c.mode === 'orbit') this.orbit(c, ax[2], ax[3], dt);
      if (down[B.UP]) c.zoom(Math.exp(-1.2 * dt)); if (down[B.DOWN]) c.zoom(Math.exp(1.2 * dt));
      return;
    }

    // zoom on the triggers
    const zt = val(B.RT) - val(B.LT);
    if (Math.abs(zt) > 0.05) c.zoom(Math.exp(-zt * 1.4 * dt));

    if (c.mode === 'walk') {
      const w = c.walk, k = 2.4 * dt * (lab.camera.fov / 60);
      w.yaw -= ax[2] * k;
      if (!phoneVR) w.pitch = THREE.MathUtils.clamp(w.pitch - ax[3] * k * 0.8, -1.35, 1.35);
      if (ax[0] || ax[1]) {
        w.target = null;
        const sp = w.speed * (down[B.LS] ? 2.2 : 1) * Math.min(1, Math.hypot(ax[0], ax[1]));
        const n = Math.hypot(ax[0], ax[1]) || 1;
        const f = new THREE.Vector3(-Math.sin(w.yaw), 0, -Math.cos(w.yaw)), r = new THREE.Vector3(Math.cos(w.yaw), 0, -Math.sin(w.yaw));
        w.pos.addScaledVector(f, -ax[1] / n * sp * dt).addScaledVector(r, ax[0] / n * sp * dt);
      }
    } else if (c.mode === 'orbit') {
      this.orbit(c, ax[2] || ax[0], ax[3] || ax[1], dt);
    }

    // highlight and select whatever sits under the centre dot
    this.ray.setFromCamera(this.center, lab.camera);
    const over = lab.hotspots.hover(this.ray);
    this.reticle.classList.toggle('on', !!over);
    if (hit(B.A)) { this.ray.setFromCamera(this.center, lab.camera); if (lab.pickRay(this.ray)) this.rumble(0.45, 70); }
    if (hit(B.LEFT) || hit(B.RIGHT)) this.cycle(hit(B.RIGHT) ? 1 : -1);
    if (hit(B.RS)) c.resetZoom();
  }

  orbit(c, x, y, dt) {
    const o = c.orbit;
    if (!x && !y) return;
    c.tween = null;
    if (o._rotateLeft) { o._rotateLeft(x * 2.2 * dt); o._rotateUp(y * 1.6 * dt); }
  }

  /** D-pad left/right: turn to face the next visible marker. */
  cycle(d) {
    const lab = this.lab, c = lab.controls, cam = lab.camera;
    const items = [...lab.hotspots.items.values()].filter(i => i.root.visible && lab.hotspots.group.visible);
    if (!items.length) return;
    const p = cam.getWorldPosition(new THREE.Vector3()), fwd = cam.getWorldDirection(new THREE.Vector3());
    const ang = it => { const v = it.root.getWorldPosition(new THREE.Vector3()).sub(p); return Math.atan2(fwd.x * v.z - fwd.z * v.x, fwd.x * v.x + fwd.z * v.z); };
    const near = items.filter(i => i.root.getWorldPosition(new THREE.Vector3()).distanceTo(p) < 40);
    const list = (near.length ? near : items).map(i => ({ i, a: ang(i) })).sort((a, b) => a.a - b.a);
    let pick = d > 0 ? list.find(e => e.a > 0.05) || list[0] : [...list].reverse().find(e => e.a < -0.05) || list[list.length - 1];
    const target = pick.i.root.getWorldPosition(new THREE.Vector3());
    if (c.mode === 'walk') {
      const v = target.clone().sub(p);
      c.walk.yaw = Math.atan2(-v.x, -v.z);
      c.walk.pitch = THREE.MathUtils.clamp(Math.atan2(v.y, Math.hypot(v.x, v.z)), -1.2, 1.2);
    } else if (c.mode === 'orbit') {
      const off = cam.position.clone().sub(c.orbit.target);
      c.flyTo(target.clone().add(off.setLength(Math.min(off.length(), 12))), target, 0.6);
    }
    this.rumble(0.2, 40);
  }
}

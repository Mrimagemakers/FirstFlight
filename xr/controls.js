// Desktop (orbit / walk / cockpit) and WebXR (teleport, snap-turn, rays) controls.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { settings, onSettings } from './settings.js';

const tmpV = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class DesktopControls {
  constructor(lab) {
    this.lab = lab;
    this.camera = lab.camera;
    this.dom = lab.renderer.domElement;
    this.enabled = true;
    this.mode = 'orbit';
    this.keys = new Set();
    this.orbit = new OrbitControls(this.camera, this.dom);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.screenSpacePanning = true;
    this.walk = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, eye: 1.65, speed: 2.2, bounds: null, target: null };
    this.cockpit = { yaw: 0, pitch: 0, limits: [1.9, 0.9] };
    this.tween = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = { down: false, x: 0, y: 0, sx: 0, sy: 0, moved: 0, id: null };

    const d = this.dom;
    d.style.touchAction = 'none';
    d.addEventListener('pointerdown', e => this.onDown(e));
    d.addEventListener('pointermove', e => this.onMove(e));
    d.addEventListener('pointerup', e => this.onUp(e));
    d.addEventListener('pointercancel', () => (this.pointer.down = false));
    d.addEventListener('dblclick', () => { if (this.mode === 'cockpit') { this.cockpit.yaw = 0; this.cockpit.pitch = 0; } });
    addEventListener('keydown', e => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      this.keys.add(e.code);
      if (this.mode === 'walk' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  reset() {
    this.tween = null;
    this.walk.target = null;
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();
  }

  /** Re-apply the last mode after XR exits. */
  restore() {
    this.camera.position.set(0, 0, 0);
    this.camera.quaternion.identity();
    if (this.mode === 'orbit') { this.camera.position.copy(this.lastOrbit?.position || new THREE.Vector3(8, 4, 8)); this.orbit.update(); }
  }

  setOrbit({ target, position, min = 2, max = 60, maxPolar = Math.PI * 0.49, minPolar = 0, fov = 50, pan = true, animate = false }) {
    this.mode = 'orbit';
    this.orbit.enabled = true;
    this.orbit.minDistance = min;
    this.orbit.maxDistance = max;
    this.orbit.maxPolarAngle = maxPolar;
    this.orbit.minPolarAngle = minPolar;
    this.orbit.enablePan = pan;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    if (animate) this.flyTo(position, target);
    else {
      this.orbit.target.copy(target);
      this.camera.position.copy(position);
      this.orbit.update();
    }
    this.lastOrbit = { position: position.clone(), target: target.clone() };
  }

  flyTo(position, target, duration = 1.1) {
    this.tween = { t: 0, duration, fromP: this.camera.position.clone(), toP: position.clone(), fromT: this.orbit.target.clone(), toT: target.clone() };
  }

  setWalk({ position, yaw = 0, pitch = -0.05, eye = 1.65, bounds = null, speed = 2.2, fov = 70 }) {
    this.mode = 'walk';
    this.orbit.enabled = false;
    Object.assign(this.walk, { yaw, pitch, eye, bounds, speed, target: null });
    this.walk.pos.copy(position);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  setCockpit({ fov = 68, limits = [1.9, 0.9] } = {}) {
    this.mode = 'cockpit';
    this.orbit.enabled = false;
    this.cockpit.yaw = 0; this.cockpit.pitch = -0.14; this.cockpit.limits = limits;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  onDown(e) {
    if (!this.enabled) return;
    const p = this.pointer;
    p.down = true; p.id = e.pointerId; p.x = p.sx = e.clientX; p.y = p.sy = e.clientY; p.moved = 0;
    if (this.mode !== 'orbit') this.dom.setPointerCapture(e.pointerId);
    this.tween = null;
  }

  onMove(e) {
    const p = this.pointer;
    if (!p.down || !this.enabled) { this.hover(e); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    p.moved += Math.abs(dx) + Math.abs(dy);
    const k = 0.0042 * (this.camera.fov / 60);
    if (this.mode === 'walk') {
      this.walk.yaw += dx * k;
      this.walk.pitch = THREE.MathUtils.clamp(this.walk.pitch + dy * k, -1.35, 1.35);
      this.walk.target = null;
    } else if (this.mode === 'cockpit') {
      this.cockpit.yaw = THREE.MathUtils.clamp(this.cockpit.yaw + dx * k, -this.cockpit.limits[0], this.cockpit.limits[0]);
      this.cockpit.pitch = THREE.MathUtils.clamp(this.cockpit.pitch + dy * k, -this.cockpit.limits[1], this.cockpit.limits[1]);
    }
  }

  hover(e) {
    const rect = this.dom.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), this.camera);
    this.lab.hotspots.hover(this.raycaster);
    this.dom.style.cursor = this.lab.hotspots.hovered ? 'pointer' : (this.mode === 'orbit' ? 'grab' : 'crosshair');
  }

  onUp(e) {
    const p = this.pointer;
    if (!p.down) return;
    p.down = false;
    if (p.moved < 6 && this.enabled) this.click(e);
  }

  click(e) {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    if (this.lab.pickRay(this.raycaster)) return;
    // walk to a clicked floor point
    if (this.mode === 'walk' && this.lab.floors?.length) {
      const hit = this.raycaster.intersectObjects(this.lab.floors, true)[0];
      if (hit) this.walk.target = hit.point.clone();
    }
  }

  update(dt) {
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      const s = tw.t * tw.t * (3 - 2 * tw.t);
      this.camera.position.lerpVectors(tw.fromP, tw.toP, s);
      this.orbit.target.lerpVectors(tw.fromT, tw.toT, s);
      if (tw.t >= 1) this.tween = null;
    }
    if (this.mode === 'orbit') {
      if (this.orbit.enabled) this.orbit.update();
      return;
    }
    if (this.mode === 'walk') {
      const w = this.walk;
      const fwd = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
      const side = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
      const turn = (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0);
      w.yaw += turn * dt * 1.6;
      const speed = w.speed * (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 2.2 : 1);
      if (fwd || side) {
        w.target = null;
        const f = new THREE.Vector3(-Math.sin(w.yaw), 0, -Math.cos(w.yaw));
        const r = new THREE.Vector3(Math.cos(w.yaw), 0, -Math.sin(w.yaw));
        w.pos.addScaledVector(f, fwd * speed * dt).addScaledVector(r, side * speed * dt);
      } else if (w.target) {
        tmpV.copy(w.target).sub(w.pos); tmpV.y = 0;
        const d = tmpV.length();
        if (d < 0.15) w.target = null;
        else {
          w.pos.addScaledVector(tmpV.normalize(), Math.min(d, speed * 1.4 * dt));
          // gently turn toward travel direction
          const desired = Math.atan2(-tmpV.x, -tmpV.z);
          let diff = ((desired - w.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          if (d > 1.2) w.yaw += diff * Math.min(1, dt * 1.5);
        }
      }
      if (w.bounds) w.bounds(w.pos);
      this.camera.position.set(w.pos.x, w.pos.y + w.eye, w.pos.z);
      this.camera.rotation.set(w.pitch, w.yaw, 0, 'YXZ');
      return;
    }
    if (this.mode === 'cockpit') {
      // camera position is driven by the station (attached to the aircraft); we only add head look
      this.camera.rotation.set(this.cockpit.pitch, this.cockpit.yaw, 0, 'YXZ');
    }
  }
}

/**
 * WebXR controllers.
 * Right hand: trigger selects, stick forward = teleport (release to jump), stick left/right = turn.
 * Left hand: stick walks (click to go faster), X shows/hides the menu panel, Y opens Stations.
 * Stations can claim the A/B buttons (flight: A = engine, B = recenter seat).
 */
const BTN = { trigger: 0, squeeze: 1, stick: 3, a: 4, b: 5 };
export class XRControls {
  constructor(lab) {
    this.lab = lab;
    const r = lab.renderer;
    this.controllers = [];
    this.grips = [];
    this.raycaster = new THREE.Raycaster();
    this.axes = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
    this.buttons = { left: [], right: [] };
    this.prev = { left: [], right: [] };
    this.sources = { left: null, right: null };
    this.turnLatch = false;
    this.teleport = { active: false, valid: false, point: new THREE.Vector3() };
    this.floorY = 0;
    const factory = new XRControllerModelFactory();
    factory.path = new URL('../vendor/xr-profiles', import.meta.url).href;
    // Hand tracking: realistic hand meshes that follow your fingers (pinch to select)
    const handFactory = new XRHandModelFactory();
    handFactory.setPath(factory.path.replace(/\/?$/, '/') + 'generic-hand/');
    this.hands = [0, 1].map(i => { const h = r.xr.getHand(i); h.add(handFactory.createHandModel(h, 'mesh')); lab.rig.add(h); return h; });

    for (let i = 0; i < 2; i++) {
      const c = r.xr.getController(i);
      const grip = r.xr.getControllerGrip(i);
      c.userData.index = i;
      c.addEventListener('connected', e => {
        c.userData.handedness = e.data.handedness;
        c.userData.source = e.data;
        grip.userData.handedness = e.data.handedness;
        const hand = !!e.data.hand;
        if (e.data.handedness === 'left' && !hand) lab.ui.vr.setHandAnchor(grip);
        this.updateHints();
      });
      c.addEventListener('disconnected', () => {
        if (c.userData.handedness === 'left' && lab.ui.vr.handAnchor === grip) lab.ui.vr.setHandAnchor(null);
        c.userData.handedness = null; c.userData.source = null;
      });
      c.addEventListener('selectstart', () => this.select(c));
      c.addEventListener('squeezestart', () => { if (!lab.ui.vr.inHand) lab.ui.vr.summon(); });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xf2c879, transparent: true, opacity: 0.8 }));
      line.scale.z = 5;
      line.name = 'ray';
      c.add(line);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.01, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
      dot.visible = false;
      c.add(dot);
      c.userData.dot = dot;
      lab.rig.add(c);
      grip.add(factory.createControllerModel(grip));
      lab.rig.add(grip);
      this.controllers.push(c);
      this.grips.push(grip);
    }

    // Teleport arc + landing marker
    this.arcN = 64;
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.arcN * 3), 3));
    this.arc = new THREE.Line(arcGeo, new THREE.LineBasicMaterial({ color: 0x7fe0c0 }));
    this.arc.frustumCulled = false;
    this.arc.visible = false;
    lab.scene.add(this.arc);
    this.ring = new THREE.Group();
    this.ring.add(new THREE.Mesh(new THREE.RingGeometry(0.24, 0.32, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fe0c0, transparent: true, opacity: 0.85, depthWrite: false })));
    this.ring.add(new THREE.Mesh(new THREE.CircleGeometry(0.24, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fe0c0, transparent: true, opacity: 0.18, depthWrite: false })));
    this.ring.visible = false;
    lab.scene.add(this.ring);

    // Short fade to black on teleport (comfort)
    this.fade = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false }));
    this.fade.renderOrder = 999;
    this.fade.visible = false;
    lab.camera.add(this.fade);
    this.fadeT = 0; this.pendingJump = null;

    onSettings(k => {
      if (k === 'seatedOffset' && lab.renderer.xr.isPresenting && lab.stationKey !== 'flight') this.applyHeight();
      if (k === 'showHints' || k === 'locomotion') this.updateHints();
    });
  }

  // ---------------------------------------------------------------- helpers
  handOf(c) { return c.userData.handedness === 'left' ? 'left' : 'right'; }

  rayFrom(c) {
    const m = new THREE.Matrix4().identity().extractRotation(c.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(m);
    this.raycaster.far = 200;
    this.raycaster.source = c;
    return this.raycaster;
  }

  /** Short vibration on the controller, where supported. */
  buzz(c, intensity = 0.3, ms = 20) {
    try { const h = c?.userData?.source?.gamepad?.hapticActuators?.[0]; h?.pulse?.(intensity, ms); } catch { /* not supported */ }
  }

  /** Is the left controller's ray hidden because it is holding the panel? */
  leftBusy(c) { return this.handOf(c) === 'left' && this.lab.ui.vr.inHand && this.lab.ui.vr.mesh.visible; }

  select(c) {
    const lab = this.lab;
    if (this.leftBusy(c)) return;
    lab.audio?.click();
    this.buzz(c, 0.45, 25);
    if (lab.pickRay(this.rayFrom(c), { fromXR: true })) return;
    lab.station?.xrSelect?.(c);
  }

  /** Floor height plus the player's height adjustment. */
  applyHeight() { this.lab.rig.position.y = this.floorY + (settings.seatedOffset || 0); }
  placed(y) { this.floorY = y; this.applyHeight(); }

  /** Bring the player back to the station's starting spot. */
  recenter() {
    const lab = this.lab;
    if (lab.stationKey === 'flight') { lab.station?.impl && (lab.station.impl.recenter = true); return; }
    this.blink(() => lab.placeXR(true));
  }

  blink(fn) {
    if (!settings.teleportFade) { fn(); return; }
    this.pendingJump = fn; this.fadeT = 0.0001; this.fade.visible = true;
  }

  // ---------------------------------------------------------------- button labels on the controllers
  makeHint(lines) {
    const W = 512, H = 64 + lines.length * 52;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.fillStyle = 'rgba(12,24,33,0.86)'; x.beginPath(); x.roundRect(0, 0, W, H, 26); x.fill();
    x.strokeStyle = 'rgba(232,196,130,0.6)'; x.lineWidth = 3; x.stroke();
    lines.forEach(([k, v], i) => {
      const y = 62 + i * 52;
      x.fillStyle = '#f2c879'; x.font = '700 32px system-ui'; x.fillText(k, 26, y);
      x.fillStyle = '#eef3f4'; x.font = '500 32px system-ui'; x.fillText(v, 190, y);
    });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const w = 0.15, m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * H / W), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    m.renderOrder = 55;
    return m;
  }

  updateHints() {
    const lab = this.lab, flight = lab.stationKey === 'flight';
    const sets = {
      right: flight ? [['Stick', 'power ↑↓'], ['A', 'engine on/off'], ['B', 'recenter seat'], ['Trigger', 'select']]
        : [['Trigger', 'select'], ['Stick ↑', 'teleport'], ['Stick ↔', 'turn']],
      left: flight ? [['Stick', 'fly'], ['X', 'menu'], ['Y', 'stations']]
        : [['Stick', settings.locomotion === 'teleport' ? '—' : 'walk (click: fast)'], ['X', 'menu'], ['Y', 'stations']],
    };
    this.grips.forEach(g => {
      if (g.userData.hint) { g.remove(g.userData.hint); g.userData.hint.material.map.dispose(); g.userData.hint = null; }
      const hand = g.userData.handedness;
      if (!settings.showHints || !hand || hand === 'none') return;
      const m = this.makeHint(sets[hand === 'left' ? 'left' : 'right']);
      // a small card floating just above and behind the controller, tilted toward the face
      m.position.set(hand === 'left' ? -0.06 : 0.06, 0.07, 0.07);
      m.rotation.set(-0.9, hand === 'left' ? 0.35 : -0.35, 0, 'YXZ');
      g.add(m); g.userData.hint = m;
    });
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const lab = this.lab;
    const session = lab.renderer.xr.getSession();
    if (!session) return;
    this.axes.left.x = this.axes.left.y = this.axes.right.x = this.axes.right.y = 0;
    for (const hand of ['left', 'right']) { this.prev[hand] = this.buttons[hand]; this.buttons[hand] = []; }
    for (const src of session.inputSources) {
      const gp = src.gamepad;
      if (!gp) continue;
      const a = gp.axes;
      const x = a.length >= 4 ? a[2] : a[0] || 0;
      const y = a.length >= 4 ? a[3] : a[1] || 0;
      const hand = src.handedness === 'left' ? 'left' : 'right';
      this.axes[hand].x = Math.abs(x) > 0.15 ? x : 0;
      this.axes[hand].y = Math.abs(y) > 0.15 ? y : 0;
      this.buttons[hand] = gp.buttons.map(b => b.pressed);
    }
    const pressed = (hand, i) => this.buttons[hand][i] && !this.prev[hand][i];

    // menu shortcuts
    if (pressed('left', BTN.a)) lab.ui.vr.toggle();
    if (pressed('left', BTN.b)) lab.ui.vr.toggle('stations');
    for (const [hand, i, name] of [['right', BTN.a, 'a'], ['right', BTN.b, 'b']]) if (pressed(hand, i)) lab.station?.xrButton?.(name);

    // fade for teleports
    if (this.fadeT > 0) {
      this.fadeT += dt;
      const t = this.fadeT, half = 0.09;
      if (t >= half && this.pendingJump) { const f = this.pendingJump; this.pendingJump = null; f(); }
      this.fade.material.opacity = t < half ? t / half : Math.max(0, 1 - (t - half) / 0.14);
      if (t > half + 0.14) { this.fadeT = 0; this.fade.visible = false; }
    }

    // hover + ray length; hide the left ray while it holds the panel
    for (const c of this.controllers) {
      const line = c.getObjectByName('ray');
      const busy = this.leftBusy(c) || !c.userData.handedness;
      line.visible = !busy;
      if (busy) { c.userData.dot.visible = false; continue; }
      const rc = this.rayFrom(c);
      rc.camera = lab.renderer.xr.getCamera();
      const d = lab.ui.vr.hit(rc) ?? lab.hotspots.hover(rc, true);
      if (d && !c.userData.hovering) this.buzz(c, 0.12, 10);
      c.userData.hovering = !!d;
      line.scale.z = d ? d : 5;
      line.material.opacity = d ? 1 : 0.55;
      c.userData.dot.visible = !!d;
      if (d) c.userData.dot.position.set(0, 0, -d);
    }

    const mode = lab.station?.xrLocomotion || 'teleport';
    if (mode === 'none') { this.arc.visible = this.ring.visible = false; return; }

    // teleport (right stick forward, release to jump) — takes priority over turning
    const rx = this.axes.right.x, ry = this.axes.right.y;
    const rightC = this.controllers.find(c => c.userData.handedness === 'right') || this.controllers[1];
    if (ry < -0.55 && lab.floors?.length) {
      this.teleport.active = true;
      this.updateArc(rightC);
    } else if (this.teleport.active && ry > -0.3) {
      this.teleport.active = false;
      this.arc.visible = this.ring.visible = false;
      if (this.teleport.valid) {
        const point = this.teleport.point.clone();
        this.blink(() => {
          const head = new THREE.Vector3();
          lab.renderer.xr.getCamera().getWorldPosition(head);
          const offset = new THREE.Vector3(head.x - lab.rig.position.x, 0, head.z - lab.rig.position.z);
          lab.rig.position.set(point.x - offset.x, lab.rig.position.y, point.z - offset.z);
          lab.station?.xrBounds?.(lab.rig.position);
          this.placed(point.y);
        });
        this.buzz(rightC, 0.3, 30);
      }
    }

    // turning (right stick sideways): snap by default, smooth if chosen in comfort settings
    const head = new THREE.Vector3();
    const turning = !this.teleport.active && Math.abs(ry) < 0.5;
    if (settings.turnMode === 'smooth') {
      if (turning && Math.abs(rx) > 0.2) {
        lab.renderer.xr.getCamera().getWorldPosition(head);
        const angle = -rx * dt * 1.8;
        lab.rig.position.sub(head).applyAxisAngle(UP, angle).add(head);
        lab.rig.rotation.y += angle;
      }
    } else if (turning && Math.abs(rx) > 0.7 && !this.turnLatch) {
      this.turnLatch = true;
      lab.renderer.xr.getCamera().getWorldPosition(head);
      const angle = -Math.sign(rx) * THREE.MathUtils.degToRad(settings.snapAngle || 30);
      lab.rig.position.sub(head).applyAxisAngle(UP, angle).add(head);
      lab.rig.rotation.y += angle;
      lab.audio?.click();
    } else if (Math.abs(rx) < 0.3) this.turnLatch = false;

    // smooth locomotion (left stick) relative to head yaw; click the stick to move faster
    const lx = this.axes.left.x, ly = this.axes.left.y;
    if ((lx || ly) && settings.locomotion !== 'teleport') {
      const cam = lab.renderer.xr.getCamera();
      const q = new THREE.Quaternion(); cam.getWorldQuaternion(q);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q); fwd.y = 0; fwd.normalize();
      const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
      const speed = this.buttons.left[BTN.stick] ? 4.2 : 2.0;
      lab.rig.position.addScaledVector(fwd, -ly * speed * dt).addScaledVector(right, lx * speed * dt);
      lab.station?.xrBounds?.(lab.rig.position);
      this.applyHeight();
    }
  }

  updateArc(c) {
    const lab = this.lab, N = this.arcN;
    const origin = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(c.getWorldQuaternion(new THREE.Quaternion()));
    const v = dir.multiplyScalar(9), g = new THREE.Vector3(0, -9.8, 0);
    const pts = this.arc.geometry.attributes.position;
    const ray = new THREE.Raycaster();
    let prev = origin.clone(), hitPoint = null, n = 0;
    for (let i = 0; i < N; i++) {
      const t = i * 0.045;
      const p = origin.clone().addScaledVector(v, t).addScaledVector(g, 0.5 * t * t);
      if (i > 0 && !hitPoint) {
        const seg = p.clone().sub(prev);
        ray.set(prev, seg.clone().normalize());
        ray.far = seg.length();
        const hit = ray.intersectObjects(lab.floors, true)[0];
        if (hit) { hitPoint = hit.point; pts.setXYZ(i, hit.point.x, hit.point.y, hit.point.z); n = i + 1; break; }
      }
      pts.setXYZ(i, p.x, p.y, p.z);
      prev = p; n = i + 1;
    }
    for (let i = n; i < N; i++) pts.setXYZ(i, pts.getX(n - 1), pts.getY(n - 1), pts.getZ(n - 1));
    pts.needsUpdate = true;
    this.arc.visible = true;
    if (!!hitPoint !== this.teleport.valid) this.buzz(c, 0.1, 8);
    this.teleport.valid = !!hitPoint;
    this.arc.material.color.set(hitPoint ? 0x7fe0c0 : 0xe07f7f);
    this.ring.visible = !!hitPoint;
    if (hitPoint) { this.ring.position.copy(hitPoint).y += 0.02; this.teleport.point.copy(hitPoint); }
  }
}

// Desktop (orbit / walk / cockpit) and WebXR (teleport, snap-turn, rays) controls.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { settings } from './settings.js';

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

/** WebXR controllers: laser pointers, trigger select, teleport arc, snap turn and smooth locomotion. */
export class XRControls {
  constructor(lab) {
    this.lab = lab;
    const r = lab.renderer;
    this.controllers = [];
    this.raycaster = new THREE.Raycaster();
    this.axes = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
    this.buttons = { left: [], right: [] };
    this.turnLatch = false;
    this.teleport = { active: false, valid: false, point: new THREE.Vector3(), hand: null };
    const factory = new XRControllerModelFactory();
    factory.path = new URL('../vendor/xr-profiles', import.meta.url).href;

    for (let i = 0; i < 2; i++) {
      const c = r.xr.getController(i);
      c.userData.index = i;
      c.addEventListener('connected', e => { c.userData.handedness = e.data.handedness; c.userData.gamepad = e.data.gamepad; });
      c.addEventListener('disconnected', () => { c.userData.handedness = null; });
      c.addEventListener('selectstart', () => this.select(c));
      c.addEventListener('squeezestart', () => lab.ui.vr.summon());
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xf2c879, transparent: true, opacity: 0.85 }));
      line.scale.z = 6;
      line.name = 'ray';
      c.add(line);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf2c879 }));
      dot.visible = false;
      c.add(dot);
      c.userData.dot = dot;
      lab.rig.add(c);
      const grip = r.xr.getControllerGrip(i);
      grip.add(factory.createControllerModel(grip));
      lab.rig.add(grip);
      this.controllers.push(c);
    }

    // Teleport arc + landing ring
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(40 * 3), 3));
    this.arc = new THREE.Line(arcGeo, new THREE.LineBasicMaterial({ color: 0x7fe0c0 }));
    this.arc.frustumCulled = false;
    this.arc.visible = false;
    lab.scene.add(this.arc);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fe0c0, transparent: true, opacity: 0.8, depthWrite: false }));
    this.ring.visible = false;
    lab.scene.add(this.ring);
  }

  rayFrom(c) {
    const m = new THREE.Matrix4().identity().extractRotation(c.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(m);
    this.raycaster.far = 200;
    return this.raycaster;
  }

  select(c) {
    this.lab.audio?.click();
    if (this.lab.station?.xrSelect?.(c)) return;
    this.lab.pickRay(this.rayFrom(c), { fromXR: true });
  }

  update(dt) {
    const lab = this.lab;
    const session = lab.renderer.xr.getSession();
    if (!session) return;
    this.axes.left.x = this.axes.left.y = this.axes.right.x = this.axes.right.y = 0;
    for (const src of session.inputSources) {
      const gp = src.gamepad;
      if (!gp) continue;
      const a = gp.axes;
      const x = a.length >= 4 ? a[2] : a[0] || 0;
      const y = a.length >= 4 ? a[3] : a[1] || 0;
      const hand = src.handedness === 'left' ? 'left' : 'right';
      this.axes[hand].x = Math.abs(x) > 0.12 ? x : 0;
      this.axes[hand].y = Math.abs(y) > 0.12 ? y : 0;
      this.buttons[hand] = gp.buttons.map(b => b.pressed);
    }

    // hover + ray length
    for (const c of this.controllers) {
      const rc = this.rayFrom(c);
      rc.camera = lab.renderer.xr.getCamera();
      const d = lab.ui.vr.hit(rc) ?? lab.hotspots.hover(rc, true);
      const line = c.getObjectByName('ray');
      if (line) line.scale.z = d ? d : 6;
      c.userData.dot.visible = !!d;
      if (d) c.userData.dot.position.set(0, 0, -d);
    }

    const mode = lab.station?.xrLocomotion || 'teleport';
    if (mode === 'none') return;

    // turning (right stick x): snap by default, smooth if chosen in comfort settings
    const rx = this.axes.right.x;
    const head = new THREE.Vector3();
    if (settings.turnMode === 'smooth' && Math.abs(rx) > 0.2) {
      lab.renderer.xr.getCamera().getWorldPosition(head);
      const angle = -rx * dt * 1.8;
      lab.rig.position.sub(head).applyAxisAngle(UP, angle).add(head);
      lab.rig.rotation.y += angle;
    } else if (settings.turnMode !== 'smooth') {
      if (Math.abs(rx) > 0.7 && !this.turnLatch) {
        this.turnLatch = true;
        lab.renderer.xr.getCamera().getWorldPosition(head);
        const angle = -Math.sign(rx) * THREE.MathUtils.degToRad(settings.snapAngle || 30);
        lab.rig.position.sub(head).applyAxisAngle(UP, angle).add(head);
        lab.rig.rotation.y += angle;
        lab.audio?.click();
      } else if (Math.abs(rx) < 0.3) this.turnLatch = false;
    }

    // smooth locomotion (left stick) relative to head yaw
    const lx = this.axes.left.x, ly = this.axes.left.y;
    if ((lx || ly) && settings.locomotion !== 'teleport') {
      const cam = lab.renderer.xr.getCamera();
      const q = new THREE.Quaternion(); cam.getWorldQuaternion(q);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q); fwd.y = 0; fwd.normalize();
      const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
      lab.rig.position.addScaledVector(fwd, -ly * 1.6 * dt).addScaledVector(right, lx * 1.6 * dt);
      lab.station?.xrBounds?.(lab.rig.position);
    }

    // teleport (right stick forward, release to jump)
    const ry = this.axes.right.y;
    const rightC = this.controllers.find(c => c.userData.handedness === 'right') || this.controllers[1];
    if (ry < -0.6 && lab.floors?.length) {
      this.teleport.active = true;
      this.updateArc(rightC);
    } else if (this.teleport.active) {
      this.teleport.active = false;
      this.arc.visible = this.ring.visible = false;
      if (this.teleport.valid) {
        const head = new THREE.Vector3();
        lab.renderer.xr.getCamera().getWorldPosition(head);
        const offset = new THREE.Vector3(head.x - lab.rig.position.x, 0, head.z - lab.rig.position.z);
        lab.rig.position.set(this.teleport.point.x - offset.x, this.teleport.point.y, this.teleport.point.z - offset.z);
        lab.station?.xrBounds?.(lab.rig.position);
      }
    }
  }

  updateArc(c) {
    const lab = this.lab;
    const origin = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(c.getWorldQuaternion(new THREE.Quaternion()));
    const v = dir.multiplyScalar(7), g = new THREE.Vector3(0, -9.8, 0);
    const pts = this.arc.geometry.attributes.position;
    const ray = new THREE.Raycaster();
    let prev = origin.clone(), hitPoint = null, n = 0;
    for (let i = 0; i < 40; i++) {
      const t = i * 0.05;
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
    for (let i = n; i < 40; i++) pts.setXYZ(i, pts.getX(n - 1), pts.getY(n - 1), pts.getZ(n - 1));
    pts.needsUpdate = true;
    this.arc.visible = true;
    this.teleport.valid = !!hitPoint;
    this.arc.material.color.set(hitPoint ? 0x7fe0c0 : 0xe07f7f);
    this.ring.visible = !!hitPoint;
    if (hitPoint) { this.ring.position.copy(hitPoint).y += 0.02; this.teleport.point.copy(hitPoint); }
  }
}

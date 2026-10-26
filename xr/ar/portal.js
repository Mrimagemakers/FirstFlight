// First Flight AR Aircraft Explorer: 3D viewer + WebXR AR (Android Chrome, Meta Quest) + AR Quick Look (iPhone/iPad).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CATALOG } from '../models/parts.js';
import { blobTexture, wrapText } from '../util.js';

const $ = id => document.getElementById(id);
const ASSET = new URL('../assets/', import.meta.url).href;
const embedded = (() => { try { return window.self !== window.top; } catch { return true; } })();
if (embedded) document.body.classList.add('embedded');

// ------------------------------------------------------------------ renderer, scene, lighting
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.85;
const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 500);
camera.position.set(3, 2, 4);
const hemi = new THREE.HemisphereLight(0xdfeaff, 0x3a3226, 0.6);
const sun = new THREE.DirectionalLight(0xfff3e2, 2.4);
sun.castShadow = true; sun.shadow.mapSize.setScalar(2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(hemi, sun, sun.target);

// texture loader shim so the shared model builders work outside the main lab
const texCache = new Map(), loader = new THREE.TextureLoader();
const lab = {
  renderer, scene, quality: 'high', maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
  tex(name, { repeat = [1, 1], srgb = false, anisotropy = 12 } = {}) {
    const key = name + repeat.join('x') + srgb;
    if (texCache.has(key)) return texCache.get(key);
    const t = loader.load(ASSET + 'tex/' + name);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = Math.min(anisotropy, this.maxAnisotropy);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t); return t;
  },
};

// holder: placed / rotated / scaled in AR; model + labels live inside it
const holder = new THREE.Group(); scene.add(holder);
const labelLayer = new THREE.Group(); scene.add(labelLayer);
// ground: soft disc + shadow catcher (the catcher alone is used in AR)
const groundDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0.55, depthWrite: false, color: 0x0a1218 }));
groundDisc.renderOrder = -1;
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.32 }));
shadowCatcher.receiveShadow = true;
holder.add(groundDisc, shadowCatcher);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.495;

// ------------------------------------------------------------------ labels (sprites with leader lines)
function labelSprite(text, n) {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = '600 40px system-ui, sans-serif';
  const w = Math.min(900, Math.ceil(x.measureText(text).width) + 104), h = 72;
  c.width = w; c.height = h;
  const draw = (hi) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = hi ? 'rgba(224,177,108,0.97)' : 'rgba(12,24,33,0.88)';
    x.beginPath(); x.roundRect(2, 2, w - 4, h - 4, 34); x.fill();
    x.strokeStyle = hi ? '#fff3d6' : 'rgba(224,177,108,0.8)'; x.lineWidth = 3; x.stroke();
    x.fillStyle = hi ? '#13212b' : '#e0b16c'; x.beginPath(); x.arc(38, h / 2, 22, 0, Math.PI * 2); x.fill();
    x.fillStyle = hi ? '#e0b16c' : '#13212b'; x.font = '700 26px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 38, h / 2 + 1);
    x.fillStyle = hi ? '#13212b' : '#f2f5f5'; x.font = '600 40px system-ui, sans-serif'; x.textAlign = 'left'; x.fillText(text, 72, h / 2 + 2);
    tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, toneMapped: false }));
  s.renderOrder = 50; s.center.set(0.5, 0); s.userData.aspect = w / h; s.userData.draw = draw;
  draw(false);
  return s;
}

let current = null, labels = [], selected = -1, showLabels = true, animate = true, explodeTarget = 0, explode = 0;
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();

function buildLabels(model) {
  labelLayer.clear();
  labels = model.labels.map((l, i) => {
    const sprite = labelSprite(l.title, i + 1);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xe0b16c, depthTest: false, toneMapped: false }));
    dot.renderOrder = 49;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xe0b16c, depthTest: false, transparent: true, opacity: 0.9 }));
    line.renderOrder = 48; line.frustumCulled = false;
    sprite.userData.index = i;
    labelLayer.add(sprite, dot, line);
    return { ...l, sprite, dot, line, parent: l.parent || model.root };
  });
}

/** World-space anchor: parent origin + offset rotated/scaled like the model root (ignores spinning parts). */
function anchorWorld(l, out) {
  l.parent.getWorldPosition(out);
  current.root.getWorldQuaternion(q); current.root.getWorldScale(sc);
  tmp2.set(...l.at).multiply(sc).applyQuaternion(q);
  // the parent's own local offset already includes the at-coordinate frame of its parents; use parent-local position
  return out.add(tmp2);
}

function updateLabels(cam) {
  const camPos = cam.getWorldPosition(tmp.clone());
  const ex = explode > 0.5;
  labels.forEach((l, i) => {
    const vis = showLabels && (!l.exploded || ex);
    l.sprite.visible = l.dot.visible = l.line.visible = vis;
    if (!vis) return;
    const a = anchorWorld(l, new THREE.Vector3());
    const d = Math.max(0.05, camPos.distanceTo(a));
    const k = renderer.xr.isPresenting ? 0.03 : 0.028;
    const h = d * k;
    // fan labels out a little so neighbours overlap less
    const lift = h * (1.6 + (i % 3) * 0.9);
    const p = a.clone().add(new THREE.Vector3(0, lift, 0));
    l.sprite.position.copy(p);
    l.sprite.scale.set(h * l.sprite.userData.aspect, h, 1);
    l.dot.position.copy(a); l.dot.scale.setScalar(h * 0.12);
    const pos = l.line.geometry.attributes.position; pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, p.x, p.y, p.z); pos.needsUpdate = true;
  });
}

function select(i, { focus = false } = {}) {
  if (selected >= 0 && labels[selected]) labels[selected].sprite.userData.draw(false);
  selected = i;
  document.querySelectorAll('#parts button').forEach((b, k) => b.classList.toggle('on', k === i));
  const l = labels[i];
  $('part').hidden = !l;
  if (!l) { $('arPart').hidden = true; return; }
  l.sprite.userData.draw(true);
  $('pTitle').textContent = l.title; $('pText').textContent = l.text;
  $('arPartTitle').textContent = l.title; $('arPartText').textContent = l.text; $('arPart').hidden = !renderer.xr.isPresenting;
  if (focus && !renderer.xr.isPresenting) {
    const a = anchorWorld(l, new THREE.Vector3());
    tween = { from: controls.target.clone(), to: a, t: 0 };
  }
}
let tween = null;

// ------------------------------------------------------------------ model loading
const cache = new Map();
function frame(model) {
  const s = model.size;
  // fit the camera to the model's bounding sphere for the current viewport
  const box = new THREE.Box3();
  model.root.updateMatrixWorld(true);
  model.root.traverse(o => { if (o.isMesh && o.visible && !(o.material?.transparent && o.material.depthWrite === false)) box.expandByObject(o); });
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const c = sphere.center.clone();
  controls.target.copy(c);
  const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const dist = sphere.radius / Math.sin(Math.min(vf, hf) / 2) * (model.fit ? model.fit * 0.95 : 0.95);
  const v = new THREE.Vector3(...(model.view || [0.62, 0.36, -0.72])).normalize();
  camera.position.copy(c).addScaledVector(v, dist);
  camera.near = Math.max(0.01, s / 400); camera.far = s * 40 + 50; camera.updateProjectionMatrix();
  controls.minDistance = s * 0.15; controls.maxDistance = s * 4;
  // light and shadow sized to the model
  sun.position.set(c.x + s * 0.8, s * 1.8 + 1, c.z + s * 0.6); sun.target.position.copy(c);
  const sh = sun.shadow.camera; sh.left = sh.bottom = -s * 0.8; sh.right = sh.top = s * 0.8; sh.near = 0.1; sh.far = s * 6 + 10; sh.updateProjectionMatrix();
  groundDisc.scale.setScalar(s * 0.75); shadowCatcher.scale.setScalar(s * 2.5);
}

async function load(id) {
  const item = CATALOG.find(c => c.id === id) || CATALOG[0];
  $('loading').classList.add('show');
  await new Promise(r => setTimeout(r, 30)); // let the spinner paint
  if (current) holder.remove(current.root);
  let model = cache.get(item.id);
  if (!model) {
    model = item.build(lab);
    model.root.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false; } });
    cache.set(item.id, model);
  }
  current = model; current.item = item;
  holder.add(model.root);
  explodeTarget = explode = 0; $('explode').value = 0; model.explode(0);
  buildLabels(model);
  frame(model);
  // info panel
  $('iGroup').textContent = item.group; $('iTitle').textContent = item.title; $('iBlurb').textContent = item.blurb;
  $('parts').innerHTML = model.labels.map((l, i) => `<li><button data-i="${i}">${l.title}${l.exploded ? ' <small>(exploded view)</small>' : ''}</button></li>`).join('');
  $('parts').querySelectorAll('button').forEach(b => (b.onclick = () => { const i = +b.dataset.i; if (model.labels[i].exploded && explodeTarget < 0.6) setExplode(1); select(i, { focus: true }); }));
  select(-1);
  document.querySelectorAll('.mcard').forEach(b => b.classList.toggle('on', b.dataset.id === item.id));
  try { history.replaceState(null, '', '?model=' + item.id); } catch { /* sandboxed */ }
  $('loading').classList.remove('show');
}

function setExplode(v) { explodeTarget = v; $('explode').value = v; }

// catalogue sidebar
{
  const groups = [...new Set(CATALOG.map(c => c.group))];
  $('catalog').innerHTML = groups.map(g => `<h4>${g}</h4>` + CATALOG.filter(c => c.group === g).map(c => `<button class="mcard" data-id="${c.id}"><img src="assets/renders/${c.thumb}.jpg" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span><b>${c.title}</b><small>${c.blurb.split(/[.:]/)[0]}</small></span></button>`).join('')).join('');
  $('catalog').querySelectorAll('.mcard').forEach(b => (b.onclick = () => load(b.dataset.id)));
}

// ------------------------------------------------------------------ viewer interaction
$('explode').oninput = e => (explodeTarget = +e.target.value);
const tog = (btn, v) => { btn.classList.toggle('on', v); btn.setAttribute('aria-pressed', v); };
$('labelsBtn').onclick = () => { showLabels = !showLabels; tog($('labelsBtn'), showLabels); };
$('animBtn').onclick = () => { animate = !animate; tog($('animBtn'), animate); };
$('resetBtn').onclick = () => { if (current) { frame(current); select(-1); } };
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let down = null;
renderer.domElement.addEventListener('pointerdown', e => (down = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  pickLabel(ray);
});
function pickLabel(rc) {
  const hit = rc.intersectObjects(labels.filter(l => l.sprite.visible).map(l => l.sprite), false)[0];
  if (hit) { select(hit.object.userData.index); return true; }
  return false;
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (renderer.xr.isPresenting || !w || !h) return;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); addEventListener('resize', resize);

// ------------------------------------------------------------------ AR
const ar = { session: null, hitSource: null, placed: false, moving: true, scale: 1, real: false, reticle: null, overlay: false, prevButtons: [] };
{
  const ret = new THREE.Group();
  ret.add(new THREE.Mesh(new THREE.RingGeometry(0.07, 0.085, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2c879 })));
  ret.add(new THREE.Mesh(new THREE.CircleGeometry(0.07, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2c879, transparent: true, opacity: 0.18 })));
  ret.matrixAutoUpdate = false; ret.visible = false; scene.add(ret); ar.reticle = ret;
}
const arMsg = t => ($('arMsg').textContent = t);
/** keep the shadow-casting light over the placed model */
function arLight() {
  const s = current.size * holder.scale.x;
  sun.target.position.copy(holder.position); sun.position.copy(holder.position).add(new THREE.Vector3(s * 0.8 + 0.3, s * 1.8 + 1, s * 0.6 + 0.2));
  const sh = sun.shadow.camera; sh.left = sh.bottom = -s; sh.right = sh.top = s; sh.near = 0.01; sh.far = s * 6 + 4; sh.updateProjectionMatrix();
}
function tabletopScale() { return Math.min(1, 0.55 / current.size); }
function applyArScale() { holder.scale.setScalar(ar.real ? 1 : ar.scale * tabletopScale()); if (ar.placed) arLight(); }

async function startAR() {
  const overlay = $('arOverlay');
  const session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay', 'local-floor'], domOverlay: { root: overlay } });
  ar.session = session; ar.placed = false; ar.moving = true; ar.scale = 1; ar.real = false;
  overlay.hidden = false;
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  ar.overlay = !!session.domOverlayState;
  ar.fallback = false;
  try {
    const viewer = await session.requestReferenceSpace('viewer');
    ar.hitSource = await session.requestHitTestSource({ space: viewer });
  } catch { ar.hitSource = null; ar.fallback = true; } // no surface detection: place in front of the viewer instead
  holder.visible = false; groundDisc.visible = false;
  scene.environmentIntensity = 1.0;
  arMsg(ar.fallback ? (ar.overlay ? 'Tap the screen to place the model in front of you' : 'Pull the trigger to place the model in front of you') : ar.overlay ? 'Move your phone slowly to find a table or the floor' : 'Point at the floor or a table and pull the trigger to place the model');
  session.addEventListener('select', onArSelect);
  session.addEventListener('end', () => {
    ar.session = null; ar.hitSource = null; overlay.hidden = true; ar.reticle.visible = false;
    holder.visible = true; groundDisc.visible = true; holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0); holder.scale.setScalar(1);
    scene.environmentIntensity = 0.85; resize(); if (current) frame(current);
  });
}

function onArSelect(e) {
  if (ar.moving || !ar.placed) {
    if (ar.reticle.visible) ar.reticle.matrix.decompose(holder.position, q, sc);
    else if (ar.fallback) {
      const cam = renderer.xr.getCamera(), p0 = cam.getWorldPosition(new THREE.Vector3()), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(q)); fwd.y = 0; fwd.normalize();
      holder.position.copy(p0).addScaledVector(fwd, 0.9); holder.position.y -= 0.5;
    } else return;
    // face the viewer
    const camPos = renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());
    holder.rotation.set(0, Math.atan2(-(camPos.x - holder.position.x), -(camPos.z - holder.position.z)) + 0.6, 0);
    applyArScale(); arLight();
    holder.visible = true; ar.placed = true; ar.moving = false; ar.reticle.visible = false;
    arMsg(ar.overlay ? 'Tap a label for details · use the buttons to rotate, resize or explode' : 'A: explode · B: labels · thumbstick: rotate and resize');
    return;
  }
  // pick a label along the input ray (screen tap or controller)
  const src = e.inputSource, frameXR = e.frame, refSpace = renderer.xr.getReferenceSpace();
  const pose = frameXR?.getPose(src.targetRaySpace, refSpace);
  if (!pose) return;
  const m = new THREE.Matrix4().fromArray(pose.transform.matrix);
  ray.ray.origin.setFromMatrixPosition(m);
  ray.ray.direction.set(0, 0, -1).applyMatrix4(new THREE.Matrix4().extractRotation(m));
  ray.camera = renderer.xr.getCamera();
  if (!pickLabel(ray)) select(-1);
}

function arFrame(frameXR) {
  const refSpace = renderer.xr.getReferenceSpace();
  if (ar.hitSource && (ar.moving || !ar.placed)) {
    const hits = frameXR.getHitTestResults(ar.hitSource);
    if (hits.length) {
      const pose = hits[0].getPose(refSpace);
      ar.reticle.visible = true; ar.reticle.matrix.fromArray(pose.transform.matrix);
      if (!ar.placed) arMsg(ar.overlay ? 'Tap to place the model here' : 'Pull the trigger to place the model');
    } else ar.reticle.visible = false;
  }
  // headsets without dom-overlay: thumbstick rotates / resizes, A explodes, B toggles labels
  if (!ar.overlay && ar.session) {
    for (const src of ar.session.inputSources) {
      const gp = src.gamepad; if (!gp) continue;
      const ax = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0] || 0, ay = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1] || 0;
      if (Math.abs(ax) > 0.2) holder.rotation.y -= ax * 0.03;
      if (Math.abs(ay) > 0.2 && !ar.real) { ar.scale = THREE.MathUtils.clamp(ar.scale * (1 - ay * 0.02), 0.2, 8); applyArScale(); }
      const pressed = gp.buttons.map(b => b.pressed), prev = ar.prevButtons[src.handedness] || [];
      if (pressed[4] && !prev[4]) setExplode(explodeTarget > 0.5 ? 0 : 1);
      if (pressed[5] && !prev[5]) { showLabels = !showLabels; tog($('labelsBtn'), showLabels); }
      if (pressed[3] && !prev[3]) { ar.moving = true; holder.visible = false; }
      ar.prevButtons[src.handedness] = pressed;
    }
  }
}

$('arOverlay').addEventListener('beforexrselect', e => e.preventDefault()); // taps on buttons don't place/pick
document.querySelectorAll('[data-ar]').forEach(b => (b.onclick = () => {
  const k = b.dataset.ar;
  if (k === 'move') { ar.moving = true; holder.visible = false; arMsg('Point at a surface and tap to place'); }
  if (k === 'left') holder.rotation.y += Math.PI / 12;
  if (k === 'right') holder.rotation.y -= Math.PI / 12;
  if (k === 'smaller') { ar.real = false; ar.scale = Math.max(0.2, ar.scale * 0.8); applyArScale(); }
  if (k === 'bigger') { ar.real = false; ar.scale = Math.min(8, ar.scale * 1.25); applyArScale(); }
  if (k === 'real') { ar.real = !ar.real; applyArScale(); b.classList.toggle('on', ar.real); if (ar.real && current.size > 8) arMsg('Real size: about ' + Math.round(current.size) + ' m across. Step back or go outside!'); }
  if (k === 'explode') { setExplode(explodeTarget > 0.5 ? 0 : 1); b.classList.toggle('on', explodeTarget > 0.5); }
  if (k === 'labels') { showLabels = !showLabels; b.classList.toggle('on', showLabels); }
}));
$('arExit').onclick = () => ar.session?.end();

// iPhone / iPad: export the current model as USDZ and open AR Quick Look
async function quickLook() {
  $('loading').classList.add('show'); $('loading').querySelector('span').textContent = 'Preparing the AR model…';
  try {
    const { USDZExporter } = await import('three/addons/exporters/USDZExporter.js');
    const src = current.exportRoot ? current.exportRoot() : current.root;
    const saved = explodeTarget; current.explode(0);
    const copy = new THREE.Group();
    const clone = src.clone(true);
    const drop = [];
    clone.traverse(o => { if (o.isSprite || o.isLine || o.isPoints || (o.isMesh && o.material?.transparent && o.material.depthWrite === false && o.material.map?.image?.width === 128)) drop.push(o); });
    drop.forEach(o => o.parent?.remove(o));
    // Quick Look supports standard PBR materials only: convert anything else
    clone.traverse(o => {
      if (!o.isMesh) return;
      const conv = m => (m && !m.isMeshStandardMaterial ? new THREE.MeshStandardMaterial({ color: m.color || 0xffffff, map: m.map || null, emissive: m.isMeshBasicMaterial ? (m.color || 0xffffff) : 0x000000, emissiveMap: m.isMeshBasicMaterial ? m.map || null : null, transparent: m.transparent, opacity: m.opacity }) : m);
      o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    });
    copy.add(clone);
    if (current.size > 4) copy.scale.setScalar(0.6 / current.size * 2); // large aircraft start at tabletop size
    const data = await new USDZExporter().parseAsync(copy, { quickLookCompatible: true, maxTextureSize: 2048 });
    current.explode(saved);
    const url = URL.createObjectURL(new Blob([data], { type: 'model/vnd.usdz+zip' }));
    const a = document.createElement('a'); a.rel = 'ar'; a.href = url; a.download = current.item.id + '.usdz';
    const img = document.createElement('img'); a.appendChild(img); document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { alertHelp('Could not prepare the AR model on this device (' + e.message + ').'); }
  finally { $('loading').classList.remove('show'); $('loading').querySelector('span').textContent = 'Building model…'; }
}

function alertHelp(why) {
  $('helpWhy').textContent = why;
  const qrEl = $('qr');
  try {
    // global from vendor/qrcode/qrcode.js (loaded on demand)
    const make = () => { const qr = window.qrcode(0, 'M'); qr.addData(location.href.replace(/^http:\/\/localhost/, location.origin)); qr.make(); qrEl.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); };
    if (window.qrcode) make();
    else { const s = document.createElement('script'); s.src = new URL('../../vendor/qrcode/qrcode.js', import.meta.url).href; s.onload = make; document.head.appendChild(s); }
  } catch { qrEl.hidden = true; }
  $('help').hidden = false;
}
$('help').addEventListener('click', e => { if (e.target === $('help') || e.target.closest('[data-close]')) $('help').hidden = true; });

$('arBtn').onclick = async () => {
  if (embedded) { window.open(location.pathname.replace(/[^/]*$/, 'ar.html') + '?model=' + (current?.item.id || '') + '&ar=1', '_blank'); return; }
  const quick = document.createElement('a').relList?.supports?.('ar');
  let webxr = false;
  try { webxr = !!navigator.xr && isSecureContext && await navigator.xr.isSessionSupported('immersive-ar'); } catch { /* no */ }
  if (webxr) { try { await startAR(); } catch (e) { alertHelp('AR could not start: ' + e.message); } return; }
  if (quick) { quickLook(); return; }
  alertHelp(/iPhone|iPad/.test(navigator.userAgent) ? 'Open this page in Safari to use AR Quick Look.' : 'This device or browser can’t place 3D models in AR. Scan the code with your phone to open this page there, or keep exploring in 3D here.');
};

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
renderer.setAnimationLoop((t, frameXR) => {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  if (current) {
    explode += (explodeTarget - explode) * Math.min(1, dt * 5);
    current.explode(explode);
    current.update(dt, time, animate);
  }
  if (frameXR) arFrame(frameXR);
  else {
    if (tween) { tween.t = Math.min(1, tween.t + dt * 2.2); controls.target.lerpVectors(tween.from, tween.to, tween.t * tween.t * (3 - 2 * tween.t)); if (tween.t >= 1) tween = null; }
    controls.update();
  }
  if (current) updateLabels(renderer.xr.isPresenting ? renderer.xr.getCamera() : camera);
  renderer.render(scene, camera);
});

// first model: ?model=id
const params = new URLSearchParams(location.search);
await load(params.get('model') || location.hash.slice(1) || 'trainer');
resize();
if (params.get('ar') === '1') $('arBtn').classList.add('pulse');
window.ffAR = { load, select, setExplode, setLabels(v) { showLabels = v; tog($('labelsBtn'), v); }, CATALOG, get current() { return current; }, renderer, camera, controls, scene };

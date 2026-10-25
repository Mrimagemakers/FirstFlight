// First Flight XR lab core: renderer, sky, image-based lighting, stations, WebXR sessions.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DesktopControls, XRControls } from './controls.js';
import { Hotspots } from './hotspots.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { Post } from './post.js';
import { settings, quality, onSettings } from './settings.js';
import { audio } from './audio.js';

const ASSET = new URL('./assets/', import.meta.url).href;

export class Lab {
  constructor({ host, ui }) {
    this.host = host;
    this.ui = ui;
    this.stations = {};
    this.station = null;
    this.stationKey = null;
    this.progress = this.loadProgress();
    this.quality = ['high', 'ultra'].includes(settings.quality) ? 'high' : 'standard';
    this.settings = settings;
    this.audio = audio;

    const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, quality().pixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    renderer.xr.setFoveation?.(0.5);
    host.prepend(renderer.domElement);
    this.maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60000);
    this.rig = new THREE.Group();
    this.rig.name = 'xr-rig';
    this.rig.add(this.camera);
    this.scene.add(this.rig);

    // Physically based daylight sky.
    this.sky = new Sky();
    this.sky.scale.setScalar(450000);
    this.sky.material.depthWrite = false;
    this.sky.renderOrder = -100;
    this.scene.add(this.sky);
    this.sunDir = new THREE.Vector3(0.3, 0.6, -0.4).normalize();

    this.sun = new THREE.DirectionalLight(0xfff1df, 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(quality().shadow);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5b5040, 0.35);
    this.scene.add(this.hemi);

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envCache = new Map();
    this.texCache = new Map();
    this.texLoader = new THREE.TextureLoader();

    // Sun lens flare (procedural textures)
    const flareTex = (size, stops) => { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const core = flareTex(256, [[0, 'rgba(255,255,250,1)'], [0.08, 'rgba(255,248,230,.9)'], [0.25, 'rgba(255,230,190,.25)'], [1, 'rgba(255,220,180,0)']]);
    const ring = flareTex(128, [[0, 'rgba(120,180,255,0)'], [0.7, 'rgba(140,190,255,.0)'], [0.85, 'rgba(160,200,255,.35)'], [1, 'rgba(160,200,255,0)']]);
    const dot = flareTex(64, [[0, 'rgba(255,220,170,.55)'], [1, 'rgba(255,200,150,0)']]);
    this.flare = new Lensflare();
    this.flare.addElement(new LensflareElement(core, 520, 0, new THREE.Color(1, 0.96, 0.9)));
    this.flare.addElement(new LensflareElement(dot, 60, 0.6));
    this.flare.addElement(new LensflareElement(ring, 120, 0.75));
    this.flare.addElement(new LensflareElement(dot, 90, 0.9));
    this.flare.addElement(new LensflareElement(ring, 200, 1.05));
    this.flare.frustumCulled = false;
    this.scene.add(this.flare);

    this.post = new Post(this);
    this.applySettings();
    onSettings(() => this.applySettings());

    this.hotspots = new Hotspots(this);
    this.controls = new DesktopControls(this);
    this.xr = new XRControls(this);
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.listeners = new Set();

    this.resize = this.resize.bind(this);
    addEventListener('resize', this.resize);
    new ResizeObserver(this.resize).observe(host);
    this.resize();
    renderer.setAnimationLoop((t, frame) => this.frame(t, frame));
  }

  // ------------------------------------------------------------------ persistence
  loadProgress() {
    try { return Object.assign({ fod: [], scenarios: [], cabin: [], walkaround: [], tools: [], missions: [], rings: 0 }, JSON.parse(localStorage.getItem('ff-xr-progress') || '{}')); }
    catch { return { fod: [], scenarios: [], cabin: [], walkaround: [], tools: [], missions: [], rings: 0 }; }
  }
  saveProgress() {
    try { localStorage.setItem('ff-xr-progress', JSON.stringify(this.progress)); } catch { /* storage unavailable */ }
    try { parent?.postMessage({ type: 'ff-xr-progress', progress: this.progress }, location.origin); } catch { /* not embedded */ }
  }
  mark(list, id) {
    if (!this.progress[list].includes(id)) { this.progress[list].push(id); this.saveProgress(); return true; }
    return false;
  }

  // ------------------------------------------------------------------ assets
  tex(name, { repeat = [1, 1], srgb = false, anisotropy = quality().anisotropy } = {}) {
    const key = name + repeat.join('x') + srgb;
    if (this.texCache.has(key)) return this.texCache.get(key);
    const t = this.texLoader.load(ASSET + 'tex/' + name, () => this.onAssetLoaded?.());
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
    t.anisotropy = Math.min(anisotropy, this.maxAnisotropy);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    this.texCache.set(key, t);
    return t;
  }

  /** Load a packed RGBE PNG (Poly Haven CC0 HDRI) into a PMREM environment map. */
  async env(name) {
    if (this.envCache.has(name)) return this.envCache.get(name);
    const promise = (async () => {
      if (name === 'room') {
        const room = new RoomEnvironment();
        const texture = this.pmrem.fromScene(room, 0.04).texture;
        return { texture, sun: new THREE.Vector3(0, 1, 0), sunAzimuth: 0 };
      }
      const img = new Image();
      img.decoding = 'async';
      img.src = ASSET + 'env/' + name + '.png';
      await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight / 2;
      const c = document.createElement('canvas');
      c.width = W; c.height = H * 2;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, W, H * 2).data;
      const data = new Uint16Array(W * H * 4);
      const toHalf = THREE.DataUtils.toHalfFloat;
      let best = 0, bx = 0, by = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4, e = px[((y + H) * W + x) * 4];
          const f = e ? Math.pow(2, e - 136) : 0;
          const r = (px[i] + 0.5) * f, g = (px[i + 1] + 0.5) * f, b = (px[i + 2] + 0.5) * f;
          data[i] = toHalf(Math.min(r, 65000)); data[i + 1] = toHalf(Math.min(g, 65000)); data[i + 2] = toHalf(Math.min(b, 65000)); data[i + 3] = toHalf(1);
          const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
          if (lum > best && y < H * 0.5) { best = lum; bx = x; by = y; }
        }
      }
      const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.LinearSRGBColorSpace;
      tex.minFilter = tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.flipY = true;
      tex.needsUpdate = true;
      const texture = this.pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      // direction of the brightest pixel (the sun) in three.js equirect convention
      const u = (bx + 0.5) / W, v = (by + 0.5) / H;
      const theta = (u - 0.5) * Math.PI * 2, phi = (0.5 - v) * Math.PI;
      const sun = new THREE.Vector3(-Math.cos(phi) * Math.cos(theta) * -1, Math.sin(phi), Math.cos(phi) * Math.sin(theta));
      return { texture, sun, sunAzimuth: Math.atan2(sun.x, sun.z), sunElevation: phi };
    })();
    this.envCache.set(name, promise);
    return promise;
  }

  /**
   * Configure sky, sun and image-based lighting.
   * opts: env name, azimuth (deg, direction sun comes from, 0 = +z), elevation (deg; defaults to HDRI sun),
   * turbidity, rayleigh, exposure, fog [color, near, far], envIntensity, sunIntensity, showSky
   */
  async setAtmosphere(opts) {
    const o = Object.assign({ env: 'quarry_01', azimuth: 135, turbidity: 3, rayleigh: 1.2, mie: 0.004, mieG: 0.8, exposure: 0.62, envIntensity: 1, sunIntensity: 3.2, sunColor: 0xfff1df, hemi: 0.3, showSky: true, fog: null, background: null }, opts);
    const env = await this.env(o.env);
    const elevation = THREE.MathUtils.degToRad(o.elevation ?? THREE.MathUtils.radToDeg(env.sunElevation ?? 0.8));
    const az = THREE.MathUtils.degToRad(o.azimuth);
    this.sunDir.set(Math.sin(az) * Math.cos(elevation), Math.sin(elevation), Math.cos(az) * Math.cos(elevation)).normalize();
    this.scene.environment = env.texture;
    this.scene.environmentIntensity = o.envIntensity;
    // rotate the HDRI so its sun lines up with our analytic sun
    this.scene.environmentRotation.set(0, az - (env.sunAzimuth || 0), 0);
    const u = this.sky.material.uniforms;
    u.turbidity.value = o.turbidity; u.rayleigh.value = o.rayleigh; u.mieCoefficient.value = o.mie; u.mieDirectionalG.value = o.mieG;
    u.sunPosition.value.copy(this.sunDir);
    this.sky.visible = o.showSky;
    this.scene.background = o.background !== null ? new THREE.Color(o.background) : null;
    this.renderer.toneMappingExposure = o.exposure;
    this.sun.intensity = o.sunIntensity;
    this.sun.color.set(o.sunColor);
    this.hemi.intensity = o.hemi;
    this.scene.fog = o.fog ? (o.fog.length === 2 ? new THREE.FogExp2(o.fog[0], o.fog[1]) : new THREE.Fog(o.fog[0], o.fog[1], o.fog[2])) : null;
    this.atmosphere = o;
  }

  /** Place the shadow-casting sun so its shadow frustum covers `size` metres around `center`. */
  focusShadow(center, size, depth = 400) {
    const s = this.sun.shadow.camera;
    s.left = -size; s.right = size; s.top = size; s.bottom = -size;
    s.near = 1; s.far = depth;
    s.updateProjectionMatrix();
    this.shadowCenter = center.clone();
    this.sun.target.position.copy(center);
    this.sun.position.copy(center).addScaledVector(this.sunDir, depth * 0.5);
  }

  // ------------------------------------------------------------------ stations
  register(key, station) { this.stations[key] = station; station.key = key; }

  async go(key, opts = {}) {
    if (!this.stations[key]) key = 'hangar';
    if (this.switching) return;
    this.switching = true;
    const next = this.stations[key];
    try {
      if (!next.built) {
        this.ui.loading(true, `Preparing ${next.title}…`);
        await next.build(this);
        next.built = true;
      }
      if (this.station && this.station !== next) {
        this.station.exit?.(this);
        this.scene.remove(this.station.root);
      }
      this.hotspots.clear();
      this.interactive = [];
      this.floors = [];
      this.station = next;
      this.stationKey = key;
      this.scene.add(next.root);
      this.controls.reset();
      await next.enter(this, opts);
      this.updatePost();
      audio.ambience(next.ambience || key);
      if (this.renderer.xr.isPresenting) this.placeXR();
      this.ui.setStation(key);
      try { history.replaceState(null, '', '#' + key + (opts.sub ? ':' + opts.sub : '')); } catch { /* sandboxed */ }
      try { parent?.postMessage({ type: 'ff-xr-station', key }, location.origin); } catch { /* not embedded */ }
    } finally {
      this.ui.loading(false);
      this.switching = false;
    }
  }

  /** Put the XR rig at the station's spawn point. */
  placeXR(keepPanel = false) {
    const s = this.station?.xrSpawn?.(this) || { position: new THREE.Vector3(0, 0, 4), yaw: 0 };
    this.rig.position.copy(s.position);
    this.rig.rotation.set(0, s.yaw || 0, 0);
    if (this.stationKey !== 'flight') this.xr.placed(s.position.y);
    this.xr.updateHints();
    if (!keepPanel) this.ui.vr.place();
  }

  // ------------------------------------------------------------------ XR sessions
  async xrSupport() {
    const out = { vr: false, ar: false };
    if (!navigator.xr || !isSecureContext) return out;
    try { out.vr = await navigator.xr.isSessionSupported('immersive-vr'); } catch { /* ignore */ }
    try { out.ar = await navigator.xr.isSessionSupported('immersive-ar'); } catch { /* ignore */ }
    return out;
  }

  async startXR(mode = 'immersive-vr') {
    if (this.renderer.xr.isPresenting) { await this.renderer.xr.getSession().end(); return; }
    const session = await navigator.xr.requestSession(mode, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    this.xrMode = mode;
    this.renderer.xr.setReferenceSpaceType('local-floor');
    // Headset detail: render above native resolution and keep the edges sharp on higher settings.
    const q = quality();
    try { this.renderer.xr.setFramebufferScaleFactor(q.xrScale || 1); } catch { /* not supported */ }
    await this.renderer.xr.setSession(session);
    try { this.renderer.xr.setFoveation(q.xrFoveation ?? 0.5); } catch { /* not supported */ }
    this.controls.enabled = false;
    if (mode === 'immersive-ar') {
      this.arBackup = { background: this.scene.background, sky: this.sky.visible, fog: this.scene.fog };
      this.scene.background = null; this.sky.visible = false; this.scene.fog = null;
      this.station?.enterAR?.(this);
      this.rig.position.set(0, 0, 0); this.rig.rotation.set(0, 0, 0);
    } else {
      this.placeXR();
    }
    this.ui.vr.visible(true);
    this.ui.onXR(true, mode);
    session.addEventListener('end', () => {
      if (this.xrMode === 'immersive-ar' && this.arBackup) {
        this.scene.background = this.arBackup.background; this.sky.visible = this.arBackup.sky; this.scene.fog = this.arBackup.fog;
        this.station?.exitAR?.(this);
      }
      this.xrMode = null;
      this.rig.position.set(0, 0, 0); this.rig.rotation.set(0, 0, 0);
      this.controls.enabled = true;
      this.controls.restore();
      this.resize();
      this.ui.vr.visible(false);
      this.ui.onXR(false);
    });
  }

  // ------------------------------------------------------------------ picking
  /** Raycast from a ray; returns true when something handled it. */
  pickRay(raycaster, { fromXR = false } = {}) {
    raycaster.camera = fromXR ? this.renderer.xr.getCamera() : this.camera;
    if (this.ui.vr.pick(raycaster)) return true;
    if (this.hotspots.pick(raycaster)) return true;
    const hits = raycaster.intersectObjects(this.interactive, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.onPick) o = o.parent;
      if (o && o.visible !== false) { o.userData.onPick(h); return true; }
    }
    if (this.station?.onPick?.(raycaster)) return true;
    return false;
  }

  addInteractive(object, onPick) {
    object.userData.onPick = onPick;
    this.interactive.push(object);
  }

  // ------------------------------------------------------------------ loop
  resize() {
    const w = this.host.clientWidth || innerWidth, h = this.host.clientHeight || innerHeight;
    if (this.renderer.xr.isPresenting) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post?.setSize(w, h);
  }

  applySettings() {
    const q = quality();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatio));
    if (this.sun.shadow.mapSize.x !== q.shadow) { this.sun.shadow.mapSize.setScalar(q.shadow); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.resize();
    this.updatePost();
    this.station?.impl?.applyQuality?.(q);
  }

  /** Station-specific post settings merged with the player's graphics settings. */
  updatePost() {
    const q = quality(), st = this.station?.post || {};
    this.post.configure({ enabled: q.post, ao: q.ao && settings.ao && st.ao !== false, bloom: settings.bloom && st.bloom !== false, smaa: q.smaa, msaa: q.msaa, aoSamples: q.aoSamples, aoRadius: st.aoRadius ?? 0.6, bloomStrength: st.bloomStrength ?? 0.22, warmth: st.warmth ?? 0, vignette: st.vignette ?? 0.28 });
  }

  frame() {
    if (this.manual) return;
    this.tick(Math.min(this.clock.getDelta(), 0.05));
  }

  /** Advance the simulation and draw one frame (used directly for trailer capture). */
  tick(dt) {
    this.elapsed += dt;
    if (this.renderer.xr.isPresenting) this.xr.update(dt);
    else this.controls.update(dt);
    this.station?.update?.(dt, this.elapsed, this);
    this.cinematic?.(dt, this.elapsed);
    this.hotspots.update(dt);
    this.ui.vr.update(dt);
    if (this.shadowFollow) {
      const p = this.shadowFollow();
      this.sun.target.position.copy(p);
      this.sun.position.copy(p).addScaledVector(this.sunDir, this.sun.shadow.camera.far * 0.5);
    }
    // sun flare sits far along the sun direction from the viewer
    const camPos = this.camera.getWorldPosition(new THREE.Vector3());
    this.flare.visible = settings.flare && this.sky.visible && this.sunDir.y > -0.02 && !this.renderer.xr.isPresenting;
    this.flare.position.copy(camPos).addScaledVector(this.sunDir, 20000);
    if (!this.renderer.xr.isPresenting && this.post.enabled) this.post.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}

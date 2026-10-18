// Station 03: airline ramp & cargo safety — FOD walk, hazard zones, beacon awareness and orientation scenarios.
import * as THREE from 'three';
import { mesh, box, tube, canvasTexture, rand, roundedBox } from '../util.js';
import { materials } from '../materials.js';
import { buildAirliner } from '../models/airliner.js';
import { baggageTug, baggageCart, beltLoader, uldDolly, groundPowerUnit, cone, chock, worker, lightMast, jetBridge, terminal, controlTower, fodItems } from '../models/gse.js';
import { runScenario } from '../scenario.js';

const FOD_SPOTS = [[-2.6, 3.2], [8.6, -13.4], [0.8, -4.0], [7.4, -9.6], [4.6, -19.2], [5.0, 11.2], [-1.3, -12.2], [-6.0, -27.6], [2.4, 17.0], [-7.1, -9.0]];

const SCENARIOS = [
  { id: 'ramp-object', at: [5.2, 0.6, -11.2], title: 'Something near the aircraft', prompt: 'Walking to the belt loader, you spot an unidentified metal object on the apron close to the aircraft. What do you do?', options: ['Kick it under the cart so nobody trips on it', 'Treat it as possible FOD and follow local reporting and removal procedures, within your access and training limits', 'Leave it; maintenance will find it on their next check'], correct: 1, why: 'Recognise the potential FOD hazard and follow your local reporting and removal procedures, staying within your airport access and training limits.', source: 'Learning focus for ramp agents: FOD, aircraft danger zones and communication.' },
  { id: 'ramp-equipment', at: [7.8, 2.6, -10.6], title: 'Equipment you are not qualified on', prompt: 'A busy colleague asks you to reposition the belt loader to the aft hold. You have not been qualified to operate it yet.', options: ['Do it slowly, since it looks simple', 'Explain the limitation and ask for a qualified operator or trainer', 'Ask another new hire to move it instead'], correct: 1, why: 'Explain your limitation and request a qualified operator or trainer. Operating equipment is authorised task by task after qualification.' },
  { id: 'ramp-leak', at: [11.3, 2.2, -8.6], title: 'A damaged, leaking package', prompt: 'While loading, you notice a carton on the cart is crushed and something is leaking from it.', options: ['Wipe it down and keep loading so the flight isn’t delayed', 'Stop handling it and notify the designated supervisor or dangerous goods contact under local procedures', 'Open it to find out what is inside'], correct: 1, why: 'Stop handling it and notify the designated supervisor or dangerous goods contact under local procedures. Some leaks need a qualified dangerous goods specialist.', source: 'Activity: use the IATA dangerous goods videos to identify situations that require referral to a qualified specialist.' },
  { id: 'ramp-clarify', at: [12.6, 2.1, -18.2], title: 'An instruction you didn’t catch', prompt: 'Your lead gives a quick instruction over the engine noise from the next stand. You only catch half of it.', options: ['Guess from what usually happens', 'Ask for clarification before proceeding', 'Wait for someone else to do it'], correct: 1, why: 'Ask for clarification before proceeding. Confirming an instruction is a professional habit, not a weakness.' },
  { id: 'ramp-transfer', at: [-20, 2.4, -29.2], title: 'Experienced, but new to this station', prompt: 'You have three years on the ramp at another airport and just transferred here. Your supervisor asks how you would like to start.', options: ['Start immediately, since your authorisations carry over', 'Verify qualifications, complete local orientation, and have equipment- and task-specific competence assessed before authorisation', 'Skip orientation because procedures are the same everywhere'], correct: 1, why: 'Verify previous qualifications, complete local orientation and assess equipment- and task-specific competence before authorisation. Prior experience informs the plan; it doesn’t automatically transfer local permissions.' },
  { id: 'ramp-beacon', at: [0.6, 6.9, -1.5], title: 'The red beacon is flashing', prompt: 'The aircraft’s red anti-collision beacon starts flashing while you are near the wing.', options: ['Finish what you were doing under the engine', 'Move clear of engine hazard areas and follow your station’s procedure; a flashing beacon means engines are running or about to start', 'Walk behind the engine to get to the other side faster'], correct: 1, why: 'Treat a flashing beacon as a warning that engines are running or about to start. Stay out of intake and exhaust hazard areas and follow your station’s procedure.' },
];

const INFO = [
  { id: 'i-chocks', at: [-0.9, 1.1, -14.6], label: 'Chocks & cones', text: 'Chocks at the nose and main wheels, and cones at the wingtips, tail and engines, mark and protect the aircraft while it is parked. Placement and removal follow your operator’s sequence.' },
  { id: 'i-gpu', at: [4.6, 2.2, -21.2], label: 'Ground power', text: 'The ground power unit supplies electrical power while the engines are off. Connecting and disconnecting it is a qualified task with its own procedure and communication with the flight deck.' },
  { id: 'i-uld', at: [7.0, 2.6, 13.2], label: 'Cargo & ULDs', text: 'Unit load devices are tagged with their ID, weight and any dangerous goods information. Shipment accuracy and traceability start with checking every tag against the load documents.' },
  { id: 'i-road', at: [-30, 2.0, -27.5], label: 'Service road', text: 'Airside driving follows local rules: designated roads, speed limits, right of way for aircraft, and your airport-specific driving authorisation. The FAA “From the Flight Deck” videos show the airport from a pilot’s view; add your local driver training.' },
  { id: 'i-hearing', at: [-9.5, 2.2, -16.5], label: 'Hearing protection', text: 'APUs, engines and ground equipment are loud. Wear the hearing protection and hi-visibility clothing your employer issues every time you are on the ramp.' },
];

export class RampStation {
  constructor() { this.title = 'Ramp & cargo safety'; this.view = 'walk'; this.zonesOn = false; this.beaconOn = false;  this.post = { ao: true, aoRadius: 1.4, warmth: 0.12, bloomStrength: 0.2 }; this.ambience = 'ramp'; }

  async build(lab) {
    const M = materials(lab);
    const root = this.root = new THREE.Group();
    root.name = 'ramp';
    const quality = lab.quality;

    // -------------------------------------------------------------- ground
    const apronGeo = new THREE.PlaneGeometry(420, 260).rotateX(-Math.PI / 2);
    const uv = apronGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 420 / 7.5, uv.getY(i) * 260 / 7.5);
    this.apron = mesh(apronGeo, M.concrete, root, { cast: false });
    this.apron.position.set(0, 0, 60);
    const roadGeo = new THREE.PlaneGeometry(420, 6).rotateX(-Math.PI / 2);
    const ruv = roadGeo.attributes.uv; for (let i = 0; i < ruv.count; i++) ruv.setXY(i, ruv.getX(i) * 420 / 6, ruv.getY(i));
    mesh(roadGeo, M.asphalt, root, { cast: false }).position.set(0, 0.004, -27.6);
    const grassGeo = new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2);
    const guv = grassGeo.attributes.uv; for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 300, guv.getY(i) * 300);
    mesh(grassGeo, M.grass, root, { cast: false }).position.set(0, -0.06, 600);
    const rwyGeo = new THREE.PlaneGeometry(3200, 45).rotateX(-Math.PI / 2);
    const rwuv = rwyGeo.attributes.uv; for (let i = 0; i < rwuv.count; i++) rwuv.setXY(i, rwuv.getX(i) * 3200 / 12, rwuv.getY(i) * 45 / 12);
    mesh(rwyGeo, M.asphalt, root, { cast: false }).position.set(0, -0.03, 260);
    const twyGeo = new THREE.PlaneGeometry(1600, 23).rotateX(-Math.PI / 2);
    const twuv = twyGeo.attributes.uv; for (let i = 0; i < twuv.count; i++) twuv.setXY(i, twuv.getX(i) * 1600 / 12, twuv.getY(i) * 23 / 12);
    mesh(twyGeo, M.asphalt, root, { cast: false }).position.set(0, 0.003, 205);

    // -------------------------------------------------------------- painted markings (one big decal)
    const S = 96, PX = 24; // 96 m square around the stand, 24 px per metre
    const marks = canvasTexture(S * PX, S * PX, (c) => {
      const m = v => (v + S / 2) * PX; // world metre -> canvas px (x and z)
      c.clearRect(0, 0, S * PX, S * PX);
      const line = (x0, z0, x1, z1, w, col, dash) => { c.strokeStyle = col; c.lineWidth = w * PX; c.setLineDash(dash ? dash.map(d => d * PX) : []); c.beginPath(); c.moveTo(m(x0), m(z0)); c.lineTo(m(x1), m(z1)); c.stroke(); };
      // lead-in line with arrow chevrons and stop bar
      line(0, 48, 0, -13.75, 0.15, '#e5b21e');
      for (let z = 30; z > -8; z -= 10) { c.fillStyle = '#e5b21e'; c.beginPath(); c.moveTo(m(-0.5), m(z + 0.8)); c.lineTo(m(0), m(z)); c.lineTo(m(0.5), m(z + 0.8)); c.lineTo(m(0.35), m(z + 0.9)); c.lineTo(m(0), m(z + 0.3)); c.lineTo(m(-0.35), m(z + 0.9)); c.fill(); }
      line(-1.5, -13.75, 1.5, -13.75, 0.3, '#e5b21e');
      c.fillStyle = '#e5b21e'; c.font = `700 ${1.1 * PX}px system-ui`; c.textAlign = 'center';
      c.save(); c.translate(m(2.4), m(-12.9)); c.fillText('NB', 0, 0); c.restore();
      // stand number painted on the apron
      c.save(); c.translate(m(0), m(26)); c.font = `800 ${4 * PX}px system-ui`; c.fillText('7', 0, 0); c.restore();
      // equipment restraint line (red) around the stand
      line(-20, -25.5, 20, -25.5, 0.2, '#c8352b'); line(-20, -25.5, -20, 24, 0.2, '#c8352b'); line(20, -25.5, 20, 24, 0.2, '#c8352b'); line(-20, 24, 20, 24, 0.2, '#c8352b');
      // no-parking hatch boxes near the nose
      c.strokeStyle = '#c8352b'; c.lineWidth = 0.12 * PX; c.setLineDash([]);
      for (const [x0, z0] of [[-8, -24.8], [4.5, -24.8]]) { c.strokeRect(m(x0), m(z0), 3.5 * PX, 3 * PX); for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(m(x0 + k * 0.7), m(z0)); c.lineTo(m(x0), m(z0 + k * 0.6)); c.stroke(); } }
      // equipment parking boxes (white, dashed)
      for (const [x0, z0, w, d] of [[9.5, -21, 4.5, 16], [-17.5, -21, 5, 12], [3.8, 7, 5, 9]]) { c.strokeStyle = '#e9e9e4'; c.lineWidth = 0.12 * PX; c.setLineDash([0.8 * PX, 0.5 * PX]); c.strokeRect(m(x0), m(z0), w * PX, d * PX); }
      c.setLineDash([]);
      // service road edges and centre dash, zebra crossing
      line(-48, -24.6, 48, -24.6, 0.15, '#f2f2ee'); line(-48, -30.6, 48, -30.6, 0.15, '#f2f2ee');
      line(-48, -27.6, 48, -27.6, 0.12, '#f2f2ee', [3, 3]);
      for (let k = 0; k < 8; k++) { c.fillStyle = '#f2f2ee'; c.fillRect(m(-24 + k * 0.9), m(-30.4), 0.45 * PX, 5.6 * PX); }
      // walkway lane to the stairs
      line(-14, -24.5, -14, -18, 0.1, '#5fb3e0', [0.6, 0.4]); line(-12.4, -24.5, -12.4, -18, 0.1, '#5fb3e0', [0.6, 0.4]);
      // taxi lane edge at the far end
      line(-48, 40, 48, 40, 0.15, '#e5b21e'); line(-48, 40.6, 48, 40.6, 0.15, '#e5b21e', [1, 1]);
      // subtle tyre marks and wear
      const r = rand(11);
      for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(20,20,20,${0.03 + r() * 0.05})`; const x = (r() - 0.5) * 70, z = (r() - 0.5) * 70; c.fillRect(m(x), m(z), (0.15 + r() * 0.2) * PX, (1 + r() * 6) * PX); }
    }, { anisotropy: 16 }).texture;
    const markMat = new THREE.MeshStandardMaterial({ map: marks, transparent: true, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    const markMesh = mesh(new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2), markMat, root, { cast: false });
    markMesh.position.y = 0.01;
    markMesh.renderOrder = 1;

    // -------------------------------------------------------------- the aircraft and its neighbours
    this.ac = buildAirliner(lab, { quality, cargoOpen: true });
    root.add(this.ac.root);
    for (const [x, rot] of [[-50, 0], [50, 0]]) {
      const n = buildAirliner(lab, { quality: 'standard', cargoOpen: false, accent: x < 0 ? '#29425a' : '#0f3d5c' });
      n.root.position.set(x, 0, 2); n.root.rotation.y = rot; root.add(n.root);
    }

    // -------------------------------------------------------------- terminal, jet bridge, tower, masts
    const term = terminal(lab, { width: 220, depth: 34, height: 15, gate: 'A7' });
    term.position.set(0, 0, -31.5); root.add(term);
    const bridge = jetBridge(lab, { rotunda: new THREE.Vector3(-13.5, 0, -24.5), door: this.ac.doorL1.clone() });
    root.add(bridge);
    box(root, [3, 2.6, 7], [-13.5, 4.3, -28.5], new THREE.MeshPhysicalMaterial({ color: 0xb9c0c4, metalness: 0.6, roughness: 0.38 }));
    for (const x of [-50, 50]) { const b = jetBridge(lab, { rotunda: new THREE.Vector3(x - 13.5, 0, -24.5), door: new THREE.Vector3(x - 1.98, 3.05, -11.9) }); root.add(b); }
    const tower = controlTower(lab); tower.position.set(-140, 0, -150); root.add(tower);
    for (const [x, z] of [[-34, -23], [34, -23], [-34, 30], [34, 30]]) { const mm = lightMast(lab); mm.position.set(x, 0, z); mm.rotation.y = z > 0 ? Math.PI : 0; root.add(mm); }
    // distant tree line and hangars for depth
    const treeGeo = new THREE.IcosahedronGeometry(1, 1);
    const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ color: 0x3d5a32, roughness: 1, flatShading: true }), 220);
    const d = new THREE.Object3D(), r = rand(5);
    for (let i = 0; i < 220; i++) { const a = r() * Math.PI - Math.PI / 2; d.position.set(-700 + r() * 1400, 4 + r() * 3, 420 + r() * 120); d.scale.set(6 + r() * 6, 6 + r() * 7, 6 + r() * 6); d.updateMatrix(); trees.setMatrixAt(i, d.matrix); }
    root.add(trees);
    for (let i = 0; i < 3; i++) box(root, [60, 18, 45], [260 + i * 75, 9, -40], new THREE.MeshStandardMaterial({ color: [0xb7bec2, 0x9fb0ba, 0xc7c4bb][i], metalness: 0.4, roughness: 0.5 }));

    // -------------------------------------------------------------- ground support equipment
    const tan = this.ac;
    const loader = beltLoader(lab, 7.2, 0.15);
    loader.rotation.y = Math.PI / 2;
    loader.position.set(tan.cargoFwd.x + 4.52 + 0.05, 0, tan.cargoFwd.z - 0.15);
    root.add(loader);
    this.loader = loader;
    const tug = baggageTug(lab); tug.position.set(11.4, 0, -16.6); root.add(tug); this.tug = tug;
    const carts = [];
    for (let i = 0; i < 3; i++) { const c = baggageCart(lab, 3 + i, { leaking: i === 1 }); c.position.set(11.4, 0, -13 + i * 3.4); root.add(c); carts.push(c); }
    const gpu = groundPowerUnit(lab); gpu.position.set(4.8, 0, -19.5); gpu.rotation.y = 0.4; root.add(gpu);
    tube(root, [[4.4, 0.9, -18.4], [3.2, 0.05, -17.5], [1.6, 0.05, -16.4], [0.6, 0.3, -15.9], [0.45, 1.9, -15.6]], 0.035, M.rubber);
    for (let i = 0; i < 2; i++) { const u = uldDolly(lab, 7 + i, i ? 'AKE 12035 FF' : 'AKE 12034 FF'); u.position.set(6.6, 0, 9.6 + i * 2.6); u.rotation.y = Math.PI / 2; root.add(u); }
    // cones and chocks
    const conePos = [[-17.8, 4.2], [17.8, 4.2], [0, 22], [-5.75, -10.2], [5.75, -10.2], [-2.4, -19.6], [2.4, -19.6]];
    conePos.forEach(([x, z]) => { const c = cone(lab); c.position.set(x, 0, z); root.add(c); });
    for (const [x, z, ry] of [[0, -14.45, 0], [0, -13.05, Math.PI], [-3.8, 0.88, 0], [3.8, 0.88, 0], [-3.8, 2.32, Math.PI], [3.8, 2.32, Math.PI]]) { const c = chock(lab); c.position.set(x, 0, z); c.rotation.y = ry; root.add(c); }
    // people
    const people = [
      worker(lab, { seed: 2 }), worker(lab, { seed: 5, vest: 'orange' }), worker(lab, { seed: 8 }), worker(lab, { seed: 13, vest: 'orange' }),
    ];
    people[0].position.set(3.4, 1.0, -10.5); people[0].rotation.y = -Math.PI / 2; // on the belt loader platform
    people[1].position.set(12.9, 0, -17.6); people[1].rotation.y = -0.6; // lead
    people[2].position.set(1.6, 0, -17.6); people[2].rotation.y = 2.5; // headset at the nose
    people[3].position.set(13.2, 0, -10.2); people[3].rotation.y = Math.PI / 2;
    people.forEach(p => root.add(p));
    // headset cable from the nose worker
    tube(root, [[1.5, 1.6, -17.5], [1.1, 0.4, -17], [0.7, 0.3, -16.2], [0.4, 1.8, -15.9]], 0.01, M.plastic);
    this.leak = carts[1].userData.leak;

    // a vehicle that drives along the service road
    this.driver = baggageTug(lab); this.driver.rotation.y = Math.PI / 2; this.driver.position.set(-60, 0, -26.2); root.add(this.driver);

    // -------------------------------------------------------------- hazard zones overlay
    const stripe = canvasTexture(256, 256, c => { c.fillStyle = 'rgba(220,40,30,0.32)'; c.fillRect(0, 0, 256, 256); c.strokeStyle = 'rgba(255,90,60,0.55)'; c.lineWidth = 26; for (let i = -256; i < 512; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 256, 256); c.stroke(); } }, { repeat: [4, 4], srgb: true }).texture;
    const zoneMat = new THREE.MeshBasicMaterial({ map: stripe, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, side: THREE.DoubleSide });
    const zones = this.zones = new THREE.Group(); root.add(zones);
    for (const e of tan.engines) {
      const intake = mesh(new THREE.CircleGeometry(4.2, 48, 0, Math.PI).rotateX(-Math.PI / 2), zoneMat, zones, { cast: false });
      intake.position.set(e.intake.x, 0.03, e.intake.z + 1.2); intake.rotation.y = 0;
      const blast = new THREE.Shape(); blast.moveTo(-1.4, 0); blast.lineTo(1.4, 0); blast.lineTo(5, 28); blast.lineTo(-5, 28); blast.closePath();
      const bl = mesh(new THREE.ShapeGeometry(blast).rotateX(Math.PI / 2), zoneMat, zones, { cast: false });
      bl.position.set(e.exhaust.x, 0.03, e.exhaust.z);
    }
    const zoneLabel = (text, x, z, rot = 0) => {
      const t = canvasTexture(1024, 160, c => { c.fillStyle = 'rgba(160,20,12,.85)'; c.beginPath(); c.roundRect(0, 0, 1024, 160, 40); c.fill(); c.fillStyle = '#fff'; c.font = '700 64px system-ui'; c.textAlign = 'center'; c.fillText(text, 512, 104); }).texture;
      const m = mesh(new THREE.PlaneGeometry(6.4, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }), zones, { cast: false });
      m.position.set(x, 0.05, z); m.rotation.y = rot;
    };
    zoneLabel('INTAKE HAZARD AREA', -5.75, -14.2); zoneLabel('INTAKE HAZARD AREA', 5.75, -14.2);
    zoneLabel('EXHAUST / JET BLAST', -7.5, 12, Math.PI / 2); zoneLabel('EXHAUST / JET BLAST', 7.5 + 2, 18, Math.PI / 2);
    zones.visible = false;

    // -------------------------------------------------------------- FOD items (with generous pick proxies)
    this.fod = fodItems(lab).map((f, i) => {
      const [x, z] = FOD_SPOTS[i];
      f.object.position.set(x, 0, z);
      f.object.rotation.y = i * 1.7;
      f.object.scale.setScalar(1.5);
      const proxy = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      proxy.position.y = 0.1;
      f.object.add(proxy);
      // a faint glint to make objects findable in sunlight
      const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(64, 64, c => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.2, 'rgba(255,250,220,.5)'); g.addColorStop(1, 'rgba(255,250,220,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }).texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glint.scale.setScalar(0.35); glint.position.y = 0.06;
      f.object.add(glint);
      f.glint = glint;
      root.add(f.object);
      f.id = 'fod-' + i;
      return f;
    });
    // the scenario object near the engine (a stray access panel)
    const panel = mesh(roundedBox(0.42, 0.015, 0.3, 0.01, 1), M.aluminum, root);
    panel.position.set(5.2, 0.01, -11.2); panel.rotation.y = 0.5;

    this.bounds = (p) => { p.x = THREE.MathUtils.clamp(p.x, -46, 46); p.z = THREE.MathUtils.clamp(p.z, -29.8, 48); };
  }

  async enter(lab, opts = {}) {
    this.lab = lab;
    await lab.setAtmosphere({ env: 'quarry_01', azimuth: 215, elevation: 34, turbidity: 2.8, rayleigh: 1.4, exposure: 0.62, envIntensity: 0.9, sunIntensity: 3.4, hemi: 0.25, fog: ['#c8d6dd', 220, 1900] });
    lab.focusShadow(new THREE.Vector3(0, 0, -2), 40, 220);
    lab.shadowFollow = null;
    lab.floors = [this.apron];
    this.fod.forEach(f => (f.object.visible = !lab.progress.fod.includes(f.id)));
    this.fod.forEach(f => { if (f.object.visible) lab.addInteractive(f.object, () => this.collect(f)); });
    if (opts.sub === 'overview') this.view = 'orbit';
    this.setView(this.view, false);
    this.addHotspots();
    this.home();
  }

  setView(v, animate = true) {
    const lab = this.lab;
    this.view = v;
    if (v === 'orbit') {
      lab.controls.setOrbit({ target: new THREE.Vector3(1, 2.5, -3), position: new THREE.Vector3(34, 21, 30), min: 6, max: 140, animate });
      lab.ui.setHint('Drag to orbit · Scroll to zoom · Right-drag to pan · Select markers');
    } else {
      lab.controls.setWalk({ position: new THREE.Vector3(21, 0, 9), yaw: 0.86, pitch: 0.02, eye: 1.68, bounds: this.bounds, speed: 2.4 });
      lab.ui.setHint('Drag to look · W A S D or arrows to walk · Click the ground to walk there · Shift to hurry');
    }
  }

  addHotspots() {
    const lab = this.lab;
    SCENARIOS.forEach(sc => lab.hotspots.add({ id: sc.id, position: new THREE.Vector3(...sc.at), kind: lab.progress.scenarios.includes(sc.id) ? 'done' : 'scenario', label: sc.title, onSelect: () => runScenario(lab, sc, { back: () => this.home(), onCorrect: () => lab.hotspots.setKind(sc.id, 'done') }) }));
    INFO.forEach(i => lab.hotspots.add({ id: i.id, position: new THREE.Vector3(...i.at), kind: 'info', label: i.label, onSelect: () => lab.ui.setPanel({ tag: 'Ramp awareness', title: i.label, text: i.text, buttons: [{ label: '← Back to ramp tasks', primary: true, onClick: () => this.home() }], foot: 'Requirements vary by employer and airport. Follow your local procedures.' }) }));
  }

  collect(f) {
    const lab = this.lab;
    if (!f.object.visible) return;
    f.object.visible = false;
    lab.interactive = lab.interactive.filter(o => o !== f.object);
    lab.mark('fod', f.id);
    const n = this.fod.filter(x => !x.object.visible).length;
    lab.ui.toast(`${f.name} picked up · ${n} of ${this.fod.length}`, 'good');
    if (n === this.fod.length) lab.ui.toast('FOD walk complete: the stand is clear', 'good');
    this.home();
  }

  home() {
    const lab = this.lab;
    const found = this.fod.filter(f => !f.object.visible).length;
    const scen = SCENARIOS.filter(s => lab.progress.scenarios.includes(s.id)).length;
    lab.ui.setPanel({
      tag: '03 · Ramp & cargo safety',
      title: found === this.fod.length && scen === SCENARIOS.length ? 'Stand 7 is safe and ready' : 'Walk the stand before the turnaround',
      html: `<p>You’re a new ramp service agent at Stand 7. Walk the apron, pick up foreign object debris (FOD) and work through the orange <b>?</b> scenarios. Blue <b>i</b> markers explain the equipment around you.</p>
<ul><li><b>FOD walk:</b> ${found} of ${this.fod.length} items found</li><li><b>Scenarios:</b> ${scen} of ${SCENARIOS.length} complete</li><li><b>Danger zones:</b> show the engine intake and exhaust hazard areas</li></ul>`,
      vrText: `FOD walk: ${found} of ${this.fod.length} found. Scenarios: ${scen} of ${SCENARIOS.length}. Teleport with the right stick, point and pull the trigger on objects and markers.`,
      buttons: [
        { label: this.zonesOn ? 'Hide danger zones' : 'Show danger zones', primary: !this.zonesOn, onClick: () => { this.zonesOn = !this.zonesOn; this.zones.visible = this.zonesOn; this.home(); } },
        { label: this.beaconOn ? 'Beacon off' : 'Beacon on', on: this.beaconOn, onClick: () => { this.beaconOn = !this.beaconOn; if (this.beaconOn) lab.ui.toast('Beacon on: stay clear of engine hazard areas', 'bad'); this.home(); } },
        { label: 'Scan for FOD (hint)', onClick: () => { this.scanTime = 3; lab.ui.toast('Look for the glints on the apron'); } },
        { label: this.view === 'walk' ? 'Overview camera' : 'Walk the ramp', onClick: () => { this.setView(this.view === 'walk' ? 'orbit' : 'walk'); this.home(); } },
        { label: 'Reset FOD walk', onClick: () => { lab.progress.fod = []; lab.saveProgress(); lab.go('ramp', { sub: this.view === 'orbit' ? 'overview' : '' }); } },
      ],
      progress: { value: found + scen, max: this.fod.length + SCENARIOS.length, label: `${found + scen} of ${this.fod.length + SCENARIOS.length} ramp tasks complete` },
      foot: 'Hazard areas shown are illustrative only. Your airline and airport define the actual zones, distances and procedures.',
    });
  }

  xrSpawn() { return { position: new THREE.Vector3(14.5, 0, -2), yaw: 0.9 }; }
  xrBounds(p) { this.bounds(p); }
  exit(lab) { lab.ui.setHint(''); this.ac.setBeacon(false); }

  update(dt, t) {
    // beacon flash
    const on = this.beaconOn && Math.floor(t * 1.4) % 2 === 0;
    this.ac.setBeacon(on);
    // FOD glints sparkle; brighter during a scan
    if (this.scanTime > 0) this.scanTime -= dt;
    this.fod.forEach((f, i) => {
      if (!f.object.visible) return;
      const s = Math.max(0, Math.sin(t * 2.2 + i * 1.3));
      f.glint.material.opacity = this.scanTime > 0 ? 0.6 + s * 0.4 : s ** 6 * 0.7;
      f.glint.scale.setScalar(this.scanTime > 0 ? 1.2 + s * 0.6 : 0.3 + s * 0.15);
    });
    // service road traffic
    const x = ((t * 4.2) % 160) - 80;
    this.driver.position.x = x;
    // leaking carton subtly darkens the puddle (no-op placeholder for future)
  }
}

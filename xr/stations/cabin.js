// Station 04: narrow-body cabin — safety equipment, cabin appearance sweep and cabin scenarios.
import * as THREE from 'three';
import { mesh, box, cyl, rod, sphere, roundedBox, canvasTexture, rand } from '../util.js';
import { materials } from '../materials.js';
import { runScenario } from '../scenario.js';

const R = 1.88, CY = 1.02;           // cabin shell radius and centre height above the floor
const PITCH = 0.79, FIRST_ROW = 1.55, ROWS = 24, EXIT_ROWS = [10, 11];
const rowZ = (i) => FIRST_ROW + i * PITCH + (i > EXIT_ROWS[1] ? 0.22 : 0) + (i > EXIT_ROWS[0] ? 0.1 : 0);
const LENGTH = rowZ(ROWS - 1) + 3.2 + 3.3;

const EQUIPMENT = [
  { id: 'eq-ext', label: 'Fire extinguisher', at: [-1.18, 1.25, -2.15], text: 'A portable fire extinguisher is stowed in a marked bracket near the crew station. Which extinguishers an aircraft carries, where they are and how they are used are covered in the airline’s initial and recurrent training.' },
  { id: 'eq-ped', label: 'PED fire containment kit', at: [1.25, 1.45, -2.45], text: 'Lithium-battery fires in phones and laptops need a specific response. The FAA’s PED fire training video for cabin crew shows the concepts; your airline’s procedure, equipment and crew communication are what you follow.' },
  { id: 'eq-o2', label: 'Portable oxygen', at: [-0.95, 2.05, 1.0], text: 'Portable oxygen bottles are stowed in marked locations, often overhead or in bulkhead compartments. Their pre-flight checks and use are part of flight attendant equipment training.' },
  { id: 'eq-aid', label: 'First aid kit', at: [0.95, 1.55, -2.85], text: 'First aid kits and other medical equipment are stowed in marked locations. Crew learn what each kit holds and when to request medical help on the ground or in flight.' },
  { id: 'eq-light', label: 'Flashlight at the jumpseat', at: [-1.12, 0.85, -1.85], text: 'Each crew jumpseat has a flashlight in a holder. It is part of the pre-flight equipment check your airline’s procedures describe.' },
  { id: 'eq-exit', label: 'Exit door (L1)', at: [-1.45, 1.6, -1.05], text: 'Exits are operated only by trained crew using the aircraft-specific procedure. Learn exit locations on every aircraft type you work on, including the overwing exits.' },
  { id: 'eq-overwing', label: 'Overwing exits', at: [-1.45, 1.35, rowZ(10) + 0.3], text: 'Overwing exits sit at the exit rows, with specific seating requirements for passengers in those rows. Exit row briefings and seating rules follow the airline’s procedures.' },
];

const SCENARIOS = [
  { id: 'cab-unlabeled', at: [0.9, 1.25, -2.3], tag: 'Cabin appearance · Chemicals', title: 'An unlabelled spray bottle', prompt: 'While preparing the cabin, you find a spray bottle in the galley with no label. It smells like a cleaner you have used before.', options: ['Use it on the tray tables; it smells right', 'Don’t use it; get an approved, correctly identified product and its safety information', 'Pour it into another bottle and label it yourself'], correct: 1, why: 'Do not use it. Obtain an approved, correctly identified product and the applicable safety information (safety data sheet).', source: 'Cabin cleaning learning priorities: approved chemicals and surfaces, safety data sheets, PPE and damage reporting.' },
  { id: 'cab-lost', at: [-0.95, 0.85, rowZ(6) + 0.3], tag: 'Cabin appearance · Lost property', title: 'A phone in a seat pocket', prompt: 'During the cabin clean you find a passenger’s phone in a seat pocket.', options: ['Leave it in the pocket for the next crew', 'Follow the lost-property procedure: hand it to the designated person and record it', 'Keep it safe in your own bag until the end of your shift'], correct: 1, why: 'Follow your employer’s lost-property procedure, handing the item to the designated person and recording it as required.' },
  { id: 'cab-damage', at: [1.1, 0.75, rowZ(15) + 0.3], tag: 'Cabin appearance · Damage', title: 'A torn seat cushion', prompt: 'You notice a seat cushion cover is torn and the tray table latch on the same row is broken.', options: ['Tuck the torn cover in so it looks tidy', 'Report the damage using the cabin defect / damage process', 'Ignore it; passengers rarely notice'], correct: 1, why: 'Report the damage through the cabin defect or damage-reporting process so it can be assessed and repaired.' },
  { id: 'cab-ped', at: [-0.4, 1.0, rowZ(13) + 0.3], tag: 'Flight attendant · PED', title: 'A device is overheating', prompt: 'A passenger says their phone is very hot and smells of smoke.', options: ['Tell them to put it in the overhead bin', 'Alert the crew immediately and follow the airline’s trained PED fire procedure', 'Wait a few minutes to see if it cools down'], correct: 1, why: 'Alert the crew straight away and follow your airline’s trained procedure for portable electronic device fires, using your assigned role and the right equipment.', source: 'Review reporting and assigned responsibilities using the FAA PED fire training video and your airline’s procedures.' },
  { id: 'cab-assist', at: [0.35, 1.2, 0.2], tag: 'Gate & cabin · Accessibility', title: 'A passenger needs boarding help', prompt: 'At the boarding door, a passenger tells you they need help getting to their seat.', options: ['Ask what help they would like and follow your accessibility assistance procedure', 'Take their arm and guide them without asking', 'Tell them to wait until everyone else has boarded'], correct: 0, why: 'Ask how you can help and follow your employer’s accessibility assistance procedure. Respectful communication comes first.' },
];

export class CabinStation {
  constructor() { this.title = 'Cabin safety'; this.xrLocomotion = 'teleport';  this.post = { ao: true, aoRadius: 0.45, bloomStrength: 0.32, vignette: 0.32 }; this.ambience = 'cabin'; }

  async build(lab) {
    const M = materials(lab);
    const root = this.root = new THREE.Group();
    root.name = 'cabin';
    const L = LENGTH, Z0 = -3.3;

    // -------------------------------------------------------------- shell
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.6, side: THREE.BackSide });
    const shell = mesh(new THREE.CylinderGeometry(R, R, L, 72, 1, true), shellMat, root, { cast: false });
    shell.rotation.x = Math.PI / 2; shell.position.set(0, CY, Z0 + L / 2);
    for (const z of [Z0, Z0 + L]) { const cap = mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.7 }), root, { cast: false }); cap.position.set(0, CY, z); if (z > 0) cap.rotation.y = Math.PI; }
    // floor: carpet aisle + darker floor under seats
    const fw = 2 * Math.sqrt(R * R - CY * CY);
    const floorGeo = new THREE.PlaneGeometry(fw, L).rotateX(-Math.PI / 2);
    this.floor = mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.95 }), root, { cast: false });
    this.floor.position.set(0, 0, Z0 + L / 2);
    const aisleGeo = new THREE.PlaneGeometry(0.62, L).rotateX(-Math.PI / 2);
    const auv = aisleGeo.attributes.uv; for (let i = 0; i < auv.count; i++) auv.setXY(i, auv.getX(i), auv.getY(i) * L / 2);
    const carpetMat = M.carpet.clone(); carpetMat.map = M.carpet.map.clone(); carpetMat.map.repeat.set(1, 1); carpetMat.map.needsUpdate = true;
    mesh(aisleGeo, carpetMat, root, { cast: false }).position.set(0, 0.004, Z0 + L / 2);
    // floor path lighting strips
    const pathMat = new THREE.MeshBasicMaterial({ color: 0xbfeccc });
    for (const x of [-0.31, 0.31]) mesh(new THREE.PlaneGeometry(0.025, L - 4).rotateX(-Math.PI / 2), pathMat, root, { cast: false }).position.set(x, 0.008, Z0 + L / 2 + 1.5);
    // dado panels / sidewall lower trim
    for (const dir of [-1, 1]) {
      const dado = box(root, [0.04, 0.3, L - 3], [dir * 1.53, 0.15, Z0 + L / 2 + 1.4], M.cabinTrim);
      dado.castShadow = false;
    }

    // -------------------------------------------------------------- overhead bins, PSU, ceiling, cove light
    const binShape = new THREE.Shape();
    binShape.moveTo(0, 0); binShape.lineTo(0.62, 0.12); binShape.quadraticCurveTo(0.7, 0.3, 0.66, 0.52); binShape.lineTo(0.0, 0.56); binShape.closePath();
    const binMat = new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.45, side: THREE.DoubleSide });
    const binLen = L - 4.2;
    for (const dir of [-1, 1]) {
      const g = new THREE.ExtrudeGeometry(binShape, { depth: binLen, bevelEnabled: false });
      const bin = mesh(g, binMat, root, { cast: false });
      bin.position.set(dir * 1.62, 1.66, Z0 + 3.0);
      bin.scale.x = -dir; // open side towards the aisle
      // bin door seams + latches
      for (let z = 0; z < binLen; z += 1.58) {
        box(root, [0.62, 0.012, 0.012], [dir * 1.28, 1.735, Z0 + 3.0 + z], M.cabinTrim);
        box(root, [0.1, 0.03, 0.02], [dir * 0.98, 2.0, Z0 + 3.0 + z + 0.79], M.plasticGrey);
      }
      // PSU strip with reading lights and seatbelt signs
      const psu = box(root, [0.42, 0.04, binLen], [dir * 1.32, 1.64, Z0 + 3.0 + binLen / 2], M.cabinTrim);
      psu.castShadow = false;
      // cove LED strip above bins
      mesh(new THREE.PlaneGeometry(0.06, binLen).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8e8ff }), root, { cast: false }).position.set(dir * 0.94, 2.27, Z0 + 3.0 + binLen / 2);
    }
    // ceiling panel
    const ceil = mesh(new THREE.CylinderGeometry(2.4, 2.4, binLen, 48, 1, true, Math.PI - 0.38, 0.76), new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.55, side: THREE.BackSide }), root, { cast: false });
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 2.32 - 2.4, Z0 + 3.0 + binLen / 2);

    // -------------------------------------------------------------- windows with an outside view
    const sky = canvasTexture(256, 384, c => {
      const g = c.createLinearGradient(0, 0, 0, 384); g.addColorStop(0, '#6f9fd0'); g.addColorStop(0.55, '#c4daea'); g.addColorStop(0.62, '#e8eef0'); g.addColorStop(0.66, '#8d9a8a'); g.addColorStop(1, '#5d6e5c');
      c.fillStyle = g; c.fillRect(0, 0, 256, 384);
      c.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(40 + i * 40, 150 + (i % 3) * 18, 34, 12, 0, 0, Math.PI * 2); c.fill(); }
    }).texture;
    const windowView = new THREE.MeshBasicMaterial({ map: sky, toneMapped: true });
    const bezelGeo = roundedBox(0.03, 0.42, 0.3, 0.1, 3);
    const paneGeo = new THREE.PlaneGeometry(0.22, 0.32);
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0xe3e0d8, roughness: 0.6 });
    const r = rand(17);
    for (let i = -1; i < ROWS + 1; i++) {
      const z = rowZ(Math.max(0, i)) + (i < 0 ? -PITCH : 0) + 0.25;
      if (z > Z0 + L - 1.5) continue;
      for (const dir of [-1, 1]) {
        const y = 1.12, x = dir * (Math.sqrt(R * R - (y - CY) ** 2) - 0.035);
        const bezel = mesh(bezelGeo, M.cabinTrim, root, { cast: false }); bezel.position.set(x, y, z);
        const pane = mesh(paneGeo, windowView, root, { cast: false }); pane.position.set(x - dir * 0.02, y, z); pane.rotation.y = -dir * Math.PI / 2;
        if (r() < 0.3) { const sh = box(root, [0.01, 0.16, 0.23], [x - dir * 0.025, y + 0.09, z], shadeMat); sh.castShadow = false; }
      }
    }

    // -------------------------------------------------------------- seats (instanced triples)
    const seatParts = this.seatTemplate(M);
    const placements = [];
    const nRows = ROWS;
    for (let i = 0; i < nRows; i++) for (const dir of [-1, 1]) placements.push({ x: dir * 0.97, z: rowZ(i), dir });
    for (const part of seatParts) {
      const inst = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
      const m = new THREE.Matrix4();
      placements.forEach((p, k) => { m.makeTranslation(p.x, 0, p.z); inst.setMatrixAt(k, m); });
      inst.castShadow = false; inst.receiveShadow = true;
      root.add(inst);
    }
    // row number placards on the bins
    for (let i = 0; i < nRows; i++) {
      const t = canvasTexture(128, 64, c => { c.fillStyle = '#e8e6e0'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#2b3236'; c.font = '700 40px system-ui'; c.textAlign = 'center'; c.fillText(String(i + 1), 64, 46); }).texture;
      for (const dir of [-1, 1]) { const p = mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshBasicMaterial({ map: t }), root, { cast: false }); p.position.set(dir * 1.02, 1.69, rowZ(i) - 0.15); p.rotation.set(0, dir * 0.9, 0); }
    }

    // -------------------------------------------------------------- forward bulkhead, galley, doors, signs
    const bulk = box(root, [3.3, 2.3, 0.08], [0, 1.15, Z0 + 0.02], M.cabinWall);
    box(root, [0.8, 1.95, 0.05], [0, 0.98, Z0 + 0.08], new THREE.MeshStandardMaterial({ color: 0x8e979c, metalness: 0.4, roughness: 0.4 })); // flight deck door
    box(root, [0.12, 0.04, 0.03], [0.28, 1.0, Z0 + 0.12], M.stainless);
    // galley block (right)
    const galley = new THREE.Group(); galley.position.set(0.95, 0, Z0 + 0.45); root.add(galley);
    box(galley, [1.1, 1.0, 0.75], [0, 0.5, 0.3], M.stainless);
    for (let i = 0; i < 3; i++) box(galley, [0.32, 0.92, 0.02], [-0.37 + i * 0.37, 0.48, 0.68], M.stainless).castShadow = false;
    box(galley, [1.1, 0.04, 0.8], [0, 1.02, 0.3], M.stainless);
    box(galley, [1.1, 0.75, 0.5], [0, 1.75, 0.15], M.stainless);
    for (let i = 0; i < 2; i++) box(galley, [0.45, 0.45, 0.02], [-0.25 + i * 0.5, 1.75, 0.41], new THREE.MeshStandardMaterial({ color: 0x1f2326, metalness: 0.6, roughness: 0.3 }));
    // galley counter items: coffee pots and the unlabeled bottle
    cyl(galley, 0.07, 0.08, 0.22, [0.32, 1.15, 0.45], M.stainless, null, 16);
    const bottle = new THREE.Group(); bottle.position.set(-0.08, 1.04, 0.55); galley.add(bottle);
    cyl(bottle, 0.045, 0.05, 0.2, [0, 0.1, 0], new THREE.MeshPhysicalMaterial({ color: 0xbfe6f2, roughness: 0.15, transparent: true, opacity: 0.75 }), null, 16);
    box(bottle, [0.04, 0.06, 0.08], [0, 0.23, 0.02], new THREE.MeshStandardMaterial({ color: 0xe9e9e9, roughness: 0.4 }));
    // equipment: extinguisher, PED kit, first aid, O2, flashlight
    const ext = new THREE.Group(); ext.position.set(-1.18, 1.0, Z0 + 1.15); root.add(ext);
    cyl(ext, 0.06, 0.06, 0.34, [0, 0.17, 0], M.red, null, 18); sphere(ext, [0.06, 0.04, 0.06], [0, 0.34, 0], M.red, 14); box(ext, [0.03, 0.05, 0.1], [0, 0.38, 0.03], M.darkMetal);
    const ped = mesh(roundedBox(0.3, 0.38, 0.12, 0.04, 2), new THREE.MeshStandardMaterial({ color: 0xd8642a, roughness: 0.8 }), root); ped.position.set(1.25, 1.4, Z0 + 0.95); ped.rotation.y = -Math.PI / 2;
    const aid = canvasTexture(128, 128, c => { c.fillStyle = '#f2f1ec'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#c4282c'; c.fillRect(52, 24, 24, 80); c.fillRect(24, 52, 80, 24); }).texture;
    const aidBox = mesh(new THREE.BoxGeometry(0.35, 0.25, 0.12), [M.cabinWall, M.cabinWall, M.cabinWall, M.cabinWall, new THREE.MeshStandardMaterial({ map: aid }), M.cabinWall], root); aidBox.position.set(0.95, 1.5, Z0 + 0.12);
    const o2 = new THREE.Group(); o2.position.set(-0.95, 1.86, 0.95); root.add(o2);
    cyl(o2, 0.055, 0.055, 0.42, [0, 0, 0], M.green, [Math.PI / 2, 0, 0], 16);
    cyl(o2, 0.02, 0.02, 0.06, [0, 0, -0.24], M.stainless, [Math.PI / 2, 0, 0], 10);
    // jumpseat (left, folded) + flashlight
    box(root, [0.5, 0.06, 0.4], [-0.95, 0.6, Z0 + 0.3], M.leather);
    box(root, [0.5, 0.75, 0.06], [-0.95, 1.0, Z0 + 0.11], M.leather);
    cyl(root, 0.025, 0.025, 0.2, [-1.12, 0.78, Z0 + 0.45], M.darkMetal, null, 10);
    // L1 / R1 doors with windows, handles and slide bustles
    for (const dir of [-1, 1]) {
      const door = new THREE.Group(); door.position.set(dir * 1.52, 0, Z0 + 2.25); root.add(door);
      box(door, [0.08, 1.9, 0.86], [0, 0.98, 0], new THREE.MeshStandardMaterial({ color: 0xdedbd3, roughness: 0.45 }));
      box(door, [0.1, 0.3, 0.6], [-dir * 0.08, 0.28, 0], new THREE.MeshStandardMaterial({ color: 0x9aa1a6, roughness: 0.5 })); // slide bustle
      const dw = mesh(new THREE.PlaneGeometry(0.2, 0.26), windowView, door, { cast: false }); dw.position.set(-dir * 0.05, 1.45, 0); dw.rotation.y = -dir * Math.PI / 2;
      box(door, [0.12, 0.05, 0.3], [-dir * 0.08, 1.15, -0.2], M.stainless);
      box(door, [0.06, 0.08, 0.14], [-dir * 0.08, 0.6, 0.3], new THREE.MeshStandardMaterial({ color: 0xd11f1f, roughness: 0.4 }));
    }
    // EXIT signs
    const exitTex = canvasTexture(256, 96, c => { c.fillStyle = '#1b1b1b'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#ff4136'; c.font = '800 66px system-ui'; c.textAlign = 'center'; c.fillText('EXIT', 128, 72); }).texture;
    const exitMat = new THREE.MeshBasicMaterial({ map: exitTex });
    const exitSign = (x, y, z, ry = 0) => { const s = mesh(new THREE.BoxGeometry(0.34, 0.12, 0.04), [M.plastic, M.plastic, M.plastic, M.plastic, exitMat, exitMat], root, { cast: false }); s.position.set(x, y, z); s.rotation.y = ry; };
    exitSign(0, 2.15, Z0 + 2.6); exitSign(0, 2.15, rowZ(10) - 0.2); exitSign(0, 2.15, rowZ(ROWS - 1) + 1.6);
    // overwing exit hatches
    for (const dir of [-1, 1]) for (const k of EXIT_ROWS) {
      const z = rowZ(k) + 0.3;
      box(root, [0.04, 0.95, 0.52], [dir * 1.66, 0.95, z], new THREE.MeshStandardMaterial({ color: 0xd9d6ce, roughness: 0.5 }));
      box(root, [0.05, 0.05, 0.25], [dir * 1.63, 1.38, z], new THREE.MeshStandardMaterial({ color: 0xd11f1f }));
    }
    // aft bulkhead / lavatory doors
    box(root, [3.3, 2.3, 0.08], [0, 1.15, Z0 + L - 0.9], M.cabinWall);
    for (const x of [-0.75, 0.75]) box(root, [0.6, 1.9, 0.04], [x, 0.98, Z0 + L - 0.95], new THREE.MeshStandardMaterial({ color: 0xcfcbc2, roughness: 0.5 }));

    // -------------------------------------------------------------- cleaner tasks: litter on seats + the props for scenarios
    this.litter = [];
    const litterMats = [new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: 0xc9473a, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0x3a6fb0, roughness: 0.5 })];
    const litterSpots = [[2, -1, 'Coffee cup'], [4, 1, 'Snack wrapper'], [8, -1, 'Newspaper'], [12, 1, 'Water bottle'], [17, -1, 'Napkins'], [20, 1, 'Blanket left on seat'], [22, -1, 'Headphone bag']];
    litterSpots.forEach(([row, side, name], k) => {
      const g = new THREE.Group();
      const z = rowZ(row) + 0.1, x = side * (0.55 + (k % 3) * 0.46);
      g.position.set(x, 0.49, z);
      if (name === 'Coffee cup') cyl(g, 0.04, 0.032, 0.1, [0, 0.05, 0], litterMats[0], null, 14);
      else if (name === 'Water bottle') { const b = cyl(g, 0.035, 0.035, 0.22, [0, 0.035, 0], new THREE.MeshPhysicalMaterial({ color: 0xcfe9f5, roughness: 0.1, transparent: true, opacity: 0.7 }), [0, 0, Math.PI / 2], 14); b.castShadow = false; }
      else if (name === 'Newspaper') box(g, [0.3, 0.02, 0.22], [0, 0.01, 0], new THREE.MeshStandardMaterial({ color: 0xdedbd1, roughness: 0.9 }));
      else if (name === 'Blanket left on seat') mesh(roundedBox(0.4, 0.06, 0.3, 0.03, 2), new THREE.MeshStandardMaterial({ color: 0x31435e, roughness: 1 }), g).position.y = 0.03;
      else box(g, [0.14, 0.02, 0.09], [0, 0.01, 0], litterMats[k % 3]);
      const proxy = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); g.add(proxy);
      root.add(g);
      this.litter.push({ id: 'lit-' + k, name, object: g });
    });
    // phone in seat pocket, torn cushion marker, smoking phone, aisle wheelchair
    box(root, [0.075, 0.14, 0.012], [-0.95, 0.7, rowZ(6) + 0.36], new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.3, metalness: 0.4 }));
    const tear = mesh(new THREE.PlaneGeometry(0.16, 0.1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 1 }), root, { cast: false }); tear.position.set(1.1, 0.475, rowZ(15) + 0.12);
    this.smoke = [];
    const smokeTex = canvasTexture(64, 64, c => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(200,200,200,.6)'); g.addColorStop(1, 'rgba(200,200,200,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }).texture;
    for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false })); s.position.set(-0.45, 0.55, rowZ(13) + 0.15); root.add(s); this.smoke.push(s); }
    box(root, [0.075, 0.012, 0.14], [-0.45, 0.475, rowZ(13) + 0.15], new THREE.MeshStandardMaterial({ color: 0x111418, emissive: 0x401000, roughness: 0.3 }));
    const chair = new THREE.Group(); chair.position.set(0.3, 0, Z0 + 2.0); root.add(chair);
    box(chair, [0.4, 0.05, 0.42], [0, 0.48, 0], new THREE.MeshStandardMaterial({ color: 0x23527a, roughness: 0.7 }));
    box(chair, [0.4, 0.7, 0.05], [0, 0.85, 0.2], new THREE.MeshStandardMaterial({ color: 0x23527a, roughness: 0.7 }));
    for (const x of [-0.18, 0.18]) { rod(chair, [x, 0.08, -0.15], [x, 0.48, -0.15], 0.015, M.aluminum); rod(chair, [x, 0.08, 0.2], [x, 1.2, 0.2], 0.015, M.aluminum); cyl(chair, 0.07, 0.07, 0.04, [x, 0.07, 0.2], M.rubber, [0, 0, Math.PI / 2], 14); }

    // -------------------------------------------------------------- lights
    for (let z = Z0 + 2; z < Z0 + L - 1; z += 5) { const p = new THREE.PointLight(0xfff3e2, 3.3, 9, 1.4); p.position.set(0, 2.05, z); root.add(p); }
    const hemi = new THREE.HemisphereLight(0xffffff, 0x5a5048, 0.6); root.add(hemi);
    this.bounds = (p) => {
      const zMin = Z0 + 0.45, zMax = Z0 + L - 1.3;
      p.z = THREE.MathUtils.clamp(p.z, zMin, zMax);
      const wide = p.z < Z0 + 2.9; // galley / door area is wider
      p.x = THREE.MathUtils.clamp(p.x, wide ? -1.15 : -0.22, wide ? 0.3 : 0.22);
    };
  }

  seatTemplate(M) {
    // One triple-seat unit centred at x=0, facing -z; built from merged parts per material.
    const parts = [];
    const add = (geo, mat, x, y, z, rx = 0) => { geo = geo.clone(); if (rx) geo.rotateX(rx); geo.translate(x, y, z); parts.push({ geo, mat }); };
    const cushion = roundedBox(0.44, 0.11, 0.46, 0.05, 2);
    const back = roundedBox(0.43, 0.72, 0.1, 0.05, 2);
    const head = roundedBox(0.4, 0.2, 0.025, 0.02, 1);
    const arm = roundedBox(0.05, 0.05, 0.42, 0.02, 1);
    const tray = roundedBox(0.36, 0.3, 0.02, 0.02, 1);
    const shellBack = roundedBox(0.43, 0.7, 0.03, 0.03, 1);
    const leg = new THREE.BoxGeometry(0.05, 0.38, 0.05);
    const beam = new THREE.CylinderGeometry(0.03, 0.03, 1.4, 10).rotateZ(Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.46;
      add(cushion, M.fabric, x, 0.43, 0.02);
      add(back, M.fabric, x, 0.83, 0.27, -0.12);
      add(head, new THREE.MeshStandardMaterial({ color: 0xf1efe8, roughness: 0.9 }), x, 1.08, 0.25, -0.12);
      add(shellBack, M.plasticGrey, x, 0.82, 0.335, -0.12);
      add(tray, M.plasticGrey, x, 0.84, 0.36, -0.12);
    }
    for (const x of [-0.69, -0.23, 0.23, 0.69]) add(arm, M.plasticGrey, x, 0.62, 0.05);
    for (const x of [-0.5, 0.5]) { add(leg, M.aluminum, x, 0.19, -0.15); add(leg, M.aluminum, x, 0.19, 0.2); }
    add(beam, M.aluminum, 0, 0.37, 0.0);
    // merge by material
    const byMat = new Map();
    for (const p of parts) { if (!byMat.has(p.mat)) byMat.set(p.mat, []); byMat.get(p.mat).push(p.geo); }
    const out = [];
    for (const [mat, geos] of byMat) {
      const merged = geos.length === 1 ? geos[0] : mergeList(geos);
      out.push({ geometry: merged, material: mat });
    }
    return out;
  }

  async enter(lab, opts = {}) {
    this.lab = lab;
    await lab.setAtmosphere({ env: 'room', exposure: 0.66, envIntensity: 0.45, sunIntensity: 0, hemi: 0.12, showSky: false, background: 0x0c1218 });
    lab.shadowFollow = null;
    lab.floors = [this.floor];
    lab.controls.setWalk({ position: new THREE.Vector3(-0.25, 0, -2.6), yaw: Math.PI * 0.97, pitch: -0.06, eye: 1.62, bounds: this.bounds, speed: 1.6, fov: 72 });
    this.litter.forEach(l => { l.object.visible = !lab.progress.cabin.includes(l.id); if (l.object.visible) lab.addInteractive(l.object, () => this.collect(l)); });
    EQUIPMENT.forEach(e => lab.hotspots.add({ id: e.id, position: new THREE.Vector3(...e.at), kind: lab.progress.cabin.includes(e.id) ? 'done' : 'info', label: e.label, onSelect: () => this.equipment(e) }));
    SCENARIOS.forEach(sc => lab.hotspots.add({ id: sc.id, position: new THREE.Vector3(...sc.at), kind: lab.progress.scenarios.includes(sc.id) ? 'done' : 'scenario', label: sc.title, onSelect: () => runScenario(lab, sc, { back: () => this.home(), onCorrect: () => lab.hotspots.setKind(sc.id, 'done') }) }));
    lab.ui.setHint('Drag to look · W/S or arrows to walk the aisle · Click the floor to move · Select markers and litter');
    this.home();
  }

  equipment(e) {
    const lab = this.lab;
    if (lab.mark('cabin', e.id)) lab.ui.toast(e.label + ' located', 'good');
    lab.hotspots.setKind(e.id, 'done');
    lab.ui.setPanel({ tag: 'Cabin safety equipment', title: e.label, text: e.text, buttons: [{ label: '← Back to cabin tasks', primary: true, onClick: () => this.home() }], foot: 'Equipment types and locations differ by aircraft and airline. Initial and recurrent training are the authority.' });
  }

  collect(l) {
    const lab = this.lab;
    if (!l.object.visible) return;
    l.object.visible = false;
    lab.interactive = lab.interactive.filter(o => o !== l.object);
    lab.mark('cabin', l.id);
    const n = this.litter.filter(x => !x.object.visible).length;
    lab.ui.toast(`${l.name} cleared · ${n} of ${this.litter.length}`, 'good');
    this.home();
  }

  home() {
    const lab = this.lab;
    const eq = EQUIPMENT.filter(e => lab.progress.cabin.includes(e.id)).length;
    const lit = this.litter.filter(l => !l.object.visible).length;
    const sc = SCENARIOS.filter(s => lab.progress.scenarios.includes(s.id)).length;
    lab.ui.setPanel({
      tag: '04 · Cabin safety & appearance',
      title: 'Prepare the cabin for boarding',
      html: `<p>Two roles share this space. <b>Cabin cleaners</b> clear and check every row. <b>Flight attendants</b> must know where the safety equipment is and how to respond.</p>
<ul><li><b>Cabin sweep:</b> ${lit} of ${this.litter.length} items cleared (select litter on seats)</li><li><b>Locate equipment:</b> ${eq} of ${EQUIPMENT.length} found (blue markers)</li><li><b>Scenarios:</b> ${sc} of ${SCENARIOS.length} complete (orange markers)</li></ul>`,
      vrText: `Cabin sweep ${lit}/${this.litter.length}, equipment ${eq}/${EQUIPMENT.length}, scenarios ${sc}/${SCENARIOS.length}. Use the left stick to walk the aisle.`,
      buttons: [
        { label: 'Walk to the front galley', onClick: () => lab.controls.setWalk({ position: new THREE.Vector3(-0.3, 0, -1.6), yaw: Math.PI * 0.75, pitch: -0.05, eye: 1.62, bounds: this.bounds, speed: 1.6, fov: 72 }) },
        { label: 'Walk to the exit rows', onClick: () => lab.controls.setWalk({ position: new THREE.Vector3(0, 0, rowZ(8)), yaw: Math.PI, pitch: -0.1, eye: 1.62, bounds: this.bounds, speed: 1.6, fov: 72 }) },
        { label: 'Look back from the rear', onClick: () => lab.controls.setWalk({ position: new THREE.Vector3(0, 0, rowZ(ROWS - 1) + 1.2), yaw: 0, pitch: -0.06, eye: 1.62, bounds: this.bounds, speed: 1.6, fov: 72 }) },
        { label: 'Reset cabin tasks', onClick: () => { lab.progress.cabin = []; lab.saveProgress(); lab.go('cabin'); } },
      ],
      progress: { value: eq + lit + sc, max: EQUIPMENT.length + this.litter.length + SCENARIOS.length, label: `${eq + lit + sc} of ${EQUIPMENT.length + this.litter.length + SCENARIOS.length} cabin tasks complete` },
      foot: 'Generic cabin for orientation. Flight attendant qualification comes only from the airline’s required training.',
    });
  }

  xrSpawn() { return { position: new THREE.Vector3(-0.2, 0, -1.4), yaw: Math.PI }; }
  xrBounds(p) { this.bounds(p); }
  exit(lab) { lab.ui.setHint(''); }
  update(dt, t) {
    this.smoke.forEach((s, i) => {
      const k = ((t * 0.35 + i / this.smoke.length) % 1);
      s.position.y = 0.52 + k * 0.7;
      s.position.x = -0.45 + Math.sin(t + i) * 0.04 * k;
      s.scale.setScalar(0.06 + k * 0.28);
      s.material.opacity = (1 - k) * 0.5;
    });
  }
}

function mergeList(geos) {
  // local merge to avoid importing utils twice; geometries share attribute layout
  const nonIndexed = geos.map(g => (g.index ? g.toNonIndexed() : g));
  const total = nonIndexed.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of nonIndexed) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array.slice(0, g.attributes.position.count * 2), o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

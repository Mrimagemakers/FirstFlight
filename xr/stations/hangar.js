// Station 01/02: maintenance hangar with a teachable trainer airplane.
// Modes: systems lab, preflight walkaround, tool control (maintenance), AR tabletop.
import * as THREE from 'three';
import { mesh, box, cyl, rod, tube, sphere, canvasTexture, contactShadow, roundedBox, rand } from '../util.js';
import { materials } from '../materials.js';
import { buildTrainer } from '../models/trainer.js';
import { quality } from '../settings.js';
import { addPlanarReflection } from '../reflect.js';
import { hfPerson } from '../models/hf.js';

const COMPONENTS = {
  airframe: { label: 'Airframe & flight controls', tag: 'Airframe & controls', title: 'Follow the control paths', text: 'Watch the ailerons, elevator and rudder move. Ailerons move differentially to roll the airplane, the elevator changes pitch and the rudder influences yaw. Cables (gold and steel) show the idea of a mechanical link from the cabin; real rigging, tension and travel limits come from approved maintenance data.', focus: [0, 1.6, 1.2], cam: [7.5, 4.2, 8.5] },
  engine: { label: 'Piston engine', tag: 'Piston engine', title: 'See the mechanism move', text: 'A horizontally opposed four-cylinder engine sits behind the propeller. Pistons reciprocate in cooling-finned cylinders and turn a central crankshaft that drives the propeller. This animation shows motion only. It is not a timed combustion cycle and not a maintenance procedure.', focus: [0, 1.5, -2.6], cam: [3.2, 2.4, -5.6] },
  fuel: { label: 'Fuel system', tag: 'Fuel system', title: 'Trace the path of fuel', text: 'Blue tanks sit inside each wing. Lines descend through the cabin area to a selector, a strainer (red) and on to the engine. Real systems add vents, drains, pumps and placards specific to the airplane. Your instructor and the approved handbook explain fuel quantity, quality checks and sampling.', focus: [0, 1.9, -0.6], cam: [-6.5, 5.5, 4.5] },
  electrical: { label: 'Electrical system', tag: 'Electrical system', title: 'Connect the essentials', text: 'A battery (red) stores energy for starting; an engine-driven alternator charges it in flight. Yellow wires show a simplified path to the panel and out to the wingtip lights. Circuit protection, switching and bus layout are aircraft-specific and omitted here.', focus: [0, 1.4, -1.6], cam: [4.2, 3, -2.6] },
};

const WALKAROUND = [
  { id: 'cabin', label: 'Cabin & documents', pos: [-0.9, 1.6, -0.5], cam: [-4.2, 2.2, -1.2], text: 'Begin in the cabin. Your instructor will show where required documents, the approved handbook and the checklist are kept, and how to confirm switches are set as the checklist directs before you walk around.' },
  { id: 'lwing', label: 'Left wing & fuel', pos: [-3.6, 2.7, -0.3], cam: [-6.5, 3.6, 2.4], text: 'Along the left wing, look at the overall condition of the surface, the fuel cap area and the leading edge. Fuel quantity and sampling use approved procedures. This model shows locations, not inspection standards.' },
  { id: 'lmain', label: 'Left main gear', pos: [-1.1, 0.9, 0.6], cam: [-3.4, 1.2, 2.6], text: 'At the main landing gear, notice the tire, wheel fairing and gear leg. Ask your instructor what “acceptable condition” means for tires and brakes on your airplane, using its approved data.' },
  { id: 'tail', label: 'Tail & control surfaces', pos: [0.6, 2.3, 3.4], cam: [3.4, 2.6, 7.2], text: 'At the tail, see the elevator and rudder. In a real walkaround you check free and correct movement and secure attachment as the approved checklist describes. Never force a control surface.' },
  { id: 'rwing', label: 'Right wing & lights', pos: [3.6, 2.7, -0.3], cam: [6.5, 3.6, 2.4], text: 'Along the right wing, find the aileron, flap and the green navigation light at the tip. Lights and the pitot-static openings are part of many checklists; your instructor demonstrates each item on the actual airplane.' },
  { id: 'rmain', label: 'Right main gear', pos: [1.1, 0.9, 0.6], cam: [3.4, 1.2, 2.6], text: 'Check the right main gear area the same way. Consistency matters: follow the checklist in order so nothing is skipped when you are interrupted.' },
  { id: 'engine', label: 'Engine & propeller', pos: [0.7, 1.6, -2.7], cam: [2.6, 1.9, -5.6], text: 'Treat every propeller as live. Never stand in its arc. Oil quantity, cowling security and the propeller are checked using the airplane’s procedures. Ask how your instructor wants you to approach this area.' },
  { id: 'nose', label: 'Nose gear & chocks', pos: [0, 0.6, -2.45], cam: [-1.6, 1.0, -5.0], text: 'At the nose gear, notice the tire, oleo strut and the wheel chocks. Remove chocks and tie-downs only as part of the procedure your instructor teaches, and confirm the area is clear.' },
];

const TOOLS = ['Torque wrench', 'Ratchet', 'Combination wrench', 'Screwdriver', 'Pliers', 'Safety-wire pliers', 'Inspection mirror', 'Flashlight', 'Hex key set', 'Feeler gauge'];

export class HangarStation {
  constructor() { this.title = 'Maintenance hangar'; this.mode = 'systems';  this.post = { ao: true, aoRadius: 0.8, bloomStrength: 0.25 }; this.ambience = 'hangar'; }

  async build(lab) {
    const M = materials(lab);
    const root = this.root = new THREE.Group();
    root.name = 'hangar';
    const W = 44, D = 36, H = 11; // hangar size; door opening faces -z

    // -------------------------------------------------------------- floors
    const floorGeo = new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2);
    this.floor = mesh(floorGeo, M.epoxy, root, { cast: false });
    this.floor.position.z = 0;
    this.floorSize = [W, D];
    if (quality().reflections) this.refl = addPlanarReflection(lab, this.floor, { width: W, depth: D, strength: 0.34 });
    const apron = new THREE.PlaneGeometry(260, 220).rotateX(-Math.PI / 2);
    const uv = apron.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 260 / 7.5, uv.getY(i) * 220 / 7.5);
    this.apron = mesh(apron, M.concrete, root, { cast: false });
    this.apron.position.set(0, -0.01, -D / 2 - 110);
    const grass = new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2);
    const guv = grass.attributes.uv; for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 160, guv.getY(i) * 160);
    mesh(grass, M.grass, root, { cast: false }).position.set(0, -0.05, -200);

    // safety markings on the hangar floor
    const lineMat = M.paintYellow;
    const lines = new THREE.Group(); root.add(lines);
    const strip = (w, d, x, z, mat = lineMat) => { const m = mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat, lines, { cast: false }); m.position.set(x, 0.006, z); return m; };
    strip(0.12, 16, -7.5, -0.5); strip(0.12, 16, 7.5, -0.5); strip(15.1, 0.12, -7.5 + 7.5, 7.5); strip(15.1, 0.12, 0, -8.5);
    // walkway hatch near the side door
    for (let i = 0; i < 9; i++) strip(1.6, 0.25, -17, -6 + i * 0.6, M.paintWhite);
    // floor text: FOD FREE ZONE
    const fodText = canvasTexture(1024, 256, (c) => { c.clearRect(0, 0, 1024, 256); c.fillStyle = '#e0b220'; c.font = '700 120px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('FOD FREE ZONE', 512, 170); }).texture;
    const ft = mesh(new THREE.PlaneGeometry(6, 1.5).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: fodText, transparent: true, roughness: 0.7 }), lines, { cast: false });
    ft.position.set(0, 0.007, -9.6); ft.rotation.y = Math.PI;

    // -------------------------------------------------------------- building shell
    const shell = new THREE.Group(); root.add(shell); this.shell = shell;
    const corrugated = (w, h, color) => {
      const g = new THREE.PlaneGeometry(w, h, Math.round(w * 9), 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * Math.PI * 2 / 0.22) * 0.025);
      g.computeVertexNormals();
      return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.42, side: THREE.DoubleSide }));
    };
    const back = corrugated(W, H, 0xd9dcdc); back.position.set(0, H / 2, D / 2); back.rotation.y = Math.PI; back.receiveShadow = back.castShadow = true; shell.add(back);
    this.walls = [back];
    for (const dir of [-1, 1]) {
      const side = corrugated(D, H, 0xd9dcdc); side.position.set(dir * W / 2, H / 2, 0); side.rotation.y = -dir * Math.PI / 2; side.receiveShadow = side.castShadow = true; shell.add(side); this.walls.push(side);
      // gable
      const gable = new THREE.Shape(); gable.moveTo(-W / 2, 0); gable.lineTo(W / 2, 0); gable.lineTo(0, 2.6); gable.closePath();
    }
    // front header above the door and wide door leaves stacked to the sides
    const header = corrugated(W, 2.5, 0x2a4458); header.position.set(0, H - 1.25, -D / 2); header.castShadow = true; shell.add(header); this.header = header;
    const leafMat = this.leafMat = new THREE.MeshStandardMaterial({ color: 0x2a4458, metalness: 0.5, roughness: 0.45 });
    for (const dir of [-1, 1]) for (let i = 0; i < 2; i++) {
      const leaf = box(shell, [4.2, H - 2.5, 0.25], [dir * (W / 2 - 2.2 - i * 0.05), (H - 2.5) / 2, -D / 2 - 0.3 - i * 0.32], leafMat);
      for (let k = 0; k < 3; k++) box(shell, [4.2, 0.08, 0.3], [leaf.position.x, 1 + k * 3, leaf.position.z], M.steel);
    }
    box(shell, [W, 0.35, 0.5], [0, H - 2.6, -D / 2], M.steel); // door track
    // roof: insulated panels + portal-frame trusses
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0xeceae4, roughness: 0.9, side: THREE.DoubleSide }));
    this.roof = roof; roof.rotation.x = Math.PI / 2; roof.position.y = H + 0.6; roof.castShadow = true; roof.receiveShadow = true; shell.add(roof);
    const beamMat = this.beamMat = new THREE.MeshStandardMaterial({ color: 0x3d5566, metalness: 0.6, roughness: 0.45 });
    for (let z = -D / 2 + 1; z <= D / 2; z += 5) {
      box(shell, [W, 0.5, 0.22], [0, H + 0.2, z], beamMat);
      box(shell, [W, 0.12, 0.1], [0, H - 1.2, z], beamMat);
      for (let x = -W / 2 + 2; x < W / 2; x += 4) { const d = rod(shell, [x, H - 1.2, z], [x + 2, H + 0.1, z], 0.05, beamMat); d.castShadow = false; rod(shell, [x + 2, H + 0.1, z], [x + 4, H - 1.2, z], 0.05, beamMat).castShadow = false; }
      for (const dir of [-1, 1]) box(shell, [0.4, H + 0.6, 0.3], [dir * (W / 2 - 0.3), (H + 0.6) / 2, z], beamMat);
    }
    // high-bay LED lights
    const lampGeo = new THREE.CylinderGeometry(0.42, 0.5, 0.18, 32);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a4045, metalness: 0.7, roughness: 0.4 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xfffbf2 });
    for (let x = -12; x <= 12; x += 8) for (let z = -10; z <= 12; z += 7.5) {
      const l = mesh(lampGeo, lampMat, shell, { cast: false }); l.position.set(x, H - 1.6, z);
      const g = mesh(new THREE.CircleGeometry(0.4, 32).rotateX(Math.PI / 2), glowMat, shell, { cast: false }); g.position.set(x, H - 1.7, z);
      rod(shell, [x, H - 1.5, z], [x, H - 1.2, z], 0.01, M.steel).castShadow = false;
    }
    const fill = [[-8, 8], [8, 8], [-8, -4], [8, -4], [0, 2]];
    this.lamps = fill.map(([x, z]) => { const p = new THREE.PointLight(0xfff4e6, 70, 30, 1.6); p.position.set(x, H - 2, z); shell.add(p); return p; });

    // office block with lit windows along the back wall
    box(shell, [12, 3.2, 3.5], [-12, 1.6, D / 2 - 1.8], new THREE.MeshStandardMaterial({ color: 0x8f9ca3, roughness: 0.7 }));
    const officeGlow = new THREE.MeshStandardMaterial({ color: 0x1b2b33, emissive: 0xffe5b8, emissiveIntensity: 0.55, roughness: 0.15 });
    for (let i = 0; i < 4; i++) box(shell, [2.2, 1.2, 0.05], [-16.5 + i * 3, 1.9, D / 2 - 3.58], officeGlow);
    box(shell, [12.2, 0.12, 3.7], [-12, 3.25, D / 2 - 1.8], M.steel);
    // signage
    const sign = (text, sub, w, pos, rotY = Math.PI, bg = '#173a52', fg = '#ffffff') => {
      const t = canvasTexture(1024, 256, (c) => {
        c.fillStyle = bg; c.fillRect(0, 0, 1024, 256); c.fillStyle = fg; c.textAlign = 'center';
        c.font = '700 96px system-ui, sans-serif'; c.fillText(text, 512, sub ? 130 : 160);
        if (sub) { c.font = '500 46px system-ui, sans-serif'; c.globalAlpha = 0.85; c.fillText(sub, 512, 205); }
      }).texture;
      const m = mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), shell, { cast: false });
      m.position.set(...pos); m.rotation.y = rotY; return m;
    };
    sign('FIRST FLIGHT', 'MAINTENANCE & TRAINING HANGAR', 9, [6, 7, D / 2 - 0.08]);
    sign('HEARING & EYE PROTECTION', 'REQUIRED BEYOND THIS POINT', 3.2, [W / 2 - 0.1, 2.6, 6], -Math.PI / 2, '#1d5e3b');
    sign('NO SMOKING', 'NO OPEN FLAMES', 2.4, [-W / 2 + 0.1, 2.6, 4], Math.PI / 2, '#a02a22');
    sign('TOOL CONTROL', 'SIGN OUT · SIGN IN · ACCOUNT FOR EVERY TOOL', 3.6, [14, 3.6, D / 2 - 0.08], Math.PI, '#4b3a7a');

    // -------------------------------------------------------------- props
    const props = new THREE.Group(); root.add(props);
    const r = rand(42);
    // rolling tool chests
    const chestMat = new THREE.MeshPhysicalMaterial({ color: 0xa3221c, metalness: 0.4, roughness: 0.35, clearcoat: 0.8 });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group(); g.position.set(10 + i * 1.9, 0, D / 2 - 1.2); props.add(g);
      mesh(roundedBox(1.6, 1.0, 0.65, 0.04), chestMat, g).position.y = 0.62;
      for (let k = 0; k < 5; k++) box(g, [1.5, 0.012, 0.02], [0, 0.25 + k * 0.17, -0.33], M.aluminum);
      mesh(roundedBox(1.6, 0.42, 0.62, 0.04), chestMat, g).position.y = 1.36;
      for (const x of [-0.7, 0.7]) for (const z of [-0.25, 0.25]) cyl(g, 0.05, 0.05, 0.04, [x, 0.06, z], M.rubber, [Math.PI / 2, 0, 0], 12);
    }
    // workbench + vise
    box(props, [3.2, 0.06, 0.9], [15.5, 0.95, 10.5], M.wood);
    for (const x of [14.1, 16.9]) for (const z of [10.1, 10.9]) box(props, [0.06, 0.95, 0.06], [x, 0.475, z], M.steel);
    box(props, [3.1, 0.04, 0.8], [15.5, 0.3, 10.5], M.steel);
    box(props, [0.25, 0.14, 0.18], [14.5, 1.05, 10.3], M.darkMetal);
    // shadow board (tool control)
    const board = this.toolBoard = new THREE.Group(); board.position.set(15.5, 2.05, 10.98); board.rotation.y = Math.PI; props.add(board);
    this.boardCanvas = canvasTexture(1024, 512, null);
    this.boardMesh = mesh(new THREE.PlaneGeometry(3.0, 1.5), new THREE.MeshStandardMaterial({ map: this.boardCanvas.texture, roughness: 0.8 }), board, { cast: false });
    box(board, [3.1, 1.6, 0.04], [0, 0, -0.03], M.darkMetal);
    // fire extinguisher on stand
    const ext = new THREE.Group(); ext.position.set(-20.6, 0, -6); props.add(ext);
    cyl(ext, 0.13, 0.13, 0.62, [0, 0.55, 0], M.red, null, 24);
    sphere(ext, [0.13, 0.08, 0.13], [0, 0.86, 0], M.red, 20);
    box(ext, [0.08, 0.1, 0.18], [0, 0.95, 0.04], M.darkMetal);
    box(ext, [0.5, 1.4, 0.04], [0, 0.9, 0.3], new THREE.MeshStandardMaterial({ color: 0xc23a2c, roughness: 0.6 }));
    // oil drums and a step ladder
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x1f5d8f, metalness: 0.5, roughness: 0.4 });
    for (let i = 0; i < 4; i++) { const d = cyl(props, 0.29, 0.29, 0.88, [-19.6 + (i % 2) * 0.62, 0.44, 12 + Math.floor(i / 2) * 0.62], drumMat, null, 24); for (const y of [0.25, 0.62]) cyl(props, 0.3, 0.3, 0.03, [d.position.x, y, d.position.z], M.steel, null, 24); }
    const ladder = new THREE.Group(); ladder.position.set(4.5, 0, 3.2); ladder.rotation.y = -0.6; props.add(ladder);
    for (const x of [-0.3, 0.3]) { rod(ladder, [x, 0, 0], [x * 0.7, 1.8, 0.35], 0.025, M.aluminum); rod(ladder, [x, 0, 0.9], [x * 0.7, 1.8, 0.45], 0.025, M.aluminum); }
    for (let k = 1; k < 5; k++) box(ladder, [0.5 - k * 0.03, 0.03, 0.14], [0, k * 0.36, 0.08 + k * 0.065], M.aluminum);
    box(ladder, [0.48, 0.04, 0.3], [0, 1.8, 0.4], M.aluminum);
    // wheel chocks (yellow) and tow bar
    const chockMat = new THREE.MeshStandardMaterial({ color: 0xe5b51c, roughness: 0.6 });
    const chock = () => { const s = new THREE.Shape(); s.moveTo(-0.14, 0); s.lineTo(0.14, 0); s.lineTo(0.05, 0.12); s.lineTo(-0.05, 0.12); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }); };
    for (const [x, z] of [[-1.08, 0.25], [-1.08, 1.0], [1.08, 0.25], [1.08, 1.0], [0, -2.82], [0, -2.1]]) { const c = mesh(chock(), chockMat, props); c.position.set(x - 0.15, 0, z); c.rotation.y = Math.PI / 2; }
    rod(props, [0, 0.12, -2.6], [0.3, 0.06, -4.2], 0.025, M.red);
    box(props, [0.1, 0.4, 0.1], [0.32, 0.2, -4.25], M.red);
    // engine stand with spare cylinder (maintenance flavour)
    const stand = new THREE.Group(); stand.position.set(-9.5, 0, 9); props.add(stand);
    for (const x of [-0.45, 0.45]) for (const z of [-0.35, 0.35]) rod(stand, [x, 0, z], [x * 0.5, 0.75, z * 0.5], 0.03, M.paintYellow);
    box(stand, [0.6, 0.06, 0.5], [0, 0.78, 0], M.steel);
    cyl(stand, 0.13, 0.13, 0.42, [0, 1.03, 0], M.steel, null, 20);
    for (let j = 0; j < 10; j++) cyl(stand, 0.16, 0.16, 0.012, [0, 0.86 + j * 0.035, 0], M.brushed, null, 24);

    // -------------------------------------------------------------- trainer airplane
    this.trainer = buildTrainer(lab);
    this.trainer.root.position.set(0, 0, 0);
    this.trainer.setLivery(localStorage.getItem('ff-livery') || 'navy');
    root.add(this.trainer.root);

    // a technician working at the engine (photoreal Higgsfield model on Medium quality and up)
    if (quality().realPeople) {
      const tech = this.technician = hfPerson('technician', { seed: 3 });
      tech.position.set(2.15, 0, -2.0); tech.rotation.y = -1.95;
      props.add(tech);
    }

    // missing tool for the tool-control exercise (left under the cowling)
    const torque = this.lostTool = new THREE.Group();
    rod(torque, [-0.28, 0, 0], [0.28, 0, 0], 0.016, M.steel);
    box(torque, [0.1, 0.04, 0.05], [-0.3, 0, 0], M.darkMetal);
    cyl(torque, 0.02, 0.02, 0.09, [0.32, 0, 0], M.red, [0, 0, Math.PI / 2], 10);
    torque.position.set(0.55, 0.03, -3.4); torque.rotation.y = 0.7;
    root.add(torque);

    // -------------------------------------------------------------- AR pedestal (only used in passthrough AR)
    this.arGroup = new THREE.Group();
    this.drawBoard(false);
    this.bounds = (p) => { p.x = THREE.MathUtils.clamp(p.x, -W / 2 + 0.8, W / 2 - 0.8); p.z = THREE.MathUtils.clamp(p.z, -D / 2 - 30, D / 2 - 0.8); };
  }

  /** Hangar collection styles chosen on the site's "Hangar collection" page. */
  applyStyle(key) {
    const k = ['heritage', 'modern', 'workshop', 'expedition'].includes(key) ? key : 'workshop';
    if (this.styleKey === k) return;
    this.styleKey = k;
    const wallColor = { heritage: 0xcdbfa6, modern: 0xb9cbd3, workshop: 0xd9dcdc, expedition: 0xd9dcdc }[k];
    this.walls.forEach(w => { w.visible = k !== 'expedition'; w.material.color.set(wallColor); w.material.transparent = k === 'modern' && w !== this.walls[0]; w.material.opacity = k === 'modern' && w !== this.walls[0] ? 0.45 : 1; w.material.roughness = k === 'modern' ? 0.15 : 0.42; });
    this.header.visible = k !== 'expedition';
    this.header.material.color.set(k === 'heritage' ? 0x5a3f2a : k === 'modern' ? 0xe8ecee : 0x2a4458);
    this.leafMat.color.set(k === 'heritage' ? 0x5a3f2a : k === 'modern' ? 0xdfe5e8 : 0x2a4458);
    this.beamMat.color.set(k === 'heritage' ? 0x7a5536 : k === 'modern' ? 0xeef1f2 : 0x3d5566);
    this.beamMat.metalness = k === 'heritage' ? 0.05 : 0.6; this.beamMat.roughness = k === 'heritage' ? 0.75 : 0.45;
    this.roof.material.color.set(k === 'expedition' ? 0x6f7a62 : 0xeceae4);
    this.lamps.forEach(l => l.color.set(k === 'heritage' ? 0xffe2b8 : k === 'modern' ? 0xf2f7ff : 0xfff4e6));
  }

  drawBoard(found) {
    const c = this.boardCanvas.ctx;
    c.fillStyle = '#e9e5da'; c.fillRect(0, 0, 1024, 512);
    c.fillStyle = '#4b3a7a'; c.fillRect(0, 0, 1024, 60);
    c.fillStyle = '#fff'; c.font = '700 34px system-ui'; c.fillText('SHADOW BOARD · CREW KIT 07', 24, 42);
    TOOLS.forEach((t, i) => {
      const x = 30 + (i % 5) * 198, y = 90 + Math.floor(i / 5) * 205;
      const missing = i === 0 && !found;
      c.fillStyle = '#1b1f22';
      c.globalAlpha = 1;
      c.beginPath(); c.roundRect(x + 20, y + 30, 150, 110, 18); c.fill();
      if (!missing) { c.fillStyle = '#9aa3a8'; c.beginPath(); c.roundRect(x + 30, y + 40, 130, 90, 12); c.fill(); c.fillStyle = '#5d666b'; c.fillRect(x + 40, y + 78, 110, 14); }
      else { c.strokeStyle = '#c2463a'; c.lineWidth = 6; c.beginPath(); c.moveTo(x + 35, y + 45); c.lineTo(x + 155, y + 125); c.stroke(); }
      c.fillStyle = missing ? '#c2463a' : '#2b3236'; c.font = '600 22px system-ui'; c.textAlign = 'center';
      c.fillText(t, x + 95, y + 172); c.textAlign = 'left';
    });
    this.boardCanvas.texture.needsUpdate = true;
  }

  async enter(lab, opts = {}) {
    this.lab = lab;
    if (opts.mode) this.mode = opts.mode;
    await lab.setAtmosphere({ env: 'room', azimuth: 200, elevation: 38, turbidity: 2.6, rayleigh: 1.1, exposure: 0.66, envIntensity: 0.42, sunIntensity: 2.6, hemi: 0.25, fog: ['#c9d6dc', 120, 900] });
    let style = 'workshop'; try { style = localStorage.getItem('flight-hangar') || 'workshop'; } catch { /* ignore */ }
    this.applyStyle(style);
    lab.focusShadow(new THREE.Vector3(0, 0, -6), 34, 160);
    lab.shadowFollow = null;
    lab.floors = [this.floor, this.apron];
    this.trainer.spinning = false;
    this.trainer.root.visible = true;
    this.lostTool.visible = !lab.progress.tools.includes('torque');
    this.setupMode(opts.sub);
    lab.ui.setHint('Drag to orbit · Scroll or pinch to zoom · Select a marker to learn more');
  }

  setupMode(sub) {
    const lab = this.lab;
    lab.hotspots.clear();
    this.trainer.explodeTarget = 0;
    this.trainer.setCutaway(false);
    this.cutaway = false;
    if (this.mode === 'walkaround') return this.walkaround(sub);
    if (sub === 'tools') return this.toolControl();
    this.systems(sub && COMPONENTS[sub] ? sub : this.component || 'airframe', !!sub);
  }

  // ---------------------------------------------------------------- systems lab
  systems(key, reveal = false) {
    const lab = this.lab;
    this.component = key;
    const c = COMPONENTS[key];
    if (reveal || key !== 'airframe') { this.cutaway = true; this.trainer.setCutaway(true); }
    this.trainer.setSystems(this.cutaway ? [key] : (key === 'airframe' ? ['airframe'] : []));
    if (key === 'airframe') this.trainer.setSystems(['airframe']);
    lab.controls.setOrbit({ target: new THREE.Vector3(...c.focus), position: new THREE.Vector3(...c.cam), min: 2.5, max: 32, animate: !!this.entered });
    this.entered = true;
    lab.hotspots.clear();
    Object.entries(COMPONENTS).forEach(([k, v]) => {
      lab.hotspots.add({ id: 'c-' + k, position: new THREE.Vector3(...v.focus).add(new THREE.Vector3(k === 'fuel' ? 2.4 : 0.9, k === 'fuel' ? 0.2 : 0.5, 0)), kind: k === key ? 'done' : 'info', label: v.label, onSelect: () => this.systems(k, true) });
    });
    const t = this.trainer;
    lab.ui.setPanel({
      tag: '01 · Systems lab · ' + c.tag,
      title: c.title,
      text: c.text,
      buttons: [
        ...Object.entries(COMPONENTS).map(([k, v]) => ({ label: v.label, on: k === key, onClick: () => this.systems(k, true) })),
        { label: this.cutaway ? 'Hide systems' : 'Reveal systems', primary: true, onClick: () => { this.cutaway = !this.cutaway; t.setCutaway(this.cutaway); t.setSystems(this.cutaway || key === 'airframe' ? [key] : []); this.systems(key, false); } },
        { label: t.explodeTarget ? 'Assemble' : 'Exploded view', onClick: () => { t.explodeTarget = t.explodeTarget ? 0 : 1; if (t.explodeTarget && !this.cutaway) { this.cutaway = true; t.setCutaway(true); t.setSystems([key]); } this.systems(key, this.cutaway); } },
        { label: t.animate ? 'Pause motion' : 'Animate motion', onClick: () => { t.animate = !t.animate; this.systems(key, this.cutaway); } },
        { label: 'Tool control check', onClick: () => this.toolControl() },
        { label: 'Livery: ' + ({ navy: 'Ivory / Midnight', crimson: 'Arctic / Crimson', alloy: 'Brushed alloy' }[t.livery] || 'Ivory'), onClick: () => { const order = ['navy', 'crimson', 'alloy']; const n = order[(order.indexOf(t.livery) + 1) % 3]; t.setLivery(n); try { localStorage.setItem('ff-livery', n); } catch { /* ignore */ } this.systems(key, this.cutaway); } },
      ],
      foot: 'Generic teaching model, not a specific aircraft type. Real inspection and maintenance follow approved data and qualified supervision.',
    });
  }

  // ---------------------------------------------------------------- preflight walkaround
  walkaround(sub) {
    const lab = this.lab;
    const done = new Set(lab.progress.walkaround);
    let index = Math.max(0, WALKAROUND.findIndex(w => w.id === sub));
    if (!sub) { const firstOpen = WALKAROUND.findIndex(w => !done.has(w.id)); index = firstOpen < 0 ? 0 : firstOpen; }
    this.trainer.setSystems([]);
    const show = (i, animate = true) => {
      index = (i + WALKAROUND.length) % WALKAROUND.length;
      const w = WALKAROUND[index];
      lab.controls.setOrbit({ target: new THREE.Vector3(...w.pos), position: new THREE.Vector3(...w.cam), min: 1.5, max: 28, animate });
      WALKAROUND.forEach((s, k) => lab.hotspots.setKind('w-' + s.id, done.has(s.id) ? 'done' : 'step', done.has(s.id) ? '' : String(k + 1)));
      lab.ui.setPanel({
        tag: `02 · Preflight walkaround · Station ${index + 1} of ${WALKAROUND.length}`,
        title: w.label,
        text: w.text,
        buttons: [
          { label: done.has(w.id) ? 'Observation recorded ✓' : 'Record observation', primary: !done.has(w.id), onClick: () => { if (lab.mark('walkaround', w.id)) lab.ui.toast('Observation recorded', 'good'); done.add(w.id); show(index + 1); } },
          { label: '← Previous', onClick: () => show(index - 1) },
          { label: 'Next station →', onClick: () => show(index + 1) },
          { label: 'Restart walkaround', onClick: () => { lab.progress.walkaround = []; lab.saveProgress(); done.clear(); show(0); } },
        ],
        progress: { value: done.size, max: WALKAROUND.length, label: `${done.size} of ${WALKAROUND.length} learning stations observed` },
        foot: 'A learning walkaround, not an inspection standard. Follow the approved checklist for your airplane with your instructor.',
      });
    };
    WALKAROUND.forEach((w, k) => lab.hotspots.add({ id: 'w-' + w.id, position: new THREE.Vector3(...w.pos), kind: 'step', text: String(k + 1), label: w.label, onSelect: () => show(k) }));
    show(index, false);
  }

  // ---------------------------------------------------------------- tool control
  toolControl() {
    const lab = this.lab;
    const found = lab.progress.tools.includes('torque');
    this.drawBoard(found);
    lab.controls.setOrbit({ target: new THREE.Vector3(12, 1.6, 6), position: new THREE.Vector3(6, 2.6, -2), min: 2, max: 30, animate: true });
    lab.hotspots.clear();
    lab.hotspots.add({ id: 'board', position: new THREE.Vector3(15.5, 3.1, 10.6), kind: 'tool', label: 'Shadow board', onSelect: () => lab.controls.flyTo(new THREE.Vector3(15.5, 2.2, 6.5), new THREE.Vector3(15.5, 2, 10.9)) });
    const finish = () => {
      lab.mark('tools', 'torque');
      this.lostTool.visible = false;
      this.drawBoard(true);
      lab.ui.toast('Tool recovered and returned to the board', 'good');
      lab.hotspots.setKind('board', 'done');
      this.toolPanel(true);
    };
    if (!found) lab.addInteractive(this.lostTool, finish);
    this.toolPanel(found);
  }

  toolPanel(found) {
    const lab = this.lab;
    lab.ui.setPanel({
      tag: 'Maintenance · Tool control',
      title: found ? 'Every tool accounted for' : 'One tool is missing',
      html: found
        ? '<p>The torque wrench is back on the shadow board. In a real hangar, a missing tool stops work on that aircraft until it is found or the situation is handled under the organisation’s procedures. A tool left in an engine bay can become foreign object debris.</p><ul><li>Sign tools out and back in.</li><li>Check the board at the end of every task and shift.</li><li>Report a missing tool immediately; never “assume it’s somewhere”.</li></ul>'
        : '<p>The crew kit’s shadow board shows an empty outline: the <b>torque wrench</b> was not returned. Walk around the airplane and find it before the aircraft can be released.</p><p class="q">Hint: look low, near the front of the airplane.</p><p class="src">Practice the habit the FAA’s maintenance human factors guidance emphasises: accurate records and tool accountability prevent errors.</p>',
      buttons: [
        { label: 'Back to systems lab', onClick: () => this.systems(this.component || 'airframe') },
        { label: 'Reset exercise', onClick: () => { lab.progress.tools = lab.progress.tools.filter(t => t !== 'torque'); lab.saveProgress(); this.lostTool.visible = true; this.toolControl(); } },
      ],
      progress: { value: found ? TOOLS.length : TOOLS.length - 1, max: TOOLS.length, label: `${found ? TOOLS.length : TOOLS.length - 1} of ${TOOLS.length} tools on the board` },
      tone: found ? 'good' : 'warn',
      foot: 'Tool-control procedures vary by employer. Follow your organisation’s system.',
    });
  }

  // ---------------------------------------------------------------- XR & AR hooks
  xrSpawn() { return { position: new THREE.Vector3(4.8, 0, 6.5), yaw: Math.atan2(4.8, 6.5) }; }
  xrBounds(p) { this.bounds?.(p); }
  enterAR(lab) {
    this.arBackup = { shell: this.shell.visible, scale: this.trainer.root.scale.x };
    this.root.children.forEach(o => { o.userData.arVisible = o.visible; if (o !== this.trainer.root) o.visible = false; });
    this.trainer.root.scale.setScalar(0.12);
    this.trainer.root.position.set(0, 0.75, -1.1);
    lab.ui.toast('Tabletop model placed in front of you');
  }
  exitAR() {
    this.root.children.forEach(o => { o.visible = o.userData.arVisible ?? true; });
    this.trainer.root.scale.setScalar(1);
    this.trainer.root.position.set(0, 0, 0);
  }
  exit(lab) { lab.ui.setHint(''); }
  update(dt, t) { this.trainer.update(dt, t); this.refl?.update(); }

  /** Quality changed in the settings while in the hangar. */
  applyQuality(q) {
    if (q.reflections && !this.refl) this.refl = addPlanarReflection(this.lab, this.floor, { width: this.floorSize[0], depth: this.floorSize[1], strength: 0.34 });
    this.refl?.setEnabled(!!q.reflections);
  }
}

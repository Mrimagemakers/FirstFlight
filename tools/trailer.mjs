// Usage (from the project folder, with Playwright installed: npm i playwright):
//   node tools/trailer.mjs
// Serves the project from disk through a virtual https://local.test origin and drives the real engine.
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const root=process.cwd(), out=process.env.OUT || 'frames';
const FPS = 30;
const onlyMeasure = process.argv[2] === 'measure';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.glb':'model/gltf-binary','.webmanifest':'application/manifest+json'};
await ctx.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.hostname === 'local.test') { const p = path.join(root, decodeURIComponent(url.pathname)); if (fs.existsSync(p) && fs.statSync(p).isFile()) return route.fulfill({ body: fs.readFileSync(p), contentType: types[path.extname(p)]||'application/octet-stream' }); return route.fulfill({status:404,body:''}); }
  return route.abort();
});
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('https://local.test/lab.html?photo=1#ramp');
await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('ff-settings', JSON.stringify({ quality: 'high', ao: true, bloom: true, flare: true })); } catch {} });
await page.reload();
await page.waitForFunction(() => window.ffLab && ffLab.stationKey === 'ramp' && !ffLab.switching, null, { timeout: 180000 });
await page.waitForTimeout(8000);
// caption overlay
await page.addStyleTag({ content: `#cap{position:fixed;left:64px;bottom:72px;z-index:50;color:#fff;font:700 44px/1.1 Inter,system-ui,sans-serif;letter-spacing:.02em;text-shadow:0 2px 18px rgba(0,0,0,.55);opacity:0;transition:none}#cap small{display:block;font:500 20px/1.4 Inter,system-ui,sans-serif;color:#e8c27c;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px}#card{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:#08131c;opacity:0;color:#fff;text-align:center}#card h1{font:800 92px/1 Inter,system-ui,sans-serif;letter-spacing:.1em;margin:0}#card p{font:500 24px/1.5 Inter,system-ui,sans-serif;color:#c9d6db;margin:14px 0 0}#card em{font-style:normal;color:#e8c27c;letter-spacing:.2em;font-size:18px;display:block;margin-top:26px}` });
await page.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<div id="cap"></div><div id="card"></div>'); ffLab.manual = true; ffLab.hotspots.group.visible = false; });
let frame = 0;
async function step(n, js) {
  for (let i = 0; i < n; i++) {
    await page.evaluate(([code, i, n]) => { const f = new Function('i', 'n', 'L', 'V', "L.controls.mode = L.stationKey === 'flight' ? 'cockpit' : 'none';" + code); f(i, n, ffLab, (x, y, z) => new (ffLab.camera.position.constructor)(x, y, z)); ffLab.tick(1 / 30); }, [js || '', i, n]);
    await page.screenshot({ path: `${out}/f${String(frame).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 });
    frame++;
    if (onlyMeasure && frame >= 10) return;
  }
}
const ease = 'const s = i / (n - 1); const e = s * s * (3 - 2 * s);';
const cap = (title, sub) => `const c = document.getElementById('cap'); c.innerHTML = '<small>${sub}</small>${title}'; const s2 = i / (n - 1); c.style.opacity = Math.min(1, Math.min(s2 / 0.12, (1 - s2) / 0.12)).toFixed(3);`;
const t0 = Date.now();
async function go(key, sub) { await page.evaluate(async ([k, s]) => { document.getElementById('cap').style.opacity = 0; ffLab.manual = false; await ffLab.go(k, { sub: s }); ffLab.hotspots.group.visible = false; ffLab.manual = true; }, [key, sub]); await page.waitForTimeout(4000); }

// 1. opening card -> ramp orbit
await step(onlyMeasure ? 10 : 60, `const c = document.getElementById('card'); c.innerHTML = '<div><h1>FIRST FLIGHT</h1><p>Aviation careers &amp; flight training</p></div>'; c.style.opacity = (i < 40 ? 1 : 1 - (i - 40) / 20).toFixed(3); L.controls.tween = null; const a = 2.3 + i * 0.004; L.camera.position.set(Math.sin(a) * 46, 7, Math.cos(a) * 46 - 4); L.camera.lookAt(0, 3.4, -4);`);
if (onlyMeasure) { console.log('ms/frame', (Date.now() - t0) / frame); await browser.close(); process.exit(0); }
await step(120, `${ease} document.getElementById('card').style.opacity = 0; const a = 2.54 + e * 0.75; L.camera.position.set(Math.sin(a) * (46 - e * 10), 7 - e * 2.5, Math.cos(a) * (46 - e * 10) - 4); L.camera.lookAt(0, 3.4 - e * 0.6, -6); ${cap('Ramp &amp; cargo safety', 'Walk a working gate')}`);
// 2. low dolly by the belt loader to the cargo door
await step(150, `${ease} L.camera.position.set(17 - e * 6, 1.4 + e * 0.5, -1 - e * 7); L.camera.lookAt(2.2, 2.6, -10.5); ${cap('Find FOD before the turnaround', 'Ramp agents')}`);
// 3. danger zones + beacon
await step(120, `${ease} const st = L.station.impl; st.zones.visible = true; st.beaconOn = true; L.camera.position.set(22 - e * 6, 19 - e * 3, -24 + e * 6); L.camera.lookAt(0, 0, -4); ${cap('See the hazards before you walk', 'Engine intake &amp; jet blast areas')}`);
await page.evaluate(() => { const st = ffLab.station.impl; st.zones.visible = false; st.beaconOn = false; });
// 4. cabin push
await go('cabin');
await step(150, `${ease} L.controls.mode = 'none'; L.camera.fov = 70; L.camera.updateProjectionMatrix(); L.camera.position.set(0, 1.62, 21.2 - e * 9); L.camera.rotation.set(-0.08, 0.04 - e * 0.08, 0, 'YXZ'); ${cap('Cabin safety &amp; appearance', 'Flight attendants · cabin cleaners')}`);
// 5. hangar systems
await go('hangar', 'engine');
await step(150, `${ease} const t = L.station.impl.trainer; t.explodeTarget = i > 50 ? 1 : 0; L.controls.tween = null; const a = 0.9 + e * 0.9; L.camera.position.set(Math.sin(a) * 6.2, 2.4 + e * 0.8, Math.cos(a) * 6.2 - 3.4); L.camera.lookAt(0, 1.6, -3.2); ${cap('Explore aircraft systems', 'Maintenance technicians')}`);
// 6. flight cockpit
await go('flight', 'alpine');
await page.evaluate(() => { const f = ffLab.station.impl; f.setView('cockpit'); f.running = true; f.trainer.spinning = true; });
await step(180, `${ease} const f = L.station.impl; L.controls.cockpit.pitch = -0.1 + Math.sin(i * 0.02) * 0.04; L.controls.cockpit.yaw = Math.sin(i * 0.012) * 0.25; f.keys.clear(); if (i > 40 && i < 80) f.keys.add('ArrowRight'); if (i > 110 && i < 150) f.keys.add('ArrowLeft'); ${cap('Fly from a detailed cockpit', 'Four missions · six regions')}`);
await page.evaluate(() => { const f = ffLab.station.impl; f.keys.clear(); f.setView('chase'); });
await step(150, `${ease} L.controls.cockpit.yaw = 0.7 - e * 1.0; L.controls.cockpit.pitch = 0.18; ${cap('Realistic skies, terrain and water', 'Alpine Lakes')}`);
// 7. canyon + twilight
await page.evaluate(() => { const f = ffLab.station.impl; f.setRegion('canyon'); f.running = true; f.setView('chase'); });
await page.waitForTimeout(4000);
await step(110, `${ease} L.controls.cockpit.yaw = -0.6 + e * 0.5; L.controls.cockpit.pitch = 0.12; ${cap('Red Rock Canyon', 'Flying regions')}`);
await page.evaluate(() => { const f = ffLab.station.impl; f.setRegion('twilight'); f.running = true; f.setView('chase'); });
await page.waitForTimeout(4000);
await step(110, `${ease} L.controls.cockpit.yaw = 0.2 + e * 0.5; L.controls.cockpit.pitch = 0.1; ${cap('Blue Hour Valley', 'Flying regions')}`);
// 8. end card
await step(120, `document.getElementById('cap').style.opacity = 0; const c = document.getElementById('card'); c.innerHTML = '<div><h1>FIRST FLIGHT</h1><p>Practise aviation work in 3D and VR</p><em>DESKTOP · MOBILE · META QUEST (WEBXR)</em></div>'; c.style.opacity = Math.min(1, i / 20).toFixed(3);`);
console.log('frames', frame, 'minutes', ((Date.now() - t0) / 60000).toFixed(1));
await browser.close();

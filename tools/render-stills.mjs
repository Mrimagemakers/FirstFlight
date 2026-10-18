// Usage (from the project folder, with Playwright installed: npm i playwright):
//   node tools/render-stills.mjs
// Serves the project from disk through a virtual https://local.test origin and drives the real engine.
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const root=process.cwd(), out=process.env.OUT || 'assets/renders';
const only = process.argv.slice(2);
const V = (x,y,z)=>`new (ffLab.camera.position.constructor)(${x},${y},${z})`;
const orbit = (p,t)=>`ffLab.controls.tween=null;ffLab.controls.setOrbit({position:${V(...p)},target:${V(...t)},min:0.1,max:500,maxPolar:3})`;
const walk = (p,yaw,pitch=0)=>`ffLab.controls.setWalk({position:${V(p[0],0,p[2])},yaw:${yaw},pitch:${pitch},eye:${p[1]},bounds:null,fov:62})`;
const lookWalk = (p,t)=>`(()=>{const dx=(${t[0]})-(${p[0]}),dz=(${t[2]})-(${p[2]}),dy=(${t[1]})-(${p[1]});const yaw=Math.atan2(-dx,-dz);const pitch=Math.atan2(dy,Math.hypot(dx,dz));${walk(p,'yaw','pitch')}})()`;
const F = 'ffLab.station.impl';
const shots = [
  ['hub-hero','ramp', orbit([21,4.6,-27.5],[0,3.6,-3])],
  ['hub-wide','ramp', orbit([42,19,16],[1,2,-5])],
  ['ramp-agent','ramp', lookWalk([14.5,1.7,-3.5],[4,2.0,-10.6])],
  ['ramp-walk','ramp', lookWalk([22,1.68,10],[0,3.2,-6])],
  ['cargo','ramp', lookWalk([12,1.65,16],[6.5,1.0,10.6])],
  ['cargo-supervisor','ramp', orbit([13,5,-20],[3,2.4,-10])],
  ['ramp-supervisor','ramp', orbit([30,24,40],[0,0,-6])],
  ['safety','ramp', `${F}.zones.visible=true;`+orbit([20,17,-26],[0,0,-4])],
  ['station-manager','ramp', orbit([-36,13,26],[-6,4,-16])],
  ['gate-agent','ramp', orbit([-9.5,2.4,-7],[-3,3.8,-15.5])],
  ['cabin-cleaner','cabin', lookWalk([0,1.62,1.2],[0.6,0.7,9])],
  ['flight-attendant','cabin', lookWalk([0.1,1.62,3.8],[-0.4,1.2,-3])],
  ['cabin-manager','cabin', lookWalk([0,1.66,21.5],[0,1.1,0])],
  ['fa-instructor','cabin', lookWalk([0.15,1.6,12.2],[-1.6,1.1,9.6])],
  ['technician','hangar:engine', `${F}.systems('engine',true);`+orbit([3.6,2.6,-5.8],[0,1.45,-2.6])],
  ['lab-engine','hangar:engine', `${F}.systems('engine',true);${F}.trainer.explodeTarget=1;`+orbit([4.2,3.2,-8.2],[0,2,-4.2])],
  ['ap-mechanic','hangar', orbit([13,3.2,15],[2,1.6,2])],
  ['lab-hangar','hangar', orbit([8.5,3.6,9.5],[0,1.5,-0.5])],
  ['lab-walkaround','walkaround', orbit([-5.5,2.2,-6.5],[0,1.4,-1.2])],
  ['cockpit','flight:alpine', `${F}.setView('cockpit');ffLab.controls.cockpit.pitch=-0.32;ffLab.controls.cockpit.yaw=0.12`],
  ['avionics','flight:alpine', `${F}.setView('cockpit');ffLab.controls.cockpit.pitch=-0.5;ffLab.controls.cockpit.yaw=0.05;ffLab.camera.fov=45;ffLab.camera.updateProjectionMatrix()`],
  ['lab-flight','flight:alpine', `${F}.setView('chase');ffLab.controls.cockpit.yaw=0.45;ffLab.controls.cockpit.pitch=0.1`],
  ['dispatcher','flight:highlands', `${F}.setView('chase');ffLab.controls.cockpit.yaw=-0.5;ffLab.controls.cockpit.pitch=0.25`],
  ['region-alpine','flight:alpine', `${F}.setView('cockpit');ffLab.controls.cockpit.pitch=0.02`],
  ['region-coast','flight:coast', `${F}.state.heading=60;${F}.setView('chase');ffLab.controls.cockpit.yaw=0.6`],
  ['region-canyon','flight:canyon', `${F}.setView('chase');ffLab.controls.cockpit.yaw=-0.4`],
  ['region-islands','flight:islands', `${F}.setView('chase');ffLab.controls.cockpit.yaw=0.5;ffLab.controls.cockpit.pitch=0.3`],
  ['region-highlands','flight:highlands', `${F}.setView('cockpit');ffLab.controls.cockpit.pitch=0`],
  ['region-twilight','flight:twilight', `${F}.setView('chase');ffLab.controls.cockpit.yaw=0.3`],
];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
await ctx.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.hostname === 'local.test') { const p = path.join(root, decodeURIComponent(url.pathname)); if (fs.existsSync(p)) return route.fulfill({ body: fs.readFileSync(p), contentType: types[path.extname(p)]||'application/octet-stream' }); return route.fulfill({status:404,body:''}); }
  return route.abort();
});
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
let current = null;
for (const [name, station, js] of shots) {
  if (only.length && !only.includes(name)) continue;
  const [st, sub] = station.split(':');
  // fresh progress each shot so all FOD/litter is visible
  if (current !== station) {
    await page.goto('https://local.test/lab.html?photo=1#' + station);
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload();
    await page.waitForFunction(() => window.ffLab && ffLab.station && !ffLab.switching && ffLab.stationKey, null, { timeout: 120000 });
    await page.waitForTimeout(6000);
    current = station;
  }
  try { await page.evaluate(`(()=>{${js}})()`); } catch (e) { console.log('ERR', name, e.message.split('\n')[0], await page.evaluate(()=>[ffLab.stationKey, typeof ffLab.station?.impl, location.hash].join(' '))); }
  await page.waitForTimeout(st === 'flight' ? 4500 : 3500);
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 84 });
  console.log('rendered', name);
}
await browser.close();

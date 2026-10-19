// Aviation Maintenance Center: careers, certification pathway, interactive tutorials and maintenance tools.
// Loads after hub.js and plugs into the shared router (globals: page, go, render).
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ML = k => MX_LINKS[k];
  const ext = (k, label) => `<a href="${ML(k)}" target="_blank" rel="noopener">${label} ↗</a>`;
  const img = (key, alt) => `<img src="assets/renders/${key}.jpg" alt="${esc(alt)}" loading="lazy" onerror="this.onerror=null;this.src='assets/renders/lab-hangar.jpg'">`;
  const crumbs = items => `<div class="crumbs">${items.map(([p, t]) => p ? `<button class="text-btn" onclick="go('${p}')">${t}</button>` : `<span>${t}</span>`).join(' <i>/</i> ')}</div>`;
  const xrBtn = (key, label) => `<button class="btn xr-btn" onclick="openLab3D('${key}')">◎ ${esc(label)}</button>`;
  const flash = msg => { let t = document.getElementById('hubToast'); if (!t) { t = document.createElement('div'); t.id = 'hubToast'; document.body.append(t); } t.textContent = msg; t.classList.add('show'); clearTimeout(flash.t); flash.t = setTimeout(() => t.classList.remove('show'), 2200); };

  // Record tools share the hub's editor (stored in the same 'ff-hub' record).
  if (typeof HUB_TOOLS === 'object') Object.assign(HUB_TOOLS, MX_RECORD_TOOLS);

  // ---------------------------------------------------------------- state
  const load = () => { try { return JSON.parse(localStorage.getItem('ff-mx') || '{}'); } catch { return {}; } };
  const mx = load();
  mx.tut ||= {}; mx.cert ||= {}; mx.dd ||= []; mx.logbook ||= []; mx.calc ||= {};
  const save = () => { try { localStorage.setItem('ff-mx', JSON.stringify(mx)); } catch { /* storage blocked */ } };
  const hubData = () => { try { return JSON.parse(localStorage.getItem('ff-hub') || '{}'); } catch { return {}; } };
  const tutDone = () => MX_TUTORIALS.filter(t => mx.tut[t.id]?.done).length;
  const certDone = () => MX_STEPS.filter(s => mx.cert[s.id]).length;

  let tutId = null, toolId = null, roleTier = 'all';

  // ---------------------------------------------------------------- navigation group
  const nav = $('nav');
  const items = [['mx', '⚙', 'Maintenance center'], ['mxcareers', '⇡', 'Maintenance careers'], ['mxcert', '✓', 'Become an A&P mechanic'], ['mxlearn', '▷', 'Maintenance tutorials'], ['mxtools', '⚒', 'Maintenance tools']];
  const html = `<p class="nav-label">Aviation maintenance</p>` + items.map(([p, i, t]) => `<button data-page="${p}"><span class="ni">${i}</span>${t}</button>`).join('');
  const xrLabel = [...nav.querySelectorAll('.nav-label')].find(l => /XR training lab/i.test(l.textContent));
  if (xrLabel) xrLabel.insertAdjacentHTML('beforebegin', html); else nav.insertAdjacentHTML('beforeend', html);
  items.forEach(([p]) => { const b = nav.querySelector(`button[data-page="${p}"]`); b.onclick = () => { document.body.classList.remove('nav-open'); if (p === 'mxlearn') tutId = null; if (p === 'mxtools') toolId = null; go(p); }; });

  // ---------------------------------------------------------------- MAINTENANCE CENTER
  function centerPage() {
    const h = hubData();
    const logHours = (h.tools?.mxlog || []).reduce((s, r) => s + (+r.hours || 0), 0);
    $('#view').innerHTML = `
<section class="path-hero">${img('mx-walkaround', 'A training airplane on a work stand in the First Flight maintenance hangar')}<div><span class="eyebrow">AVIATION MAINTENANCE CENTER</span><h1>Keep them flying.</h1><p>Every flight depends on technicians who inspect, repair and sign for the work. Explore maintenance careers, follow the FAA mechanic pathway, learn core shop skills and use real calculators and logs.</p></div></section>
<div class="stats mx-stats">
  <div class="stat"><span class="icon">$</span><div><strong>${MX_BLS.median}</strong><small>Median pay, aircraft & avionics technicians (BLS, May 2025)</small></div></div>
  <div class="stat"><span class="icon">↗</span><div><strong>${MX_BLS.growth}</strong><small>Projected job growth, ${MX_BLS.period}</small></div></div>
  <div class="stat"><span class="icon">▷</span><div><strong>${tutDone()} / ${MX_TUTORIALS.length}</strong><small>Tutorials complete</small></div></div>
  <div class="stat"><span class="icon">✓</span><div><strong>${certDone()} / ${MX_STEPS.length}</strong><small>Certification steps</small></div></div>
</div>
<div class="hub-grid">
  ${[
    ['mxcareers', 'Maintenance careers', `${MX_ROLES.length} roles from first job to inspector and director, with training routes, tools and workplaces.`, 'ap-mechanic'],
    ['mxcert', 'Become an A&P mechanic', `The FAA pathway step by step: school, experience or military, three knowledge tests and the oral & practical.`, 'mx-walkaround'],
    ['mxlearn', 'Maintenance tutorials', `${MX_TUTORIALS.length} interactive lessons: tool control, technical data, records, torque, safety wire, rivets, human factors and more.`, 'mx-shadowboard'],
    ['mxtools', 'Maintenance tools', 'Torque extension and rivet calculators, unit converter, ATA lookup, logbook entry builder, Dirty Dozen check and shop logs.', 'mx-toolchest'],
    ['sim', '3D hangar', 'Reveal the engine, fuel and electrical systems and run a tool-control check in the 3D and VR lab.', 'lab-engine'],
    ['learning', 'Videos & resources', 'FAA maintenance human factors, fatigue and AMT handbooks.', 'mx-electrical'],
  ].map(([pg, t, d, im]) => `<button class="hub-tile" onclick="${pg === 'sim' ? "openLab3D('hangar')" : `go('${pg}')`}">${img(im, t)}<span><b>${t}</b><small>${d}</small></span></button>`).join('')}
</div>
<div class="two-col">
  <div class="note"><strong>Your experience log</strong><p>${logHours ? `You’ve logged <b>${logHours.toFixed(1)} hours</b> of practical work.` : 'Heading for the experience route? Log every task with a supervisor’s validation.'} <button class="text-btn" onclick="openTool('mxlog')">Open the maintenance experience log →</button></p></div>
  <div class="note"><strong>About this content</strong><p>Educational summaries of FAA rules and handbooks for U.S. learners. The manufacturer’s data, your employer’s procedures and the current regulations always govern real maintenance. ${ext('handbooks', 'FAA AMT handbooks')}</p></div>
</div>`;
  }

  // ---------------------------------------------------------------- CAREERS
  function careersPage() {
    const roles = MX_ROLES.filter(r => roleTier === 'all' || r.tier === roleTier);
    $('#view').innerHTML = `${crumbs([['mx', 'Maintenance center'], [null, 'Careers']])}
<h1>Aviation maintenance careers</h1>
<p class="muted">From your first hangar job to inspector and director. Requirements vary by employer, aircraft and the type of operation.</p>
<div class="mx-ladder">${Object.entries(MX_TIERS).map(([k, t], i) => `<button class="${roleTier === k ? 'on' : ''}" onclick="mxTier('${k}')"><em>0${i + 1}</em><b>${t}</b><small>${MX_ROLES.filter(r => r.tier === k).length} roles</small></button>`).join('<i>→</i>')}</div>
<div class="row filters"><button class="chip ${roleTier === 'all' ? 'on' : ''}" onclick="mxTier('all')">All roles</button>${Object.entries(MX_TIERS).map(([k, t]) => `<button class="chip ${roleTier === k ? 'on' : ''}" onclick="mxTier('${k}')">${t}</button>`).join('')}</div>
<div class="role-grid">${roles.map(r => `<article class="card role-card">${img(r.img, r.title)}<div><span class="num">${MX_TIERS[r.tier].toUpperCase()}</span><h3>${esc(r.title)}</h3><p>${esc(r.does)}</p><h4>How you get there</h4><p class="focus">${esc(r.path)}</p><h4>Tools of the trade</h4><ul class="tags">${r.tools.map(t => `<li>${esc(t)}</li>`).join('')}</ul><p class="small muted"><b>Where:</b> ${esc(r.where)}</p></div></article>`).join('')}</div>
<div class="note"><strong>Pay and outlook</strong><p>The BLS reports a median of <b>${MX_BLS.mechanics}</b> for aircraft mechanics and service technicians and <b>${MX_BLS.avionics}</b> for avionics technicians (May 2025), with about ${MX_BLS.jobs} jobs and ${MX_BLS.growth} projected growth for ${MX_BLS.period}. Pay varies widely by employer, location, shift and seniority. ${ext('bls', 'BLS career guide')}</p></div>
<div class="row"><button class="btn" onclick="go('mxcert')">See the A&P certification pathway →</button><button class="btn secondary" onclick="openTool('tracker')">Track applications</button><a class="btn secondary" href="${ML('usajobs')}" target="_blank" rel="noopener">Federal aircraft mechanic jobs ↗</a></div>`;
  }
  window.mxTier = t => { roleTier = t; careersPage(); };

  // ---------------------------------------------------------------- CERTIFICATION PATHWAY
  function certPage() {
    const first = mx.cert.firstTest;
    let deadline = '';
    if (first) { const d = new Date(first + 'T12:00:00'); d.setMonth(d.getMonth() + 24); deadline = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); }
    const h = hubData(); const log = h.tools?.mxlog || [];
    const dates = log.map(r => r.date).filter(Boolean).sort();
    let months = 0;
    if (dates.length > 1) { const a = new Date(dates[0]), b = new Date(dates[dates.length - 1]); months = Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()); }
    $('#view').innerHTML = `${crumbs([['mx', 'Maintenance center'], [null, 'Become an A&P mechanic']])}
<section class="path-hero dark">${img('lab-engine', 'An exploded view of a training airplane engine in the First Flight hangar')}<div><span class="eyebrow">FAA MECHANIC CERTIFICATE</span><h1>Your path to an A&P certificate.</h1><p>An FAA mechanic certificate with Airframe (A) and Powerplant (P) ratings lets you maintain and approve work on aircraft within its privileges. Tick off each step as you go.</p></div></section>
<div class="section-head"><h2>Three ways to qualify for testing</h2></div>
<div class="pillars mx-routes">
  <article class="card"><span class="num">ROUTE 1</span><h3>FAA-approved AMT school</h3><p>Graduate from an Aviation Maintenance Technician School. Graduation establishes eligibility to test. Many programs take around two years; some combine an associate degree.</p>${ext('schools', 'Find approved schools')}</article>
  <article class="card"><span class="num">ROUTE 2</span><h3>Practical experience</h3><p>Document <b>18 months</b> of practical experience for one rating, or <b>30 months</b> working concurrently on both airframes and powerplants. Keep pay records and logs signed by your certificated supervisor.</p>${ext('experience', 'FAA experience requirements')}</article>
  <article class="card"><span class="num">ROUTE 3</span><h3>Military</h3><p>Complete a Joint Service Aviation Maintenance Technician Certification Council (JSAMTCC) course, or have your military experience and records (such as a DD-214) evaluated by the FAA.</p>${ext('become', 'FAA: become a mechanic')}</article>
</div>
<div class="section-head"><h2>Step-by-step checklist</h2><span class="eyebrow muted">${certDone()} OF ${MX_STEPS.length} DONE</span></div>
<div class="timeline">${MX_STEPS.map((s, i) => `<div class="tl-item ${mx.cert[s.id] ? 'done' : ''}"><div class="tl-dot">${mx.cert[s.id] ? '✓' : i + 1}</div><div class="tl-body"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p><div class="row"><button class="btn ${mx.cert[s.id] ? 'secondary' : ''}" onclick="mxCert('${s.id}')">${mx.cert[s.id] ? 'Done ✓' : 'Mark done'}</button>${s.id === 'ftn' ? ext('iacra', 'IACRA') : ''}${s.id === 'general' ? ext('psi', 'Testing centers') : ''}${s.id === 'op' ? ext('dme', 'Find a DME') : ''}${s.id === 'route' ? `<button class="text-btn" onclick="openTool('mxlog')">Experience log →</button>` : ''}</div></div></div>`).join('')}</div>
<div class="two-col">
  <div class="card mx-calc"><h3>24-month test window</h3><p class="small muted">All required tests must be passed within 24 months. Enter the date of your first passed knowledge test.</p><div class="fields"><label>First knowledge test passed<input type="date" value="${esc(first || '')}" onchange="mxFirstTest(this.value)"></label></div>${deadline ? `<p class="mx-out">Complete all tests by <b>${deadline}</b></p>` : ''}</div>
  <div class="card mx-calc"><h3>Experience-route progress</h3><p class="small muted">Based on your maintenance experience log. The FAA, not this tool, decides whether experience qualifies.</p><p class="mx-out"><b>${log.length}</b> entries · <b>${months}</b> months between first and last entry</p><div class="mbar"><i style="width:${Math.min(100, months / 30 * 100)}%"></i></div><p class="small muted">Targets: 18 months for one rating · 30 months for both</p><button class="text-btn" onclick="openTool('mxlog')">Add log entries →</button></div>
</div>
<div class="section-head"><h2>The tests</h2></div>
<table class="data"><thead><tr><th>Test</th><th>Format</th><th>Notes</th></tr></thead><tbody>
<tr><td><b>General</b> knowledge</td><td>Computer-based, up to 2 hours</td><td rowspan="3">Taken at an approved testing center before the oral & practical. Subject areas come from the Airman Certification Standards. Passing score is 70%. After a failure, wait 30 days or present a signed statement of additional instruction.</td></tr>
<tr><td><b>Airframe</b> knowledge</td><td>Computer-based, up to 2 hours</td></tr>
<tr><td><b>Powerplant</b> knowledge</td><td>Computer-based, up to 2 hours</td></tr>
<tr><td><b>Oral & practical</b></td><td>With a Designated Mechanic Examiner</td><td>Questions and hands-on projects for each rating sought.</td></tr></tbody></table>
<p class="small muted">${ext('tests', 'FAA test requirements')} · ${ext('acs', 'Airman Certification Standards')} · ${ext('faq', 'Mechanic FAQs')}</p>
<div class="note"><strong>After the A&P: Inspection Authorization</strong><p>An Inspection Authorization (IA) lets an experienced A&P perform annual inspections and approve major repairs and alterations. Eligibility includes holding A&P ratings for at least 3 years and being actively engaged in maintenance for the previous 2 years, plus a knowledge test. In July 2026 the FAA proposed replacing the IA with a non-expiring Inspection Rating; that is a proposal, not yet a rule. ${ext('iaGuide', 'IA information guide (PDF)')} · ${ext('irProposal', 'Proposed rule')}</p></div>`;
  }
  window.mxCert = id => { mx.cert[id] = !mx.cert[id]; save(); certPage(); };
  window.mxFirstTest = v => { mx.cert.firstTest = v; save(); certPage(); };

  // ---------------------------------------------------------------- TUTORIALS
  function learnPage() {
    if (tutId) return tutorialPage(MX_TUTORIALS.find(t => t.id === tutId));
    $('#view').innerHTML = `${crumbs([['mx', 'Maintenance center'], [null, 'Tutorials']])}
<h1>Maintenance tutorials</h1><p class="muted">Short, step-by-step lessons on core shop skills, each with a quick check. ${tutDone()} of ${MX_TUTORIALS.length} complete. They support, and don’t replace, school, employer and manufacturer training.</p>
<div class="mx-tuts">${MX_TUTORIALS.map((t, i) => { const s = mx.tut[t.id] || {}; return `<button class="card mx-tut ${s.done ? 'done' : ''}" onclick="mxOpen('${t.id}')">${img(t.img, t.title)}<span><em>LESSON ${String(i + 1).padStart(2, '0')} · ${t.mins} MIN${s.done ? ' · COMPLETE ✓' : ''}</em><b>${esc(t.title)}</b><small>${esc(t.intro)}</small></span></button>`; }).join('')}</div>
<div class="note"><strong>Go further</strong><p>The FAA’s ${ext('hbGeneral', 'General')}, ${ext('hbAirframe', 'Airframe')} and ${ext('hbPowerplant', 'Powerplant')} handbooks are free and cover every subject on the knowledge tests.</p></div>`;
  }
  function tutorialPage(t) {
    const s = mx.tut[t.id] ||= { step: 0, answers: {} };
    const n = t.steps.length, step = Math.min(s.step || 0, n);
    const quizOn = step >= n;
    const answered = t.quiz.filter((q, i) => s.answers?.[i] === q.c).length;
    const idx = MX_TUTORIALS.indexOf(t), next = MX_TUTORIALS[idx + 1];
    $('#view').innerHTML = `${crumbs([['mx', 'Maintenance center'], ['mxlearn', 'Tutorials'], [null, t.title]])}
<div class="mx-lesson">
  <div class="mx-lesson-main">
    <span class="eyebrow muted">LESSON ${String(idx + 1).padStart(2, '0')} · ${t.mins} MIN</span>
    <h1>${esc(t.title)}</h1><p class="muted">${esc(t.intro)}</p>
    <div class="mx-progress">${t.steps.map((_, i) => `<i class="${i < step ? 'done' : i === step ? 'on' : ''}"></i>`).join('')}<i class="${quizOn ? 'on' : ''} q"></i></div>
    ${quizOn ? `
    <div class="card mx-quiz"><h3>Quick check</h3>${t.quiz.map((q, qi) => `<div class="mx-q"><p><b>${qi + 1}. ${esc(q.q)}</b></p>${q.a.map((a, ai) => { const picked = s.answers?.[qi]; const cls = picked === ai ? (ai === q.c ? 'correct' : 'wrong') : ''; return `<button class="answer ${cls}" onclick="mxAns('${t.id}',${qi},${ai})">${'ABC'[ai]} &nbsp; ${esc(a)}</button>`; }).join('')}${s.answers?.[qi] !== undefined ? `<p class="small mx-why">${s.answers[qi] === q.c ? '✓ ' : 'Not quite. '}${esc(q.why)}</p>` : ''}</div>`).join('')}
      <p class="mx-out">${answered} of ${t.quiz.length} correct${s.done ? ' · Lesson complete ✓' : ''}</p>
      <div class="row"><button class="btn secondary" onclick="mxStep('${t.id}',-1)">← Back to steps</button>${next ? `<button class="btn" onclick="mxOpen('${next.id}')">Next lesson: ${esc(next.title)} →</button>` : `<button class="btn" onclick="mxBackList()">All tutorials</button>`}</div></div>` : `
    <div class="card mx-step"><span class="num">STEP ${step + 1} OF ${n}</span><h3>${esc(t.steps[step][0])}</h3><p>${esc(t.steps[step][1])}</p>
      <div class="row"><button class="btn secondary" ${step === 0 ? 'disabled' : ''} onclick="mxStep('${t.id}',-1)">← Back</button><button class="btn" onclick="mxStep('${t.id}',1)">${step === n - 1 ? 'Take the quick check →' : 'Next step →'}</button></div></div>
    <ol class="mx-outline">${t.steps.map(([h], i) => `<li class="${i === step ? 'on' : i < step ? 'done' : ''}"><button class="text-btn" onclick="mxGoStep('${t.id}',${i})">${esc(h)}</button></li>`).join('')}</ol>`}
  </div>
  <div class="mx-lesson-side">${img(t.img, t.title)}${t.xr ? `<div class="row">${xrBtn(t.xr, t.xrLabel)}</div>` : ''}<p class="small muted">Related tools: ${relatedTools(t.id)}</p></div>
</div>`;
  }
  function relatedTools(id) {
    const map = { 'tool-control': [['toolcrib', 'Tool crib log', 1], ['calibration', 'Calibration tracker', 1]], 'tech-data': [['ata', 'ATA chapter lookup']], records: [['logbook', 'Logbook entry builder']], torque: [['torque', 'Torque extension calculator'], ['units', 'Unit converter']], 'safety-wire': [['units', 'Unit converter']], rivets: [['rivet', 'Rivet calculator']], 'human-factors': [['dirty', 'Dirty Dozen check']], corrosion: [['deferrals', 'Write-up tracker', 1]], ndt: [['ata', 'ATA chapter lookup']], inspections: [['deferrals', 'Write-up & deferral tracker', 1]], 'hangar-safety': [['dirty', 'Dirty Dozen check']] };
    return (map[id] || []).map(([k, l, rec]) => `<button class="text-btn" onclick="${rec ? `openTool('${k}')` : `mxTool('${k}')`}">${l}</button>`).join(' · ');
  }
  window.mxOpen = id => { tutId = id; mx.tut[id] ||= { step: 0, answers: {} }; save(); if (page !== 'mxlearn') go('mxlearn'); else { learnPage(); window.scrollTo(0, 0); } };
  window.mxBackList = () => { tutId = null; learnPage(); window.scrollTo(0, 0); };
  window.mxStep = (id, d) => { const t = MX_TUTORIALS.find(x => x.id === id), s = mx.tut[id]; s.step = Math.max(0, Math.min(t.steps.length, (s.step || 0) + d)); save(); learnPage(); };
  window.mxGoStep = (id, i) => { mx.tut[id].step = i; save(); learnPage(); };
  window.mxAns = (id, qi, ai) => {
    const t = MX_TUTORIALS.find(x => x.id === id), s = mx.tut[id];
    s.answers ||= {}; s.answers[qi] = ai;
    if (t.quiz.every((q, i) => s.answers[i] === q.c) && !s.done) { s.done = true; flash('Lesson complete ✓'); }
    save(); learnPage();
  };

  // ---------------------------------------------------------------- TOOLS
  const CALCS = [
    ['torque', '⟲', 'Torque extension calculator', 'Correct the wrench setting for crowfoot and extension adapters.'],
    ['rivet', '⊙', 'Rivet calculator', 'Diameter, edge distance, pitch, length and shop-head size, plus a part-number decoder.'],
    ['units', '⇄', 'Unit converter', 'Torque, pressure, temperature, length, volume, weight and fuel weight.'],
    ['ata', '▤', 'ATA chapter lookup', 'Find the chapter for any aircraft system.'],
    ['logbook', '✎', 'Logbook entry builder', 'Practise writing a complete 14 CFR 43.9 maintenance record entry.'],
    ['dirty', '!', 'Dirty Dozen self-check', 'Spot today’s human-factors risks before you start a task.'],
  ];
  const RECORDS = ['mxlog', 'toolcrib', 'calibration', 'deferrals'];
  function toolsPage() {
    if (toolId) return ({ torque: torquePage, rivet: rivetPage, units: unitsPage, ata: ataPage, logbook: logbookPage, dirty: dirtyPage })[toolId]();
    const h = hubData();
    $('#view').innerHTML = `${crumbs([['mx', 'Maintenance center'], [null, 'Tools']])}
<h1>Maintenance tools</h1><p class="muted">Calculators and shop logs for students, apprentices and technicians. Always confirm values against the manufacturer’s data. Records are saved in this browser only; export or print them.</p>
<div class="section-head"><h2>Calculators & references</h2></div>
<div class="tool-grid">${CALCS.map(([k, i, t, b]) => `<button class="tool-tile" onclick="mxTool('${k}')"><span>${i}</span><b>${t}</b><small>${b}</small></button>`).join('')}</div>
<div class="section-head"><h2>Shop logs & trackers</h2></div>
<div class="tool-grid">${RECORDS.map(k => { const t = HUB_TOOLS[k]; return `<button class="tool-tile" onclick="openTool('${k}')"><span>${t.icon}</span><b>${t.title}</b><small>${t.blurb}</small><em>${(h.tools?.[k] || []).length} saved</em></button>`; }).join('')}</div>`;
  }
  window.mxTool = k => { toolId = k; if (page !== 'mxtools') go('mxtools'); else { toolsPage(); window.scrollTo(0, 0); } };
  const toolHead = (t, sub) => `${crumbs([['mx', 'Maintenance center'], ['mxtools', 'Tools'], [null, t]])}<h1>${t}</h1><p class="muted">${sub}</p>`;
  const num = (id, v) => { const x = parseFloat(document.getElementById(id)?.value); return Number.isFinite(x) ? x : v; };
  const fmt = (x, d = 1) => Number.isFinite(x) ? (+x.toFixed(d)).toLocaleString(undefined, { maximumFractionDigits: d }) : '—';

  // Torque
  function torquePage() {
    const c = mx.calc.torque ||= { t: 300, u: 'in-lb', l: 12, e: 3, dir: 'inline' };
    $('#view').innerHTML = `${toolHead('Torque extension calculator', 'When an adapter extends the wrench’s effective length, the wrench must be set lower than the torque you need.')}
<div class="mx-calc-grid"><form class="card mx-calc" oninput="mxTorque()" onsubmit="return false">
  <div class="fields">
    <label>Required torque<input id="tq-t" type="number" step="any" value="${c.t}"></label>
    <label>Units<select id="tq-u">${['in-lb', 'ft-lb', 'N·m'].map(u => `<option ${u === c.u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
    <label>Wrench length L (drive center to handle grip)<input id="tq-l" type="number" step="any" value="${c.l}"></label>
    <label>Extension length E (along the wrench line)<input id="tq-e" type="number" step="any" value="${c.e}"></label>
    <label>Adapter direction<select id="tq-d"><option value="inline" ${c.dir === 'inline' ? 'selected' : ''}>In line, pointing away (adds length)</option><option value="back" ${c.dir === 'back' ? 'selected' : ''}>Pointing back toward the handle (reduces length)</option><option value="right" ${c.dir === 'right' ? 'selected' : ''}>At 90° to the wrench (no correction)</option></select></label>
  </div>
  <div class="mx-out big" id="tq-out"></div>
</form>
<div class="card mx-diagram"><svg viewBox="0 0 360 120" role="img" aria-label="Torque wrench with an in-line extension"><rect x="60" y="52" width="230" height="16" rx="8" fill="#1b2f40"/><rect x="250" y="48" width="70" height="24" rx="10" fill="#c5a36a"/><circle cx="60" cy="60" r="14" fill="#7d8c96"/><rect x="10" y="55" width="50" height="10" fill="#9fb0bb"/><circle cx="14" cy="60" r="9" fill="none" stroke="#9fb0bb" stroke-width="4"/><path d="M14 95 H60" stroke="#a2453a" stroke-width="2"/><path d="M60 95 H285" stroke="#2f6b4f" stroke-width="2"/><text x="37" y="112" font-size="12" text-anchor="middle" fill="#a2453a">E</text><text x="172" y="112" font-size="12" text-anchor="middle" fill="#2f6b4f">L</text><text x="180" y="30" font-size="12" text-anchor="middle" fill="#5c6f7b">Setting = T × L ÷ (L + E)</text></svg><p class="small muted">Measure both lengths in the same units. Use the manufacturer’s torque values and a calibrated wrench, and remember the wrench reads correctly only when you pull at the handle grip.</p></div></div>`;
    mxTorque();
  }
  window.mxTorque = () => {
    const t = num('tq-t', 0), l = num('tq-l', 0), e = num('tq-e', 0), u = document.getElementById('tq-u').value, dir = document.getElementById('tq-d').value;
    mx.calc.torque = { t, u, l, e, dir }; save();
    const out = document.getElementById('tq-out');
    if (!(t > 0 && l > 0)) { out.innerHTML = 'Enter the required torque and wrench length.'; return; }
    if (dir === 'back' && e >= l) { out.innerHTML = 'The extension can’t be as long as the wrench when it points back.'; return; }
    const s = dir === 'right' ? t : dir === 'back' ? t * l / (l - e) : t * l / (l + e);
    out.innerHTML = `Set the wrench to <b>${fmt(s, 1)} ${u}</b><small>${dir === 'right' ? 'At 90° the effective length doesn’t change.' : `${fmt(t, 1)} × ${fmt(l, 2)} ÷ (${fmt(l, 2)} ${dir === 'back' ? '−' : '+'} ${fmt(e, 2)})`}</small>`;
  };

  // Rivets
  const RIVET_D = [3, 4, 5, 6, 8]; // 32nds of an inch
  const MAT = { A: '1100 aluminum (soft, non-structural)', AD: '2117-T4 aluminum (most common)', D: '2017-T4 aluminum (heat-treated before use)', DD: '2024-T4 aluminum (“icebox” rivet)', B: '5056 aluminum (for magnesium)', M: 'Monel', C: 'Copper' };
  const HEAD = { MS20470: 'universal head', MS20426: '100° countersunk head', AN470: 'universal head (older standard)', AN426: '100° countersunk head (older standard)', MS20430: 'round head (older)', MS20615: 'universal head, Monel or copper' };
  function rivetPage() {
    const c = mx.calc.rivet ||= { t: 0.04, g: 0.08, head: 'MS20470', code: 'MS20470AD4-6' };
    $('#view').innerHTML = `${toolHead('Rivet calculator', 'Layout rules of thumb from FAA-H-8083-31B and AC 43.13-1B. When the structural repair manual gives different values, the manual wins.')}
<div class="mx-calc-grid"><form class="card mx-calc" oninput="mxRivet()" onsubmit="return false"><h3>Size and lay out a rivet</h3>
  <div class="fields">
    <label>Thickest sheet (in)<input id="rv-t" type="number" step="0.001" min="0" value="${c.t}"></label>
    <label>Total grip, all sheets (in)<input id="rv-g" type="number" step="0.001" min="0" value="${c.g}"></label>
    <label>Head<select id="rv-h"><option value="MS20470" ${c.head === 'MS20470' ? 'selected' : ''}>Universal (MS20470)</option><option value="MS20426" ${c.head === 'MS20426' ? 'selected' : ''}>Countersunk 100° (MS20426)</option></select></label>
  </div><div id="rv-out"></div></form>
<form class="card mx-calc" oninput="mxDecode()" onsubmit="return false"><h3>Decode a part number</h3><div class="fields"><label>Rivet part number<input id="rv-c" value="${esc(c.code)}" placeholder="MS20470AD4-6"></label></div><div id="rv-dec"></div>
<p class="small muted">Diameter dash numbers are in 32nds of an inch; length dash numbers are in 16ths.</p></form></div>`;
    mxRivet(); mxDecode();
  }
  window.mxRivet = () => {
    const t = num('rv-t', 0), g = num('rv-g', 0), head = document.getElementById('rv-h').value;
    mx.calc.rivet = Object.assign(mx.calc.rivet || {}, { t, g, head }); save();
    const out = document.getElementById('rv-out');
    if (!(t > 0)) { out.innerHTML = '<p class="mx-out">Enter the sheet thickness.</p>'; return; }
    const want = 3 * t * 32;
    const d32 = RIVET_D.find(d => d >= want - 0.15) || 8;
    const D = d32 / 32;
    const cs = head === 'MS20426';
    const lenIn = (g || t) + 1.5 * D, l16 = Math.ceil(lenIn * 16 - 1e-6);
    const row = (k, v) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`;
    out.innerHTML = `<table class="data mx-table">
${row('Suggested diameter (≈ 3 × thickest sheet)', `${d32}/32 in (${D.toFixed(4)} in)`)}
${row('Edge distance', `min ${((cs ? 2.5 : 2) * D).toFixed(3)} in (${cs ? '2.5' : '2'}D) · preferred ${((cs ? 3 : 2.5) * D).toFixed(3)} in`)}
${row('Pitch (rivet to rivet in a row)', `min ${(3 * D).toFixed(3)} in (3D) · typical ${(4 * D).toFixed(3)}–${(6 * D).toFixed(3)} in`)}
${row('Transverse pitch (between rows)', `min ${(2.5 * D).toFixed(3)} in (2.5D)`)}
${row('Length = grip + 1.5D', `${lenIn.toFixed(4)} in → <b>${l16}/16 in</b> (rounded up)`)}
${row('Bucked shop head', `${(1.5 * D).toFixed(3)} in wide × ${(0.5 * D).toFixed(3)} in high`)}
${row('Example part number', `${head}AD${d32}-${l16}`)}
</table><p class="small muted">${cs ? 'Countersunk heads are used where a smooth surface is needed and need enough sheet thickness for the countersink, or a dimpled skin. Check the SRM.' : 'Universal heads are used where a smooth surface isn’t required. Check the SRM for the rivet type, material and size for each repair.'}</p>`;
  };
  window.mxDecode = () => {
    const raw = (document.getElementById('rv-c').value || '').toUpperCase().replace(/\s/g, '');
    mx.calc.rivet = Object.assign(mx.calc.rivet || {}, { code: raw }); save();
    const m = raw.match(/^(MS\d{5}|AN\d{3})([A-Z]{1,2})(\d{1,2})-(\d{1,2})$/);
    const el = document.getElementById('rv-dec');
    if (!m) { el.innerHTML = '<p class="mx-out">Format: head standard, material code, diameter-length (e.g. MS20470AD4-6).</p>'; return; }
    const [, std, mat, d, l] = m;
    el.innerHTML = `<table class="data mx-table"><tr><td>Head</td><td><b>${esc(std)}</b> · ${esc(HEAD[std] || 'see the standard')}</td></tr><tr><td>Material</td><td><b>${esc(mat)}</b> · ${esc(MAT[mat] || 'check the material code')}</td></tr><tr><td>Diameter</td><td><b>${d}/32 in</b> (${(d / 32).toFixed(4)} in)</td></tr><tr><td>Length</td><td><b>${l}/16 in</b> (${(l / 16).toFixed(4)} in)</td></tr></table>`;
  };

  // Units
  const UNITS = {
    torque: { label: 'Torque', units: { 'in-lb': 0.112984829, 'ft-lb': 1.35581795, 'N·m': 1, 'kgf·m': 9.80665 } },
    pressure: { label: 'Pressure', units: { psi: 6.89475729, kPa: 1, bar: 100, inHg: 3.38638866, hPa: 0.1 } },
    length: { label: 'Length', units: { in: 0.0254, mm: 0.001, cm: 0.01, ft: 0.3048, m: 1 } },
    volume: { label: 'Volume', units: { 'US gal': 3.78541178, L: 1, qt: 0.946352946, 'fl oz': 0.0295735296 } },
    weight: { label: 'Weight', units: { lb: 0.45359237, kg: 1, oz: 0.0283495231 } },
    temp: { label: 'Temperature', units: { '°F': 0, '°C': 0, K: 0 } },
    fuel: { label: 'Fuel weight', units: { 'Avgas 100LL (≈6.0 lb/gal)': 6.0, 'Jet A (≈6.7 lb/gal)': 6.7 } },
  };
  function unitsPage() {
    const c = mx.calc.units ||= { cat: 'torque', v: 100, from: 'in-lb' };
    const cat = UNITS[c.cat];
    $('#view').innerHTML = `${toolHead('Unit converter', 'Quick conversions for the hangar. Use the units given in the maintenance data whenever you can, to avoid conversion errors.')}
<div class="row filters">${Object.entries(UNITS).map(([k, u]) => `<button class="chip ${k === c.cat ? 'on' : ''}" onclick="mxUnitCat('${k}')">${u.label}</button>`).join('')}</div>
<form class="card mx-calc" oninput="mxUnits()" onsubmit="return false"><div class="fields">
<label>${c.cat === 'fuel' ? 'US gallons' : 'Value'}<input id="un-v" type="number" step="any" value="${c.v}"></label>
<label>${c.cat === 'fuel' ? 'Fuel type' : 'From'}<select id="un-f">${Object.keys(cat.units).map(u => `<option ${u === c.from ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
<div id="un-out"></div>${c.cat === 'fuel' ? '<p class="small muted">Fuel density changes with temperature and batch. Use the measured specific gravity and the aircraft’s data for weight and balance.</p>' : ''}</form>`;
    mxUnits();
  }
  window.mxUnitCat = k => { mx.calc.units = { cat: k, v: k === 'temp' ? 59 : k === 'fuel' ? 50 : 100, from: Object.keys(UNITS[k].units)[0] }; save(); unitsPage(); };
  window.mxUnits = () => {
    const c = mx.calc.units, v = num('un-v', 0), from = document.getElementById('un-f').value;
    c.v = v; c.from = from; save();
    const out = document.getElementById('un-out');
    let rows = [];
    if (c.cat === 'temp') {
      const k = from === '°F' ? (v - 32) * 5 / 9 + 273.15 : from === '°C' ? v + 273.15 : v;
      rows = [['°F', (k - 273.15) * 9 / 5 + 32], ['°C', k - 273.15], ['K', k]];
    } else if (c.cat === 'fuel') {
      const lb = v * UNITS.fuel.units[from];
      rows = [['lb', lb], ['kg', lb * 0.45359237], ['litres', v * 3.78541178]];
    } else {
      const base = v * UNITS[c.cat].units[from];
      rows = Object.entries(UNITS[c.cat].units).map(([u, f]) => [u, base / f]);
    }
    out.innerHTML = `<table class="data mx-table">${rows.filter(([u]) => u !== from).map(([u, x]) => `<tr><td>${u}</td><td><b>${fmt(x, Math.abs(x) < 10 ? 3 : 2)}</b></td></tr>`).join('')}</table>`;
  };

  // ATA
  function ataPage() {
    $('#view').innerHTML = `${toolHead('ATA chapter lookup', 'Most maintenance manuals are organized by ATA chapter numbers (ATA iSpec 2200). Titles below are the standard ones; your manufacturer’s manual may differ slightly.')}
<input class="txt" id="ata-q" placeholder="Search a system or number, e.g. fuel, 32, lights" oninput="mxAta()" autofocus>
<div class="mx-ata" id="ata-list"></div>`;
    mxAta();
  }
  window.mxAta = () => {
    const q = (document.getElementById('ata-q').value || '').trim().toLowerCase();
    const list = MX_ATA.filter(([n, t]) => !q || n.startsWith(q) || t.toLowerCase().includes(q));
    const group = n => +n < 20 ? 'Aircraft general' : +n < 50 ? 'Airframe systems' : +n < 60 ? 'Structures' : +n < 70 ? 'Propellers & rotors' : 'Power plant';
    document.getElementById('ata-list').innerHTML = list.length ? list.map(([n, t]) => `<div class="mx-ata-row"><b>${n}</b><span>${esc(t)}</span><em>${group(n)}</em></div>`).join('') : '<p class="muted">No match. Try a broader word.</p>';
  };

  // Logbook entry builder
  const LB_FIELDS = [['date', 'Date of completion', 'date'], ['aircraft', 'Aircraft make / model'], ['reg', 'Registration (N-number)'], ['serial', 'Aircraft serial number'], ['tt', 'Total time / tach (hours)'], ['work', 'Description of work performed', 'textarea'], ['data', 'Data reference (manual, chapter, task, revision)'], ['parts', 'Parts installed (P/N, S/N)', 'textarea'], ['performer', 'Performed by (if different from approver)'], ['name', 'Approving person'], ['cert', 'Kind of certificate', 'select', ['A&P mechanic', 'Airframe mechanic', 'Powerplant mechanic', 'Repairman', 'Repair station', 'A&P with IA']], ['certno', 'Certificate number']];
  function logbookPage() {
    const d = mx.calc.logbook ||= { date: new Date().toISOString().slice(0, 10), aircraft: 'First Flight Trainer FF-1', reg: 'N123FF', work: 'Removed and replaced left main tire due to wear beyond limits. Torqued axle nut and installed new cotter pin. Operational check good.', data: 'AMM 32-40-01, Rev 12' };
    $('#view').innerHTML = `${toolHead('Logbook entry builder', 'Practise a complete maintenance record entry. 14 CFR 43.9 requires a description of the work (or reference to acceptable data), the completion date, the performer’s name if different, and the approver’s signature, certificate number and kind of certificate.')}
<div class="mx-calc-grid"><form class="card mx-calc" oninput="mxLog()" onsubmit="mxLogSave(event)"><div class="fields">${LB_FIELDS.map(([k, l, type = 'text', opts]) => type === 'textarea' ? `<label>${l}<textarea name="${k}">${esc(d[k] || '')}</textarea></label>` : type === 'select' ? `<label>${l}<select name="${k}">${opts.map(o => `<option ${o === d[k] ? 'selected' : ''}>${o}</option>`).join('')}</select></label>` : `<label>${l}<input name="${k}" type="${type}" value="${esc(d[k] || '')}"></label>`).join('')}</div>
<div class="row"><button class="btn" type="submit">Save practice entry</button><button class="btn secondary" type="button" onclick="mxLogCopy()">Copy text</button><button class="btn secondary" type="button" onclick="printSection('#lb-out','Practice maintenance record entry')">Print</button></div></form>
<div><div class="card mx-logbook" id="lb-out"></div><div id="lb-check"></div></div></div>
<div class="section-head"><h2>Saved practice entries (${mx.logbook.length})</h2></div>
${mx.logbook.length ? `<div class="mx-saved">${mx.logbook.map((e, i) => `<div class="card"><pre>${esc(logText(e))}</pre><div class="row"><button class="text-btn" onclick="mxLogLoad(${i})">Edit a copy</button><button class="text-btn danger" onclick="mxLogDel(${i})">Delete</button></div></div>`).join('')}</div>` : '<p class="muted">None yet.</p>'}
<p class="small muted">Practice only: this page does not create a legal maintenance record. ${ext('rec439', '14 CFR 43.9')}</p>`;
    mxLog();
  }
  const logText = e => [
    `${e.date || '[date]'}   ${e.aircraft || '[aircraft]'}   ${e.reg || ''}${e.serial ? '   S/N ' + e.serial : ''}${e.tt ? '   TT ' + e.tt + ' h' : ''}`,
    '', e.work || '[description of work]', e.data ? `Ref: ${e.data}` : '', e.parts ? `Parts: ${e.parts}` : '', e.performer ? `Work performed by: ${e.performer}` : '', '',
    'I certify that this work was performed in accordance with the current regulations and the referenced data, and the aircraft is approved for return to service with respect to the work performed.', '',
    `Signature: ____________________   ${e.name || '[name]'}   ${e.cert || ''} ${e.certno ? 'No. ' + e.certno : '[certificate no.]'}`,
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  window.mxLog = () => {
    const f = document.querySelector('.mx-calc-grid form'); if (!f) return;
    const e = Object.fromEntries(new FormData(f).entries()); mx.calc.logbook = e; save();
    document.getElementById('lb-out').innerHTML = `<pre>${esc(logText(e))}</pre>`;
    const checks = [['Description of work or data reference', !!(e.work || e.data)], ['Date of completion', !!e.date], ['Approver’s name / signature line', !!e.name], ['Certificate number', !!e.certno], ['Kind of certificate', !!e.cert]];
    document.getElementById('lb-check').innerHTML = `<div class="card mx-checks"><h3>43.9 checklist</h3>${checks.map(([t, ok]) => `<p class="${ok ? 'ok' : 'miss'}">${ok ? '✓' : '○'} ${t}</p>`).join('')}<p class="small muted">Good practice: be specific, include part and serial numbers, and say what you found as well as what you did.</p></div>`;
  };
  window.mxLogSave = ev => { ev.preventDefault(); mx.logbook.unshift({ ...mx.calc.logbook }); save(); logbookPage(); flash('Practice entry saved'); };
  window.mxLogCopy = () => navigator.clipboard?.writeText(logText(mx.calc.logbook)).then(() => flash('Entry copied'), () => flash('Copy is not available here'));
  window.mxLogLoad = i => { mx.calc.logbook = { ...mx.logbook[i] }; save(); logbookPage(); window.scrollTo(0, 0); };
  window.mxLogDel = i => { mx.logbook.splice(i, 1); save(); logbookPage(); };

  // Dirty Dozen
  function dirtyPage() {
    const sel = new Set(mx.dd);
    $('#view').innerHTML = `${toolHead('Dirty Dozen self-check', 'Before a task, tap any factor that applies to you or your team today. You’ll get a matching safety net for each one.')}
<div class="mx-dd">${MX_DIRTY_DOZEN.map(([t], i) => `<button class="mx-dd-item ${sel.has(i) ? 'on' : ''}" onclick="mxDD(${i})"><em>${String(i + 1).padStart(2, '0')}</em>${esc(t)}</button>`).join('')}</div>
<div class="card mx-dd-out">${sel.size ? `<h3>${sel.size} factor${sel.size > 1 ? 's' : ''} today: your safety nets</h3><ul>${[...sel].sort((a, b) => a - b).map(i => `<li><b>${esc(MX_DIRTY_DOZEN[i][0])}:</b> ${esc(MX_DIRTY_DOZEN[i][1])}</li>`).join('')}</ul>${sel.size >= 3 ? '<p class="mx-warn">Three or more factors: tell your lead, consider an independent inspection on critical steps, and slow down.</p>' : ''}` : '<h3>Nothing selected</h3><p class="muted">Good. Stay alert: conditions change during a shift.</p>'}
<div class="row"><button class="btn secondary" onclick="mxDDClear()">Clear</button><button class="btn secondary" onclick="printSection('.mx-dd-out','Dirty Dozen self-check')">Print</button></div></div>
<p class="small muted">The Dirty Dozen are the twelve common causes of maintenance error identified by the FAA. ${ext('hf', 'FAA maintenance human factors')} · ${ext('fatigue', 'Fatigue risk management')}</p>`;
  }
  window.mxDD = i => { const k = mx.dd.indexOf(i); if (k < 0) mx.dd.push(i); else mx.dd.splice(k, 1); save(); dirtyPage(); };
  window.mxDDClear = () => { mx.dd = []; save(); dirtyPage(); };

  // ---------------------------------------------------------------- router hook
  const MX_PAGES = { mx: centerPage, mxcareers: careersPage, mxcert: certPage, mxlearn: learnPage, mxtools: toolsPage };
  const prev = render;
  render = function () {
    if (MX_PAGES[page]) { document.body.dataset.page = page; MX_PAGES[page](); }
    else prev();
  };
  window.addEventListener('hashchange', () => { const p = location.hash.slice(1); if (MX_PAGES[p] && p !== page) go(p); });
  const initial = window.__ffHash || location.hash.slice(1);
  if (MX_PAGES[initial]) go(initial);
})();

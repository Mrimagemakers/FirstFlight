// Aviation Careers & New-Hire Learning Hub + XR lab page + grouped navigation.
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = k => HUB_LINKS[k];
  const ext = (k, label) => `<a href="${L(k)}" target="_blank" rel="noopener">${label} ↗</a>`;
  const img = (key, alt, cls = '') => `<img class="${cls}" src="assets/renders/${key}.jpg" alt="${esc(alt)}" loading="lazy" onerror="this.onerror=null;this.src='assets/renders/hub-hero.jpg'">`;

  // ---------------------------------------------------------------- local, rendered fallbacks for remote photos
  const TOPIC_RENDER = { training: 'cockpit', cockpit: 'cockpit', hangar: 'lab-hangar', terrain: 'region-alpine', navigation: 'region-highlands', cabin: 'flight-attendant', weather: 'region-highlands', canyon: 'region-canyon', maintenance: 'technician', ground: 'ramp-agent', coast: 'region-coast', islands: 'region-islands', highlands: 'region-highlands', twilight: 'region-twilight', engine: 'lab-engine', airframe: 'lab-walkaround', alpine: 'region-alpine' };
  const urlToKey = new Map(typeof mediaCards === 'object' ? Object.entries(mediaCards).map(([k, m]) => [m.url, k]) : []);
  document.addEventListener('error', e => {
    const t = e.target;
    if (t.tagName !== 'IMG' || t.dataset.fallback) return;
    const k = urlToKey.get(t.getAttribute('src'));
    if (!k) return;
    e.stopPropagation();
    t.dataset.fallback = '1';
    t.style.display = '';
    t.src = 'assets/renders/' + (TOPIC_RENDER[k] || 'hub-hero') + '.jpg';
    const fig = t.closest('figure');
    if (fig) { fig.classList.remove('image-unavailable'); const cap = fig.querySelector('figcaption'); if (cap) cap.textContent = 'Rendered in the First Flight 3D lab'; }
    const credit = t.parentElement?.querySelector('.hero-credit, .home-photo-credit'); if (credit) credit.textContent = 'Rendered in the First Flight 3D lab';
  }, true);

  // ---------------------------------------------------------------- state
  let hub;
  try { hub = JSON.parse(localStorage.getItem('ff-hub') || '{}'); } catch { hub = {}; }
  hub.stages ||= []; hub.videos ||= {}; hub.gap ||= {}; hub.tools ||= {}; hub.selector ||= {}; hub.agenda ||= [];
  const saveHub = () => { try { localStorage.setItem('ff-hub', JSON.stringify(hub)); } catch { /* storage blocked */ } };
  const xr = () => { try { return Object.assign({ fod: [], scenarios: [], cabin: [], walkaround: [], tools: [], missions: [] }, JSON.parse(localStorage.getItem('ff-xr-progress') || '{}')); } catch { return { fod: [], scenarios: [], cabin: [], walkaround: [], tools: [], missions: [] }; } };
  const saveXR = p => { try { localStorage.setItem('ff-xr-progress', JSON.stringify(p)); } catch { /* ignore */ } };
  window.addEventListener('message', e => { if (e.origin === location.origin && e.data?.type === 'ff-xr-progress' && page === 'sim') labProgress(); });

  // ---------------------------------------------------------------- navigation (grouped)
  const groups = [
    ['Start here', [['home', '◈', 'Welcome'], ['hub', '✦', 'Careers & new-hire hub']]],
    ['Careers & new hires', [['new', '→', 'I’m new to aviation'], ['experienced', '★', 'I have experience'], ['paths', '⇡', 'Career paths'], ['onboarding', '◷', 'First 90 days & Day 1'], ['tools', '▦', 'Practical tools'], ['scenarios', '?', 'Orientation scenarios'], ['learning', '▶', 'Videos & resources'], ['jobs', '⌕', 'Job search']]],
    ['XR training lab', [['sim', '◎', '3D & VR training lab'], ['ar', '⧉', 'AR aircraft explorer']]],
    ['Pilot academy', [['learn', '▤', 'Pilot handbook'], ['courses', '▤', 'Courses'], ['tutorials', '▷', 'Tutorials'], ['study', '◇', 'Study desk'], ['quiz', '◎', 'Knowledge check'], ['worlds', '◉', 'Flying environments'], ['hangars', '⌂', 'Hangar collection'], ['career', '◈', 'Pilot career prep'], ['encyclopedia', '▥', 'Encyclopedia'], ['resources', '▧', 'Resource library']]],
  ];
  const nav = $('nav');
  nav.innerHTML = groups.map(([label, items]) => `<p class="nav-label">${label}</p>` + items.map(([p, i, t]) => `<button data-page="${p}"><span class="ni">${i}</span>${t}</button>`).join('')).join('');
  nav.querySelectorAll('button').forEach(b => (b.onclick = () => { if (b.dataset.page === 'encyclopedia' && typeof encArticle !== 'undefined') encArticle = null; document.body.classList.remove('nav-open'); if (b.dataset.page === 'tools') return window.openTool(null); go(b.dataset.page); }));
  const brand = $('.brand'); if (brand) brand.innerHTML = '↗ <span>FIRST FLIGHT<small>AVIATION CAREERS & TRAINING</small></span>';
  const label = $('.label'); if (label) label.remove();
  const bottom = $('.aside-bottom'); if (bottom) bottom.innerHTML = '<span class="badge">CAREERS · XR · ACADEMY</span><p>Explore aviation work.<br>Practice it safely in 3D and VR.</p><small>U.S.-focused learning framework</small>';
  $('header span').textContent = 'AVIATION CAREERS & NEW-HIRE LEARNING HUB';
  $('aside').insertAdjacentHTML('afterbegin', '<button class="menu-btn" aria-label="Open navigation" onclick="document.body.classList.toggle(\'nav-open\')">☰</button>');
  $('footer').innerHTML = 'Educational exploration only. This hub does not issue certificates, airport access, employment qualifications or flight-training credit. Employer training, airport access requirements and task-specific authorization determine when someone can work independently. Simplified simulations; learn real procedures from your employer, airline or instructor and the approved documentation. 3D lab lighting uses CC0 HDR imagery from Poly Haven.';

  // ---------------------------------------------------------------- shared bits
  const hubProgress = () => {
    const p = xr();
    const toolRecords = Object.values(hub.tools).reduce((s, r) => s + (r?.length || 0), 0);
    return {
      stages: hub.stages.length, videos: Object.values(hub.videos).filter(v => v.done).length,
      scenarios: HUB_SCENARIOS.filter(s => p.scenarios.includes(s.id)).length, toolRecords,
      xrTasks: p.fod.length + p.scenarios.length + p.cabin.length + p.walkaround.length + p.tools.length + p.missions.length,
    };
  };
  const crumbs = (items) => `<div class="crumbs">${items.map(([p, t]) => p ? `<button class="text-btn" onclick="go('${p}')">${t}</button>` : `<span>${t}</span>`).join(' <i>/</i> ')}</div>`;
  const xrButton = (key, label = 'Practice in 3D') => `<button class="btn xr-btn" onclick="openLab3D('${key}')">◎ ${label}</button>`;
  window.openLab3D = (key) => { try { localStorage.setItem('academy-launch', key); } catch { /* ignore */ } go('sim'); };

  // ---------------------------------------------------------------- WELCOME (home)
  home = function () {
    const p = hubProgress();
    $('#view').innerHTML = `
<section class="welcome">
  <div class="welcome-copy">
    <span class="eyebrow">AVIATION CAREERS & NEW-HIRE LEARNING HUB</span>
    <h1>Find your place in aviation.<br>Then practice it in 3D.</h1>
    <p>Explore real airport and airline careers, prepare for your first 90 days, and walk a realistic ramp, cabin, hangar and cockpit in your browser or VR headset.</p>
    <div class="start-cards">
      <button class="start-card" onclick="go('new')"><span class="sc-num">01</span><b>I’m new to aviation</b><small>Explore entry-level roles, build an application plan and get ready for Day 1.</small><em>Start here →</em></button>
      <button class="start-card dark" onclick="go('experienced')"><span class="sc-num">02</span><b>I have aviation experience</b><small>Plan your next role, complete a gap assessment and move up with confidence.</small><em>Continue →</em></button>
    </div>
  </div>
  <figure class="welcome-art">${img('hub-hero', 'A narrow-body airliner at a gate with ground support equipment, rendered in the First Flight 3D lab')}<figcaption>Rendered in the First Flight XR lab · Stand 7</figcaption></figure>
</section>
<div class="stats">
  <div class="stat"><span class="icon">◷</span><div><strong>${p.stages} / ${HUB_STAGES.length}</strong><small>New-hire stages complete</small></div></div>
  <div class="stat"><span class="icon">?</span><div><strong>${p.scenarios} / ${HUB_SCENARIOS.length}</strong><small>Orientation scenarios</small></div></div>
  <div class="stat"><span class="icon">◎</span><div><strong>${p.xrTasks}</strong><small>3D training tasks done</small></div></div>
</div>
<div class="section-head"><h2>Three ways to learn</h2><span class="eyebrow muted">EXPLORE · PREPARE · PRACTICE</span></div>
<div class="pillars">
  <article class="card image-card">${img('ramp-agent', 'A ramp service view with a belt loader at an open cargo door')}<div class="image-card-body"><span class="num">01 / CAREERS & NEW HIRES</span><h3>Plan your aviation career</h3><p>Six entry-level roles, nine experienced paths, a 90-day new-hire plan, a Day-1 agenda, practical tools and a full aviation maintenance center.</p><button class="text-btn" onclick="go('hub')">Open the hub →</button> <button class="text-btn" onclick="go('mx')">Maintenance center →</button></div></article>
  <article class="card image-card">${img('lab-flight', 'A training airplane flying over an alpine valley in the First Flight 3D lab')}<div class="image-card-body"><span class="num">02 / XR TRAINING LAB</span><h3>Practice in 3D and VR</h3><p>Walk the ramp and collect FOD, find cabin safety equipment, explore aircraft systems, and fly six realistic regions.</p><button class="text-btn" onclick="go('sim')">Enter the lab →</button></div></article>
  <article class="card image-card">${img('cockpit', 'The instrument panel of a training airplane cockpit')}<div class="image-card-body"><span class="num">03 / PILOT ACADEMY</span><h3>Keep your pilot dream flying</h3><p>Ground-school chapters, courses, flashcards, sample tests and an aviation encyclopedia for future pilots.</p><button class="text-btn" onclick="go('learn')">Open the academy →</button></div></article>
</div>`;
  };

  // ---------------------------------------------------------------- HUB HOME
  function hubPage() {
    const p = hubProgress();
    $('#view').innerHTML = `
<section class="career-hero hub-hero">
  <div><span class="eyebrow">AVIATION CAREERS & NEW-HIRE LEARNING HUB</span><h1>Choose where you’re starting from.</h1><p>Two paths, one goal: reach your first authorized task safely, and keep growing after it. This is a U.S.-focused framework. Employer training, airport access requirements and task-specific authorization determine when someone can work independently.</p>
  <div class="row"><button class="btn gold" onclick="go('new')">I’m new to aviation →</button><button class="btn ghost" onclick="go('experienced')">I have aviation experience →</button></div></div>
  ${img('hub-wide', 'Overview of an airline stand with an aircraft, jet bridge and baggage carts')}
</section>
<div class="hub-grid">
  ${[
    ['paths', 'Career paths', `${HUB_ENTRY_ROLES.length} entry-level and ${HUB_SPECIALIST_ROLES.length} experienced roles with learning priorities and advancement.`, 'cargo'],
    ['onboarding', 'First 90 days & Day 1', `From application to day 90 · ${p.stages} of ${HUB_STAGES.length} stages done · full first-day agenda.`, 'gate-agent'],
    ['tools', 'Practical tools', `Career selector, application tracker, training passport and four more · ${p.toolRecords} records saved.`, 'technician'],
    ['scenarios', 'Orientation scenarios', `${p.scenarios} of ${HUB_SCENARIOS.length} complete · practice each one again inside the 3D lab.`, 'safety'],
    ['learning', 'Videos & resources', `${p.videos} of ${HUB_VIDEOS.length} activities done · FAA, IATA, OSHA and NATA resources.`, 'flight-attendant'],
    ['jobs', 'Job search', 'Employer career portals and a reminder of what to check before you apply.', 'station-manager'],
    ['mx', 'Aviation maintenance', 'Maintenance careers, the A&P pathway, shop-skill tutorials and technician calculators.', 'mx-walkaround'],
  ].map(([pg, t, d, im]) => `<button class="hub-tile" onclick="go('${pg}')">${img(im, t)}<span><b>${t}</b><small>${d}</small></span></button>`).join('')}
</div>
<div class="note"><strong>How authorization works</strong><p>Use four clear learning statuses: <b>Not started → Learning → Supervised practice → Authorized for the specified task.</b> Course completion and operational authorization are recorded separately. Videos support learning; they don’t replace employer-required instruction or practical qualification.</p></div>`;
  }

  // ---------------------------------------------------------------- NEW TO AVIATION
  function newPage() {
    const done = new Set(hub.stages);
    $('#view').innerHTML = `${crumbs([['hub', 'Hub'], [null, 'I’m new to aviation']])}
<section class="path-hero">${img('ramp-walk', 'Walking the ramp toward an airliner')}<div><span class="eyebrow">PATH 01 · NEW TO AVIATION</span><h1>Your first aviation job starts on the ground.</h1><p>Most airport and airline careers start with an entry-level role, a structured orientation and a period of supervised practice. Follow these five steps.</p></div></section>
<ol class="steps">
  <li><span>1</span><div><h3>Compare entry-level roles</h3><p>Ramp, cargo, cabin appearance, flight attendant, apprentice technician and ticket/gate roles. Look at schedules, physical demands and qualifications.</p><button class="btn" onclick="go('paths')">Explore career paths</button> <button class="btn secondary" onclick="openTool('selector')">Use the career selector</button></div></li>
  <li><span>2</span><div><h3>Prepare your applications</h3><p>Tailor your résumé and prepare examples of teamwork, reliability, customer service and following procedures.</p><button class="btn" onclick="openTool('tracker')">Open the application tracker</button> <button class="btn secondary" onclick="go('jobs')">Job-search links</button></div></li>
  <li><span>3</span><div><h3>Know what preboarding and Day 1 look like</h3><p>Documents and screening, arrival instructions, a mentor contact, then a full orientation day.</p><button class="btn" onclick="go('onboarding')">See the 90-day path & Day-1 agenda</button></div></li>
  <li><span>4</span><div><h3>Practice safety thinking</h3><p>Six orientation scenarios cover FOD, equipment limits, damaged cargo, unlabeled chemicals, unclear instructions and station transfers.</p><button class="btn" onclick="go('scenarios')">Try the scenarios</button> ${xrButton('ramp', 'Walk the ramp in 3D')}</div></li>
  <li><span>5</span><div><h3>Watch, then do an activity</h3><p>Pair each official video with a short activity and keep notes for your first conversations with a trainer.</p><button class="btn" onclick="go('learning')">Videos & resources</button></div></li>
</ol>
<div class="two-col">
  <div class="note"><strong>Flight attendants</strong><p>${esc(HUB_ENTRY_ROLES.find(r => r.id === 'fa').note)} ${ext('deltaFA', 'Delta flight attendant careers')}</p></div>
  <div class="note"><strong>Maintenance apprentices</strong><p>${esc(HUB_ENTRY_ROLES.find(r => r.id === 'apprentice').note)} ${ext('mechanicExp', 'FAA experience requirements')}</p></div>
</div>
<p class="muted small">Progress: ${done.size} of ${HUB_STAGES.length} new-hire stages marked complete.</p>`;
  }

  // ---------------------------------------------------------------- EXPERIENCED
  function experiencedPage() {
    const gapDone = HUB_GAP.filter(g => hub.gap[g.id]?.done).length;
    $('#view').innerHTML = `${crumbs([['hub', 'Hub'], [null, 'I have aviation experience']])}
<section class="path-hero dark">${img('ramp-supervisor', 'Overview of a stand during a turnaround')}<div><span class="eyebrow">PATH 02 · EXPERIENCED</span><h1>Bring your experience. Verify it locally.</h1><p>Prior experience can inform your training plan; it does not automatically transfer local permissions. Start with a focused gap assessment, then plan your next role.</p></div></section>
<div class="section-head"><h2>Experienced-hire gap assessment</h2><span class="eyebrow muted">${gapDone} OF ${HUB_GAP.length} REVIEWED</span></div>
<div class="gap-list">${HUB_GAP.map(g => `<div class="gap-item ${hub.gap[g.id]?.done ? 'done' : ''}"><label><input type="checkbox" ${hub.gap[g.id]?.done ? 'checked' : ''} onchange="hubGap('${g.id}',this.checked)"> ${esc(g.text)}</label><textarea placeholder="Notes: evidence, who verified it, what still needs assessment" oninput="hubGapNote('${g.id}',this.value)">${esc(hub.gap[g.id]?.notes || '')}</textarea></div>`).join('')}</div>
<div class="row"><button class="btn" onclick="printSection('.gap-list','Experienced-hire gap assessment')">Print assessment</button><button class="btn secondary" onclick="openTool('competency')">Open the competency checklist</button>${xrButton('ramp', 'Scenario: new station, new rules')}</div>
<div class="section-head"><h2>Experienced and specialist career paths</h2><span class="eyebrow muted">DEVELOPMENT ROUTES, NOT AUTOMATIC PROMOTIONS</span></div>
<div class="role-grid">${HUB_SPECIALIST_ROLES.map(r => `<article class="card role-card">${img(r.img, r.title)}<div><h3>${esc(r.title)}</h3><p>${esc(r.does)}</p><p class="focus"><b>Development focus:</b> ${esc(r.focus)}</p>${r.link ? `<p class="small">${ext(r.link, r.link === 'bls' ? 'BLS career guide' : r.link === 'dispatch' ? 'FAA dispatcher course directory (PDF)' : 'FAA Safety Management Systems')}</p>` : ''}</div></article>`).join('')}</div>
<div class="note"><strong>Technical and dispatch requirements</strong><p>For technical career requirements, use the ${ext('bls', 'BLS aircraft and avionics career guide')}. For dispatch, use the ${ext('dispatch', 'FAA dispatcher certification course directory')}.</p></div>`;
  }
  window.hubGap = (id, v) => { hub.gap[id] = Object.assign(hub.gap[id] || {}, { done: v }); saveHub(); experiencedPage(); };
  window.hubGapNote = (id, v) => { hub.gap[id] = Object.assign(hub.gap[id] || {}, { notes: v }); saveHub(); };

  // ---------------------------------------------------------------- CAREER PATHS
  let pathTab = 'entry', pathFilter = 'all';
  function pathsPage() {
    const roles = HUB_ENTRY_ROLES.filter(r => pathFilter === 'all' || r.prefs.includes(pathFilter));
    $('#view').innerHTML = `${crumbs([['hub', 'Hub'], [null, 'Career paths']])}
<h1>Aviation career paths</h1><p class="muted">What each role does, what you learn first, and where it can lead. Requirements vary by employer and posting.</p>
<div class="career-tabs"><button class="${pathTab === 'entry' ? 'active' : ''}" onclick="hubPathTab('entry')">Entry-level careers</button><button class="${pathTab === 'spec' ? 'active' : ''}" onclick="hubPathTab('spec')">Experienced & specialist paths</button></div>
${pathTab === 'entry' ? `
<div class="row filters"><span class="muted small">Preferred work:</span>${[['all', 'All'], ...HUB_SELECTOR.work].map(([k, t]) => `<button class="chip ${pathFilter === k ? 'on' : ''}" onclick="hubPathFilter('${k}')">${t}</button>`).join('')}</div>
<div class="role-grid entry">${roles.map(r => `<article class="card role-card big">${img(r.img, r.title)}<div><span class="num">ENTRY LEVEL</span><h3>${esc(r.title)}</h3><p>${esc(r.does)}</p><h4>Initial learning priorities</h4><ul class="tags">${r.learn.map(l => `<li>${esc(l)}</li>`).join('')}</ul><h4>Possible advancement</h4><div class="ladder">${r.ladder.map(s => `<span>${esc(s)}</span>`).join('<i>→</i>')}</div>${r.note ? `<p class="small note-inline">${esc(r.note)} ${ext(r.noteLink, 'Source')}</p>` : ''}<div class="row">${xrButton(r.xr, r.xr === 'ramp' ? 'Practice on the ramp' : r.xr === 'cabin' ? 'Practice in the cabin' : 'Practice in the hangar')}</div></div></article>`).join('')}</div>
<p class="small muted">Delta explicitly identifies ramp, cargo, cabin experience and ticket/gate positions as entry-level opportunities. Requirements vary by posting. ${ext('deltaACS', 'Delta Airport Customer Service & Cargo')}</p>` : `
<div class="role-grid">${HUB_SPECIALIST_ROLES.map(r => `<article class="card role-card">${img(r.img, r.title)}<div><h3>${esc(r.title)}</h3><p>${esc(r.does)}</p><p class="focus"><b>Development focus:</b> ${esc(r.focus)}</p></div></article>`).join('')}</div>
<div class="note"><p>These are potential development routes, not automatic promotions. For technical requirements use the ${ext('bls', 'BLS career guide')}; for dispatch, the ${ext('dispatch', 'FAA dispatcher course directory')}.</p></div>`}`;
  }
  window.hubPathTab = t => { pathTab = t; pathsPage(); };
  window.hubPathFilter = f => { pathFilter = f; pathsPage(); };

  // ---------------------------------------------------------------- ONBOARDING
  function onboardingPage() {
    const done = new Set(hub.stages);
    $('#view').innerHTML = `${crumbs([['hub', 'Hub'], [null, 'First 90 days & Day 1']])}
<h1>New-hire path: application through the first 90 days</h1>
<p class="muted">The timing below is a proposed onboarding structure. Flight attendant, maintenance and other regulated training programs follow their own required schedules.</p>
<div class="timeline">${HUB_STAGES.map((s, i) => `<div class="tl-item ${done.has(s.id) ? 'done' : ''}"><div class="tl-dot">${done.has(s.id) ? '✓' : i + 1}</div><div class="tl-body"><span class="eyebrow muted">${esc(s.when)}</span><h3>${esc(s.stage)}</h3><p>${esc(s.act)}</p><p class="evidence"><b>Completion evidence:</b> ${esc(s.evidence)}</p><div class="row"><button class="btn ${done.has(s.id) ? 'secondary' : ''}" onclick="hubStage('${s.id}')">${done.has(s.id) ? 'Completed ✓' : 'Mark complete'}</button>${s.tool ? `<button class="text-btn" onclick="openTool('${s.tool}')">Open ${esc((HUB_TOOLS[s.tool] || { title: 'Career selector' }).title)} →</button>` : ''}${s.link ? `<button class="text-btn" onclick="document.getElementById('day1').scrollIntoView({behavior:'smooth'})">See the Day-1 agenda ↓</button>` : ''}</div></div></div>`).join('')}</div>
<div class="section-head" id="day1"><h2>First-day orientation agenda</h2><span class="eyebrow muted">TICK SESSIONS AS YOU GO</span></div>
<table class="agenda"><thead><tr><th>Time</th><th>Session</th><th>Outcome</th><th></th></tr></thead><tbody>${HUB_AGENDA.map(([t, s, o], i) => `<tr class="${s === 'Break' ? 'brk' : ''} ${hub.agenda.includes(i) ? 'done' : ''}"><td>${t}</td><td><b>${s}</b></td><td>${o}</td><td>${s === 'Break' ? '' : `<input type="checkbox" aria-label="Session complete" ${hub.agenda.includes(i) ? 'checked' : ''} onchange="hubAgenda(${i},this.checked)">`}</td></tr>`).join('')}</tbody></table>
<div class="row"><button class="btn" onclick="printSection('.agenda','First-day orientation agenda')">Print agenda</button><button class="btn secondary" onclick="hubAgendaCopy()">Copy as text</button></div>
<div class="note"><strong>For employers</strong><p>Before using this agenda, insert your emergency contacts, local procedures, approved training materials and designated trainers.</p></div>`;
  }
  window.hubStage = id => { const i = hub.stages.indexOf(id); if (i < 0) hub.stages.push(id); else hub.stages.splice(i, 1); saveHub(); onboardingPage(); };
  window.hubAgenda = (i, v) => { hub.agenda = hub.agenda.filter(x => x !== i); if (v) hub.agenda.push(i); saveHub(); };
  window.hubAgendaCopy = () => { const t = HUB_AGENDA.map(a => a.join(' · ')).join('\n'); navigator.clipboard?.writeText('First-day orientation agenda\n' + t).then(() => flash('Agenda copied'), () => flash('Copy is not available here')); };

  // ---------------------------------------------------------------- LEARNING
  function learningPage() {
    $('#view').innerHTML = `${crumbs([['hub', 'Hub'], [null, 'Videos & resources']])}
<h1>Videos and learning resources</h1><p class="muted">Pair each resource with a short activity. Videos support learning; they do not replace employer-required instruction or practical qualification.</p>
<div class="video-list">${HUB_VIDEOS.map(v => { const s = hub.videos[v.id] || {}; return `<article class="card video-card ${s.done ? 'done' : ''}"><div class="vc-head"><span class="play">▶</span><div><h3>${esc(v.title)}</h3><p class="small muted">Best for: ${esc(v.audience)}</p></div></div><p><b>Activity:</b> ${esc(v.activity)}</p><textarea placeholder="Your notes for this activity" oninput="hubVideoNote('${v.id}',this.value)">${esc(s.notes || '')}</textarea><div class="row"><a class="btn secondary" href="${L(v.link)}" target="_blank" rel="noopener">Open resource ↗</a><label class="check"><input type="checkbox" ${s.done ? 'checked' : ''} onchange="hubVideo('${v.id}',this.checked)"> Activity done</label></div>${v.linkNote ? `<p class="small muted">${esc(v.linkNote)}.</p>` : ''}</article>`; }).join('')}</div>
<p class="small muted">These official collections cover career exploration, surface awareness, cabin battery-fire training, dangerous goods and maintenance fatigue.</p>
<div class="section-head"><h2>Reference tools</h2></div>
<div class="grid">${HUB_REFERENCES.map(r => `<a class="card resource" href="${L(r.link)}" target="_blank" rel="noopener"><span class="num">REFERENCE ↗</span><h3>${esc(r.title)}</h3><p>${esc(r.text)}</p></a>`).join('')}</div>
<div class="note"><strong>Cabin cleaning</strong><p>For cabin cleaning, assign an employer-produced demonstration covering the actual aircraft, approved products and cleaning procedures.</p></div>`;
  }
  window.hubVideo = (id, v) => { hub.videos[id] = Object.assign(hub.videos[id] || {}, { done: v }); saveHub(); learningPage(); };
  window.hubVideoNote = (id, v) => { hub.videos[id] = Object.assign(hub.videos[id] || {}, { notes: v }); saveHub(); };

  // ---------------------------------------------------------------- SCENARIOS
  function scenariosPage() {
    const p = xr();
    $('#view').innerHTML = `${crumbs([['hub', 'Hub'], [null, 'Orientation scenarios']])}
<h1>Orientation scenarios</h1><p class="muted">Choose the response you would give. Each scenario is also hidden in the 3D lab, so you can find it on the ramp or in the cabin.</p>
<div class="scen-list">${HUB_SCENARIOS.map((s, i) => `<article class="card scen ${p.scenarios.includes(s.id) ? 'done' : ''}" id="sc-${s.id}"><span class="num">SCENARIO ${i + 1}${p.scenarios.includes(s.id) ? ' · COMPLETE ✓' : ''}</span><h3>${esc(s.title)}</h3>${s.options.map((o, k) => `<button class="answer" onclick="hubAnswer('${s.id}',${k},this)">${'ABC'[k]} &nbsp; ${esc(o)}</button>`).join('')}<div class="feedback" aria-live="polite"></div><div class="row">${xrButton(s.xr, s.xr === 'ramp' ? 'Find it on the ramp' : 'Find it in the cabin')}</div></article>`).join('')}</div>`;
  }
  window.hubAnswer = (id, k, el) => {
    const s = HUB_SCENARIOS.find(x => x.id === id), card = document.getElementById('sc-' + id);
    card.querySelectorAll('.answer').forEach((b, i) => { b.classList.toggle('correct', i === s.correct && k === s.correct); b.classList.toggle('wrong', i === k && k !== s.correct); });
    card.querySelector('.feedback').innerHTML = k === s.correct ? `<p><b>Expected response.</b> ${esc(s.why)}</p>` : '<p><b>Not the safest choice.</b> Think about who could be hurt and who is qualified to act, then try again.</p>';
    if (k === s.correct) { const p = xr(); if (!p.scenarios.includes(id)) { p.scenarios.push(id); saveXR(p); } card.classList.add('done'); }
  };

  // ---------------------------------------------------------------- JOBS
  function jobsPage() {
    $('#view').innerHTML = `${crumbs([['hub', 'Hub'], [null, 'Job search']])}
<h1>Job-search links</h1><p class="muted">These are employer career portals, not a claim that a particular local vacancy is available.</p>
<div class="grid">${HUB_JOBS.map(j => `<a class="card resource" href="${L(j.link)}" target="_blank" rel="noopener"><span class="num">CAREER PORTAL ↗</span><h3>${esc(j.title)}</h3><p>${esc(j.text)}</p></a>`).join('')}</div>
<div class="note"><strong>Before you apply</strong><p>Check the posting’s minimum requirements, schedule, physical demands and location, then log it in your <button class="text-btn" onclick="openTool('tracker')">application tracker</button>.</p></div>`;
  }

  // ---------------------------------------------------------------- TOOLS
  let toolKey = null, editIndex = -1;
  window.openTool = (k) => { toolKey = k; editIndex = -1; go('tools'); };
  function toolsPage() {
    if (toolKey === 'selector') return selectorPage();
    if (toolKey && HUB_TOOLS[toolKey]) return toolPage(toolKey);
    $('#view').innerHTML = `${crumbs([['hub', 'Hub'], [null, 'Practical tools']])}
<h1>Practical tools</h1><p class="muted">Ready-to-use fields for job seekers, new hires, trainers and supervisors. Records are saved in this browser only. Export them as a spreadsheet file or print them.</p>
<div class="tool-grid"><button class="tool-tile" onclick="openTool('selector')"><span>⌖</span><b>Career selector</b><small>Preferred work, shifts, location, qualifications and interests → suggested roles.</small></button>
${Object.entries(HUB_TOOLS).map(([k, t]) => `<button class="tool-tile" onclick="openTool('${k}')"><span>${t.icon}</span><b>${t.title}</b><small>${t.blurb}</small><em>${(hub.tools[k] || []).length} saved</em></button>`).join('')}</div>
<div class="note"><strong>Four learning statuses</strong><p>${HUB_STATUSES.join(' → ')}. Record course completion and operational authorization separately.</p></div>`;
  }

  function selectorPage() {
    const s = hub.selector;
    s.work ||= []; s.shifts ||= []; s.quals ||= []; s.interests ||= [];
    const chips = (key, list) => list.map(x => { const [v, t] = Array.isArray(x) ? x : [x, x]; return `<button class="chip ${s[key].includes(v) ? 'on' : ''}" onclick="hubSel('${key}','${esc(v).replace(/'/g, '&#39;')}')">${esc(t)}</button>`; }).join('');
    // scoring
    const scores = HUB_ENTRY_ROLES.map(r => {
      let sc = 0;
      s.work.forEach(w => { if (r.prefs.includes(w)) sc += 3; });
      const int = s.interests;
      if (int.includes('Safety')) sc += 1;
      if (int.includes('Customer service') && ['fa', 'gate', 'cleaner'].includes(r.id)) sc += 2;
      if (int.includes('Logistics') && ['cargo', 'ramp'].includes(r.id)) sc += 2;
      if (int.includes('Maintenance') && ['apprentice', 'cleaner'].includes(r.id)) sc += 2;
      if (s.quals.includes('Warehouse / forklift experience') && r.id === 'cargo') sc += 2;
      if (s.quals.includes('Mechanical or technical training') && r.id === 'apprentice') sc += 2;
      if (s.quals.includes('Customer service experience') && ['gate', 'fa'].includes(r.id)) sc += 2;
      if (s.quals.includes('Valid driver’s license') && ['ramp', 'cargo'].includes(r.id)) sc += 1;
      if (s.quals.includes('A second language') && ['gate', 'fa'].includes(r.id)) sc += 1;
      return { r, sc };
    }).sort((a, b) => b.sc - a.sc);
    const max = Math.max(1, scores[0].sc);
    $('#view').innerHTML = `${crumbs([['hub', 'Hub'], ['tools', 'Practical tools'], [null, 'Career selector']])}
<h1>Career selector</h1><p class="muted">Choose what fits you. Suggestions update as you go. They’re a starting point for research, not a hiring assessment.</p>
<div class="selector"><div class="sel-form">
<h4>Preferred work</h4><div class="chips">${chips('work', HUB_SELECTOR.work)}</div>
<h4>Shift availability</h4><div class="chips">${chips('shifts', HUB_SELECTOR.shifts)}</div>
<h4>Location</h4><input class="txt" placeholder="City or airport, e.g. Atlanta (ATL)" value="${esc(s.location || '')}" oninput="hubSelText('location',this.value)">
<h4>Existing qualifications</h4><div class="chips">${chips('quals', HUB_SELECTOR.quals)}</div>
<h4>Training interests</h4><div class="chips">${chips('interests', HUB_SELECTOR.interests)}</div>
</div><div class="sel-results"><h3>Roles to research first</h3>${scores.map(({ r, sc }) => `<div class="match"><div class="mbar"><i style="width:${Math.round(sc / max * 100)}%"></i></div><b>${esc(r.title)}</b><small>${esc(r.does)}</small><div class="row"><button class="text-btn" onclick="go('paths')">Details →</button><button class="text-btn" onclick="hubTrack('${esc(r.title)}')">+ Add to tracker</button></div></div>`).join('')}
${s.interests.includes('Maintenance') || s.quals.includes('Mechanical or technical training') ? `<p class="note-inline small">Interested in maintenance? See all ${typeof MX_ROLES === 'object' ? MX_ROLES.length : ''} <button class="text-btn" onclick="go('mxcareers')">aviation maintenance careers →</button></p>` : ''}<p class="small muted">Your choices are saved in this browser.${s.location ? ' Search employer portals for roles near ' + esc(s.location) + '.' : ''}</p></div></div>`;
  }
  window.hubSel = (k, v) => { const a = hub.selector[k]; const i = a.indexOf(v); if (i < 0) a.push(v); else a.splice(i, 1); saveHub(); selectorPage(); };
  window.hubSelText = (k, v) => { hub.selector[k] = v; saveHub(); };
  window.hubTrack = (role) => { hub.tools.tracker ||= []; hub.tools.tracker.push({ role, status: 'Researching', location: hub.selector.location || '' }); saveHub(); flash('Added to your application tracker'); };

  function field(f, val) {
    const [key, lab, type = 'text', opts] = f;
    const v = esc(val ?? '');
    if (type === 'textarea') return `<label>${lab}<textarea name="${key}">${v}</textarea></label>`;
    if (type === 'select') return `<label>${lab}<select name="${key}">${opts.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    return `<label>${lab}<input name="${key}" type="${type}" value="${v}" ${type === 'number' ? 'step="0.25" min="0"' : ''}></label>`;
  }
  function toolPage(k) {
    const t = HUB_TOOLS[k], rows = hub.tools[k] || [];
    const editing = editIndex >= 0 ? rows[editIndex] : {};
    const cols = t.fields.slice(0, 5);
    const total = k === 'mxlog' ? rows.reduce((s, r) => s + (+r.hours || 0), 0) : null;
    $('#view').innerHTML = `${crumbs([['hub', 'Hub'], ['tools', 'Practical tools'], [null, t.title]])}
<h1>${t.title}</h1><p class="muted">${t.blurb}</p>
<form class="tool-form card" onsubmit="hubSave(event,'${k}')"><h3>${editIndex >= 0 ? 'Edit record' : 'New record'}</h3><div class="fields">${t.fields.map(f => field(f, editing[f[0]])).join('')}</div><div class="row"><button class="btn" type="submit">${editIndex >= 0 ? 'Save changes' : 'Add record'}</button>${editIndex >= 0 ? '<button class="btn secondary" type="button" onclick="hubCancel()">Cancel</button>' : ''}</div></form>
<div class="section-head"><h2>Saved records (${rows.length})</h2><div class="row"><button class="btn secondary" onclick="hubCSV('${k}')">Export CSV</button><button class="btn secondary" onclick="printSection('.records','${t.title}')">Print</button></div></div>
${total !== null ? `<p class="muted">Total practical time logged: <b>${total.toFixed(2)} hours</b>. Keep supervisor validation for every entry.</p>` : ''}
<div class="records">${rows.length ? `<table class="data"><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map((r, i) => `<tr>${cols.map(c => `<td>${c[2] === 'url' && r[c[0]] ? `<a href="${esc(r[c[0]])}" target="_blank" rel="noopener">Link ↗</a>` : esc(r[c[0]] || '—')}</td>`).join('')}<td class="act"><button class="text-btn" onclick="hubEdit(${i})">Edit</button> <button class="text-btn danger" onclick="hubDel('${k}',${i})">Delete</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No records yet. Add your first one above.</p>'}</div>
${k === 'competency' ? `<div class="note"><strong>Learning statuses</strong><p>${HUB_STATUSES.join(' → ')}. Course completion and operational authorization should be recorded separately.</p></div>` : ''}
${k === 'mxlog' ? `<div class="note"><strong>Why this log matters</strong><p>${esc(HUB_ENTRY_ROLES.find(r => r.id === 'apprentice').note)} ${ext('mechanicExp', 'FAA experience requirements')}</p></div>` : ''}`;
  }
  window.hubSave = (e, k) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    hub.tools[k] ||= [];
    if (editIndex >= 0) hub.tools[k][editIndex] = data; else hub.tools[k].push(data);
    editIndex = -1; saveHub(); toolPage(k); flash('Saved');
  };
  window.hubEdit = i => { editIndex = i; toolPage(toolKey); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  window.hubCancel = () => { editIndex = -1; toolPage(toolKey); };
  window.hubDel = (k, i) => { hub.tools[k].splice(i, 1); saveHub(); toolPage(k); flash('Record deleted'); };
  window.hubCSV = k => {
    const t = HUB_TOOLS[k], rows = hub.tools[k] || [];
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [t.fields.map(f => q(f[1])).join(','), ...rows.map(r => t.fields.map(f => q(r[f[0]])).join(','))].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.csv';
    document.body.append(a); a.click(); a.remove();
  };
  window.printSection = (sel, title) => {
    const el = document.querySelector(sel); if (!el) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { window.print(); return; }
    w.document.write(`<!doctype html><title>${esc(title)}</title><style>body{font:13px system-ui;padding:24px;color:#1b2b39}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd;padding:6px 8px;text-align:left;vertical-align:top}textarea{width:100%;border:1px solid #ccd;min-height:50px}.gap-item{margin:10px 0}button,input[type=checkbox]{display:none}</style><h2>${esc(title)}</h2>${el.outerHTML}<p style="font-size:10px;color:#667">First Flight · Aviation Careers & New-Hire Learning Hub</p>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };
  function flash(msg) { let t = document.getElementById('hubToast'); if (!t) { t = document.createElement('div'); t.id = 'hubToast'; document.body.append(t); } t.textContent = msg; t.classList.add('show'); clearTimeout(flash.t); flash.t = setTimeout(() => t.classList.remove('show'), 2200); }

  // ---------------------------------------------------------------- XR LAB PAGE
  const STATIONS = [
    ['hangar', 'Systems lab', 'Reveal the engine, fuel and electrical systems; run a tool-control check.', 'lab-hangar'],
    ['walkaround', 'Preflight walkaround', 'Eight learning stations around a training airplane.', 'lab-walkaround'],
    ['ramp', 'Ramp & cargo safety', 'Walk Stand 7, pick up FOD, see danger zones and solve six scenarios.', 'ramp-agent'],
    ['cabin', 'Cabin safety & appearance', 'Clear the cabin, locate safety equipment and handle cabin scenarios.', 'cabin-cleaner'],
    ['flight', 'Fly', 'Four missions over six realistic regions from a detailed cockpit.', 'lab-flight'],
  ];
  function labProgress() {
    const p = xr();
    const el = document.getElementById('labStats');
    if (el) el.innerHTML = `<span><b>${p.fod.length}/10</b> FOD found</span><span><b>${p.scenarios.length}/11</b> scenarios</span><span><b>${p.cabin.length}/14</b> cabin tasks</span><span><b>${p.walkaround.length}/8</b> walkaround</span><span><b>${p.missions.length}/4</b> missions</span>`;
  }
  sim = function () {
    let launch = 'hangar';
    try { const l = localStorage.getItem('academy-launch'); if (l) launch = ({ flight: 'flight', preflight: 'walkaround', engine: 'hangar:engine', fuel: 'hangar:fuel', electrical: 'hangar:electrical' })[l] || l; } catch { /* ignore */ }
    try { const w = localStorage.getItem('flight-world'); if (launch === 'flight' && w) launch = 'flight:' + w; localStorage.removeItem('academy-launch'); } catch { /* ignore */ }
    $('#view').innerHTML = `
<div class="lab-head"><div><span class="eyebrow muted">XR TRAINING LAB · THREE.JS + WEBXR</span><h1>Practice aviation work in 3D and VR.</h1><p class="muted">Five stations built with physically based materials, real-world HDR lighting and a realistic sky. Works with a mouse, touch screen or a WebXR headset such as Meta Quest.</p></div><a class="btn secondary" href="lab.html#${launch}" target="_blank" rel="noopener">Open full screen ↗</a></div>
<div class="lab-frame"><iframe id="flight3d" title="First Flight XR training lab" src="lab.html#${launch}" allow="xr-spatial-tracking; fullscreen; gamepad; autoplay" allowfullscreen></iframe></div>
<div class="lab-stats" id="labStats"></div>
<div class="station-grid">${STATIONS.map(([k, t, d, im], i) => `<button class="station" onclick="labGo('${k}')">${img(im, t)}<span><em>0${i + 1}</em><b>${t}</b><small>${d}</small></span></button>`).join('')}</div>
<div class="three-notes">
  <div class="card"><span class="num">DESKTOP & MOBILE</span><h3>Look, walk, select</h3><p>Drag to look or orbit. On the ramp and in the cabin use W A S D or the arrow keys, or click the ground to walk there. Select glowing markers, litter and FOD. When flying, use the arrow keys or on-screen pad; set power with + / − or the slider. Press C for the outside view.</p></div>
  <div class="card"><span class="num">VR HEADSET</span><h3>Enter VR</h3><p>Open this page in your headset’s browser and choose <b>Enter VR</b>. The menu panel rides on your left controller: point at it with the right controller and pull the trigger. X shows or hides it, Y opens Stations. The right stick teleports (push forward) and turns; the left stick walks. In flight the left stick flies, the right stick sets power, A starts the engine and B recenters your seat. Comfort options are on the panel.</p></div>
  <div class="card"><span class="num">AR (SUPPORTED DEVICES)</span><h3>View in your space</h3><p>On AR-capable devices, <b>View in your space</b> places a tabletop model of the training airplane in front of you. The lab is a simplified educational model, not a certified simulator or training device.</p></div>
</div>
<h2>Gallery</h2><p class="muted">Every scene below was rendered live in the First Flight engine.</p>
<div class="gallery">${[['region-alpine', 'Cockpit view over the Alpine Lakes'], ['hub-hero', 'Stand 7 at the terminal'], ['cabin-manager', 'Cabin from the rear galley'], ['lab-engine', 'Exploded engine in the systems lab'], ['region-canyon', 'Red Rock Canyon'], ['safety', 'Engine hazard areas on the ramp']].map(([k, t]) => `<figure>${img(k, t)}<figcaption>${t}</figcaption></figure>`).join('')}</div>`;
    labProgress();
  };
  window.labGo = (key) => {
    const f = document.getElementById('flight3d');
    f.contentWindow?.postMessage({ type: 'ff-go', key }, location.origin);
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ---------------------------------------------------------------- AR AIRCRAFT EXPLORER
  const AR_MODELS = [['trainer', 'Training airplane'], ['piston', 'Piston engine & propeller'], ['wing', 'Wing structure'], ['tail', 'Tail (empennage)'], ['gear', 'Landing gear'], ['panel', 'Instrument panel'], ['airliner', 'Narrow-body airliner'], ['turbofan', 'Turbofan engine (cutaway)'], ['jetgear', 'Airliner main landing gear']];
  function arPage() {
    $('#view').innerHTML = `
<div class="lab-head"><div><span class="eyebrow muted">AUGMENTED REALITY · THREE.JS + WEBXR</span><h1>Put an airplane on your desk.</h1><p class="muted">Nine detailed 3D models of a training airplane, an airliner and their key parts. Explode them, tap the numbered labels to learn each part, then place them in your room with augmented reality, at tabletop size or full size.</p></div><a class="btn" href="ar.html" target="_blank" rel="noopener">Open the AR explorer ↗</a></div>
<div class="lab-frame"><iframe id="arFrame" title="First Flight AR aircraft explorer" src="ar.html" allow="xr-spatial-tracking; fullscreen" allowfullscreen style="width:100%;height:min(76vh,760px);min-height:520px;border:0;display:block"></iframe></div>
<div class="station-grid" style="margin-top:16px">${AR_MODELS.map(([k, t]) => `<button class="station" onclick="arModel('${k}')"><img src="assets/renders/ar-${k}.jpg" alt="" loading="lazy" onerror="this.src='assets/renders/lab-engine.jpg'"><span><b>${t}</b></span></button>`).join('')}</div>
<div class="three-notes">
  <div class="card"><span class="num">ANDROID</span><h3>Chrome on ARCore phones</h3><p>Tap <b>View in AR</b>, move the phone to find a table or the floor, then tap to place. Buttons rotate, resize, show the real size, explode the model and switch labels.</p></div>
  <div class="card"><span class="num">IPHONE & IPAD</span><h3>Safari with AR Quick Look</h3><p>Tap <b>View in AR</b> and the model opens in Apple’s AR viewer. Pinch to resize, drag to move, and switch between tabletop and real size.</p></div>
  <div class="card"><span class="num">META QUEST</span><h3>Passthrough mixed reality</h3><p>Open the explorer in the Quest Browser and tap <b>View in AR</b>. Pull the trigger to place the model; the thumbstick rotates and resizes; A explodes; B shows labels.</p></div>
</div>`;
  }
  window.arModel = k => { const f = document.getElementById('arFrame'); try { f.contentWindow.ffAR.load(k); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { f.src = 'ar.html?model=' + k; } };

  // ---------------------------------------------------------------- resources page: keep supplied references
  const baseResources = resources;
  resources = function () {
    baseResources();
    $('#view').insertAdjacentHTML('beforeend', `<div class="note"><strong>Careers & new-hire resources</strong><p>For FAA, IATA, OSHA and NATA resources for ramp, cargo, cabin and maintenance roles, see <button class="text-btn" onclick="go('learning')">Videos & resources</button> in the careers hub.</p></div>`);
  };

  // ---------------------------------------------------------------- router
  const PAGES = { ar: arPage, hub: hubPage, new: newPage, experienced: experiencedPage, paths: pathsPage, onboarding: onboardingPage, learning: learningPage, scenarios: scenariosPage, jobs: jobsPage, tools: toolsPage };
  const prev = render;
  render = function () {
    document.body.dataset.page = page;
    if (page !== 'tools') toolKey = null;
    if (PAGES[page]) PAGES[page]();
    else prev();
  };
  // Older pages and links that still point to the 3D cockpit
  window.addEventListener('hashchange', () => { const p = location.hash.slice(1); if (PAGES[p] && p !== page) go(p); });
  const initial = window.__ffHash || location.hash.slice(1);
  if (PAGES[initial] || initial === 'sim' || initial === 'home' || !initial) go(initial || 'home'); else render();
})();

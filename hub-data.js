// Aviation Careers & New-Hire Learning Hub — content (U.S.-focused framework).
// Source notes reviewed October 2026. Requirements vary by employer and posting.
const HUB_LINKS = {
  faaVideos: 'https://www.faa.gov/education/photo_videogallery',
  flightDeck: 'https://www.faa.gov/airports/runway_safety/videos',
  pedFire: 'https://www.faa.gov/hazmat/air_carriers/resources',
  iataDG: 'https://www.iata.org/en/training/media/dgr-videos',
  grounded: 'https://www.faa.gov/about/initiatives/maintenance_hf/fatigue',
  osha: 'https://www.osha.gov/etools/baggage-handling',
  nata: 'https://nata.aero/nata-safety-1st/',
  mxhf: 'https://www.faa.gov/about/initiatives/maintenance_hf',
  sms: 'https://www.faa.gov/about/initiatives/sms',
  bls: 'https://www.bls.gov/ooh/installation-maintenance-and-repair/aircraft-and-avionics-equipment-mechanics-and-technicians.htm',
  dispatch: 'https://www.faa.gov/sites/faa.gov/files/part65.pdf',
  mechanic: 'https://www.faa.gov/mechanics/become',
  mechanicExp: 'https://www.faa.gov/mechanics/become/experience',
  deltaACS: 'https://www.delta.com/us/en/careers/airport-customer-service-cargo-careers',
  deltaFA: 'https://www.delta.com/us/en/careers/flight-attendant-careers',
  united: 'https://careers.united.com/',
};

const HUB_ENTRY_ROLES = [
  { id: 'ramp', title: 'Ramp Service Agent', img: 'ramp-agent', prefs: ['outdoors'], xr: 'ramp',
    does: 'Load and unload baggage, support aircraft arrivals and departures, and operate equipment after qualification.',
    learn: ['Foreign object debris (FOD)', 'Aircraft danger zones', 'Baggage handling', 'Communication', 'Equipment inspections', 'Local driving rules'],
    ladder: ['Ramp lead', 'Supervisor', 'Station operations manager'] },
  { id: 'cargo', title: 'Air-Cargo / Material Handler', img: 'cargo', prefs: ['warehouse', 'outdoors'], xr: 'ramp',
    does: 'Receive, scan, sort, track, and prepare freight for movement.',
    learn: ['Shipment accuracy', 'Damaged-package reporting', 'Dangerous goods awareness', 'Warehouse safety', 'Equipment authorization'],
    ladder: ['Cargo lead', 'Cargo supervisor', 'Logistics or cargo operations manager'] },
  { id: 'cleaner', title: 'Aircraft Detail / Cabin Cleaner Technician', img: 'cabin-cleaner', prefs: ['passenger', 'technical'], xr: 'cabin',
    does: 'Clean and prepare cabins; some positions also include exterior detailing.',
    learn: ['Approved chemicals and surfaces', 'Safety data sheets', 'PPE', 'FOD', 'Lost-property procedures', 'Damage reporting'],
    ladder: ['Team lead', 'Cabin quality inspector', 'Cabin services manager'] },
  { id: 'fa', title: 'Flight Attendant', img: 'flight-attendant', prefs: ['passenger'], xr: 'cabin',
    does: 'Protect passenger safety, conduct cabin duties, provide service, and respond to emergencies.',
    learn: ['Airline initial training', 'Emergency procedures', 'Crew communication', 'Passenger assistance', 'Aircraft-specific qualifications'],
    ladder: ['Lead / purser where offered', 'Instructor', 'Inflight supervisor'],
    note: 'Candidates may enter without previous flying experience, but must complete the airline’s required training and qualification process. Delta currently describes seven weeks of onsite initial training in Atlanta; other employers differ.', noteLink: 'deltaFA' },
  { id: 'apprentice', title: 'Aviation Repair / Apprentice Technician', img: 'technician', prefs: ['technical'], xr: 'hangar',
    does: 'Assist with maintenance or component work within the employer’s authorized supervision structure.',
    learn: ['Tool control', 'Technical documentation', 'Maintenance human factors', 'Accurate records', 'Supervised practical skills'],
    ladder: ['Qualifying experience or school', 'Relevant certification', 'Technician', 'Lead'],
    note: 'An apprentice title does not automatically establish eligibility for an FAA mechanic certificate. The FAA offers school and qualifying practical-experience pathways. The experience route generally requires 18 months for one rating or 30 months concurrently for both Airframe and Powerplant ratings, plus the required testing. Document the work performed, time spent and supervisor validation.', noteLink: 'mechanicExp' },
  { id: 'gate', title: 'Ticket / Gate Agent', img: 'gate-agent', prefs: ['passenger'], xr: 'cabin',
    does: 'Assist with check-in, boarding, reservations, and travel disruptions.',
    learn: ['Customer service', 'Accessibility assistance', 'Airline systems', 'Documentation', 'Escalation procedures'],
    ladder: ['Lead agent', 'Customer service supervisor', 'Station management'] },
];

const HUB_SPECIALIST_ROLES = [
  { title: 'Ramp / Ground Operations Supervisor', img: 'ramp-supervisor', does: 'Assign work, coordinate turnarounds, coach staff, and manage operational disruptions.', focus: 'Staffing, incident reporting, competency assessment, and equipment readiness' },
  { title: 'Cargo Operations Supervisor', img: 'cargo-supervisor', does: 'Oversee freight flow, documentation, warehouse teams, and exceptions.', focus: 'Dangerous goods responsibilities, shipment traceability, and operational planning' },
  { title: 'Cabin Services / Aircraft Appearance Manager', img: 'cabin-manager', does: 'Manage cleaning standards, inspections, staffing, supplies, and service delivery.', focus: 'Quality assurance, chemical controls, vendor management, and training' },
  { title: 'A&P Mechanic / Lead Technician', img: 'ap-mechanic', does: 'Perform maintenance within qualifications and privileges; coordinate technical work.', focus: 'Aircraft-specific training, troubleshooting, documentation, and leadership', link: 'bls' },
  { title: 'Avionics Technician', img: 'avionics', does: 'Diagnose and service electronic, communication, navigation, and instrument systems.', focus: 'Electronics, approved technical data, specialized testing, and employer qualifications', link: 'bls' },
  { title: 'Flight Attendant Instructor / Inflight Supervisor', img: 'fa-instructor', does: 'Train or support cabin crews and maintain service and safety standards.', focus: 'Instruction, assessment, crew leadership, and recurrent training' },
  { title: 'Aircraft Dispatcher', img: 'dispatcher', does: 'Support flight planning and operational control within the operator’s procedures.', focus: 'A separate FAA certification pathway, weather, planning, and operational decision-making', link: 'dispatch' },
  { title: 'Airport / Station Operations Manager', img: 'station-manager', does: 'Coordinate departments, contractors, staffing, and operational performance.', focus: 'Emergency planning, budgets, safety systems, and cross-functional leadership' },
  { title: 'Safety / Training Specialist', img: 'safety', does: 'Support hazard reporting, training records, investigations, and corrective actions.', focus: 'Safety management systems, human factors, auditing, and instructional design', link: 'sms' },
];

const HUB_VIDEOS = [
  { id: 'v-careers', title: 'FAA Aviation Career Videos', audience: 'New entrants and career changers', activity: 'Select two careers and identify three transferable skills.', link: 'faaVideos' },
  { id: 'v-deck', title: 'FAA “From the Flight Deck” video series', audience: 'Operations teams and airside staff', activity: 'Discuss airport layout and surface hazards. These videos use a pilot perspective; add local driver training.', link: 'flightDeck' },
  { id: 'v-ped', title: 'FAA Portable Electronic Device Fire Training: Cabin', audience: 'Flight attendants; awareness for cabin teams', activity: 'Review reporting and assigned responsibilities using the airline’s procedures.', link: 'pedFire', linkNote: 'Listed on the FAA OperateSafe resources page' },
  { id: 'v-dg', title: 'IATA Dangerous Goods videos', audience: 'Cargo, ramp, and logistics staff', activity: 'Identify situations that require referral to a qualified dangerous goods specialist.', link: 'iataDG' },
  { id: 'v-fatigue', title: 'FAA “Grounded” fatigue awareness', audience: 'Maintenance teams; useful discussion for shift workers', activity: 'Discuss fatigue-related errors and the employer’s reporting process.', link: 'grounded', linkNote: 'Listed on the FAA maintenance fatigue page' },
];

const HUB_REFERENCES = [
  { title: 'OSHA Baggage Handling eTool', text: 'Task-based guidance on baggage-handling hazards and possible controls.', link: 'osha' },
  { title: 'NATA Safety 1st', text: 'Structured ground-handling and fueling training. Confirm employer access and applicable course costs.', link: 'nata' },
  { title: 'FAA Maintenance Human Factors', text: 'Resources for maintenance performance, communication, and error prevention.', link: 'mxhf' },
  { title: 'FAA Safety Management Systems', text: 'Background for supervisors, safety specialists, and managers.', link: 'sms' },
];

const HUB_STAGES = [
  { id: 'explore', stage: 'Career exploration', when: 'Before you apply', act: 'Compare roles, schedules, physical demands, location, and qualifications.', evidence: 'Selected role and personal skills-gap checklist', tool: 'selector' },
  { id: 'apply', stage: 'Application preparation', when: 'Before you apply', act: 'Tailor your résumé; prepare examples of teamwork, reliability, customer service, and following procedures.', evidence: 'Application tracker and interview examples', tool: 'tracker' },
  { id: 'pre', stage: 'Preboarding', when: 'After an offer', act: 'Complete employer-requested documents and screening; receive arrival instructions, schedule, and mentor contact.', evidence: 'HR checklist; access status recorded' },
  { id: 'day1', stage: 'Day 1', when: 'First day', act: 'Complete orientation, meet the team, locate emergency resources, and review reporting procedures.', evidence: 'Orientation checklist', link: 'day1' },
  { id: 'd2', stage: 'Days 2–5', when: 'First week', act: 'Complete foundational modules, observe qualified staff, and begin role-specific instruction.', evidence: 'Knowledge checks and trainer observations', tool: 'passport' },
  { id: 'd30', stage: 'Days 6–30', when: 'First month', act: 'Perform assigned tasks under supervision; receive regular feedback.', evidence: 'Task-by-task competency record', tool: 'competency' },
  { id: 'd60', stage: 'Days 31–60', when: 'Second month', act: 'Build consistency on authorized duties and address gaps.', evidence: 'Supervisor review and updated development plan', tool: 'review' },
  { id: 'd90', stage: 'Days 61–90', when: 'Third month', act: 'Review performance, remaining qualifications, and career interests.', evidence: 'Documented authorization scope and next learning goals', tool: 'review' },
];

const HUB_AGENDA = [
  ['9:00–9:30', 'Welcome and aviation overview', 'Understand the employer, customers, and role'],
  ['9:30–10:15', 'Employment essentials', 'Understand schedules, attendance, payroll, conduct, and support contacts'],
  ['10:15–10:30', 'Break', '—'],
  ['10:30–11:15', 'Security and access', 'Understand badge responsibilities, permitted areas, and reporting'],
  ['11:15–12:00', 'Safety foundations', 'Recognize FOD, PPE needs, hazards, and escalation procedures'],
  ['12:00–12:45', 'Lunch and mentor introduction', 'Establish a support relationship'],
  ['12:45–1:30', 'Guided workplace tour', 'Locate work areas, exits, muster points, and emergency equipment'],
  ['1:30–2:15', 'Role-specific introduction', 'Understand duties, limits, and required qualifications'],
  ['2:15–2:30', 'Break', '—'],
  ['2:30–3:15', 'Assigned video and scenarios', 'Apply introductory learning'],
  ['3:15–4:00', 'Systems and communication', 'Access learning, scheduling, and reporting tools'],
  ['4:00–4:30', 'Knowledge check and next steps', 'Confirm understanding and the first-week plan'],
];

const HUB_SCENARIOS = [
  { id: 'ramp-object', xr: 'ramp', title: 'You find an unidentified object near an aircraft.', options: ['Kick it out of the way and keep working', 'Recognize the potential FOD hazard and follow local reporting/removal procedures within your access and training limits', 'Leave it for maintenance to find later'], correct: 1, why: 'Recognize the potential FOD hazard and follow local reporting/removal procedures within your access and training limits.' },
  { id: 'ramp-equipment', xr: 'ramp', title: 'Someone asks you to use equipment you have not been qualified to operate.', options: ['Use it carefully because it looks simple', 'Explain the limitation and request a qualified operator or trainer', 'Ask another new hire to do it'], correct: 1, why: 'Explain the limitation and request a qualified operator or trainer.' },
  { id: 'ramp-leak', xr: 'ramp', title: 'A cargo package appears damaged or is leaking.', options: ['Wipe it down and keep loading', 'Stop handling it and notify the designated supervisor or dangerous goods contact under local procedures', 'Open it to see what is inside'], correct: 1, why: 'Stop handling it and notify the designated supervisor or dangerous goods contact under local procedures.' },
  { id: 'cab-unlabeled', xr: 'cabin', title: 'A cleaning product is unlabeled.', options: ['Use it if it smells familiar', 'Do not use it; obtain an approved, correctly identified product and applicable safety information', 'Label it yourself with your best guess'], correct: 1, why: 'Do not use it; obtain an approved, correctly identified product and applicable safety information.' },
  { id: 'ramp-clarify', xr: 'ramp', title: 'You do not understand an instruction.', options: ['Guess based on what usually happens', 'Ask for clarification before proceeding', 'Wait until someone else does it'], correct: 1, why: 'Ask for clarification before proceeding.' },
  { id: 'ramp-transfer', xr: 'ramp', title: 'An experienced employee joins a new station.', options: ['They start immediately because authorizations carry over', 'Verify previous qualifications, complete local orientation, and assess equipment- and task-specific competence before authorization', 'Skip orientation because procedures are similar everywhere'], correct: 1, why: 'Verify previous qualifications, complete local orientation, and assess equipment- and task-specific competence before authorization.' },
];

const HUB_GAP = [
  { id: 'g-cred', text: 'Verified credentials, relevant experience, and training currency.' },
  { id: 'g-diff', text: 'Differences in aircraft, equipment, software, and procedures.' },
  { id: 'g-access', text: 'Local airport access and driving permissions.' },
  { id: 'g-emerg', text: 'Emergency arrangements and safety-reporting systems.' },
  { id: 'g-practical', text: 'Practical assessment for assigned duties.' },
  { id: 'g-lead', text: 'Leadership expectations and coaching responsibilities where applicable.' },
];

const HUB_STATUSES = ['Not started', 'Learning', 'Supervised practice', 'Authorized for the specified task'];

// Practical tools: field definitions drive the shared record editor.
const HUB_TOOLS = {
  tracker: { title: 'Application tracker', icon: '▦', blurb: 'Track every application and follow-up in one place.',
    fields: [['employer', 'Employer'], ['role', 'Role'], ['location', 'Location'], ['posting', 'Posting link', 'url'], ['minimum', 'Minimum requirements', 'textarea'], ['applied', 'Application date', 'date'], ['status', 'Status', 'select', ['Researching', 'Applied', 'Assessment', 'Interview', 'Offer', 'Not selected', 'Withdrawn']], ['followup', 'Follow-up date', 'date']] },
  passport: { title: 'Training passport', icon: '▣', blurb: 'One record per module: what you completed, which revision, and when it renews.',
    fields: [['employee', 'Employee'], ['role', 'Role'], ['module', 'Module'], ['revision', 'Procedure revision'], ['date', 'Date', 'date'], ['result', 'Assessment result', 'select', ['Pass', 'Needs review', 'Not assessed']], ['instructor', 'Instructor'], ['renewal', 'Renewal date (where applicable)', 'date']] },
  competency: { title: 'Practical competency checklist', icon: '✓', blurb: 'Course completion and operational authorization are recorded separately.',
    fields: [['task', 'Task'], ['demo', 'Observed demonstration', 'date'], ['practice', 'Supervised practice', 'textarea'], ['status', 'Learning status', 'select', HUB_STATUSES], ['result', 'Assessment result', 'select', ['Not assessed', 'Competent', 'Not yet competent']], ['evaluator', 'Evaluator'], ['restrictions', 'Restrictions', 'textarea'], ['authorized', 'Authorization date', 'date']] },
  mxlog: { title: 'Maintenance experience log', icon: '⚙', blurb: 'Document work performed, time spent and supervisor validation.',
    fields: [['date', 'Date', 'date'], ['aircraft', 'Aircraft / component'], ['task', 'Exact task', 'textarea'], ['hours', 'Practical time (hours)', 'number'], ['supervisor', 'Supervising mechanic'], ['validation', 'Validation', 'select', ['Pending', 'Validated', 'Returned for correction']]] },
  handover: { title: 'Shift handover form', icon: '⇄', blurb: 'Hand over the shift clearly and get an acknowledgement.',
    fields: [['shift', 'Shift / date'], ['open', 'Open tasks', 'textarea'], ['equipment', 'Equipment issues', 'textarea'], ['hazards', 'Reported hazards', 'textarea'], ['changes', 'Operational changes', 'textarea'], ['responsible', 'Responsible person'], ['ack', 'Acknowledgement (name / time)']] },
  review: { title: '30 / 60 / 90-day review', icon: '◷', blurb: 'Capture progress and agree actions at each checkpoint.',
    fields: [['checkpoint', 'Checkpoint', 'select', ['30 days', '60 days', '90 days']], ['progress', 'Progress', 'textarea'], ['strengths', 'Strengths', 'textarea'], ['gaps', 'Training gaps', 'textarea'], ['feedback', 'Employee feedback', 'textarea'], ['actions', 'Actions', 'textarea'], ['owner', 'Owner'], ['due', 'Due date', 'date']] },
};

const HUB_SELECTOR = {
  work: [['passenger', 'Passenger-facing'], ['outdoors', 'Outdoors'], ['warehouse', 'Warehouse'], ['technical', 'Technical']],
  shifts: ['Early mornings', 'Days', 'Evenings', 'Overnight', 'Weekends', 'Rotating'],
  quals: ['High school diploma or equivalent', 'Valid driver’s license', 'Customer service experience', 'Warehouse / forklift experience', 'Mechanical or technical training', 'A second language'],
  interests: ['Safety', 'Customer service', 'Logistics', 'Maintenance', 'Leadership', 'Training others'],
};

const HUB_JOBS = [
  { title: 'Delta Airport Customer Service and Cargo Careers', text: 'Delta identifies ramp, cargo, cabin experience, and ticket/gate positions as entry-level opportunities. Requirements vary by posting.', link: 'deltaACS' },
  { title: 'Delta Flight Attendant Careers', text: 'Delta describes seven weeks of onsite initial training in Atlanta. Other employers differ.', link: 'deltaFA' },
  { title: 'United Airlines Careers', text: 'United’s portal includes ramp, maintenance, and flight attendant categories.', link: 'united' },
];

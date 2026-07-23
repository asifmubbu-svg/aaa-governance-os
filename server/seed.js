const fs = require('fs');
const path = require('path');
const { store, meta, users } = require('./store');
const { hash } = require('./auth');

const DATA = path.join(__dirname, '..', 'assets', 'js', 'data');
const RECORD_COLLECTIONS = ['employees','entities','domains','documents','changeRequests','approvals','announcements','auditEvents','capabilities','opportunities','raci','roles','vacancies','risks','controls','campaigns','processes','doa','positions','requirements','findings','evidenceRequests','regChanges','trainings','trainingRecords'];

const DEFAULT_PASSWORD = process.env.GOV_DEFAULT_PASSWORD || 'Admin@123';
const SEED_USERS = [
  { email: 'asif@aaabed.com',       name: 'Asif Ali',       role: 'Admin' },
  { email: 'm.abed@aaabed.com',     name: 'Mohanad Abed',   role: 'Executive' },
  { email: 't.ibrahim@aaabed.com',  name: 'Tamer Ibrahim',  role: 'Executive' },
  { email: 'k.alduwayk@aaabed.com', name: 'Kamal Al Duwayk', role: 'HOD' },
  { email: 'e.ramadan@aaabed.com',  name: 'Eslam Ramadan',  role: 'HOD' },
  { email: 'h.mohamed@aaabed.com',  name: 'Hamdi Mohamed',  role: 'HOD' },
  { email: 'author@aaabed.com',     name: 'Author (demo)',  role: 'Author' },
  { email: 'viewer@aaabed.com',     name: 'Viewer (demo)',  role: 'Viewer' },
];

function readJSON(f){ return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); }

// ---- configuration model (config-driven so admins can add types/fields/workflows) ----
const STD_SECTIONS = ['1. Purpose','2. Scope','3. Definitions','4. Policy Statements / Requirements','5. Procedure','6. Roles & Responsibilities','7. KPIs & Controls','8. References','9. Revision History'];
const PROC_SECTIONS = ['1. Purpose','2. Scope','3. Trigger & Inputs','4. Procedure Steps','5. Outputs','6. Roles & Responsibilities (RACI)','7. Risks & Controls','8. Records & Systems','9. References'];
function buildConfig(){
  const t = (key, prefix, reviewMonths, sections, retentionYears=7) => ({ key, prefix, reviewMonths, sections, retentionYears, workflow:'default', customFields:[], demo:true });
  return {
    documentTypes: [
      t('Policy','POL',12,STD_SECTIONS), t('Standard','STD',12,STD_SECTIONS),
      t('Delegation of Authority','DOA',12,['1. Purpose','2. Scope','3. Authority Matrix','4. Conditions & Exceptions','5. Escalation','6. Revision History']),
      t('Charter','CHT',24,['1. Purpose','2. Mandate & Authority','3. Membership','4. Responsibilities','5. Meetings & Quorum','6. Revision History']),
      t('Framework','FWK',24,STD_SECTIONS), t('Process','PRC',12,PROC_SECTIONS),
      t('Procedure','PRD',12,PROC_SECTIONS), t('SOP','SOP',12,PROC_SECTIONS),
      t('Work Instruction','WIN',12,['1. Purpose','2. Scope','3. Steps','4. Safety & Quality Notes','5. References']),
      t('Manual','MAN',24,STD_SECTIONS), t('Guideline','GDL',24,['1. Purpose','2. Scope','3. Guidance','4. References']),
      t('Register','REG',12,['1. Purpose','2. Scope','3. Register Fields','4. Maintenance & Ownership']),
      t('Form','FRM',24,['1. Purpose','2. Instructions','3. Fields']),
      t('Checklist','CHK',12,['1. Purpose','2. Checklist Items','3. Sign-off']),
      t('Plan','PLN',12,STD_SECTIONS), t('Program','PGM',12,STD_SECTIONS),
      t('Job Description','JD',24,['1. Role Purpose','2. Key Responsibilities','3. Decision Rights','4. Competencies','5. Qualifications & Experience','6. KPIs']),
    ],
    statuses: ['Draft','Released','Active','Superseded','Archived','Rejected','Withdrawn'],
    workflows: [
      { key:'default', name:'Standard (HOD then Executive)', stages:[
        { role:'HOD', name:'Head of Department review' },
        { role:'Executive', name:'Executive approval' },
      ]},
      { key:'single', name:'Single approver (HOD)', stages:[ { role:'HOD', name:'Head of Department approval' } ] },
    ],
    processNodeTypes: ['start','task','decision','system','manual','approval','subprocess','end'],
    riskScale: { likelihood:5, impact:5, bands:[ {max:3,label:'Low'},{max:8,label:'Medium'},{max:14,label:'High'},{max:25,label:'Critical'} ] },
    controlClassifications: ['Preventive','Detective','Corrective'],
    demoDataLabel: true,
    configVersion: 1,
  };
}

async function seedUsers(){
  const ph = hash(DEFAULT_PASSWORD);
  if((await users.count()) === 0){
    for(const u of SEED_USERS) await users.add({ ...u, password_hash: ph });
    return SEED_USERS.length;
  }
  // One-time: reset the seeded accounts' passwords to the current DEFAULT_PASSWORD.
  // Set RESET_SEED_PASSWORDS=true once, redeploy, then remove the flag.
  if(process.env.RESET_SEED_PASSWORDS === 'true'){
    let n = 0;
    for(const u of SEED_USERS){ const ex = await users.byEmail(u.email); if(ex){ await users.setPassword(ex.id, ph); n++; } }
    return n;
  }
  return 0;
}

async function seedData(force){
  const emp = readJSON('employees.json');
  const gov = readJSON('governance.json');
  const current = await meta.get('seedVersion');
  const need = force || current !== (gov.seedVersion || 1) || (await store.count('documents')) === 0;
  if(need){
    for(const c of RECORD_COLLECTIONS) await store.clear(c);
    await store.addMany('employees', emp.employees);
    await store.addMany('entities', gov.entities || []);
    await store.addMany('domains', gov.domains || []);
    await store.addMany('documents', gov.documents || []);
    await store.addMany('changeRequests', gov.changeRequests || []);
    await store.addMany('approvals', gov.approvals || []);
    await store.addMany('announcements', gov.announcements || []);
    await store.addMany('auditEvents', gov.auditEvents || []);
    await store.addMany('capabilities', gov.capabilities || []);
    await store.addMany('opportunities', gov.opportunities || []);
    await store.addMany('raci', gov.raci || []);
    await store.addMany('roles', gov.roles || []);
    await store.addMany('vacancies', gov.vacancies || []);
    await store.addMany('risks', gov.risks || []);
    await store.addMany('controls', gov.controls || []);
    await store.addMany('campaigns', gov.campaigns || []);
    await store.addMany('processes', gov.processes || []);
    await store.addMany('doa', gov.doa || []);
    await store.addMany('positions', gov.positions || []);
    await store.addMany('requirements', gov.requirements || []);
    await store.addMany('findings', gov.findings || []);
    await store.addMany('evidenceRequests', gov.evidenceRequests || []);
    await store.addMany('regChanges', gov.regChanges || []);
    await store.addMany('trainings', gov.trainings || []);
    await store.addMany('trainingRecords', gov.trainingRecords || []);
    await meta.set('reference', {
      departments: emp.departments, units: emp.units, locations: emp.locations,
      docTypes: gov.docTypes, statuses: gov.statuses, raciRoles: gov.raciRoles,
      lifecycle: gov.lifecycle, responsibilityLibrary: gov.responsibilityLibrary,
      headcountPlan: gov.headcountPlan, grades: gov.grades,
      competencyLibrary: gov.competencyLibrary, systems: gov.systems,
      govRoles: gov.roles,
      jobFamilies: gov.jobFamilies, departmentFamily: gov.departmentFamily, gradeArchitecture: gov.gradeArchitecture,
    });
    if(!(await meta.get('config'))) await meta.set('config', buildConfig());
    await meta.set('seedVersion', gov.seedVersion || 1);
  }
  return need;
}

async function seedAll(force){
  const reseeded = await seedData(force);
  const u = await seedUsers();
  return { reseeded, usersCreated: u };
}

module.exports = { seedAll, seedData, seedUsers, RECORD_COLLECTIONS, DEFAULT_PASSWORD, SEED_USERS };

// CLI: `npm run seed` (add --force to reseed)
if (require.main === module) {
  (async () => { const r = await seedAll(process.argv.includes('--force')); console.log('Seed complete:', r); process.exit(0); })()
    .catch((e) => { console.error('Seed failed:', e); process.exit(1); });
}

if(require.main === module){
  const r = seedAll(process.argv.includes('--force'));
  console.log('Seed complete:', r, '· documents:', store.count('documents'), '· employees:', store.count('employees'), '· users:', users.count());
}

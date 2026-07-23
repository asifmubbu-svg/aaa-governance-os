// Controlled-document lifecycle: immutable version snapshots + configurable workflow engine.
const { store, meta } = require('./store');
const { rank, RANK } = require('./auth');

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const DEFAULT_WF = { key: 'default', name: 'Standard (HOD then Executive)', stages: [
  { role: 'HOD', name: 'Head of Department review', type: 'approve' },
  { role: 'Executive', name: 'Executive approval', type: 'approve' },
]};

async function resolveWorkflow(doc) {
  const cfg = (await meta.get('config')) || {};
  const type = (cfg.documentTypes || []).find(t => t.key === doc.type);
  const key = (type && type.workflow) || doc.workflowKey || 'default';
  return (cfg.workflows || []).find(w => w.key === key) || DEFAULT_WF;
}

function snapshotFields(doc) {
  return {
    title: doc.title, type: doc.type, domain: doc.domain, domainName: doc.domainName,
    owner: doc.owner, riskLevel: doc.riskLevel, sections: doc.sections || [],
    custom: doc.custom || {}, tags: doc.tags || [], acknowRequired: !!doc.acknowRequired,
  };
}
function verStr(doc) { return `${doc.major || 0}.${doc.minor || 0}`; }
async function audit(user, action, doc) { await store.add('auditEvents', { actor: user.name, action, target: doc.title, date: now(), entity: doc.entity || 'AAA Holding' }); }
function pushHistory(doc, entry) { doc.workflow = doc.workflow || { stageIndex: 0, stages: [], history: [] }; doc.workflow.history = doc.workflow.history || []; doc.workflow.history.push(entry); }

// ---- actions ----
async function submit(doc, user, justification) {
  const wf = await resolveWorkflow(doc);
  doc.workflowKey = wf.key;
  doc.workflow = {
    stageIndex: 0,
    stages: (wf.stages || DEFAULT_WF.stages).map(s => ({ role: s.role, name: s.name, type: s.type || 'approve', status: 'Pending', decidedBy: '', decidedAt: '', comment: '', dueDate: addDays(7) })),
    history: (doc.workflow && doc.workflow.history) || [],
  };
  doc.minor = (doc.minor || 0) + 1;
  doc.version = verStr(doc);
  doc.status = 'Released';
  await store.add('documentVersions', {
    docId: doc.id, version: doc.version, major: doc.major || 0, minor: doc.minor,
    status: 'In Review', snapshot: snapshotFields(doc), changeJustification: justification || '',
    createdBy: user.name, createdAt: now(),
  });
  pushHistory(doc, { action: 'Submitted for approval', by: user.name, role: user.role, at: now(), comment: justification || '', stage: -1 });
  await audit(user, 'Submitted document v' + doc.version, doc);
  await store.put('documents', doc._id, doc);
  return doc;
}

async function decide(doc, user, action, comment) {
  const wf = doc.workflow;
  if (!wf || !wf.stages || !wf.stages[wf.stageIndex]) { const e = new Error('No active workflow stage'); e.code = 400; throw e; }
  const stage = wf.stages[wf.stageIndex];
  // role gate (Admin can act on any stage)
  if (rank(user.role) < RANK.Admin && user.role !== stage.role) { const e = new Error(`This stage requires the ${stage.role} role`); e.code = 403; throw e; }
  // self-approval / conflict of interest
  if (action === 'approve' && doc.owner && doc.owner === user.name) { const e = new Error('Conflict of interest: you cannot approve a document you own'); e.code = 403; throw e; }

  stage.decidedBy = user.name; stage.decidedAt = now(); stage.comment = comment || '';
  if (action === 'approve') {
    stage.status = 'Approved';
    pushHistory(doc, { action: `Approved (${stage.name})`, by: user.name, role: user.role, at: now(), comment: comment || '', stage: wf.stageIndex });
    if (wf.stageIndex >= wf.stages.length - 1) {
      // finalize -> Active, promote major, supersede prior active version
      doc.major = (doc.major || 0) + 1; doc.minor = 0; doc.version = verStr(doc);
      doc.status = 'Active'; doc.effectiveDate = today();
      const actives = (await store.all('documentVersions')).filter(v => v.docId === doc.id && v.status === 'Active');
      for (const v of actives) { v.status = 'Superseded'; v.supersededByVersion = doc.version; await store.put('documentVersions', v._id, v); }
      await store.add('documentVersions', {
        docId: doc.id, version: doc.version, major: doc.major, minor: 0, status: 'Active',
        snapshot: snapshotFields(doc), changeJustification: 'Approved and made effective',
        createdBy: user.name, createdAt: now(), effectiveDate: doc.effectiveDate,
      });
      await audit(user, 'Approved (final) — document active v' + doc.version, doc);
    } else {
      wf.stageIndex += 1;
      await audit(user, 'Approved stage — ' + stage.name, doc);
    }
  } else if (action === 'reject') {
    stage.status = 'Rejected'; doc.status = 'Rejected';
    pushHistory(doc, { action: 'Rejected', by: user.name, role: user.role, at: now(), comment: comment || '', stage: wf.stageIndex });
    await audit(user, 'Rejected document', doc);
  } else if (action === 'return' || action === 'changes') {
    stage.status = action === 'return' ? 'Returned' : 'Changes requested';
    doc.status = 'Draft';
    pushHistory(doc, { action: action === 'return' ? 'Returned for correction' : 'Changes requested', by: user.name, role: user.role, at: now(), comment: comment || '', stage: wf.stageIndex });
    await audit(user, action === 'return' ? 'Returned document for correction' : 'Requested changes', doc);
  } else { const e = new Error('Unknown action'); e.code = 400; throw e; }
  await store.put('documents', doc._id, doc);
  return doc;
}

async function cancel(doc, user) {
  doc.status = 'Draft';
  pushHistory(doc, { action: 'Submission cancelled', by: user.name, role: user.role, at: now(), comment: '', stage: (doc.workflow && doc.workflow.stageIndex) || 0 });
  await audit(user, 'Cancelled submission', doc);
  await store.put('documents', doc._id, doc);
  return doc;
}

async function withdraw(doc, user, comment) {
  doc.status = 'Withdrawn';
  const versions = (await store.all('documentVersions')).filter(v => v.docId === doc.id && v.status === 'Active');
  for (const v of versions) { v.status = 'Withdrawn'; await store.put('documentVersions', v._id, v); }
  pushHistory(doc, { action: 'Withdrawn', by: user.name, role: user.role, at: now(), comment: comment || '', stage: -1 });
  await audit(user, 'Withdrew document', doc);
  await store.put('documents', doc._id, doc);
  return doc;
}

async function rollback(doc, user, version) {
  const snap = (await store.all('documentVersions')).filter(v => v.docId === doc.id && v.version === version).sort((a, b) => b._id - a._id)[0];
  if (!snap) { const e = new Error('Version not found'); e.code = 404; throw e; }
  const s = snap.snapshot || {};
  Object.assign(doc, { title: s.title, sections: s.sections, custom: s.custom, tags: s.tags, riskLevel: s.riskLevel, acknowRequired: s.acknowRequired });
  doc.status = 'Draft'; doc.minor = (doc.minor || 0) + 1; doc.version = verStr(doc);
  pushHistory(doc, { action: `Rolled back to v${version}`, by: user.name, role: user.role, at: now(), comment: '', stage: -1 });
  await audit(user, `Rolled back to v${version}`, doc);
  await store.put('documents', doc._id, doc);
  return doc;
}

async function versionsOf(docId) { return (await store.all('documentVersions')).filter(v => v.docId === docId).sort((a, b) => a._id - b._id); }

module.exports = { submit, decide, cancel, withdraw, rollback, versionsOf, resolveWorkflow };

// Tamper-evident audit log: each event is chained with a SHA-256 hash of the
// previous event + this event's core fields. Any later edit/deletion breaks the
// chain and is detected by verify(). Server-set fields only.
const crypto = require('crypto');
const { store } = require('./store');

function coreString(f){ return JSON.stringify({ actor: f.actor, action: f.action, target: f.target, date: f.date, entity: f.entity || '' }); }
function hashOf(prevHash, seq, f){ return crypto.createHash('sha256').update(prevHash + '|' + seq + '|' + coreString(f)).digest('hex'); }

async function chained(){
  const all = await store.all('auditEvents');
  return all.filter(e => typeof e.seq === 'number').sort((a, b) => a.seq - b.seq);
}

async function append(fields){
  const chain = await chained();
  const last = chain[chain.length - 1];
  const prevHash = last ? last.hash : 'GENESIS';
  const seq = last ? last.seq + 1 : 1;
  const rec = { ...fields, seq, prevHash };
  rec.hash = hashOf(prevHash, seq, rec);
  return store.add('auditEvents', rec);
}

async function verify(){
  const chain = await chained();
  let prevHash = 'GENESIS';
  for (const e of chain){
    const expect = hashOf(prevHash, e.seq, e);
    if (e.prevHash !== prevHash || e.hash !== expect){
      return { ok: false, count: chain.length, brokenAtSeq: e.seq, actor: e.actor, action: e.action };
    }
    prevHash = e.hash;
  }
  return { ok: true, count: chain.length };
}

module.exports = { append, verify };

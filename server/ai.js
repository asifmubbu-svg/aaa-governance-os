// Grounded governance assistant. Retrieves relevant records from the governance
// collections (NO employee PII) and asks a Groq-hosted model to answer strictly
// from that context, with citations. Degrades gracefully when GROQ_API_KEY is unset.
const https = require('https');
const { store } = require('./store');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

// Collections the assistant may ground on. Deliberately excludes `employees`
// and `positions` so personal data is not sent to the external model.
const AI_COLLECTIONS = ['documents','risks','controls','requirements','processes','doa','findings','evidenceRequests','regChanges','trainings','capabilities','opportunities'];

function isConfigured(){ return !!process.env.GROQ_API_KEY; }

function termsOf(q){ return (q||'').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2); }
function scoreRecord(rec, terms){ const text = JSON.stringify(rec).toLowerCase(); let s = 0; for (const t of terms) if (text.includes(t)) s++; return s; }

async function retrieve(question, limit = 14){
  const terms = termsOf(question);
  const hits = [];
  for (const c of AI_COLLECTIONS){
    const recs = await store.all(c).catch(() => []);
    for (const r of recs){ const s = scoreRecord(r, terms); if (s > 0) hits.push({ c, r, s }); }
  }
  hits.sort((a, b) => b.s - a.s);
  return hits.slice(0, limit);
}

function summarize(c, r){
  const id = r.id || r._id;
  const title = r.title || r.name || r.transactionType || '';
  const bits = [];
  for (const k of ['status','type','domain','owner','severity','residual','complianceStatus','impact','purpose','summary','description','action','effectiveDate','reviewDate','dueDate']){
    if (r[k]) bits.push(`${k}: ${String(r[k]).slice(0, 180)}`);
  }
  return `[${c} ${id}] ${title}${bits.length ? ' - ' + bits.join('; ') : ''}`;
}

async function ask(question){
  if (!isConfigured()) return { configured: false, answer: '', sources: [] };
  const hits = await retrieve(question);
  const context = hits.map(h => summarize(h.c, h.r)).join('\n');
  const system = 'You are the AAA Governance OS assistant for Ahmad A. Abed Holding (a KSA holding company). '
    + 'Answer ONLY from the CONTEXT records provided. If the answer is not in the context, say you do not have that in the governance records and suggest where the user might look. '
    + 'Be concise and professional. Cite record IDs in square brackets, e.g. [POL-QLT-016]. Never invent policies, figures, names, or dates.';
  const user = `QUESTION: ${question}\n\nCONTEXT (governance records):\n${context || '(no matching records found)'}`;
  const body = JSON.stringify({ model: MODEL, temperature: 0.2, max_tokens: 700, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
  const answer = await callGroq(body);
  return { configured: true, answer, model: MODEL, sources: hits.slice(0, 8).map(h => ({ collection: h.c, id: h.r.id || h.r._id, label: h.r.title || h.r.name || '' })) };
}

function callGroq(body){
  return new Promise((resolve, reject) => {
    const req = https.request(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = ''; res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.error) return reject(new Error(j.error.message || 'AI provider error'));
          resolve((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '').trim() || '(no answer returned)');
        } catch (e) { reject(new Error('Could not parse AI response')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('AI request timed out')));
    req.write(body); req.end();
  });
}

module.exports = { ask, isConfigured, MODEL };

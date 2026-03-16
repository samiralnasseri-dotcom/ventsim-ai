const VALID_IDS = new Set([
  'P001','P002','P003','P004','P005','P006','P007','P008','P009','P010',
  'P011','P012','P013','P014','P015','P016','P017','P018','P019','P020',
  'P021','P022','P023','P024','P025','P026','P027','P028','P029','P030',
  'P031','P032','P033','P034','P035','P036','P037','P038','P039','P040',
  'P041','P042','P043','P044','P045',
  'P046','P047','P048','P049','P050','P051','P052','P053','P054','P055',
  'P056','P057','P058','P059','P060','P061','P062','P063','P064','P065',
  'P066','P067','P068','P069','P070','P071','P072','P073','P074','P075',
  'P076','P077','P078','P079','P080','P081','P082','P083','P084','P085',
  'P086','P087','P088','P089','P090',
  'PP01','PP02','PP03','PP04','PP05','PP06','PP07','PP08','PP09','PP10',
  'PP11','PP12','PP13','PP14','PP15','PP16','PP17','PP18','PP19','PP20',
  'PP21','PP22','PP23','PP24',
  'TEST','DEMO','SAMIR','EXPERT'
]);

const TEST_IDS = new Set(['TEST','DEMO','SAMIR','EXPERT']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
  'Content-Type': 'application/json'
};

function resp(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function getGroup(id) {
  if (id.startsWith('PP')) return 'pilot';
  if (id.startsWith('P') && parseInt(id.slice(1)) <= 45) return 'control';
  if (id.startsWith('P')) return 'intervention';
  return 'test';
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const path = new URL(request.url).pathname;

    if (path === '/health') {
      return resp({ status: 'VentSim AI Worker Active', phase: 'both' });
    }

    if (path === '/validate' && request.method === 'POST') {
      const { pid } = await request.json();
      const id = (pid || '').trim().toUpperCase();
      if (!id) return resp({ valid: false, message: 'No ID provided.' });
      if (!VALID_IDS.has(id)) return resp({ valid: false, message: 'Participant ID not recognised. Please check your ID card.' });
      if (!TEST_IDS.has(id) && env.KV) {
        const status = await env.KV.get('status_' + id);
        if (status === 'completed') return resp({ valid: false, message: 'This ID has already completed the study. Contact the researcher if this is an error.' });
        if (status === 'locked') return resp({ valid: false, message: 'This ID is locked. Please contact the researcher.' });
        await env.KV.put('status_' + id, 'in_progress', { expirationTtl: 604800 });
      }
      return resp({ valid: true, group: getGroup(id), pid: id });
    }

    if (path === '/ai' && request.method === 'POST') {
      const body = await request.json();
      const pid = (body.pid || '').trim().toUpperCase();
      if (!VALID_IDS.has(pid)) return resp({ error: 'Unauthorized.' }, 401);
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: body.max_tokens || 250, system: body.system || '', messages: body.messages || [] })
        });
        return resp(await r.json());
      } catch (e) {
        return resp({ content: [{ type: 'text', text: 'What does the patient data tell you?' }] });
      }
    }

    if (path === '/save' && request.method === 'POST') {
      const data = await request.json();
      const pid = (data.pid || data.participant_id || '').trim().toUpperCase();
      if (!VALID_IDS.has(pid)) return resp({ success: false, message: 'Invalid ID.' }, 401);
      if (TEST_IDS.has(pid)) return resp({ success: true, message: 'Test — not saved.' });
      data.server_timestamp = new Date().toISOString();
      if (env.KV) {
        await env.KV.put('status_' + pid, 'completed');
        await env.KV.put('completed_at_' + pid, new Date().toISOString());
      }
      try {
        await fetch(env.SHEETS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      } catch (e) {}
      return resp({ success: true });
    }

    if (path.startsWith('/admin') && request.method === 'POST') {
      const adminKey = request.headers.get('X-Admin-Key');
      if (!adminKey || adminKey !== env.ADMIN_KEY) return resp({ error: 'Unauthorized.' }, 401);
      const body = await request.json();

      if (path === '/admin/reset') {
        const pid = (body.pid || '').trim().toUpperCase();
        if (!VALID_IDS.has(pid) || TEST_IDS.has(pid)) return resp({ success: false, message: 'Invalid ID.' });
        if (env.KV) { await env.KV.delete('status_' + pid); await env.KV.delete('completed_at_' + pid); }
        return resp({ success: true, message: pid + ' reset successfully.' });
      }

      if (path === '/admin/status') {
        if (!env.KV) return resp({ error: 'KV not configured.' });
        const results = {};
        for (const id of [...VALID_IDS].filter(id => !TEST_IDS.has(id))) {
          const status = await env.KV.get('status_' + id);
          const completedAt = await env.KV.get('completed_at_' + id);
          if (status) results[id] = { status, completedAt: completedAt || null };
        }
        const completed = Object.values(results).filter(r => r.status === 'completed').length;
        const inProgress = Object.values(results).filter(r => r.status === 'in_progress').length;
        return resp({ summary: { completed, inProgress, pending: [...VALID_IDS].filter(id => !TEST_IDS.has(id)).length - completed - inProgress }, details: results });
      }

      if (path === '/admin/phase') {
        const phase = body.phase;
        if (!['control','intervention','both','locked'].includes(phase)) return resp({ success: false, message: 'Invalid phase.' });
        if (env.KV) await env.KV.put('study_phase', phase);
        return resp({ success: true, message: 'Phase set to: ' + phase });
      }

      return resp({ error: 'Unknown admin command.' }, 404);
    }

    return resp({ error: 'Not found.' }, 404);
  }
};

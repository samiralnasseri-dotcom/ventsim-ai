var consentChecked=false;
function checkConsent(){ consentChecked=document.getElementById('consent-cb').checked; }
function goConsent(){
  if(!consentChecked){var e=document.getElementById('c-err');if(e)e.textContent='Please tick the consent box to continue.';return;}
  show('login-sc');setProg(12);
  var d=document.getElementById('ses-date');
  if(d&&!d.value){d.value=new Date().toISOString().split('T')[0];}
}
function startSession(){
  var pid=document.getElementById('pid').value.trim().toUpperCase();
  if(!pid){document.getElementById('pid-err').textContent='Please enter your participant number.';return;}
  window._testMode=(pid==='TEST'||pid==='DEMO'||pid==='SAMIR');
  _realStartSession();
}

/* ═══════════════════════════════════════════
   WORKER URL
═══════════════════════════════════════════ */
const WORKER_URL = 'https://ventsim-worker.samir-alnasseri.workers.dev';

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
const S = {
  pid:'', group:'control', date:'', sessionId:'', startTime:0,
  consentDone:false, savedSession:null,
  data:{ demo:{}, preMCQ:{}, postMCQ:{}, preCDMNS:{}, postCDMNS:{}, tam:{},
         preMCQScore:0, postMCQScore:0 },
  sim:{ scenario:0, step:0, decisions:[], correct:0, total:0,
        startTime:0, scores:[] },
  chat:{ history:[], scenarioSystem:'' },
  xp: 0,
  autoSaveTimer:null,
  timing:{
    sessionStart: null,
    screenStart: null,
    screens:{},       // time spent per screen in seconds
    lastActivity: null,
    hints_used: 0
  }
};
/* ═══════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════ */
function show(id){
  document.querySelectorAll('.sc').forEach(s=>s.classList.remove('active'));
  var el=document.getElementById(id);
  if(!el){console.error('Screen not found:',id);return;}
  el.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  // Record time spent on previous screen
  if(S.timing.screenStart && S.timing.currentScreen){
    const secs = Math.round((Date.now()-S.timing.screenStart)/1000);
    S.timing.screens[S.timing.currentScreen] = (S.timing.screens[S.timing.currentScreen]||0)+secs;
  }
  S.timing.currentScreen = id;
  S.timing.screenStart = Date.now();
  S.timing.lastActivity = Date.now();
}
function setProg(pct){ document.getElementById('prog-bar').style.width=pct+'%'; }

// Track user activity (mouse/keyboard) for idle detection
document.addEventListener('mousemove',()=>{ if(S.timing) S.timing.lastActivity=Date.now(); });
document.addEventListener('keydown',()=>{ if(S.timing) S.timing.lastActivity=Date.now(); });

function loader(on,txt='PROCESSING...'){
  document.getElementById('loader').classList.toggle('on',on);
  document.getElementById('ltxt').textContent=txt;
}
function genSid(){ return 'VS-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase(); }
function saveLocal(){
  const snap={pid:S.pid,group:S.group,ts:Date.now(),sessionId:S.sessionId,data:S.data,sim:S.sim};
  localStorage.setItem('ventsim_'+S.pid,JSON.stringify(snap));
  localStorage.setItem('ventsim__last__',JSON.stringify(snap));
}
function checkSaved(pid){
  const k=localStorage.getItem('ventsim_'+pid);
  return k?JSON.parse(k):null;
}

/* ═══════════════════════════════════════════
   S2 — CONSENT
═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   S3 — LOGIN
═══════════════════════════════════════════ */
async function _realStartSession(){
  const pid = document.getElementById('pid').value.trim().toUpperCase();
  const err = document.getElementById('login-err');
  document.getElementById('pid-err').textContent = '';
  err.textContent = '';
  if(!pid){ document.getElementById('pid-err').textContent='Please enter your participant number.'; return; }
  // TEST mode — always start fresh, never resume
  if(window._testMode){
    if(pid==='TEST'||pid==='DEMO') localStorage.removeItem('ventsim_'+pid);
    loader(false);
    S.pid=pid; S.group='intervention';
    S.date=document.getElementById('ses-date').value||new Date().toISOString().split('T')[0];
    S.sessionId='TEST-'+Date.now(); S.startTime=Date.now();
    document.getElementById('hbadge').textContent=pid+' · TEST';
    document.getElementById('hbadge2').textContent=pid+' · TEST';
    show('demo-sc'); setProg(15);
    startAutoSave();
    return;
  }
  const saved = checkSaved(pid);
  if(saved && !S.savedSession){
    S.savedSession = saved; S.pid = pid;
    document.getElementById('res-banner').style.display='flex';
    document.getElementById('res-info').textContent = pid+' — resume from where you left off?';
    return;
  }
  loader(true,'VALIDATING...');
  try{
    const r = await fetch(WORKER_URL+'/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pid})});
    const j = await r.json(); loader(false);
    if(!j.valid){ err.textContent = j.message||'Invalid participant ID.'; return; }
    S.pid=pid; S.group=j.group||'intervention';
    S.date=document.getElementById('ses-date').value||new Date().toISOString().split('T')[0];
    S.sessionId=genSid(); S.startTime=Date.now();
    S.timing.sessionStart=Date.now(); S.timing.lastActivity=Date.now();
    document.getElementById('hbadge').textContent=pid+' · INT';
    document.getElementById('hbadge2').textContent=pid+' · PRE-MCQ';
    show('demo-sc'); setProg(15);
    startAutoSave();
  }catch(e){
    loader(false);
    S.pid=pid; S.group='intervention';
    S.date=document.getElementById('ses-date').value||new Date().toISOString().split('T')[0];
    S.sessionId=genSid(); S.startTime=Date.now();
    document.getElementById('hbadge').textContent=pid+' · INT';
    document.getElementById('hbadge2').textContent=pid+' · PRE-MCQ';
    show('demo-sc'); setProg(15);
    startAutoSave();
  }
}
function resumeSession(){
window._realStartSession = _realStartSession;
  const saved=S.savedSession;
  if(!saved) return;
  S.pid=saved.pid; S.group=saved.group; S.sessionId=saved.sessionId;
  S.data=saved.data; S.sim=saved.sim||S.sim;
  document.getElementById('hbadge').textContent=saved.pid+' · INT';
  show('demo-sc'); setProg(15);
  startAutoSave();
}
function clearSaved(){
  if(S.pid) localStorage.removeItem('ventsim_'+S.pid);
  S.savedSession=null;
  document.getElementById('res-banner').style.display='none';
}
function startAutoSave(){
  S.autoSaveTimer=setInterval(saveLocal,120000);
  // Browser close warning — only after login
  window.addEventListener('beforeunload', e=>{
    if(S.pid && !['TEST','DEMO','SAMIR'].includes(S.pid)){
      e.preventDefault(); e.returnValue='';
    }
  });
  // Idle timeout warning — 30 minutes
  setInterval(()=>{
    if(!S.timing.lastActivity) return;
    const idleSec = Math.round((Date.now()-S.timing.lastActivity)/1000);
    const existing = document.getElementById('idle-warn');
    if(idleSec > 1800 && !existing){
      const warn = document.createElement('div');
      warn.id='idle-warn';
      warn.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a2a1a;border:1px solid #ffd740;color:#ffd740;font-family:monospace;font-size:.8rem;padding:12px 20px;border-radius:6px;z-index:9999;text-align:center;';
      warn.innerHTML='⚠️ You have been idle for 30 minutes. Please continue to avoid losing your progress. <button onclick="document.getElementById(\'idle-warn\').remove();S.timing.lastActivity=Date.now();" style="margin-left:10px;background:#ffd740;color:#000;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-family:monospace;">CONTINUE</button>';
      document.body.appendChild(warn);
    } else if(idleSec <= 1800 && existing){
      existing.remove();
    }
  }, 60000);
}

/* ═══════════════════════════════════════════
   S4 — DEMOGRAPHICS
═══════════════════════════════════════════ */
function submitDemo(){
  const ids=['d1','d2','d3','d4','d5','d6','d7','d8','d9','d10','d11','d12','d13','d14','d15','d16','d17'];
  const missing=ids.filter(i=>!document.getElementById(i).value);
  if(missing.length){ document.getElementById('demo-err').textContent='Please complete all fields ('+missing.length+' remaining).'; return; }
  ids.forEach(i=>S.data.demo[i]=document.getElementById(i).value);
  show('premcq-sc'); setProg(28); saveLocal();
  buildMCQ('mcq-pre-cont','preMCQ');
}

/* ═══════════════════════════════════════════
   MCQ DATA — 20 Evidence-based Questions
═══════════════════════════════════════════ */
const MCQ_ITEMS = [
  {q:"A ventilated ARDS patient has PaO₂/FiO₂ ratio of 120 mmHg. According to ARDSNet protocol, what is the maximum recommended tidal volume?",opts:["10 mL/kg actual body weight","6 mL/kg ideal body weight","8 mL/kg actual body weight","6 mL/kg actual body weight"],ans:1},
  {q:"You notice double-triggering on the flow waveform with a short expiratory time. What is the most likely cause of patient-ventilator dyssynchrony?",opts:["Auto-PEEP","Flow starvation","Reverse triggering","Insufficient inspiratory time"],ans:2},
  {q:"A ventilated patient suddenly desaturates to SpO₂ 82%. Using the DOPE mnemonic, what should you assess FIRST?",opts:["Check plateau pressure","Disconnect and bag ventilate","Assess for Displacement of ETT","Increase FiO₂ to 100%"],ans:2},
  {q:"An ARDS patient on ARDSNet ventilation has plateau pressure of 34 cmH₂O. What is the MOST appropriate immediate action?",opts:["Reduce PEEP by 2 cmH₂O","Reduce tidal volume to achieve Pplat ≤30 cmH₂O","Increase sedation","Switch to pressure control ventilation"],ans:1},
  {q:"Which parameter BEST predicts successful weaning from mechanical ventilation?",opts:["Vital capacity >10 mL/kg","Rapid Shallow Breathing Index (RSBI) <105","Maximum inspiratory pressure >-20 cmH₂O","Minute ventilation <10 L/min"],ans:1},
  {q:"A patient on AC/VC ventilation develops flow starvation dyssynchrony. What ventilator change addresses this BEST?",opts:["Increase respiratory rate","Increase inspiratory flow rate or switch to pressure control","Increase tidal volume","Add PEEP"],ans:1},
  {q:"What defines severe ARDS according to the Berlin Definition?",opts:["PaO₂/FiO₂ <200 mmHg","PaO₂/FiO₂ <100 mmHg","PaO₂/FiO₂ <150 mmHg","SpO₂ <88% on FiO₂ 0.6"],ans:1},
  {q:"During a spontaneous breathing trial (SBT), which finding indicates FAILURE and should prompt stopping the trial?",opts:["RR 20 breaths/min","SpO₂ 93% on FiO₂ 0.4","RR >35 breaths/min for >5 minutes","HR 95 bpm"],ans:2},
  {q:"A patient with ARDS is on PEEP 12 cmH₂O. SpO₂ remains 88% on FiO₂ 60%. What is the MOST appropriate next step?",opts:["Increase FiO₂ to 100%","Consider prone positioning","Reduce PEEP to decrease overdistension","Increase respiratory rate"],ans:1},
  {q:"What is the correct sequence for the DOPE mnemonic in acute desaturation?",opts:["Displacement, Obstruction, Pneumothorax, Equipment","Dislodgement, Occlusion, Pulmonary embolism, Edema","Disconnection, Obstruction, Perfusion, Equipment","Displacement, Over-inflation, Pneumothorax, Equipment"],ans:0},
  {q:"In pressure-controlled ventilation, the clinician sets:",opts:["Tidal volume and respiratory rate","Inspiratory pressure and respiratory rate","Flow rate and tidal volume","FiO₂ and PEEP only"],ans:1},
  {q:"A patient develops auto-PEEP. Which intervention is MOST effective?",opts:["Increase inspiratory time","Decrease respiratory rate and increase expiratory time","Increase tidal volume","Switch from PCV to VCV"],ans:1},
  {q:"The plateau pressure measures:",opts:["Peak airway resistance","Alveolar pressure at end-inspiration","Mean airway pressure","Work of breathing"],ans:1},
  {q:"A nurse calculates driving pressure as 18 cmH₂O. This is calculated as:",opts:["Peak pressure minus PEEP","Plateau pressure minus PEEP","Mean airway pressure minus PEEP","PIP minus Pplat"],ans:1},
  {q:"Which FiO₂/PEEP combination is recommended by ARDSNet for PaO₂/FiO₂ <100?",opts:["FiO₂ 0.5 / PEEP 8","FiO₂ 0.7 / PEEP 14","FiO₂ 0.9 / PEEP 18","FiO₂ 0.8 / PEEP 10"],ans:2},
  {q:"A ventilated patient has RSBI of 65. What does this suggest?",opts:["Weaning likely to fail","Weaning likely to succeed","Patient is apnoeic","High work of breathing"],ans:1},
  {q:"Reverse triggering dyssynchrony occurs when:",opts:["Patient triggers the ventilator early","Ventilator-delivered breath stimulates patient effort","Flow starvation occurs","Patient double-triggers"],ans:1},
  {q:"The minimum duration of a spontaneous breathing trial before extubation decision is:",opts:["15 minutes","30 minutes","60 minutes","2 hours"],ans:1},
  {q:"A patient on ARDSNet has IBW of 70 kg. What is the maximum recommended tidal volume?",opts:["350 mL","420 mL","490 mL","560 mL"],ans:1},
  {q:"In acute ETT obstruction, after suctioning fails to relieve the blockage, what is the NEXT priority action?",opts:["Increase ventilator pressure","Change ETT immediately","Perform chest physiotherapy","Increase FiO₂"]  ,ans:1}
];

function buildMCQ(containerId, storeKey){
  const c = document.getElementById(containerId);
  c.innerHTML = '';
  MCQ_ITEMS.forEach((item,i)=>{
    const letters=['A','B','C','D'];
    const div=document.createElement('div');
    div.className='mcq-item'; div.id='mcq-item-'+storeKey+'-'+i;
    div.innerHTML=`<div class="mcq-q"><span class="mcq-qn">Q${i+1}.</span>${item.q}</div><div class="mcq-opts">${item.opts.map((o,j)=>`<div class="mcq-opt" onclick="selMCQ('${storeKey}',${i},${j},this)" id="mopt-${storeKey}-${i}-${j}"><span class="mcq-letter">${letters[j]}</span>${o}</div>`).join('')}</div>`;
    c.appendChild(div);
  });
}
function selMCQ(key,qi,oi,el){
  const prev=document.querySelector('#mcq-item-'+key+'-'+qi+' .mcq-opt.sel');
  if(prev) prev.classList.remove('sel');
  el.classList.add('sel');
  S.data[key][qi]=oi;
  document.getElementById('mcq-item-'+key+'-'+qi).classList.add('answered');
}
function scoreMCQ(key){ return MCQ_ITEMS.reduce((s,item,i)=>s+(S.data[key][i]===item.ans?1:0),0); }

function submitPreMCQ(){
  const answered=Object.keys(S.data.preMCQ).length;
  if(answered<20){ document.getElementById('premcq-err').textContent='Please answer all 20 questions ('+(20-answered)+' remaining).'; return; }
  S.data.preMCQScore=scoreMCQ('preMCQ');
  show('precdmns-sc'); setProg(38); saveLocal();
  buildCDMNS('cdmns-pre-cont','preCDMNS');
}
function submitPostMCQ(){
  const answered=Object.keys(S.data.postMCQ).length;
  if(answered<20){ document.getElementById('postmcq-err').textContent='Please answer all 20 questions ('+(20-answered)+' remaining).'; return; }
  S.data.postMCQScore=scoreMCQ('postMCQ');
  show('postcdmns-sc'); setProg(82); saveLocal();
  buildCDMNS('cdmns-post-cont','postCDMNS');
}

/* ═══════════════════════════════════════════
   CDMNS — Jenkins 1985, 40 items, 4 subscales
═══════════════════════════════════════════ */
const CDMNS_ITEMS = [
  // Subscale 1 — Searching for Alternatives (1–10)
  "I search for information relevant to the care of my patients","I review options before making clinical decisions","I consult resources such as protocols or research findings","I consider multiple possibilities before deciding","I update my plan when new information becomes available","I look for evidence to support clinical decisions","I reassess patients after implementing a change","I seek advice from colleagues when uncertain","I explore different approaches to patient problems","I evaluate outcomes of my clinical decisions",
  // Subscale 2 — Canvassing Objectives (11–20)
  "I identify the goals of care for each patient","I prioritise patient needs before taking action","I align nursing interventions with patient outcomes","I set clear objectives for each clinical encounter","I coordinate care to meet patient goals","I adapt interventions based on changing patient status","I consider the patient's preferences in planning care","I document care plans that reflect clinical goals","I communicate goals clearly with the healthcare team","I evaluate whether goals have been achieved",
  // Subscale 3 — Evaluating Consequences (21–30)
  "I anticipate the likely consequences of clinical decisions","I consider risks before implementing interventions","I evaluate short-term and long-term effects of care","I revise my plan if anticipated outcomes are not met","I identify warning signs that indicate deterioration","I question decisions that seem inconsistent with evidence","I review the impact of interventions on patient status","I consider the effect of medications and treatments","I anticipate complications related to the patient's condition","I balance benefits and risks in clinical decisions",
  // Subscale 4 — Searching for Information (31–40)
  "I use patient data to guide clinical decisions","I monitor vital signs to detect changes in condition","I interpret laboratory and diagnostic results","I perform systematic physical assessments","I integrate clinical data to form a complete picture","I apply clinical knowledge to interpret assessment findings","I use a structured approach when assessing patients","I recognise patterns in clinical data that indicate risk","I identify the significance of abnormal findings","I use clinical information to anticipate patient needs"
];
const CDMNS_LABELS = ['Never','Rarely','Sometimes','Often','Always'];
const CDMNS_SUBS = ['Searching for Alternatives','Canvassing Objectives','Evaluating Consequences','Searching for Information'];

function buildCDMNS(containerId, storeKey){
  const c=document.getElementById(containerId); c.innerHTML='';
  CDMNS_SUBS.forEach((sub,si)=>{
    const sd=document.createElement('div'); sd.className='card';
    sd.innerHTML=`<div class="card-title">${si+1}. ${sub}</div>`;
    for(let i=si*10;i<(si+1)*10;i++){
      const row=document.createElement('div'); row.className='lk-row'; row.id='lk-'+storeKey+'-'+i;
      row.innerHTML=`<div class="lk-q"><span class="lk-qn">${i+1}.</span>${CDMNS_ITEMS[i]}</div><div class="lk-opts">${[1,2,3,4,5].map(v=>`<button class="lk-opt" title="${CDMNS_LABELS[v-1]}" onclick="selLK('${storeKey}',${i},${v},this)">${v}</button>`).join('')}</div>`;
      sd.appendChild(row);
    }
    c.appendChild(sd);
  });
}
function selLK(key,qi,val,el){
  document.querySelectorAll('#lk-'+key+'-'+qi+' .lk-opt').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel'); S.data[key][qi]=val;
  document.getElementById('lk-'+key+'-'+qi).classList.add('answered');
}
function cdmnsComplete(key){ return Object.keys(S.data[key]).length>=40; }
function cdmnsTotal(key){ return Object.values(S.data[key]).reduce((a,b)=>a+b,0); }

function submitPreCDMNS(){
  if(!cdmnsComplete('preCDMNS')){ document.getElementById('precdmns-err').textContent='Please rate all 40 items.'; return; }
  show('orient-sc'); setProg(48); saveLocal();
}
function submitPostCDMNS(){
  if(!cdmnsComplete('postCDMNS')){ document.getElementById('postcdmns-err').textContent='Please rate all 40 items.'; return; }
  show('tam-sc'); setProg(90); saveLocal();
  buildTAM();
}

/* ═══════════════════════════════════════════
   TAM — 19 items, 5 dimensions
═══════════════════════════════════════════ */
const TAM_DIMS = [
  { name:'Perceived Usefulness', items:["Using VentSim AI improves my clinical decision-making performance","Using VentSim AI enhances my effectiveness in managing ventilated patients","VentSim AI is useful for developing ICU nursing competencies","Using VentSim AI increases my productivity in learning","VentSim AI provides useful feedback for my clinical practice"] },
  { name:'Perceived Ease of Use', items:["Learning to use VentSim AI is easy for me","I find VentSim AI easy to interact with","The AI chat interface is clear and understandable","It is easy to navigate through the VentSim AI scenarios","Overall, VentSim AI is easy to use"] },
  { name:'Behavioural Intention', items:["I intend to use AI simulation tools for clinical learning in the future","I plan to recommend AI-based simulation to my colleagues","I would use VentSim AI again if it were available"] },
  { name:'AI-Specific Trust', items:["I trust the clinical guidance provided by VentSim AI","VentSim AI provides reliable information to support my decisions","I feel confident that VentSim AI's questions are evidence-based"] },
  { name:'Educational Value', items:["VentSim AI effectively stimulates my critical thinking","The Socratic questioning approach helped me reason through clinical problems","VentSim AI is a valuable tool for ICU nursing education"] }
];
let tamItemIdx = 0;
function buildTAM(){
  const c=document.getElementById('tam-cont'); c.innerHTML='';
  TAM_DIMS.forEach((dim,di)=>{
    const dd=document.createElement('div'); dd.className='tam-dim';
    dd.innerHTML=`<div class="tam-dim-title">${di+1}. ${dim.name}</div>`;
    dim.items.forEach(item=>{
      const row=document.createElement('div'); row.className='lk-row'; row.id='lk-tam-'+tamItemIdx;
      const idx=tamItemIdx;
      row.innerHTML=`<div class="lk-q"><span class="lk-qn">${idx+1}.</span>${item}</div><div class="lk-opts">${[1,2,3,4,5].map(v=>`<button class="lk-opt" title="${['Strongly Disagree','Disagree','Neutral','Agree','Strongly Agree'][v-1]}" onclick="selTAM(${idx},${v},this)">${v}</button>`).join('')}</div>`;
      dd.appendChild(row);
      tamItemIdx++;
    });
    c.appendChild(dd);
  });
}
function selTAM(qi,val,el){
  document.querySelectorAll('#lk-tam-'+qi+' .lk-opt').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel'); S.data.tam[qi]=val;
  document.getElementById('lk-tam-'+qi).classList.add('answered');
}
function submitTAM(){
  if(Object.keys(S.data.tam).length<19){ document.getElementById('tam-err').textContent='Please rate all 19 items.'; return; }
  loadDebrief(); show('deb-sc'); setProg(96); saveLocal();
}

  loadDebrief(); show('deb-sc'); setProg(96); saveLocal();
}
}

/* ═══════════════════════════════════════════
   SIMULATION ENGINE
═══════════════════════════════════════════ */
const SCENARIOS = [
  {
    id:'SC1', title:'Patient-Ventilator Dyssynchrony',
    mrn:'ICU-2026-001', age:58, sex:'Male', wt:75, ht:175,
    dx:'Post-op Day 3 — Abdominal surgery. COPD background. Increasing agitation on ventilator.',
    hx:'Mr. Al-Rashidi, 58M, admitted following emergency laparotomy for perforated peptic ulcer. Background: COPD (GOLD III), hypertension, smoker 30 pack-years. Currently sedated (RASS -1, target -2). Nurse reports increasing patient-triggered breaths not matching ventilator cycles. FiO₂ requirements increasing.',
    vitals:{spo2:91,hr:108,rr:28,bp:'142/88',etco2:48,fio2:55},
    vent:{mode:'AC/VC',tv:520,rr:14,peep:6,pip:36,fio2:55,ie:'1:2.5',plat:32},
    wave:'dyssynchrony',
    decisions:[
      {prompt:'The waveforms show irregular flow patterns with abrupt drops — what type of dyssynchrony do you identify?',opts:[{t:'Flow starvation — insufficient inspiratory flow',c:true},{t:'Double-triggering — short expiratory time',c:false},{t:'Auto-PEEP — incomplete exhalation',c:false},{t:'Reverse triggering — passive inflation',c:false}],exp:'Flow starvation occurs when patient demand exceeds set flow, causing concave flow waveform dips. The clinical finding here — COPD patient, high inspiratory effort against fixed flow — is classic flow starvation.'},
      {prompt:'To address flow starvation dyssynchrony, what is the MOST effective ventilator intervention?',opts:[{t:'Increase tidal volume to 650 mL',c:false},{t:'Increase peak inspiratory flow rate to 80 L/min or switch to PCV',c:true},{t:'Reduce respiratory rate to 10',c:false},{t:'Increase PEEP to 10 cmH₂O',c:false}],exp:'Increasing flow rate meets the patient\'s demand. PCV provides a decelerating flow pattern that better matches COPD patient breathing effort. Correct answer aligns with evidence for managing flow starvation.'},
      {prompt:'After adjusting flow, patient remains distressed (RASS +1). SpO₂ still 91%. What is your NEXT priority assessment?',opts:[{t:'Immediately increase FiO₂ to 80%',c:false},{t:'Check for auto-PEEP using expiratory hold manoeuvre',c:true},{t:'Request CT chest',c:false},{t:'Increase sedation to RASS -3',c:false}],exp:'In COPD patients with dyssynchrony, auto-PEEP is common. Expiratory hold manoeuvre reveals intrinsic PEEP. Addressing auto-PEEP is essential before escalating FiO₂ or sedation.'}
    ]
  },
  {
    id:'SC2', title:'Acute Desaturation — DOPE',
    mrn:'ICU-2026-002', age:44, sex:'Female', wt:62, ht:163,
    dx:'Post-intubation Day 1. Sudden SpO₂ drop from 97% to 78% in 3 minutes.',
    hx:'Ms. Zahra Al-Balushi, 44F, intubated 18 hours ago for type 2 respiratory failure secondary to community-acquired pneumonia. Previously well, no significant PMH. RASS -2, ETT size 7.5 mm at 22 cm lip. Nurse reports patient was being repositioned for pressure area care when desaturation began.',
    vitals:{spo2:78,hr:132,rr:30,bp:'88/54',etco2:22,fio2:100},
    vent:{mode:'AC/VC',tv:420,rr:18,peep:8,pip:52,fio2:100,ie:'1:2',plat:'N/A'},
    wave:'obstruction',
    decisions:[
      {prompt:'SpO₂ is 78% and falling. The FIRST action using the DOPE mnemonic is:',opts:[{t:'Increase PEEP to 14 cmH₂O',c:false},{t:'Disconnect from ventilator and manually ventilate with 100% O₂',c:true},{t:'Order emergency chest X-ray',c:false},{t:'Increase respiratory rate to 24',c:false}],exp:'Disconnect and bag-valve-mask with 100% O₂ is the first action in acute desaturation. This confirms whether the problem is the ventilator (Equipment — E in DOPE) and provides immediate oxygenation while assessing.'},
      {prompt:'Manual ventilation feels very stiff (high resistance). ETT appears to be at 26 cm lip. You suspect:',opts:[{t:'Tension pneumothorax',c:false},{t:'ETT displacement into right mainstem bronchus (D — Displacement)',c:true},{t:'Mucus plug obstruction',c:false},{t:'Patient-ventilator dyssynchrony',c:false}],exp:'ETT advancing from 22 cm to 26 cm after repositioning strongly suggests right mainstem intubation. This is the D (Displacement) of DOPE. Absent left breath sounds would confirm.'},
      {prompt:'After confirming right mainstem intubation and pulling ETT back to 21 cm, SpO₂ improves to 88% but remains low. FiO₂ is 100%. What next?',opts:[{t:'Add PEEP 5 cmH₂O above current level and reassess SpO₂',c:true},{t:'Extubate immediately',c:false},{t:'Reduce FiO₂ to wean oxygen',c:false},{t:'Perform bronchoscopy immediately',c:false}],exp:'After correcting displacement, optimising PEEP addresses residual atelectasis from right mainstem intubation. Incremental PEEP titration is indicated before FiO₂ reduction.'}
    ]
  },
  {
    id:'SC3', title:'ARDS — Lung Protective Ventilation',
    mrn:'ICU-2026-003', age:51, sex:'Male', wt:80, ht:178,
    dx:'ARDS Day 2. PaO₂/FiO₂ 105. ARDSNet protocol review required.',
    hx:'Mr. Khalid Al-Farsi, 51M, ARDS secondary to severe sepsis from intra-abdominal source. Day 2 in ICU. IBW 72 kg. Current settings not matching ARDSNet protocol — nurse flagged tidal volume as potentially too high. Recent ABG: pH 7.28, PaO₂ 62 mmHg, PaCO₂ 58 mmHg, on FiO₂ 80%.',
    vitals:{spo2:88,hr:118,rr:32,bp:'98/62',etco2:55,fio2:80},
    vent:{mode:'AC/VC',tv:650,rr:18,peep:10,pip:44,fio2:80,ie:'1:2',plat:34},
    wave:'ards',
    decisions:[
      {prompt:'IBW is 72 kg. Current TV is 650 mL. According to ARDSNet, what should the tidal volume be?',opts:[{t:'650 mL — current setting is acceptable',c:false},{t:'432 mL (6 mL/kg IBW)',c:true},{t:'504 mL (7 mL/kg IBW)',c:false},{t:'576 mL (8 mL/kg IBW)',c:false}],exp:'ARDSNet mandates 6 mL/kg IBW. IBW 72 kg × 6 = 432 mL. Current TV of 650 mL is 9 mL/kg — significantly exceeding the safe threshold and causing volutrauma.'},
      {prompt:'After reducing TV to 432 mL, plateau pressure is 33 cmH₂O. Target is ≤30 cmH₂O. What next?',opts:[{t:'Reduce TV further to 5 mL/kg (360 mL)',c:true},{t:'Increase PEEP to compensate',c:false},{t:'Accept plateau pressure — within acceptable range',c:false},{t:'Switch to PRVC mode',c:false}],exp:'ARDSNet allows TV reduction to 4 mL/kg if needed to achieve Pplat ≤30 cmH₂O. Permissive hypercapnia is acceptable. 5 mL/kg (360 mL) is the appropriate next reduction.'},
      {prompt:'PaO₂/FiO₂ is 105 (severe ARDS). SpO₂ persists at 88% on FiO₂ 80% / PEEP 10. What additional intervention should be considered?',opts:[{t:'Immediate ECMO referral',c:false},{t:'Prone positioning for 16+ hours',c:true},{t:'High-frequency oscillatory ventilation',c:false},{t:'Increase FiO₂ to 100%',c:false}],exp:'PROSEVA trial demonstrated 28-day mortality reduction with prone positioning in severe ARDS (PaO₂/FiO₂ <150). Prone for ≥16 hours is standard of care. ECMO is considered only after prone positioning fails.'}
    ]
  },
  {
    id:'SC4', title:'Weaning Readiness & SBT',
    mrn:'ICU-2026-004', age:66, sex:'Female', wt:68, ht:160,
    dx:'Day 8 ventilation. Meets weaning criteria. Spontaneous breathing trial decision.',
    hx:'Mrs. Fatima Al-Zaabi, 66F, ventilated for 8 days following Guillain-Barré syndrome exacerbation. Condition improving. Physiotherapy report: improving limb strength. RASS 0 (awake, calm). Last sedation 18 hours ago. SpO₂ satisfactory on low support. Team considering extubation. Requires SBT evaluation.',
    vitals:{spo2:96,hr:82,rr:16,bp:'124/76',etco2:38,fio2:40},
    vent:{mode:'PS/CPAP',tv:480,rr:16,peep:5,pip:18,fio2:40,ie:'1:2',plat:16},
    wave:'weaning',
    decisions:[
      {prompt:'Before starting an SBT, which set of criteria MUST be met?',opts:[{t:'SpO₂ >90%, awake, haemodynamically stable, FiO₂ ≤50%',c:true},{t:'SpO₂ >95%, RASS -2, FiO₂ ≤40%, no vasopressors',c:false},{t:'Normal ABG, no fever, oral secretions controlled',c:false},{t:'Negative NIF >-30, VC >10 mL/kg, RR <20',c:false}],exp:'Readiness criteria include: adequate oxygenation (SpO₂ >90% on FiO₂ ≤50%, PEEP ≤8), haemodynamic stability, alert/cooperative, resolving cause. This patient meets all criteria.'},
      {prompt:'You commence a 30-minute T-piece SBT. At 15 minutes: RR 34, SpO₂ 91%, increasing accessory muscle use, HR 118 (was 82). What do you do?',opts:[{t:'Continue — minor changes are expected during SBT',c:false},{t:'Stop the SBT immediately — failure criteria met',c:true},{t:'Increase FiO₂ during trial',c:false},{t:'Extend SBT to 60 minutes to give more time',c:false}],exp:'SBT failure criteria: RR >35, SpO₂ <90%, HR increase >20%, increased work of breathing, agitation or distress. Multiple failure criteria present. Continuing risks patient fatigue and decompensation.'},
      {prompt:'SBT stopped. Patient returned to PS ventilation. What is the MOST appropriate next action?',opts:[{t:'Immediate tracheostomy',c:false},{t:'Rest patient for 24 hours then reassess readiness for repeat SBT',c:true},{t:'Return to full AC ventilation for 48 hours',c:false},{t:'Increase sedation and restart in 6 hours',c:false}],exp:'After SBT failure, allow patient 24 hours rest on comfortable ventilator settings. Identify and address reversible causes of failure. Daily reassessment with spontaneous awakening trial + SBT bundle is evidence-based.'}
    ]
  }
];

const WAVE_TYPES = { dyssynchrony:true, obstruction:true, ards:true, weaning:true };
let waveAnimFrame = null;
let waveTime = 0;
let currentWaveType = 'flow';

function setWave(type, el){
  document.querySelectorAll('.wave-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.wc').forEach(c=>c.classList.remove('active'));
  document.getElementById('wc-'+type).classList.add('active');
  currentWaveType = type;
  const units={'flow':'L/min','pressure':'cmH₂O','volume':'mL'};
  document.getElementById('wave-lbl').textContent = units[type];
}

function drawWave(canvasId, type, scenarioType){
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 600;
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#050d14'; ctx.fillRect(0,0,W,H);
  // Grid
  ctx.strokeStyle='rgba(14,42,63,.8)'; ctx.lineWidth=1;
  for(let x=0;x<W;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  // Baseline
  ctx.strokeStyle='rgba(0,229,255,.2)'; ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();
  ctx.setLineDash([]);

  const colors={flow:'#00e5ff',pressure:'#ffd740',volume:'#00e676'};
  ctx.strokeStyle=colors[type]||'#00e5ff';
  ctx.lineWidth=2;
  ctx.shadowBlur=6; ctx.shadowColor=colors[type]||'#00e5ff';
  ctx.beginPath();

  const speed=2;
  for(let x=0;x<W;x++){
    const t=(x+waveTime*speed)/W*4*Math.PI;
    let y=H/2;
    if(type==='flow'){
      if(scenarioType==='dyssynchrony'){
        const base=Math.sin(t)*H*0.3;
        const notch=(Math.sin(t*3)*0.15)*(Math.abs(Math.sin(t))>0.3?1:0);
        y=H/2-base-notch*H;
      } else if(scenarioType==='obstruction'){
        y=H/2-(Math.sin(t)*H*0.35)*(Math.cos(t*0.5)>0?1.3:0.4);
      } else if(scenarioType==='ards'){
        y=H/2-Math.sin(t)*H*0.25;
      } else {
        y=H/2-Math.sin(t)*H*0.25*(1+0.1*Math.sin(t*7));
      }
    } else if(type==='pressure'){
      const base=Math.max(0,Math.sin(t));
      if(scenarioType==='ards'){ y=H/2-base*H*0.38; }
      else if(scenarioType==='dyssynchrony'){ y=H/2-base*H*0.35*(1+0.15*Math.sin(t*4)); }
      else { y=H/2-base*H*0.3; }
    } else {
      if(scenarioType==='weaning'){
        y=H/2-Math.max(0,Math.sin(t))*H*0.25*(0.8+0.2*Math.sin(t*0.3));
      } else {
        y=H/2-Math.max(0,Math.sin(t))*H*0.28;
      }
    }
    x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.stroke(); ctx.shadowBlur=0;
}

function animateWaves(){
  const sc=SCENARIOS[S.sim.scenario];
  if(!sc) return;
  waveTime++;
  ['flow','pressure','volume'].forEach(t=>drawWave('wc-'+t,t,sc.wave));
  waveAnimFrame=requestAnimationFrame(animateWaves);
}

const COMPASS_DATA = {
  'SC1': {
    compare: [
      {label:'RR Set', set:'14 /min', actual:'28 /min', warn:true, note:'Patient breathing faster than set'},
      {label:'FiO₂', set:'55%', actual:'55%', warn:false, note:''},
      {label:'TV', set:'520 mL', actual:'520 mL', warn:false, note:''},
      {label:'PEEP', set:'6 cmH₂O', actual:'6 cmH₂O', warn:false, note:''},
      {label:'PIP', set:'—', actual:'36 cmH₂O', warn:true, note:'Elevated peak pressure'},
    ],
    reference: [
      {label:'Normal flow waveform', val:'Smooth descending ramp — no abrupt drops'},
      {label:'Dyssynchrony signs', val:'Irregular waveform, double triggering, flow starvation'},
      {label:'Flow starvation fix', val:'Increase peak flow (≥60 L/min) or switch to PCV'},
      {label:'COPD consideration', val:'Prolonged expiratory time needed — I:E ratio 1:3 or longer'},
      {label:'Sedation role', val:'RASS target -2 — assess if sedation adequate'},
    ],
    hints: [
      'Look at the flow waveform shape — a normal waveform descends smoothly. What do you see instead?',
      'The patient RR is 28 but the ventilator is set to 14 — this mismatch means the patient is generating their own breaths. What type of dyssynchrony does this suggest?',
      'Flow starvation occurs when the patient\'s inspiratory demand exceeds what the ventilator delivers. The fix is to increase peak inspiratory flow to ≥60 L/min or switch to Pressure Control Ventilation (PCV).'
    ]
  },
  'SC2': {
    compare: [
      {label:'SpO₂', set:'≥95%', actual:'78%', warn:true, note:'Critical desaturation'},
      {label:'RR', set:'14 /min', actual:'32 /min', warn:true, note:'Tachypnoea'},
      {label:'FiO₂', set:'60%', actual:'60%', warn:false, note:''},
      {label:'PEEP', set:'8 cmH₂O', actual:'8 cmH₂O', warn:false, note:''},
      {label:'PIP', set:'—', actual:'42 cmH₂O', warn:true, note:'Significantly elevated'},
    ],
    reference: [
      {label:'DOPE mnemonic', val:'Displacement · Obstruction · Pneumothorax · Equipment failure'},
      {label:'First action', val:'Disconnect ventilator — manual bag ventilation to assess lung compliance'},
      {label:'Pneumothorax signs', val:'Absent breath sounds, tracheal deviation, SpO₂ drop post-repositioning'},
      {label:'ETT check', val:'Confirm position at lip — note cm marking, bilateral air entry'},
      {label:'Suction indication', val:'If secretions suspected — pass suction catheter'},
    ],
    hints: [
      'SpO₂ dropped from 97% to 78% during repositioning — use the DOPE mnemonic. What does each letter stand for?',
      'Repositioning is a key clue — ETT displacement is common during turns. What would you check first at the bedside before anything else?',
      'Disconnect the ventilator and use a bag-mask — if lungs are easy to ventilate, obstruction is less likely. If hard to ventilate, think pneumothorax. Auscultate both sides immediately.'
    ]
  },
  'SC3': {
    compare: [
      {label:'TV Set', set:'520 mL', actual:'520 mL', warn:true, note:'Above lung-protective target'},
      {label:'IBW Target', set:'6mL/kg = 450mL', actual:'520 mL delivered', warn:true, note:'70mL above target'},
      {label:'Pplat', set:'<30 cmH₂O', actual:'34 cmH₂O', warn:true, note:'Exceeds safe limit'},
      {label:'FiO₂', set:'70%', actual:'70%', warn:true, note:'High — consider PEEP optimisation'},
      {label:'PEEP', set:'10 cmH₂O', actual:'10 cmH₂O', warn:false, note:''},
    ],
    reference: [
      {label:'ARDS TV target', val:'6 mL/kg IBW (max 8 mL/kg)'},
      {label:'IBW calculation (male)', val:'50 + 0.91 × (height cm − 152.4)'},
      {label:'For 175cm male', val:'IBW = 50 + 0.91×22.6 = 70.6kg → TV target = 424mL'},
      {label:'Plateau pressure target', val:'<30 cmH₂O — driving pressure <15 cmH₂O'},
      {label:'PEEP/FiO₂ table', val:'FiO₂ 0.70 → PEEP 10–12 cmH₂O (ARDSnet table)'},
    ],
    hints: [
      'Look at the TV (520mL) and the patient\'s height (175cm). Calculate IBW using: 50 + 0.91 × (height − 152.4). What TV should this patient be receiving?',
      'IBW ≈ 70kg → target TV = 6×70 = 420mL. The patient is receiving 520mL — 100mL above the lung-protective target. What does this risk?',
      'Volutrauma from excess TV worsens ARDS. Reduce TV to 420mL and monitor Pplat — it should drop below 30 cmH₂O. If Pplat stays high, consider reducing RR or increasing I:E ratio.'
    ]
  },
  'SC4': {
    compare: [
      {label:'SpO₂', set:'≥95%', actual:'97%', warn:false, note:'Adequate'},
      {label:'FiO₂', set:'40%', actual:'40%', warn:false, note:'Acceptable for SBT'},
      {label:'PEEP', set:'5 cmH₂O', actual:'5 cmH₂O', warn:false, note:'Low — appropriate for weaning'},
      {label:'RR', set:'12 /min', actual:'18 /min', warn:false, note:'Within acceptable range'},
      {label:'MIP', set:'>-25 cmH₂O', actual:'-28 cmH₂O', warn:false, note:'Adequate respiratory muscle strength'},
    ],
    reference: [
      {label:'SBT readiness criteria', val:'FiO₂ ≤50%, PEEP ≤8, SpO₂ >90%, haemodynamically stable'},
      {label:'RSBI formula', val:'RR ÷ TV(L) — target <105'},
      {label:'SBT failure signs', val:'RR>35, SpO₂<90%, HR±20%, agitation, diaphoresis'},
      {label:'SBT duration', val:'30–120 minutes on T-piece or low-level PS'},
      {label:'Cuff leak test', val:'Deflate cuff — air leak around ETT suggests adequate airway'},
    ],
    hints: [
      'Before starting an SBT, check readiness criteria: FiO₂ ≤50%, PEEP ≤8, haemodynamically stable, adequate cough. Does this patient meet criteria?',
      'Calculate RSBI = RR ÷ TV in litres. RR is 18, TV is 480mL (0.48L). RSBI = 18÷0.48 = 37.5 — well below 105. What does a low RSBI predict?',
      'RSBI <105 predicts successful extubation. All criteria met. Proceed with 30-minute SBT on T-piece. Monitor for failure signs: RR>35, SpO₂<90%, agitation, diaphoresis, accessory muscle use.'
    ]
  }
};

function buildCompass(sc){
  const data = COMPASS_DATA[sc.id];
  if(!data) return;
  // Compare tab
  const ct = document.getElementById('compare-table');
  if(ct) ct.innerHTML = data.compare.map(r=>`
    <div class="compare-row">
      <span class="compare-label">${r.label}</span>
      <span class="compare-set">${r.set}</span>
      <span class="${r.warn?'compare-warn':'compare-ok'}">${r.actual} ${r.warn?'⚠️':'✓'}</span>
    </div>
    ${r.note?`<div style="font-size:.68rem;color:var(--text3);padding:0 10px 4px;">${r.note}</div>`:''}`
  ).join('');
  // Reference tab
  const rc = document.getElementById('reference-content');
  if(rc) rc.innerHTML = data.reference.map(r=>`
    <div class="ref-item">
      <div class="ref-label">${r.label}</div>
      <div>${r.val}</div>
    </div>`
  ).join('');
  // Reset hints
  window._compassHints = data.hints;
  window._hintLevel = 0;
  const hc = document.getElementById('hint-content');
  if(hc) hc.innerHTML = '';
  const hb = document.getElementById('hint-btn');
  if(hb){ hb.style.display='block'; hb.textContent='💡 Show Hint 1 of 3'; }
}

function toggleCompass(){
  const body = document.getElementById('compass-body');
  const arrow = document.getElementById('compass-arrow');
  const open = body.style.display === 'none';
  body.style.display = open ? 'block' : 'none';
  arrow.style.transform = open ? 'rotate(180deg)' : '';
}

function switchTab(tab){
  ['compare','reference','hint'].forEach(t=>{
    document.getElementById('compass-'+t).style.display = t===tab?'block':'none';
    document.getElementById('ctab-'+t).classList.toggle('active', t===tab);
  });
}

function showNextHint(){
  const hints = window._compassHints || [];
  const level = window._hintLevel || 0;
  if(level >= hints.length) return;
  const hc = document.getElementById('hint-content');
  const div = document.createElement('div');
  div.className = 'hint-box';
  div.innerHTML = `<strong style="color:var(--amber);font-size:.68rem;">HINT ${level+1}</strong><br>${hints[level]}`;
  hc.appendChild(div);
  window._hintLevel = level + 1;
  S.timing.hints_used = (S.timing.hints_used||0) + 1;
  const hb = document.getElementById('hint-btn');
  if(window._hintLevel >= hints.length){
    hb.style.display = 'none';
    const done = document.createElement('div');
    done.className = 'hint-used';
    done.textContent = '— All hints shown — reflect on these before deciding —';
    hc.appendChild(done);
  } else {
    hb.textContent = `💡 Show Hint ${window._hintLevel+1} of 3`;
  }
}

function loadScenario(idx){
  const sc=SCENARIOS[idx];
  // Save previous scenario chat log before resetting
  if(!S.sim.scenarioChatLogs) S.sim.scenarioChatLogs = {};
  if(idx > 0 && S.chat.history.length > 0){
    S.sim.scenarioChatLogs[idx-1] = S.chat.history.map(m=>({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp || null
    }));
  }
  S.sim.scenario=idx; S.sim.step=0;
  S.chat.history=[];
  window._hintLevel=0;
  buildCompass(sc);
  // Kolb: Concrete Experience — participant engages with scenario
  setTimeout(()=>addXP(KOLB_XP.concrete.pts, KOLB_XP.concrete.label), 1000);

  // Patient info
  document.getElementById('pt-name').textContent=sc.title;
  document.getElementById('pt-meta').textContent='MRN: '+sc.mrn+' · '+sc.age+'yr '+sc.sex+' · '+sc.wt+'kg '+sc.ht+'cm';
  document.getElementById('pt-dx').textContent=sc.dx;
  document.getElementById('sc-badge').textContent='SCENARIO '+(idx+1)+'/4';
  document.getElementById('sc-prog').textContent=(idx+1)+' of 4 scenarios';
  document.getElementById('sim-sc-ind').textContent='SCENARIO '+(idx+1)+'/4';

  // Vitals
  const v=sc.vitals;
  ['spo2','hr','rr','bp','etco2','fio2'].forEach(k=>{
    document.getElementById('v-'+k).textContent=v[k];
  });
  // Alert styling
  document.querySelector('.v-spo2').parentElement.classList.toggle('alert',v.spo2<90);
  document.querySelector('.v-hr').parentElement.classList.toggle('alert',v.hr>120||v.hr<50);

  // Vent settings
  const vs=sc.vent;
  document.getElementById('vs-mode').textContent=vs.mode;
  document.getElementById('vs-tv').textContent=vs.tv;
  document.getElementById('vs-rr').textContent=vs.rr;
  document.getElementById('vs-peep').textContent=vs.peep;
  document.getElementById('vs-pip').textContent=vs.pip;
  document.getElementById('vs-fio2').textContent=vs.fio2;
  document.getElementById('vs-ie').textContent=vs.ie;
  document.getElementById('vs-plat').textContent=vs.plat;

  // History
  document.getElementById('hx-box').textContent=sc.hx;

  // Clear chat
  document.getElementById('msgs').innerHTML='';
  S.chat.scenarioSystem = buildSystemPrompt(sc);

  // Load first decision
  loadDecision(0);

  // Restart waveform
  if(waveAnimFrame) cancelAnimationFrame(waveAnimFrame);
  waveTime=0; animateWaves();

  // AI opens scenario proactively
  setTimeout(()=>aiOpenScenario(sc), 1200);
}

function buildSystemPrompt(sc){
  return `You are VentSim AI, a Socratic clinical mentor for ICU nursing education.

SCENARIO: ${sc.title} (${sc.id})
PATIENT: ${sc.age}yr ${sc.sex}, ${sc.dx}
CURRENT VITALS: SpO2 ${sc.vitals.spo2}%, HR ${sc.vitals.hr}bpm, RR ${sc.vitals.rr}, BP ${sc.vitals.bp}, FiO2 ${sc.vitals.fio2}%
VENTILATOR: Mode ${sc.vent.mode}, TV ${sc.vent.tv}mL, PEEP ${sc.vent.peep}cmH2O, PIP ${sc.vent.pip}, Pplat ${sc.vent.plat}

CRITICAL RULE: You MUST read what the nurse just said and respond SPECIFICALLY to it. Never repeat the same question twice. Every response must directly address what was typed.

RESPONSE STRATEGY based on what the nurse says:
- CORRECT or partially correct response: Affirm briefly ("That's an important observation —") then probe deeper with a specific follow-up about mechanism or consequences.
- VAGUE response (e.g. "I don't know", "help", "hint", "I'm not sure", "I did not understand"): Give a CONCRETE pointing hint to one specific piece of data. Example: "Look at the flow waveform — what shape tells you the patient is fighting the machine?"
- WRONG response: Gently redirect without saying wrong. Example: "Interesting — if we did that, what would you expect to happen to the plateau pressure?"
- ASKING WHAT SOMETHING MEANS (e.g. "what is GOLD III", "what is dyssynchrony"): Give a brief 1-sentence factual answer then immediately link it back to this specific patient's data.
- FRUSTRATED or stuck: Be warm and encouraging, give a direct pointing hint to exact numbers in the scenario.
- ASKING FOR MORE HINTS: Escalate specificity — point to exact numbers. Example: "The TV is 520mL for a 75kg patient — lung-protective ventilation targets 6mL/kg IBW. What does that calculate to?"

PROGRESSIVE HINT LEVELS (escalate each time nurse asks for help):
Level 1: Point to a general area ("Look at the waveform pattern")
Level 2: Point to specific data ("The TV is 520mL for a 75kg patient")
Level 3: Near-direct with calculation ("6mL/kg IBW for 75kg = 450mL — how does that compare?")

FORMAT RULES:
- Maximum 3 sentences
- Ask exactly ONE question per response
- Be warm and supportive, like a senior colleague at the bedside
- Never say "correct", "wrong", or "incorrect"
- Always end with a question
- Reference actual numbers from the patient data`;
}

function aiOpenScenario(sc){
  const encouragements = [
    `You're doing great — let's tackle this together. `,
    `Building on your last scenario — you've got this. `,
    `Halfway through — your reasoning is developing well. `,
    `Final scenario — show everything you've learned. `
  ];
  const enc = encouragements[S.sim.scenario] || '';
  const opens = {
    'SC1': `You're taking over care of Mr. Al-Rashidi. Before anything else — what do those ventilator waveforms tell you about how this patient is interacting with the machine?`,
    'SC2': `Ms. Al-Balushi just desaturated from 97% to 78% in three minutes during repositioning. What's the very first thing going through your mind right now?`,
    'SC3': `Looking at Mr. Al-Farsi's ventilator settings and his IBW — is there anything that stands out to you before we go further?`,
    'SC4': `Mrs. Al-Zaabi has been improving and the team is considering extubation. What would you want to assess before even considering a spontaneous breathing trial?`
  };
  const msg = enc + (opens[sc.id] || `You're now caring for this patient. What is your initial clinical impression from the data in front of you?`);
  addMsg('ai', msg);
  S.chat.history.push({role:'assistant', content:msg});
}

function loadDecision(stepIdx){
  const sc=SCENARIOS[S.sim.scenario];
  const dec=sc.decisions[stepIdx];
  if(!dec){ showScenarioDebrief(); return; }
  document.getElementById('dec-prompt').textContent=dec.prompt;
  const opts=document.getElementById('dec-opts');
  opts.innerHTML='';
  dec.opts.forEach((opt,i)=>{
    const btn=document.createElement('button');
    btn.className='dec-opt'; btn.id='dopt-'+i;
    btn.innerHTML=`<span class="dec-icon">○</span>${opt.t}`;
    btn.onclick=()=>makeDecision(i,btn,dec);
    opts.appendChild(btn);
  });
  document.getElementById('sdeb-area').style.display='none';
  // AI asks a focusing question before each decision (after first which is handled by scenario open)
  if(stepIdx>0){ setTimeout(()=>aiPreDecision(dec,stepIdx), 800); }
}

function aiPreDecision(dec, stepIdx){
  const questions=[
    `You've addressed that. Now — ${dec.prompt.toLowerCase().replace('?','.')} What's your clinical reasoning here?`,
    `Good — the patient's condition is evolving. What does the current data suggest you should focus on now?`,
    `Before you choose — what would you expect to happen to this patient's physiology with each of those options?`
  ];
  const q=questions[Math.min(stepIdx-1, questions.length-1)];
  addMsg('sys', '— Decision Point '+(stepIdx+1)+' —');
  // Small delay then AI prompts
  setTimeout(()=>{
    addMsg('ai', q);
    S.chat.history.push({role:'assistant',content:q});
  }, 500);
}

function makeDecision(optIdx, btn, dec){
  const isCorrect=dec.opts[optIdx].c;
  S.sim.total++;
  if(isCorrect) S.sim.correct++;
  S.sim.decisions.push({step:S.sim.step, optIdx, correct:isCorrect, timestamp:Date.now()});
  // Kolb: Abstract Conceptualisation — making a decision
  addXP(KOLB_XP.abstract.pts, KOLB_XP.abstract.label);
  // Kolb: Active Experimentation — correct decision bonus
  if(isCorrect) setTimeout(()=>addXP(KOLB_XP.active.pts, KOLB_XP.active.label), 800);

  // Disable all options and show result
  document.querySelectorAll('.dec-opt').forEach(b=>{
    b.disabled=true;
    const oi=parseInt(b.id.replace('dopt-',''));
    if(dec.opts[oi].c) b.classList.add('correct');
    else if(oi===optIdx && !isCorrect) b.classList.add('incorrect');
  });

  // AI responds to the decision after a short pause
  setTimeout(()=>aiPostDecision(dec, optIdx, isCorrect), 600);

  S.sim.step++;
  const sc=SCENARIOS[S.sim.scenario];
  setTimeout(()=>loadDecision(S.sim.step), 4500);
  saveLocal();
}

async function aiPostDecision(dec, optIdx, isCorrect){
  const chosen=dec.opts[optIdx].t;
  const prompt=`The nurse just chose: "${chosen}". This is ${isCorrect?'the correct clinical approach':'not the optimal choice'}. 
  
  Clinical context for this decision: ${dec.exp}
  
  Your task: WITHOUT saying correct or incorrect, ask one Socratic question that helps the nurse reflect on the REASONING behind this decision and its expected clinical consequences. If the choice was wrong, guide gently toward understanding why the optimal choice would be better. Keep it to 2-3 sentences maximum.`;

  S.chat.history.push({role:'user', content:`I chose: ${chosen}`});
  showTyping();
  try{
    const r=await fetch(WORKER_URL+'/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pid:S.pid,max_tokens:120,system:S.chat.scenarioSystem,messages:[...cleanMsgs(S.chat.history),{role:'user',content:prompt}]})});
    const j=await r.json(); hideTyping();
    const txt=j?.content?.[0]?.text||fallbackPostDecision(isCorrect);
    addMsg('ai',txt); S.chat.history.push({role:'assistant',content:txt});
  }catch(e){ hideTyping(); addMsg('ai',fallbackPostDecision(isCorrect)); }
}
function fallbackPostDecision(isCorrect){
  return isCorrect
    ? `Good thinking. What do you expect to see happen to the patient's physiology over the next few minutes?`
    : `Interesting choice. What was your clinical reasoning there — and what outcome would you anticipate with that approach?`;
}

// Always strip any extra fields before sending to Anthropic API
// Anthropic only accepts {role, content} — nothing else
function cleanMsgs(msgs){ return msgs.map(m=>({role:m.role, content:m.content})); }

async function sendMsg(){
  // Control group — no AI chat
}


function chatKey(e){ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();} }

function addMsg(type,txt){
  const c=document.getElementById('msgs');
  const d=document.createElement('div'); d.className='msg '+type;
  if(type==='sys'){
    d.innerHTML=`<div class="mb">${txt}</div>`; c.appendChild(d);
  } else {
    const av=document.createElement('div');
    av.className='mav '+(type==='usr'?'u':'ai');
    av.textContent=type==='usr'?'RN':'AI';
    const b=document.createElement('div'); b.className='mb'; b.textContent=txt;
    d.appendChild(av); d.appendChild(b); c.appendChild(d);
  }
  c.scrollTop=c.scrollHeight;
}
function showTyping(){
  const c=document.getElementById('msgs');
  const d=document.createElement('div'); d.className='msg ai'; d.id='typing-ind';
  const av=document.createElement('div'); av.className='mav ai'; av.textContent='AI';
  const b=document.createElement('div'); b.className='mb';
  b.innerHTML='<div class="typing"><span></span><span></span><span></span></div>';
  d.appendChild(av); d.appendChild(b); c.appendChild(d);
  c.scrollTop=c.scrollHeight;
}
function hideTyping(){ const t=document.getElementById('typing-ind'); if(t) t.remove(); }

function getLevel(xp){
  if(xp>=300) return {name:'ICU Expert',icon:'🏆'};
  if(xp>=150) return {name:'Senior Clinician',icon:'🎖️'};
  if(xp>=50)  return {name:'ICU Nurse',icon:'⭐'};
  return {name:'Resident',icon:'🩺'};
}
// Kolb XP stages:
// Concrete Experience (observing) = awarded when scenario loads
// Reflective Observation (AI chat engagement) = awarded when sending a message
// Abstract Conceptualisation (making a decision) = awarded on any decision
// Active Experimentation (correct decision bonus) = awarded for correct decisions
const KOLB_XP = {
  concrete: {pts:10, label:'Concrete Experience'},
  reflective: {pts:20, label:'Reflective Observation'},
  abstract: {pts:35, label:'Abstract Conceptualisation'},
  active: {pts:15, label:'Active Experimentation'}
};

function addXP(points, stage){
  S.xp += points;
  const badge = document.getElementById('xp-badge');
  if(badge){
    const lv = getLevel(S.xp);
    badge.textContent = `${lv.icon} ${S.xp} XP`;
    badge.classList.remove('xp-pop');
    void badge.offsetWidth;
    badge.classList.add('xp-pop');
  }
  const toast = document.createElement('div');
  toast.className = 'xp-gain-toast';
  toast.innerHTML = `+${points} XP<br><span style="font-size:.65rem;opacity:.8;">${stage||''}</span>`;
  document.body.appendChild(toast);
  setTimeout(()=>toast.remove(), 2100);
}
function getStars(pct){
  if(pct===100) return 3;
  if(pct>=67) return 2;
  if(pct>=33) return 1;
  return 0;
}
function renderStars(n){
  return `<div class="stars-wrap">${[1,2,3].map(i=>`<span class="${i<=n?'star-lit':'star-dim'}">★</span>`).join('')}</div>`;
}
function showScenarioDebrief(){
  const sc=SCENARIOS[S.sim.scenario];
  const correct=S.sim.decisions.filter(d=>d.correct&&SCENARIOS[S.sim.scenario]&&d.step<sc.decisions.length).length;
  // Count for this scenario only
  const scDecisions=S.sim.decisions.filter(d=>{
    const start=S.sim.scenario*3;
    return d.step>=start&&d.step<start+3;
  });
  const scCorrect=scDecisions.filter(d=>d.correct).length;
  const pct=Math.round((scCorrect/3)*100);
  const cls=pct>=67?'good':pct>=33?'mid':'poor';
  const stars=getStars(pct);
  // XP already awarded per Kolb stage during scenario — just show total
  const lv=getLevel(S.xp);
  const msg=pct===100?'🏆 Perfect scenario! Exceptional clinical reasoning!':
    pct>=67?'⭐ Strong clinical reasoning on this scenario.':
    pct>=33?'💪 Good effort — review the decision rationale below.':
    '📚 This was challenging — the explanations below will reinforce key concepts.';
  const kolbSummary=`<div style="font-size:.7rem;color:var(--text3);font-family:var(--mono);margin-top:4px;">
    Kolb XP earned: CE +${KOLB_XP.concrete.pts} · RO up to +${KOLB_XP.reflective.pts*3} · AC +${KOLB_XP.abstract.pts*3} · AE +${scCorrect*KOLB_XP.active.pts}
  </div>`;
  const area=document.getElementById('sdeb-area');
  area.style.display='block';
  area.innerHTML=`<div class="sdeb-wrap">
    <div class="sdeb-score">
      <div class="sdeb-ring ${cls}">${pct}%</div>
      <div>
        <strong style="color:var(--text);font-family:var(--sans);">Scenario ${S.sim.scenario+1} Complete</strong>
        ${renderStars(stars)}
        <span style="font-size:.78rem;color:var(--text3);">${sc.title}</span><br>
        <span style="font-size:.72rem;color:var(--green);font-family:var(--mono);">${lv.icon} ${lv.name} · ${S.xp} XP Total</span>
        ${kolbSummary}
      </div>
    </div>
    <div class="sdeb-fb">${msg}<br><br>
    ${sc.decisions.map((d,i)=>`<strong>Decision ${i+1}:</strong> ${d.exp}`).join('<br><br>')}
    </div>
    ${S.sim.scenario<3?`<button class="btn btn-p" style="margin-top:14px;width:100%;" onclick="nextScenario()">▶ SCENARIO ${S.sim.scenario+2}</button>`:`<button class="btn btn-g" style="margin-top:14px;width:100%;" onclick="endSim()">✓ COMPLETE SIMULATION</button>`}
  </div>`;
  area.scrollIntoView({behavior:'smooth'});
  // AI scenario closing reflection
  setTimeout(()=>aiCloseScenario(sc,pct), 800);
}

async function aiCloseScenario(sc, pct){
  const prompt=`The nurse has just completed scenario ${S.sim.scenario+1}: "${sc.title}" with ${pct}% decision accuracy. 

  Ask ONE reflective question that prompts them to consolidate their learning from this scenario — what would they do differently next time, or what was the most important clinical lesson? Keep it to 2 sentences, warm and encouraging.`;
  showTyping();
  try{
    const r=await fetch(WORKER_URL+'/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pid:S.pid,max_tokens:100,system:S.chat.scenarioSystem,messages:[{role:'user',content:prompt}]})});
    const j=await r.json(); hideTyping();
    const txt=j?.content?.[0]?.text||`Reflecting on this scenario — what is the single most important clinical principle you'll take forward from this case?`;
    addMsg('ai',txt);
  }catch(e){ hideTyping(); addMsg('ai',`Reflecting on this scenario — what is the single most important clinical principle you'll take forward from this case?`); }
}

function nextScenario(){
  S.sim.scenario++;
  loadScenario(S.sim.scenario);
  window.scrollTo({top:0,behavior:'smooth'});
  const pctMap=[55,62,68,75];
  setProg(pctMap[S.sim.scenario]||70);
}
function endSim(){
  if(waveAnimFrame) cancelAnimationFrame(waveAnimFrame);
  S.sim.endTime=Date.now();
  S.sim.durationSec=Math.floor((S.sim.endTime-S.sim.startTime)/1000);
  // Save final scenario chat log
  if(!S.sim.scenarioChatLogs) S.sim.scenarioChatLogs = {};
  if(S.chat.history.length > 0){
    S.sim.scenarioChatLogs[S.sim.scenario] = S.chat.history.map(m=>({
      role: m.role, content: m.content, timestamp: m.timestamp||null
    }));
  }
  buildMCQ('mcq-post-cont','postMCQ');
  show('postmcq-sc'); setProg(75); saveLocal();
}
function startSim(){
  S.sim.startTime=Date.now();
  show('sim-sc'); setProg(55);
  loadScenario(0);
}

/* ═══════════════════════════════════════════
   DEBRIEF
═══════════════════════════════════════════ */
// Populate researcher email spans safely via JS (avoids Cloudflare obfuscation)
function populateEmails(){
  const e = ['s','a','m','i','r','.','a','l','n','a','s','s','e','r','i','@','g','m','a','i','l','.','c','o','m'].join('');
  document.querySelectorAll('.researcher-email').forEach(function(el){
    el.innerHTML = '<a href="mailto:'+e+'" style="color:var(--cyan);text-decoration:none;">'+e+'</a>';
  });
}
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', populateEmails);
} else {
  populateEmails();
}

function renderMarkdown(text){
  if(!text) return '';
  return text
    // Headers ## and ###
    .replace(/^### (.+)$/gm, '<h4 style="color:var(--cyan);font-family:var(--sans);margin:14px 0 6px;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color:var(--cyan);font-family:var(--sans);margin:16px 0 8px;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h3 style="color:var(--cyan);font-family:var(--sans);margin:16px 0 8px;">$1</h3>')
    // Bold **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--text);">$1</strong>')
    // Bullet points - item
    .replace(/^[-•]\s+(.+)$/gm, '<div style="display:flex;gap:8px;margin:4px 0;"><span style="color:var(--cyan);flex-shrink:0;">▸</span><span>$1</span></div>')
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<div style="display:flex;gap:8px;margin:4px 0;padding-left:4px;"><span style="color:var(--amber);flex-shrink:0;">◆</span><span>$1</span></div>')
    // Double newlines = paragraph break
    .replace(/\n\n/g, '</p><p style="margin:10px 0;">')
    // Single newlines
    .replace(/\n/g, '<br>')
    // Wrap in paragraph
    .replace(/^/, '<p style="margin:0;">')
    .replace(/$/, '</p>');
}

async function loadDebrief(){
  const preMCQ=S.data.preMCQScore||0;
  const postMCQ=S.data.postMCQScore||0;
  const preCDMNS=cdmnsTotal('preCDMNS');
  const postCDMNS=cdmnsTotal('postCDMNS');
  const acc=S.sim.total>0?Math.round((S.sim.correct/S.sim.total)*100):0;

  document.getElementById('deb-sim-score').textContent=S.sim.correct+'/'+S.sim.total;
  document.getElementById('deb-sim-acc').textContent=acc+'% accuracy';
  document.getElementById('deb-mcq-gain').textContent=(postMCQ-preMCQ>=0?'+':'')+(postMCQ-preMCQ);
  document.getElementById('deb-mcq-sub').textContent=preMCQ+' → '+postMCQ+' / 20';
  document.getElementById('deb-cdmns-gain').textContent=(postCDMNS-preCDMNS>=0?'+':'')+(postCDMNS-preCDMNS);

  const debPrompt=`Generate a personalised clinical debrief (per INACSL Standards 2021) for an ICU nurse who just completed VentSim AI.

PERFORMANCE DATA:
- Simulation: ${S.sim.correct}/${S.sim.total} correct decisions (${acc}% accuracy)
- MCQ: Pre ${preMCQ}/20 → Post ${postMCQ}/20 (gain: ${postMCQ-preMCQ})
- CDMNS: Pre ${preCDMNS}/200 → Post ${postCDMNS}/200 (gain: ${postCDMNS-preCDMNS})
- Scenarios completed: Patient-Ventilator Dyssynchrony, Acute Desaturation/DOPE, ARDS Lung Protective Ventilation, Weaning Readiness/SBT

Write a debrief with 4 clear sections:
1. Performance Summary (2–3 sentences — specific, not generic)
2. Clinical Strengths Demonstrated
3. Key Learning Areas (specific to ventilation management)
4. One Forward-Looking Takeaway

Keep total length under 220 words. Be warm, evidence-based, and specific to mechanical ventilation nursing.`;

  try{
    const r=await fetch(WORKER_URL+'/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pid:S.pid,max_tokens:300,messages:[{role:'user',content:debPrompt}]})});
    const j=await r.json();
    const txt=j?.content?.[0]?.text||'Your performance data has been recorded. Thank you for your participation in this research study.';
    document.getElementById('deb-fb').innerHTML=renderMarkdown(txt);
  }catch(e){
    document.getElementById('deb-fb').textContent='Simulation complete. Correct decisions: '+S.sim.correct+'/'+S.sim.total+'. Your MCQ score changed from '+preMCQ+' to '+postMCQ+'. All data has been recorded. Thank you for your participation.';
  }
}

/* ═══════════════════════════════════════════
   FINISH & SAVE
═══════════════════════════════════════════ */
async function finish(){
  loader(true,'SAVING SESSION DATA...');
  const preCDMNS=S.data.preCDMNS||{};
  const postCDMNS=S.data.postCDMNS||{};
  const acc=S.sim.total>0?Math.round((S.sim.correct/S.sim.total)*100):0;
  // Build per-scenario chat logs
  const chatLogs = {};
  if(S.sim.scenarioChatLogs){
    Object.keys(S.sim.scenarioChatLogs).forEach(scIdx => {
      const sc = SCENARIOS[parseInt(scIdx)];
      chatLogs['scenario_'+(parseInt(scIdx)+1)+'_'+sc.id] = S.sim.scenarioChatLogs[scIdx];
    });
  }

  const record={
    session_id:S.sessionId, participant_id:S.pid, group:'control',
    version:'control-v1', session_date:S.date,
    timestamp:new Date().toISOString(),
    demographics:S.data.demo,
    pre_mcq_score:S.data.preMCQScore, pre_mcq_raw:S.data.preMCQ,
    post_mcq_score:S.data.postMCQScore, post_mcq_raw:S.data.postMCQ,
    mcq_gain:(S.data.postMCQScore||0)-(S.data.preMCQScore||0),
    pre_cdmns_raw:preCDMNS, pre_cdmns_total:cdmnsTotal('preCDMNS'),
    post_cdmns_raw:postCDMNS, post_cdmns_total:cdmnsTotal('postCDMNS'),
    cdmns_gain:cdmnsTotal('postCDMNS')-cdmnsTotal('preCDMNS'),
    tam_raw:S.data.tam, tam_total:Object.values(S.data.tam||{}).reduce((a,b)=>a+b,0),
    aisam_raw:S.data.aisam||null,
    aisam_total:S.data.aisam?Object.values(S.data.aisam).reduce((a,b)=>a+b,0):null,
    simulation:{
      correct:S.sim.correct, total:S.sim.total,
      accuracy_pct:acc, decisions:S.sim.decisions,
      duration_sec:S.sim.durationSec||0,
      duration_min:parseFloat(((S.sim.durationSec||0)/60).toFixed(1))
    },
    ai_chat_logs: chatLogs,
    ai_chat_summary: {
      total_user_messages: Object.values(chatLogs).reduce((a,sc)=>a+(sc.filter(m=>m.role==='user').length),0),
      total_ai_messages: Object.values(chatLogs).reduce((a,sc)=>a+(sc.filter(m=>m.role==='assistant').length),0),
      scenarios_with_chat: Object.values(chatLogs).filter(sc=>sc.some(m=>m.role==='user')).length
    },
    timing: {
      total_session_sec: S.timing.sessionStart ? Math.round((Date.now()-S.timing.sessionStart)/1000) : null,
      screen_times_sec: S.timing.screens,
      hints_used_total: S.timing.hints_used||0,
      flags: {
        fast_precdmns: (S.timing.screens['precdmns-sc']||999) < 120,
        fast_postcdmns: (S.timing.screens['postcdmns-sc']||999) < 120,
        fast_premcq: (S.timing.screens['premcq-sc']||999) < 60,
        fast_postmcq: (S.timing.screens['postmcq-sc']||999) < 60,
        fast_tam: (S.timing.screens['tam-sc']||999) < 60
      }
    }
  };

  let saveOk=false;
  if(window._testMode){
    console.log('TEST MODE — data not saved to server:',record);
    saveOk=true;
  } else {
    try{
      const r=await fetch(WORKER_URL+'/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});
      const j=await r.json(); saveOk=j.success;
    }catch(e){}
  }

  localStorage.setItem('ventsim_final_'+S.pid,JSON.stringify(record));
  localStorage.removeItem('ventsim_'+S.pid);

  show('ty-sc'); setProg(100);
  populateTyScreen();
  loader(false);
}

function populateTyScreen(){
  const pid = document.getElementById('ty-pid');
  const sid = document.getElementById('ty-sid');
  if(pid) pid.textContent = S.pid;
  if(sid) sid.textContent = S.sessionId||'—';

  // Performance summary
  const preMCQ = S.data.preMCQScore||0;
  const postMCQ = S.data.postMCQScore||0;
  const gain = postMCQ - preMCQ;
  const gainStr = gain>0?`<span style="color:var(--green)">+${gain}</span>`: gain<0?`<span style="color:var(--red)">${gain}</span>`:`<span style="color:var(--text3)">no change</span>`;
  const simPct = S.sim.total>0?Math.round((S.sim.correct/S.sim.total)*100):0;
  const sumEl = document.getElementById('ty-summary');
  if(sumEl) sumEl.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div style="background:var(--bg2);padding:10px;border-radius:6px;">
        <div style="font-size:.68rem;color:var(--text3);font-family:var(--mono);">PRE-TEST MCQ</div>
        <div style="font-size:1.4rem;color:var(--cyan);font-family:var(--mono);">${preMCQ}/20</div>
      </div>
      <div style="background:var(--bg2);padding:10px;border-radius:6px;">
        <div style="font-size:.68rem;color:var(--text3);font-family:var(--mono);">POST-TEST MCQ</div>
        <div style="font-size:1.4rem;color:var(--cyan);font-family:var(--mono);">${postMCQ}/20 (${gainStr})</div>
      </div>
      <div style="background:var(--bg2);padding:10px;border-radius:6px;">
        <div style="font-size:.68rem;color:var(--text3);font-family:var(--mono);">SIMULATION ACCURACY</div>
        <div style="font-size:1.4rem;color:var(--green);font-family:var(--mono);">${simPct}%</div>
      </div>
      <div style="background:var(--bg2);padding:10px;border-radius:6px;">
        <div style="font-size:.68rem;color:var(--text3);font-family:var(--mono);">TOTAL XP EARNED</div>
        <div style="font-size:1.4rem;color:var(--amber);font-family:var(--mono);">${S.xp} XP</div>
      </div>
    </div>`;

  // XP level summary
  const lv = getLevel(S.xp);
  const xpEl = document.getElementById('ty-xp');
  if(xpEl) xpEl.innerHTML = `
    <div style="font-size:1.5rem;margin-bottom:6px;">${lv.icon} <strong style="color:var(--green);">${lv.name}</strong></div>
    <div>Total XP: <strong style="color:var(--amber);">${S.xp} points</strong></div>
    <div style="font-size:.75rem;margin-top:4px;">Earned through: observing clinical data, reflecting with AI mentor, making decisions, and correct clinical reasoning.</div>`;
}

function printCertificate(){
  const name = S.pid || 'Participant';
  const date = new Date().toLocaleDateString('en-GB',{year:'numeric',month:'long',day:'numeric'});
  const lv = getLevel(S.xp);
  const certHTML = `
    <!DOCTYPE html><html><head><title>VentSim AI — Participation Certificate</title>
    <style>
      body{font-family:'Times New Roman',serif;background:#fff;color:#111;margin:0;padding:40px;}
      .cert{max-width:700px;margin:auto;border:3px double #1a3a6e;padding:50px;text-align:center;}
      .cert-logo{font-size:1.1rem;color:#1a3a6e;letter-spacing:2px;text-transform:uppercase;margin-bottom:30px;}
      .cert-title{font-size:2rem;font-weight:bold;color:#1a3a6e;margin-bottom:10px;}
      .cert-sub{font-size:1rem;color:#555;margin-bottom:30px;}
      .cert-name{font-size:1.6rem;font-weight:bold;border-bottom:2px solid #1a3a6e;display:inline-block;padding:0 30px 6px;margin:10px 0 30px;}
      .cert-body{font-size:.95rem;line-height:1.9;color:#333;margin-bottom:30px;}
      .cert-xp{background:#f0f7ff;border:1px solid #1a3a6e;border-radius:8px;padding:12px;margin:20px 0;font-size:.9rem;}
      .cert-sig{display:flex;justify-content:space-around;margin-top:50px;font-size:.85rem;}
      .cert-sig div{text-align:center;}
      .cert-sig .line{border-top:1px solid #111;width:180px;margin:0 auto 6px;}
      .cert-footer{font-size:.7rem;color:#888;margin-top:30px;border-top:1px solid #ddd;padding-top:14px;}
      @media print{body{padding:0;}}
    </style></head><body>
    <div class="cert">
      <div class="cert-logo">Universiti Malaya · Faculty of Education · 2026</div>
      <div class="cert-title">Certificate of Participation</div>
      <div class="cert-sub">This is to certify that</div>
      <div class="cert-name">Participant ${name}</div>
      <div class="cert-body">
        has successfully completed the<br>
        <strong>VentSim AI — Clinical Simulation Session</strong><br>
        as part of the research study:<br><br>
        <em>"Effect of Generative AI-Driven Standardized Patient Simulation on ICU Nurses' Clinical Decision-Making and Technology Acceptance in Mechanical Ventilation Management"</em><br><br>
        Session Date: ${date}
      </div>
      <div class="cert-xp">
        Achievement Level: <strong>${lv.icon} ${lv.name}</strong> · Total XP: <strong>${S.xp} points</strong><br>
        <small>Based on Kolb's Experiential Learning Cycle engagement</small>
      </div>
      <div class="cert-sig">
        <div>
          <div class="line"></div>
          Samir Alnasseri<br>PhD Candidate · Universiti Malaya<br>samir.alnasseri@gmail.com<br>+968 9944245
        </div>
        <div>
          <div class="line"></div>
          Dr. Noor Hanita Binti Zaini<br>Main Supervisor<br>Universiti Malaya
        </div>
      </div>
      <div class="cert-footer">
        This certificate is issued for research participation record only. It does not constitute a formal academic award.<br>
        VentSim AI Platform · Universiti Malaya · 2026
      </div>
    </div>
    </body></html>`;
  const w = window.open('','_blank','width=800,height:700');
  w.document.write(certHTML);
  w.document.close();
  w.print();
}

// ── CONSOLE PROTECTION ──
(function(){
  // Researcher bypass — ?dev=1 in URL skips all protection immediately
  const params = new URLSearchParams(window.location.search);
  if(params.get('dev')==='1') return;
  // Dynamic check — also bypasses after SAMIR/TEST/DEMO login
  const isResearcher = () => window._testMode || (window.S && ['SAMIR','TEST','DEMO'].includes(window.S.pid));

  // Disable right-click
  document.addEventListener('contextmenu',e=>{ if(!isResearcher()) e.preventDefault(); });
  // Disable F12, Ctrl+Shift+I, Ctrl+U
  document.addEventListener('keydown',e=>{
    if(isResearcher()) return;
    if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&['I','J','C'].includes(e.key))||(e.ctrlKey&&e.key==='U')){
      e.preventDefault(); return false;
    }
  });
  // DevTools detection — freeze if opened
  let devOpen=false;
  const threshold=160;
  setInterval(()=>{
    if(isResearcher()){ devOpen=false; return; }
    if(window.outerWidth-window.innerWidth>threshold||window.outerHeight-window.innerHeight>threshold){
      if(!devOpen){
        devOpen=true;
        document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#050d14;color:#ff5252;font-family:monospace;font-size:1.2rem;text-align:center;padding:40px;">⚠️ DevTools detected. Please close to continue.</div>';
      }
    } else { devOpen=false; }
  },1000);
  console.log('%c⛔ STOP!','color:red;font-size:2rem;font-weight:bold;');
  console.log('%cThis is a research platform.','color:#ff5252;font-size:1rem;');
})();

var EXPERT_KEYS = {
  'EXPERT01': '4IIU',
  'EXPERT02': '38LK',
  'EXPERT03': 'SJQR',
  'EXPERT04': 'RL8M',
  'EXPERT05': '3TGT',
  'EXPERT06': 'OO79',
  'EXPERT07': 'ZXSZ',
  'EXPERT08': 'I2CK',
  'EXPERT09': 'AGVP',
  'EXPERT10': 'K0PD'
};

var E = {id:'', name:'', role:'', years:'', inst:'', ratings:{}, comments:{}, rec:''};

// Validate URL key on load
var URL_PARAMS = new URLSearchParams(window.location.search);
var URL_ID = (URL_PARAMS.get('id') || '').toUpperCase();
var URL_KEY = (URL_PARAMS.get('key') || '').toUpperCase();
var VALID_ACCESS = URL_ID && URL_KEY && EXPERT_KEYS[URL_ID] === URL_KEY;
var SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxlOp_9TrmWy40PZmCpMZZN5QFLR3Z9pkoz39AJlECBGMS6JDA7BY5jcPIG58STb03z/exec';

var SCENARIOS = [
  {id:'SC1', title:'Patient-Ventilator Dyssynchrony',
   context:'Mr. Al-Rashidi, 58M, Post-op Day 3 after emergency laparotomy. Background COPD GOLD III. RASS -1. Increasing patient-triggered breaths not matching ventilator cycles. SpO2 91%, HR 108.',
   params:'Mode: AC/VC | TV: 550 mL | RR: 14 | PEEP: 5 | FiO2: 55% | PIP: 38 cmH2O',
   items:['The scenario accurately represents patient-ventilator dyssynchrony as encountered in ICU practice.',
          'The patient history and demographics are realistic for an Omani ICU setting.',
          'The ventilator parameters presented are clinically accurate for this scenario.',
          'The decision options reflect genuine clinical choices an ICU nurse would face.',
          'The clinical explanations after each decision are evidence-based and educationally appropriate.']},
  {id:'SC2', title:'Acute Desaturation - DOPE',
   context:'Ms. Al-Balushi, 44F, intubated 18 hours ago for Type 2 respiratory failure. ETT 7.5mm at 22cm lip. SpO2 dropped from 97% to 78% during repositioning.',
   params:'Mode: AC/VC | TV: 420 mL | RR: 18 | PEEP: 8 | FiO2: 100% | SpO2: 78% | HR: 132',
   items:['The DOPE mnemonic framework is accurately applied in this scenario.',
          'The scenario realistically represents acute desaturation following repositioning.',
          'The sequence of clinical events is logical and educationally sound.',
          'The decision options are clinically appropriate and discriminating.',
          'The scenario adequately covers key competencies for managing acute ETT complications.']},
  {id:'SC3', title:'ARDS Lung Protective Ventilation',
   context:'Mr. Al-Farsi, 51M, ARDS Day 2 secondary to sepsis. IBW 72kg. ABG: pH 7.28, PaO2 62 mmHg, PaCO2 58 mmHg. P/F ratio 77.5. Settings appear non-compliant with ARDSNet.',
   params:'Mode: AC/VC | TV: 650 mL (9 mL/kg IBW) | RR: 18 | PEEP: 10 | FiO2: 80% | Plat: 34 cmH2O',
   items:['The ARDSNet protocol parameters are accurately represented.',
          'The scenario appropriately challenges nurses on lung protective ventilation.',
          'The patient data (ABG, P/F ratio, ventilator settings) is clinically realistic.',
          'The decision options reflect current evidence-based ARDS management.',
          'The scenario is at an appropriate difficulty level for ICU nurses.']},
  {id:'SC4', title:'Weaning Readiness and SBT',
   context:'Mrs. Al-Zaabi, 67F, ARDS Day 7, showing improvement. FiO2 40%, PEEP 6. Spontaneous breathing efforts noted. Team considering extubation. RSBI: 78.',
   params:'Mode: SIMV | RR set: 10 | PEEP: 6 | FiO2: 40% | SpO2: 96% | PS: 10 cmH2O | RSBI: 78',
   items:['The weaning readiness criteria presented are consistent with current clinical guidelines.',
          'The SBT protocol is accurately represented.',
          'The scenario appropriately assesses nurses ability to evaluate extubation readiness.',
          'The decision options reflect genuine clinical judgment required for weaning.',
          'The scenario adequately covers key competencies for ventilator liberation.']}
];

var MCQ_ITEMS = [
  'In volume-controlled ventilation, which parameter directly determines the tidal volume delivered?',
  'A patient on AC/VC mode has a set rate of 14 breaths/min but is triggering 22 breaths/min. This is best described as:',
  'The ARDSNet protocol recommends a tidal volume of:',
  'Which of the following BEST indicates patient-ventilator dyssynchrony?',
  'During a spontaneous breathing trial, which finding would indicate failure?',
  'In ARDS management, the primary goal of PEEP titration is to:',
  'A patient peak inspiratory pressure suddenly increases from 28 to 48 cmH2O. The FIRST action should be:',
  'The P/F ratio is used to assess:',
  'Which ventilator mode allows the patient to breathe spontaneously at any point in the respiratory cycle?',
  'Auto-PEEP is MOST likely to occur in patients with:',
  'The plateau pressure reflects:',
  'In pressure support ventilation, the clinician directly sets:',
  'Which finding during a spontaneous breathing trial indicates readiness for extubation?',
  'The DOPE mnemonic for acute desaturation stands for:',
  'A patient with ARDS has a PaO2 of 55 mmHg on FiO2 0.60. The P/F ratio is:',
  'Which of the following is a sign of over-distension on pressure-volume loop?',
  'Intrinsic PEEP can be measured by:',
  'In a patient with COPD on mechanical ventilation, which strategy reduces air trapping?',
  'The primary indication for lung protective ventilation is:',
  'Which parameter should be monitored to detect ventilator-induced lung injury?'
];

var USABILITY_ITEMS = [
  'The platform interface is visually clear and easy to navigate.',
  'The patient information in each scenario is well-organised and easy to read.',
  'The ventilator waveform displays are realistic and clinically meaningful.',
  'The Clinical Compass reference panel provides useful clinical information.',
  'The AI mentor Socratic questioning approach is appropriate for clinical education.',
  'The MCQ and CDMNS instruments are clearly presented and easy to complete.',
  'The TAM questionnaire items are clear and appropriate for this context.',
  'The overall flow of the platform is logical.',
  'The platform is appropriate for use on mobile devices and tablets.',
  'The time required to complete the platform (approximately 90 minutes) is reasonable.'
];

function showSc(id){
  document.querySelectorAll('.sc').forEach(function(s){s.classList.remove('active');});
  document.getElementById(id).classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
}

function switchSec(id){
  document.querySelectorAll('.sec').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('.nav-tab').forEach(function(t){t.classList.remove('active');});
  document.getElementById('sec-'+id).classList.add('active');
  document.getElementById('tab-'+id).classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  var map = {scenarios:25,mcq:50,usability:75,overall:90};
  document.getElementById('prog').style.width = (map[id]||25)+'%';
}

function setCVI(key, val, btn){
  E.ratings[key] = val;
  var parent = btn.closest('.cvi-item');
  if(parent){
    parent.querySelectorAll('.cvi-opt').forEach(function(b){
      b.classList.remove('sel-1','sel-2','sel-3','sel-4');
    });
  }
  btn.classList.add('sel-'+val);
}

function setRec(val, btn){
  E.rec = val;
  document.getElementById('rec-btns').querySelectorAll('.cvi-opt').forEach(function(b){
    b.style.borderColor='';b.style.color='';
  });
  btn.style.borderColor='var(--cyan)';
  btn.style.color='var(--cyan)';
}

function makeCVIItem(key, text, commentKey){
  var div = document.createElement('div');
  div.className = 'cvi-item';
  var q = document.createElement('div');
  q.className = 'cvi-q';
  q.textContent = text;
  div.appendChild(q);
  var scale = document.createElement('div');
  scale.className = 'cvi-scale';
  var labels = ['1 - Not relevant','2 - Somewhat relevant','3 - Relevant','4 - Highly relevant'];
  labels.forEach(function(lbl, i){
    var btn = document.createElement('button');
    btn.className = 'cvi-opt';
    btn.textContent = lbl;
    var val = i+1;
    var k = key;
    btn.onclick = function(){ setCVI(k, val, btn); };
    scale.appendChild(btn);
  });
  div.appendChild(scale);
  var ta = document.createElement('textarea');
  ta.className = 'cvi-comment';
  ta.placeholder = 'Optional comment...';
  var ck = commentKey;
  ta.addEventListener('input', function(){ E.comments[ck] = ta.value; });
  div.appendChild(ta);
  return div;
}

function buildAll(){
  // Scenarios
  var scCont = document.getElementById('scenario-cont');
  scCont.innerHTML = '';
  SCENARIOS.forEach(function(sc, si){
    var card = document.createElement('div');
    card.className = 'card';
    var title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = sc.id + ': ' + sc.title;
    card.appendChild(title);
    var box = document.createElement('div');
    box.className = 'scenario-box';
    box.innerHTML = '<strong style="color:var(--text);">Clinical Context:</strong> ' + sc.context + '<br><br><strong style="color:var(--text);">Parameters:</strong> ' + sc.params;
    card.appendChild(box);
    sc.items.forEach(function(item, ii){
      card.appendChild(makeCVIItem('sc'+si+'_'+ii, item, 'sc'+si+'_c'+ii));
    });
    scCont.appendChild(card);
  });

  // MCQ
  var mcqCont = document.getElementById('mcq-cont');
  mcqCont.innerHTML = '';
  var mcqCard = document.createElement('div');
  mcqCard.className = 'card';
  var mcqTitle = document.createElement('div');
  mcqTitle.className = 'card-title';
  mcqTitle.textContent = 'MCQ Items - Rate for Relevance and Clarity';
  mcqCard.appendChild(mcqTitle);
  MCQ_ITEMS.forEach(function(item, i){
    mcqCard.appendChild(makeCVIItem('mcq_'+i, 'Item '+(i+1)+': '+item, 'mcq_c'+i));
  });
  mcqCont.appendChild(mcqCard);

  // Usability
  var useCont = document.getElementById('usability-cont');
  useCont.innerHTML = '';
  var useCard = document.createElement('div');
  useCard.className = 'card';
  var useTitle = document.createElement('div');
  useTitle.className = 'card-title';
  useTitle.textContent = 'Platform Usability and Face Validity';
  useCard.appendChild(useTitle);
  USABILITY_ITEMS.forEach(function(item, i){
    useCard.appendChild(makeCVIItem('use_'+i, item, 'use_c'+i));
  });
  useCont.appendChild(useCard);

  // Overall
  var overallCont = document.getElementById('overall-cont');
  overallCont.innerHTML = '';
  var overallItems = [
    'The VentSim AI platform is appropriate for assessing ICU nurses clinical decision-making in mechanical ventilation.',
    'The platform is suitable for use with ICU nurses in Oman without significant cultural modifications.'
  ];
  overallItems.forEach(function(item, i){
    overallCont.appendChild(makeCVIItem('overall_'+i, item, 'overall_c'+i));
  });
}

function calcCVI(prefix){
  var keys = Object.keys(E.ratings).filter(function(k){ return k.indexOf(prefix) === 0; });
  if(keys.length === 0) return 'N/A';
  var relevant = keys.filter(function(k){ return E.ratings[k] >= 3; }).length;
  return (relevant / keys.length).toFixed(2);
}

// Check if returning from platform
window.addEventListener('DOMContentLoaded', function(){
  var returning = sessionStorage.getItem('expert_from_review');
  var profile = sessionStorage.getItem('expert_profile');
  if(returning === 'done' && profile){
    var p = JSON.parse(profile);
    E.id = p.id; E.name = p.name; E.role = p.role; E.years = p.years; E.inst = p.inst;
    document.getElementById('exp-hdr').textContent = (p.id||'') + ' | ' + p.role;
    buildAll();
    showSc('sc-review');
    document.getElementById('prog').style.width = '25%';
    sessionStorage.removeItem('expert_from_review');
    // Show welcome back message
    var banner = document.createElement('div');
    banner.style.cssText = 'background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.3);color:var(--green);font-family:var(--mono);font-size:.75rem;padding:10px 16px;border-radius:6px;margin-bottom:16px;';
    banner.textContent = 'Welcome back! Please now complete your expert ratings below.';
    document.querySelector('.wrap').insertBefore(banner, document.querySelector('.nav-tabs'));
  }
  document.getElementById('begin-btn').addEventListener('click', startExpert);
  document.getElementById('submit-btn').addEventListener('click', submitExpert);
});

function goToPlatform(){
  sessionStorage.setItem('expert_from_review', 'going');
  var profile = JSON.parse(sessionStorage.getItem('expert_profile')||'{}');
  var eid = profile.id || 'EXPERT';
  window.open('https://ventsim2.pages.dev/ventsim-study.html?pid='+eid+'&dev=1', '_blank');
  // Show waiting screen
  document.getElementById('sc-redirect').innerHTML = document.getElementById('sc-redirect').innerHTML + '';
  showSc('sc-waiting');
}

function skipToPlatform(){
  var profile = sessionStorage.getItem('expert_profile');
  if(profile){
    var p = JSON.parse(profile);
    E.name = p.name; E.role = p.role; E.years = p.years; E.inst = p.inst;
  }
  buildAll();
  showSc('sc-review');
  document.getElementById('prog').style.width = '25%';
}

function startExpert(){
  var expId = document.getElementById('exp-id') ? document.getElementById('exp-id').value : 'EXPERT';
  var name = document.getElementById('exp-name').value.trim() || 'Anonymous';
  var role = document.getElementById('exp-role').value;
  var years = document.getElementById('exp-years').value;
  var inst = document.getElementById('exp-inst').value.trim();
  if(!expId || !role || !years || !inst){
    document.getElementById('exp-err').textContent = 'Please complete all required fields.';
    return;
  }
  E.id = expId; E.name = name; E.role = role; E.years = years; E.inst = inst;
  sessionStorage.setItem('expert_profile', JSON.stringify({id:expId, name:name, role:role, years:years, inst:inst}));
  sessionStorage.setItem('expert_from_review', '1');
  document.getElementById('exp-hdr').textContent = expId + ' | ' + role;
  showSc('sc-redirect');
}

async function submitExpert(){
  if(!E.rec){
    document.getElementById('submit-err').textContent = 'Please select your recommendation.';
    return;
  }
  var scCVI = calcCVI('sc');
  var mcqCVI = calcCVI('mcq');
  var useCVI = calcCVI('use');
  var payload = {
    type: 'expert_validation',
    timestamp: new Date().toISOString(),
    expert_id: E.id || 'EXPERT',
    expert: {id: E.id, name: E.name, role: E.role, years: E.years, institution: E.inst},
    ratings: E.ratings,
    comments: E.comments,
    recommendation: E.rec,
    strengths: document.getElementById('strengths-txt').value,
    improvements: document.getElementById('improve-txt').value,
    cvi: {scenarios: scCVI, mcq: mcqCVI, usability: useCVI}
  };
  try{
    await fetch(SHEETS_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  }catch(e){}
  document.getElementById('sum-sc').textContent = scCVI;
  document.getElementById('sum-mcq').textContent = mcqCVI;
  document.getElementById('sum-use').textContent = useCVI;
  showSc('sc-thanks');
  document.getElementById('prog').style.width = '100%';
}

function returnFromPlatform(){
  var profile = sessionStorage.getItem('expert_profile');
  if(profile){
    var p = JSON.parse(profile);
    E.id = p.id; E.name = p.name; E.role = p.role; E.years = p.years; E.inst = p.inst;
    document.getElementById('exp-hdr').textContent = (p.id||'') + ' | ' + p.role;
  }
  buildAll();
  showSc('sc-review');
  document.getElementById('prog').style.width = '25%';
  var wrap = document.querySelector('#sc-review .wrap');
  var banner = document.createElement('div');
  banner.style.cssText = 'background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.3);color:var(--green);font-family:var(--mono);font-size:.75rem;padding:10px 16px;border-radius:6px;margin-bottom:16px;';
  banner.textContent = 'Platform completed. Please now rate your experience below.';
  wrap.insertBefore(banner, wrap.querySelector('.nav-tabs'));
}

window.addEventListener('DOMContentLoaded', function(){
  // Validate URL key
  if(!VALID_ACCESS){
    // Check if returning from platform with sessionStorage
    var profile = sessionStorage.getItem('expert_profile');
    var savedId = profile ? JSON.parse(profile).id : '';
    var savedKey = sessionStorage.getItem('expert_key');
    if(!savedKey || !savedId || EXPERT_KEYS[savedId] !== savedKey){
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#050d14;color:#ff5252;font-family:monospace;text-align:center;padding:40px;"><div><div style="font-size:2rem;margin-bottom:16px;">🔒</div><div style="font-size:1.1rem;margin-bottom:8px;">Invalid or Missing Access Link</div><div style="font-size:.8rem;color:#546e7a;">Please use the personal link provided to you by the researcher.<br>Contact: samir.alnasseri@gmail.com</div></div></div>';
      return;
    }
  } else {
    // Valid URL access - save to sessionStorage for return trip
    sessionStorage.setItem('expert_key', URL_KEY);
  }

  // Pre-fill expert ID if in URL
  var idSelect = document.getElementById('exp-id');
  if(idSelect && URL_ID){
    idSelect.value = URL_ID;
    idSelect.disabled = true;
    idSelect.style.opacity = '0.6';
  }

  // Check if returning from platform
  var returning = sessionStorage.getItem('expert_from_review');
  var profile = sessionStorage.getItem('expert_profile');
  if(returning === 'done' && profile){
    returnFromPlatform();
    sessionStorage.removeItem('expert_from_review');
  }
  var beginBtn = document.getElementById('begin-btn');
  var submitBtn = document.getElementById('submit-btn');
  if(beginBtn) beginBtn.addEventListener('click', startExpert);
  if(submitBtn) submitBtn.addEventListener('click', submitExpert);
});

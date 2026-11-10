
const $=id=>document.getElementById(id);
const keys=['ecg','capno','art','pleth','hemo'];
const labels={ecg:'ECG',capno:'EtCO₂',art:'Pressione invasiva ART',pleth:'SpO₂',hemo:'MostCare Up / PRAM'};
const AV1='Blocco AV I grado',AV2='Blocco AV II grado (2:1)',AV3='Blocco AV III grado';
let active=Object.fromEntries(keys.map(k=>[k,true]));
let state={hr:95,etco2:33,rr:12,sap:135,dap:80,spo2:98,
co:3.00,ci:3.47,sv:32,svi:36.5,svr:2450,svri:2123,ppv:8,spv:4,dpdt:1.087,cce:0.35,ea:3.8,cpo:0.65};
// V2.8.97: il modello iniziale e' un cane sano, sveglio e non premedicato.
// 135/80 mmHg corrisponde a MAP ~98 mmHg con la formula usata dal monitor.
let patientModel='healthy';
const hemoDefs=[['co','CO','L/min'],['ci','CI','L/min/m²'],['sv','SV','mL'],['svi','SVI','mL/m²'],['svr','SVR','dyn·s/cm⁵'],['svri','SVRI','dyn·s·m²/cm⁵'],['ppv','PPV','%'],['spv','SPV','mmHg'],['dpdt','dP/dtmax','mmHg/ms'],['cce','CCE',''],['ea','Ea','mmHg/mL'],['cpo','CPO','W']];
$('toggles').innerHTML=keys.map(k=>`<div class="toggle"><span>${labels[k]}</span><input type="checkbox" data-toggle="${k}"></div>`).join('');
 // Le onde aggiuntive condividono la stessa colonna delle altre selezioni.
 // Spostiamo i controlli originali per conservarne ID, stato e listener.
 for(const id of ['showVentPressure','showVentFlow']){
  const input=$(id),label=input?.closest('label');
  if(!input||!label)continue;
  const title=id==='showVentPressure'?'Pressione vie aeree':'Flusso respiratorio';
  const row=document.createElement('div');
  row.className='toggle';
  const caption=document.createElement('span');
  caption.textContent=title;
  row.append(caption,input);
  $('toggles').appendChild(row);
  label.remove();
 }
 document.querySelector('.resp-wave-controls')?.remove();

$('hemoInputs').innerHTML=hemoDefs.map(([k,l,u])=>`<label>${l} ${u?`(${u})`:''}<input id="${k}" type="number" step="any" value="${state[k]}"></label>`).join('');
$('hemoMetrics').innerHTML=hemoDefs.map(([k,l,u])=>`<div class="metric"><small>${l}</small><b id="m_${k}">${state[k]}</b><small>${u}</small></div>`).join('');

function map(){return Math.round((+state.sap+2*(+state.dap))/3)}
function render(){
 const cpr=$('rhythm').value==='Artefatto massaggio cardiaco 120/min';
 const dynValid=typeof window.simVentValid==='function'&&window.simVentValid();
 const currentRhythm=$('rhythm').value,isAV2=currentRhythm===AV2,isAV3=currentRhythm===AV3;
 const hrInput=$('hr');hrInput.min=isAV2||isAV3?20:0;hrInput.max=isAV2?100:isAV3?65:260;
 $('hrCaption').textContent=isAV2||isAV3?'FC ventricolare (bpm)':'FC (bpm)';
 const avInfo=$('avBlockInfo');avInfo.style.display=currentRhythm.startsWith('Blocco AV')?'block':'none';
 avInfo.textContent=currentRhythm===AV1?'PR prolungato (~0,32 s a 80 bpm): tutte le onde P sono condotte.':isAV2?'Conduzione 2:1: una P su due non produce un QRS né una pulsazione. FC atriale circa '+(2*hrInput.value)+'/min.':isAV3?'Dissociazione AV: onde P regolari a circa 118/min; ritmo di scappamento ventricolare indipendente.':'';
 state.hr=+$('hr').value; $('hrOut').textContent=($('rhythm').value==='Fibrillazione ventricolare'||$('rhythm').value==='Asistolia'||cpr)?'—':(($('rhythm').value==='Tachicardia ventricolare senza polso'||$('rhythm').value==='PEA / attività elettrica'||$('rhythm').value==='Asistolia')?state.hr+' elettr.':state.hr);
 ['etco2','rr','sap','dap','spo2',...hemoDefs.map(x=>x[0])].forEach(k=>state[k]=+$(k).value);
 $('vhr').textContent=($('rhythm').value==='Fibrillazione ventricolare'||$('rhythm').value==='Asistolia'||cpr)?'—':(($('rhythm').value==='Tachicardia ventricolare senza polso'||$('rhythm').value==='PEA / attività elettrica'||$('rhythm').value==='Asistolia')?state.hr+' elettr.':state.hr);$('vet').textContent=(+state.etco2).toFixed(1).replace('.0','');$('vrr').textContent=state.rr;
 $('vart').textContent=`${state.sap}/${state.dap}`;$('vmap').textContent=map();$('vspo2').textContent=cpr?'—':($('rhythm').value==='Fibrillazione ventricolare'||$('rhythm').value==='Tachicardia ventricolare senza polso'||$('rhythm').value==='PEA / attività elettrica'||$('rhythm').value==='Asistolia')?'—':state.spo2;
 hemoDefs.forEach(([k])=>{const rh=$('rhythm').value;const nv=(!dynValid&&['ppv','spv'].includes(k))||((rh===AV2||rh===AV3)&&['ppv','spv'].includes(k))||(rh==='Artefatto massaggio cardiaco 120/min')||(rh==='Tachicardia ventricolare con polso'&&(k==='ppv'||k==='spv'))||((rh==='Tachicardia ventricolare senza polso'||rh==='Fibrillazione ventricolare'||rh==='PEA / attività elettrica'||rh==='Asistolia')&&['svr','svri','ea','ppv','spv'].includes(k));$('m_'+k).textContent=nv?'N/V':state[k]});
 $('studentPatient').textContent=$('name').value;$('studentWeight').textContent=$('weight').value;
 if(typeof window.simVentRefresh==='function')window.simVentRefresh();
 document.querySelectorAll('[data-key]').forEach(el=>{let k=el.dataset.key;el.style.display=(active[k]&&!(k==='capno'&&(typeof window.simNonIntubated==='function'?window.simNonIntubated():window.premedAwakePhase)))?'':'none'});const awakeNotice=$('awakeCapnoNotice');if(awakeNotice)awakeNotice.style.display=(typeof window.simNonIntubated==='function'?window.simNonIntubated():window.premedAwakePhase)?'flex':'none';
 if(!document.body.classList.contains('student'))save();
}
function save(){localStorage.setItem('recoverCaneState',JSON.stringify({state,active,name:$('name').value,weight:$('weight').value,rhythm:$('rhythm').value,caseState:typeof caseState!=='undefined'?caseState:null,casePresentation:(typeof caseState!=='undefined'&&caseState.active)?clinicalCases[caseState.key].presentation:'',caseEvolutionText:(typeof caseState!=='undefined'&&caseState.active)?caseEvolution():'',airwayIntubated:window.simAirwayIntubated,anesthesiaPhase:typeof v25!=='undefined'?v25.induction.phase:'legacy',inductionStarted:typeof v25!=='undefined'&&v25.induction.startedAt>0,patient:{age:$('patientAge')?.value,breed:$('patientBreed')?.value,morph:$('patientMorph')?.value,bodyType:$('patientBodyType')?.value,bcs:$('patientBCS')?.value},vent:typeof window.simVentSettings==='function'?window.simVentSettings():null}))}
function setActive(v){keys.forEach(k=>active[k]=v);document.querySelectorAll('[data-toggle]').forEach(x=>x.checked=v);render()}
document.querySelectorAll('input,select').forEach(x=>{
 if(!['preload','contractility','vascularTone','compliance','v25FluidRate','v25DobRate','v25NorRate','v25AtDose','v25EphDose','v25Metric','v25Window'].includes(x.id)) x.addEventListener('input',render)
});
// Frequenza elettrica coerente con il ritmo selezionato; il cursore resta modificabile.
let previousRhythm=$('rhythm').value;
$('rhythm').addEventListener('change',()=>{
 const rhythm=$('rhythm').value;
 // Ristabilisce il range corretto prima di assegnare una nuova FC (es. da BAV III a TV).
 $('hr').min=rhythm===AV2||rhythm===AV3?20:0;
 $('hr').max=rhythm===AV2?100:rhythm===AV3?65:260;
 if(rhythm==='Tachicardia ventricolare con polso'||rhythm==='Tachicardia ventricolare senza polso'){
  if(!previousRhythm.startsWith('Tachicardia ventricolare'))$('hr').value=180;
  manualSet('hr',true);
 }else if(rhythm===AV2||rhythm===AV3){
  if(previousRhythm!==rhythm)$('hr').value=rhythm===AV2?50:40;
  manualSet('hr',true);
 }else if(previousRhythm.startsWith('Tachicardia ventricolare')||previousRhythm===AV2||previousRhythm===AV3){
  $('hr').value=80;
  manualSet('hr',false);
 }
 previousRhythm=rhythm;
 physiology();render();
});
document.querySelectorAll('[data-toggle]').forEach(x=>x.addEventListener('change',e=>{active[e.target.dataset.toggle]=e.target.checked;render()}));
$('allOn').onclick=()=>setActive(true);$('allOff').onclick=()=>setActive(false);

const presets={
'Paziente sano':{hr:95,etco2:34,rr:12,sap:135,dap:80,co:3.00,ci:3.47,sv:32,svr:2450,ppv:8,spv:4,dpdt:1.087,cce:.35,ea:3.8,cpo:.65},
'Paziente anestetizzato':{hr:80,etco2:34,rr:12,sap:98,dap:48,co:2.88,ci:3.34,sv:36,svr:1800,ppv:8,spv:4,dpdt:0.79,cce:.32,ea:2.45,cpo:.42},
'Bradicardia':{hr:45,co:2.1,sv:47,sap:105,dap:62},
'Tachicardia':{hr:180,co:3.5,sv:20,sap:105,dap:65},
'PEA 80':{hr:80,sap:45,dap:25,co:.8,etco2:12,cpo:.08},
'TV senza polso 220':{hr:220,sap:25,dap:15,co:.2,etco2:8,cpo:.02},
'Massaggio cardiaco 120':{hr:120,sap:55,dap:25,co:1.0,etco2:12},
'CPR EtCO₂ basso':{hr:120,etco2:8,sap:45,dap:20,co:.7},
'CPR EtCO₂ migliore':{hr:120,etco2:18,sap:60,dap:30,co:1.2},
'CPR ROSC imminente':{hr:120,etco2:32,sap:75,dap:40,co:1.8},
'ROSC':{hr:105,etco2:38,sap:105,dap:60,co:2.8,ci:2.7,sv:27,ppv:10,spv:5,cpo:.55},
'Ipovolemia':{hr:150,sap:82,dap:48,co:1.8,ci:1.8,sv:12,svr:2400,ppv:22,spv:11,dpdt:0.8,cce:.18,ea:3.0,cpo:.30},
'Vasodilatazione':{hr:130,sap:75,dap:35,co:3.8,svr:750,ppv:9,spv:5,ea:1.1,cpo:.42},
'Bassa contrattilità':{hr:120,sap:78,dap:50,co:1.6,sv:13,dpdt:0.42,cce:.10,cpo:.25},
'Fluid responsive':{hr:140,sap:88,dap:50,co:2.0,sv:14,ppv:20,spv:10},
'Dopo fluid challenge':{hr:115,sap:108,dap:62,co:3.0,sv:26,ppv:9,spv:5},
'Dopo vasopressore':{hr:105,sap:120,dap:72,co:2.8,svr:2100,ea:2.6}
};
$('presets').innerHTML=['Paziente sano','Paziente anestetizzato'].map(p=>`<button data-p="${p}">${p}</button>`).join('');
function applyPreset(p){
 const o=presets[p];if(!o)return;
 if((p==='Paziente sano'||p==='Paziente anestetizzato')&&typeof v25!=='undefined'&&(['premed','induction'].includes(v25.induction.phase)||(v25.induction.phase==='maintenance'&&v25.induction.startedAt>0))){
  alert('Per cambiare il paziente di partenza dopo la somministrazione di farmaci, ricarica la pagina. In questo modo la farmacocinetica non viene alterata.');return;
 }
 const isHealthy=p==='Paziente sano',isAnesthetized=p==='Paziente anestetizzato';
 if(isHealthy||isAnesthetized){
  patientModel=isHealthy?'healthy':'anesthetized';
  // Paziente sano: nessuna ventilazione controllata preimpostata.
  // Il preset anestetizzato conserva invece la VCV di riferimento.
  if($('ventMode'))$('ventMode').value=isHealthy?'SPONT':'VCV';
  if(typeof window.simVentSetLungProfile==='function')window.simVentSetLungProfile('healthy',true);
  phys={preload:100,contractility:100,vascularTone:100,compliance:100};setPhysInputs();
  $('mac').value=1;$('macOut').textContent='1,0';
  if(typeof v25!=='undefined'){
   v25.base={preload:100,contractility:100,vascularTone:100,hr:isHealthy?95:80};
   v25.fx={preload:0,contractility:0,tone:0,hr:0};
   v25.continuousHR=isHealthy?95:80;v25.lastShownHR=isHealthy?95:80;
   v25.etRef=34;v25.etEffective=34;v25.co2Pools=null;
   v25.oxygenEffective=98;
   v25.induction.startedAt=0;
   v25.induction.phase=isHealthy?'awake':'maintenance';
    window.simAirwayIntubated=!isHealthy;
   v25.induction.maintenanceAt=isHealthy?0:(typeof simClock!=='undefined'?simClock.virtual-60000:0);
  }
  const label=$('patientPresetStatus');if(label)label.textContent=isHealthy?'Paziente sano · sveglio · non premedicato':'Paziente anestetizzato · preset manuale';
 }
 Object.entries(o).forEach(([k,v])=>setNum(k,v));
 if(p.includes('PEA'))$('rhythm').value='PEA / attività elettrica';
 else if(p.includes('TV'))$('rhythm').value='Tachicardia ventricolare con polso';
 else if(p.includes('Massaggio')||p.includes('CPR'))$('rhythm').value='Artefatto massaggio cardiaco 120/min';
 else $('rhythm').value='Ritmo sinusale';
 if(isHealthy||isAnesthetized)physiology();else render();
}

document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>applyPreset(b.dataset.p));



const clinicalCases={
 hemorrhagic:{
  title:'Shock emorragico',presentation:'Cane, addome acuto post-traumatico. Mucose pallide, polso periferico debole, estremità fredde.',
  start:{preload:50,contractility:110,vascularTone:140,compliance:95,hr:150,etco2:33,rr:12,spo2:94},
  drift:{preload:-7,contractility:-2,vascularTone:3,hr:5},
  preferred:['fluid'], harmful:['vasodilator']
 },
 distributive:{
  title:'Shock distributivo / vasoplegico',presentation:'Cane con quadro infiammatorio sistemico. Polsi inizialmente ampi, mucose iperemiche, ipotensione.',
  start:{preload:75,contractility:105,vascularTone:50,compliance:112,hr:140,etco2:33,rr:12,spo2:95},
  drift:{preload:-3,contractility:-3,vascularTone:-4,hr:3},
  preferred:['pressor','fluid'], harmful:[]
 },
 myocardial:{
  title:'Depressione miocardica',presentation:'Cane debole e dispnoico. Polsi piccoli, perfusione periferica ridotta; pressione arteriosa bassa.',
  start:{preload:115,contractility:40,vascularTone:120,compliance:90,hr:140,etco2:33,rr:12,spo2:91},
  drift:{preload:2,contractility:-5,vascularTone:2,hr:2},
  preferred:['inotrope','oxygen'], harmful:['fluid']
 },
 arrest:{
  title:'Arresto cardiaco / PEA',presentation:'Paziente improvvisamente non responsivo, apnea e assenza di polso palpabile.',
  start:{preload:60,contractility:20,vascularTone:80,compliance:100,hr:80,etco2:33,rr:12,spo2:70},
  drift:{preload:-2,contractility:-2,vascularTone:-3,hr:0},
  preferred:['cpr','pressor'], harmful:['shock']
 }
};
let caseState={active:false,key:'',minute:0,score:0,actions:[],cpr:false};
function setNum(id,v){
 if(id==='etco2'){if($('etco2Set'))$('etco2Set').value=v;if($('etco2'))$('etco2').value=v;if(typeof v25!=='undefined'){v25.etRef=+v;v25.etEffective=+v;v25.co2Pools=null}return}
 if($(id))$(id).value=v
}
// A clinical case changes the untreated physiology baseline. Active
// treatment effects remain additive, so subsequent therapy ticks cannot
// silently restore the previous scenario.
function caseSyncPhysiologyBaseline(){
 if(typeof v25==='undefined')return;
 const fx=v25.fx||{preload:0,contractility:0,tone:0,hr:0};
 v25.base.preload=clamp(phys.preload-(fx.preload||0),20,180);
 v25.base.contractility=clamp(phys.contractility-(fx.contractility||0),20,180);
 v25.base.vascularTone=clamp(phys.vascularTone-(fx.tone||0),30,180);
 v25.base.hr=+$('hr').value||80;
}
function caseRecalculatePhysiology(){
 setPhysInputs();
 caseSyncPhysiologyBaseline();
 physiology();
}
function caseApplyStart(c){
 patientModel='anesthetized';
 if(typeof v25!=='undefined')v25.induction.phase='maintenance';
 window.simAirwayIntubated=true;
 const presetLabel=$('patientPresetStatus');if(presetLabel)presetLabel.textContent='Caso clinico · profilo emodinamico dedicato';
 $('mac').value=1;$('macOut').textContent='1,0';
 phys.preload=c.start.preload;phys.contractility=c.start.contractility;phys.vascularTone=c.start.vascularTone;phys.compliance=c.start.compliance;
 ['hr','etco2','rr','spo2'].forEach(k=>setNum(k,c.start[k]));
 // Preserve ongoing pharmacological effects when switching clinical cases.
 caseRecalculatePhysiology();
}
function caseStatus(msg){
 let c=clinicalCases[caseState.key];
 $('caseInstructor').innerHTML=`<b>${c.title}</b> · minuto ${caseState.minute} · punteggio didattico <span class="case-score">${caseState.score}</span><br>${c.presentation}`;
 $('caseFeedback').textContent=msg;
 $('studentCaseMinute').textContent=caseState.minute;$('studentCasePresentation').textContent=c.presentation;
 $('studentCaseEvolution').textContent=caseEvolution();
 $('studentCaseBanner').style.display='block';
 save();
}
function caseEvolution(){
 let m=map(),co=+state.co,et=+state.etco2;
 if(caseState.key==='arrest'&&!caseState.cpr)return 'Paziente non responsivo. Nessun polso palpabile.';
 if(m<45||co<1)return 'Perfusione gravemente compromessa. Il paziente sta peggiorando.';
 if(m<60||co<1.8)return 'Perfusione ridotta. Parametri ancora instabili.';
 if(m>=65&&co>=2.2&&et>=25)return 'I parametri mostrano un miglioramento emodinamico.';
 return 'Condizioni emodinamiche intermedie: rivalutare la risposta agli interventi.';
}
function startClinicalCase(){
 let k=$('caseSelect').value;if(!k){$('caseFeedback').textContent='Seleziona prima un caso clinico.';return}
 caseState={active:true,key:k,minute:0,score:0,actions:[],cpr:false};caseApplyStart(clinicalCases[k]);
 if(k==='arrest')$('rhythm').value='PEA / attività elettrica'; else $('rhythm').value='Tachicardia sinusale';
 caseStatus('Caso avviato. Diagnosi visibile solo all’istruttore.');
}
function advanceClinicalCase(){
 if(!caseState.active)return;
 let c=clinicalCases[caseState.key],d=c.drift;caseState.minute++;
 phys.preload=clamp(phys.preload+(d.preload||0),20,180);phys.contractility=clamp(phys.contractility+(d.contractility||0),20,180);
 phys.vascularTone=clamp(phys.vascularTone+(d.vascularTone||0),30,180);
 if(d.hr)setNum('hr',clamp(+$('hr').value+d.hr,0,260));if(d.etco2)setNum('etco2',clamp(+$('etco2').value+d.etco2,3,60));
 caseRecalculatePhysiology();caseStatus('È trascorso 1 minuto senza un nuovo intervento.');
}
function caseAction(a){
 if(!caseState.active){$('caseFeedback').textContent='Avvia prima un caso clinico.';return}
 let c=clinicalCases[caseState.key],good=c.preferred.includes(a),bad=c.harmful.includes(a);
 caseState.actions.push(a);caseState.score+=good?2:bad?-2:0;
 let msg='';
 if(a==='fluid'){phys.preload=clamp(phys.preload+22,20,180);msg='Somministrato bolo di fluidi.'}
 if(a==='pressor'){phys.vascularTone=clamp(phys.vascularTone+30,30,180);msg='Somministrato vasopressore.'}
 if(a==='inotrope'){phys.contractility=clamp(phys.contractility+30,20,180);msg='Somministrato inotropo.'}
 if(a==='oxygen'){setNum('spo2',clamp(+$('spo2').value+6,0,100));setNum('etco2',clamp(+$('etco2').value+3,3,60));msg='Ottimizzata ossigenazione/ventilazione.'}
 if(a==='cpr'){caseState.cpr=true;setNum('hr',120);$('rhythm').value='Artefatto massaggio cardiaco 120/min';phys.contractility=48;phys.preload=clamp(phys.preload+8,20,180);setNum('etco2',Math.max(12,+$('etco2').value));msg='CPR iniziata.'}
 if(a==='shock'){msg='Defibrillazione eseguita.'; if(caseState.key==='arrest'){caseState.score-=2;msg+=' Il ritmo iniziale è PEA: rivalutare l’indicazione alla defibrillazione.'}}
 caseRecalculatePhysiology();logEvent('Caso clinico: '+msg);caseStatus(msg+(good?' Risposta emodinamica favorevole.':bad?' Risposta non favorevole.':' Rivalutare i parametri.'));
}
function endClinicalCase(){
 if(!caseState.active)return;
 let outcome=caseEvolution();$('caseFeedback').textContent=`Caso terminato — ${outcome} Punteggio didattico: ${caseState.score}.`;
 caseState.active=false;$('studentCaseEvolution').textContent='Caso terminato.';save();
}
$('startCase').onclick=startClinicalCase;$('advanceCase').onclick=advanceClinicalCase;$('endCase').onclick=endClinicalCase;



// Override indipendenti: i valori bloccati non vengono sovrascritti dal modello.
const manualParams=['hr','etco2','rr','sap','dap','spo2',...hemoDefs.map(d=>d[0])];
const manualLocks=Object.fromEntries(manualParams.map(k=>[k,false]));
function manualSet(k,on){
 manualLocks[k]=on;
 const b=document.getElementById('manual-'+k);
 if(b){b.textContent=on?'MANUALE':'AUTO';b.style.color=on?'#ffcf77':'#8db9c5';b.title=on?'Valore bloccato: clicca per tornare automatico':'Valore calcolato: clicca per bloccarlo';}
 if(!on){if(k==='etco2'){v25.etRef=clamp(+$('etco2Set').value||33,3,80);v25.co2Pools=null}if(k==='hr'||k==='sap'||k==='dap'||hemoDefs.some(d=>d[0]===k))physiology();else render();}
}
function manualSetup(){
 manualParams.forEach(k=>{
  const input=$(k);if(!input)return;
  const b=document.createElement('button');b.type='button';b.id='manual-'+k;b.textContent='AUTO';
  b.style.cssText='display:block;margin-top:3px;padding:2px 6px;font-size:10px;border:1px solid #33505d;border-radius:5px;background:#10212b;color:#8db9c5;cursor:pointer';
  b.onclick=()=>manualSet(k,!manualLocks[k]);
  input.insertAdjacentElement('afterend',b);
  input.addEventListener('input',()=>{if(!v25.applying)manualSet(k,true)});
 });
}

let phys={preload:100,contractility:100,vascularTone:100,compliance:100};
let eventLines=[];
function logEvent(t){eventLines.unshift(new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+' — '+t);eventLines=eventLines.slice(0,8);$('eventLog').innerHTML=eventLines.join('<br>')}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function setPhysInputs(){
 ['preload','contractility','vascularTone','compliance'].forEach(k=>{$(k).value=phys[k];$(k+'Out').textContent=Math.round(phys[k])+'%'})
}
function physiology(){
 // Anche in modalità manuale gli slider aggiornano il modello emodinamico.
 phys.preload=+$('preload').value;phys.contractility=+$('contractility').value;phys.vascularTone=+$('vascularTone').value;phys.compliance=+$('compliance').value;
 const avRhythm=$('rhythm').value,ventRate=+$('hr').value||80;
 const advancedAV=avRhythm===AV2||avRhythm===AV3;
 // Prima dei 20 minuti dalla prima IM il paziente e' sveglio: nessun effetto del MAC inalatorio.
  // La funzione legge direttamente il tempo virtuale, cosi' salti e riavvolgimenti restano coerenti.
  const awakePremed=typeof window.isPremedAwake==='function'&&window.isPremedAwake();
  const healthy=patientModel==='healthy';
  const maintenanceProgress=healthy&&typeof v25!=='undefined'&&v25.induction.phase==='maintenance'?clamp((simClock.virtual-(v25.induction.maintenanceAt||simClock.virtual))/60000,0,1):0;
  const refSV=healthy?31.6+4.4*maintenanceProgress:36;
  const refSVR=healthy?2450-650*maintenanceProgress:1800;
  const refCVP=healthy?6*(1-maintenanceProgress):0;
  const refPP=healthy?55-5*maintenanceProgress:50;
  const refHR=healthy?95-15*maintenanceProgress:80;
  const refMAP=healthy?98-33*maintenanceProgress:65;
  const refCO=healthy?3.0-.1*maintenanceProgress:2.9;
  const vent=typeof window.simVentCalc==='function'?window.simVentCalc():null;
 let P=(phys.preload/100)*(vent?.preloadFactor??1),mac=(awakePremed||(typeof window.isInductionPhase==='function'&&window.isInductionPhase()))?1:clamp(+$('mac').value||1,.6,2),md=mac-1,macC=Math.exp(-.28*md-.08*Math.max(md,0)*Math.max(md,0)),macV=Math.exp(-.35*md-.10*Math.max(md,0)*Math.max(md,0));
 // Compenso vasocostrittore moderato e attenuato dall'anestesia: non corregge la perdita dei battiti ventricolari.
 const avCompensation=advancedAV?clamp((80-ventRate)*(avRhythm===AV3?.0040:.0033),0,avRhythm===AV3?.16:.10)*clamp(1-.35*Math.max(0,mac-1),.6,1):0;
 let C=(phys.contractility/100)*macC,V=(phys.vascularTone/100)*macV*(1+avCompensation),A=phys.compliance/100;window.macEffectiveContractility=C*100;window.macEffectiveTone=V*100;
 const calc=hr=>{hr=Math.max(1,hr);let filling=clamp(Math.pow(P,.72),.25,1.45),tp=hr>110?clamp(1/(1+.008*(hr-110)*clamp(1+.9*Math.max(0,1-P)+.65*Math.max(0,1-A),.7,2)),.38,1):1;tp*=hr>140?1/(1+.004*(hr-140)):1;let bf=hr<70?clamp(1+(70-hr)/250,1,1.16):1,ap=clamp(Math.pow(V,-.22),.72,1.22),sv=clamp(refSV*filling*Math.pow(C,.78)*ap*tp*bf,5,70),co=clamp(sv*hr/1000,.25,7.5),svr=clamp(refSVR*V,450,3400),map=clamp(refCVP+co*svr/80,20,155),pp=clamp((sv/refSV)*(refPP/A)*Math.pow(V,-.28),12,85),
 // Compliance arteriosa e runoff: con SVR elevate il decadimento diastolico
 // e' minore. Il termine della pressione pulsatoria si riduce moderatamente.
 dap=clamp(map-pp/3,12,125),sap=clamp(dap+pp,25,210);return{hr,sv,co,svr,map,pp,dap,sap}};
 let shownHR=+$('hr').value||80;let hr=(typeof v25!=='undefined'&&Number.isFinite(v25.continuousHR)&&v25.lastShownHR===shownHR)?v25.continuousHR:shownHR;let r=calc(hr),rh=$('rhythm').value,reflex=['Ritmo sinusale','Tachicardia sinusale','Bradicardia sinusale',AV1].includes(rh);
 if(reflex&&!manualLocks.hr){const unpremedicatedPropofol=typeof v25!=='undefined'&&v25.induction.phase==='induction'&&v25.induction.drug==='Propofol'&&v25.induction.premedicated===false;
 let pressureDrive=clamp((refMAP-r.map)*1.15,-30,85),flowDrive=clamp((refCO-r.co)*18,-18,45),reflexGain=unpremedicatedPropofol?1:(awakePremed?1.25:((typeof window.isInductionPhase==='function'&&window.isInductionPhase())?.75:(mac<=1.6?1:clamp(1-.55*((mac-1.6)/.4),.45,1)))),dobResponse=(typeof v25!=='undefined'&&v25.inf.dob)?clamp((r.co-refCO)*18,0,14):0,target=refHR+reflexGain*((pressureDrive+flowDrive)>0?(unpremedicatedPropofol?.72:(awakePremed?.36:.25))*(pressureDrive+flowDrive):(pressureDrive+flowDrive))-dobResponse+(typeof v25!=='undefined'?(v25.fx.hr||0):0);let ephActive=typeof v25!=='undefined'&&v25.ephedrineAt&&simClock.virtual-v25.ephedrineAt<420000;if(ephActive){let pressorRise=Math.max(0,r.map-v25.ephedrineBaselineMAP);let ephElapsed=(simClock.virtual-v25.ephedrineAt)/1000;let gain=clamp((ephElapsed-2)/9,0,1);target-=clamp(pressorRise*1.45*gain,0,65);}
 // Riflesso barocettivo nel cane: la bradicardia segue l'aumento delle SVR
 // e della pressione indotto dalla dexmedetomidina, non una riduzione FC fissa.
 const dex=typeof window.premedDexEffect==='function'?window.premedDexEffect():0;
 if(dex>0){
  const toneRise=Math.max(0,phys.vascularTone-v25.base.vascularTone);
  const pressorRise=Math.max(0,r.map-refMAP);
  const diastolicRise=Math.max(0,r.dap-(refMAP-refPP/3));
  target-=clamp(dex*(toneRise*.46+pressorRise*.40+diastolicRise*.28),0,52);
 }
 let washedOut=typeof v25!=='undefined'&&!ephActive&&!v25.inf.dob&&!v25.inf.fluid&&!v25.inf.nor&&Math.abs(v25.fx.contractility)<.05&&Math.abs(v25.fx.tone)<.05&&Math.abs(v25.fx.preload)<.05;let structuralHR=healthy?80:((typeof v25!=='undefined'&&v25.base.hr)||80);let stableAnesthetized=washedOut&&(!healthy||maintenanceProgress>=.99)&&Math.abs(v25.fx.hr)<.05&&!awakePremed&&!(typeof window.isInductionPhase==='function'&&window.isInductionPhase())&&Math.abs(mac-1)<.03&&Math.abs(phys.preload-100)<=3&&Math.abs(phys.contractility-100)<=3&&Math.abs(phys.vascularTone-100)<=3&&Math.abs(phys.compliance-100)<=3;if(stableAnesthetized){hr+=(structuralHR-hr)*.16;if(Math.abs(structuralHR-hr)<.35)hr=structuralHR;$('hr').value=Math.round(hr);r=calc(hr)}else{target=clamp(target,42,190);hr+=(target-hr)*.055;$('hr').value=Math.round(hr);r=calc(hr)}$('hr').value=Math.round(hr);if(typeof v25!=='undefined'){v25.continuousHR=hr;v25.lastShownHR=Math.round(hr)}r=calc(hr)}
 let variability=clamp((8+Math.max(0,100-phys.preload)*.23+Math.max(0,hr-170)*.025)*(vent?.controlled?clamp((vent.driving||10)/11,.65,1.9):1),3,35),dpdt=clamp(950*C*(r.sap/118)*Math.pow(A,-.15),180,2200),ea=clamp((r.sap*.9)/Math.max(r.sv,5),.5,8),cce=clamp(.35*C*(r.co/3.2)/(V**.35),.04,.75),cpo=clamp(r.map*r.co/451,.03,2),bsa=Math.max(.25,0.101*Math.pow(+$('weight').value||25,2/3));
 if(rh==='Tachicardia ventricolare con polso'){let tvHR=clamp(hr,120,240);r=calc(tvHR);r.sv*=.42;r.co=r.sv*tvHR/1000;r.map=r.co*r.svr/80;r.pp*=.42;r.dap=Math.max(12,r.map-r.pp/3);r.sap=r.dap+r.pp;}
 if(rh==='Tachicardia ventricolare con polso'){
  // Ricalcola i parametri derivati dopo aver applicato la riduzione di SV/CO della TV.
  dpdt=dpdt*Math.min(1,r.sv/36)*.85;
  cce=clamp(.35*C*(r.co/3.2)/(V**.35)*.65,.02,.40);
  ea=clamp((r.sap*.9)/Math.max(r.sv,5),.5,8);
  cpo=clamp(r.map*r.co/451,0,2);
 }
 let vals={sv:Math.round(r.sv),svi:+(r.sv/bsa).toFixed(1),co:+r.co.toFixed(2),ci:+(r.co/bsa).toFixed(2),svr:Math.round(r.svr),svri:Math.round(r.svr*bsa),ppv:(rh==='Tachicardia ventricolare con polso'||rh===AV2||rh===AV3)?0:Math.round(variability),spv:(rh==='Tachicardia ventricolare con polso'||rh===AV2||rh===AV3)?0:+clamp(r.pp*variability/100*.9+(vent?.controlled?(vent.peep||0)*.12:0),0,35).toFixed(1),dpdt:+(dpdt/1000).toFixed(3),cce:+cce.toFixed(2),ea:+ea.toFixed(2),cpo:+cpo.toFixed(2),sap:Math.round(r.sap),dap:Math.round(r.dap)};
 if((rh==='Artefatto massaggio cardiaco 120/min'||rh==='Fibrillazione ventricolare'||rh==='Tachicardia ventricolare senza polso'||rh==='PEA / attività elettrica'||rh==='Asistolia')){const arrest={sv:0,svi:0,co:0,ci:0,dpdt:0,cce:0,cpo:0,ea:0,ppv:0,spv:0,sap:0,dap:0,svr:0,svri:0};Object.assign(vals,arrest);if(rh==='Artefatto massaggio cardiaco 120/min'){vals.sap=55;vals.dap=15;}}
 // V3.0: stato cardiovascolare condiviso, sola lettura per il loop PV.
 // Il motore emodinamico resta l'unica fonte di SV, pressioni ed Ea.
 window.simCardiovascularState={
  hr:Number($('hr').value)||0,
  sv:manualLocks.sv?Number($('sv').value):vals.sv,
  sap:manualLocks.sap?Number($('sap').value):vals.sap,
  dap:manualLocks.dap?Number($('dap').value):vals.dap,
  ea:manualLocks.ea?Number($('ea').value):vals.ea,
  preload:phys.preload,contractility:C*100,tone:V*100,
  clinicalScenario:caseState.active?caseState.key:null,
  compliance:phys.compliance,
  timestamp:Date.now()
 };
 Object.entries(vals).forEach(([k,v])=>{if($(k)&&(!manualLocks[k]||(rh==='Fibrillazione ventricolare'||rh==='Tachicardia ventricolare senza polso'||rh==='PEA / attività elettrica'||rh==='Asistolia'||rh==='Artefatto massaggio cardiaco 120/min')))$(k).value=v});$('preloadOut').textContent=Math.round(phys.preload)+'%';$('contractilityOut').textContent=Math.round(phys.contractility)+'%';$('vascularToneOut').textContent=Math.round(phys.vascularTone)+'%';$('complianceOut').textContent=Math.round(phys.compliance)+'%';render()
}
['preload','contractility','vascularTone','compliance'].forEach(k=>$(k).addEventListener('input',()=>{if(typeof v25!=='undefined'){v25.base.preload=clamp(+$('preload').value-(v25.fx.preload||0),20,180);v25.base.contractility=clamp(+$('contractility').value-(v25.fx.contractility||0),20,180);v25.base.vascularTone=clamp(+$('vascularTone').value-(v25.fx.tone||0),30,180);}physiology()}));
$('mac').addEventListener('input',()=>{$('macOut').textContent=(+$('mac').value).toFixed(1).replace('.',',');physiology()});$('mac').addEventListener('change',()=>{if(typeof v25Event==='function')v25Event('MAC impostato a '+(+$('mac').value).toFixed(1));});




/* ===== V2.8.14 dobutamine response + norepinephrine dose-response + drug washout + MAC closed-loop hemodynamics ===== */
const v25={start:performance.now(),last:performance.now(),lastPhys:performance.now(),lastSample:0,oxygenEffective:+$('spo2').value||98,inf:{fluid:false,dob:false,nor:false},fluidBolusUntil:0,atropineUntil:0,ephedrineAt:0,ephedrineDose:0,ephedrineBaselineMAP:0,dobStoppedAt:0,etRef:+$('etco2Set').value||33,etEffective:+$('etco2').value||33,co2Pools:null,history:[],events:[],applying:false,base:{preload:phys.preload,contractility:phys.contractility,vascularTone:phys.vascularTone,hr:95},fx:{preload:0,contractility:0,tone:0,hr:0},
 induction:{phase:'awake',startedAt:0,maintenanceAt:0,drug:'',dose:0,administrationSeconds:60,windowMinutes:10,
 pk:{central:0,fast:0,slow:0,ce:0,cv:0},effects:{preload:0,tone:0,contractility:0,hr:0,active:false},apneaRisk:'—'}};
// Airway is an explicit instructor-controlled state, independent of anesthesia phase.
window.simAirwayIntubated=false;
window.simSetAirwayIntubated=(value,reason)=>{
 if(document.body.classList.contains('student'))return;
 const next=Boolean(value),previous=window.simAirwayIntubated;
 window.simAirwayIntubated=next;
 if(previous!==next&&typeof v25Event==='function')v25Event('Vie aeree: '+(next?'intubato':'non intubato')+' ('+(reason||'comando istruttore')+')');
 if(typeof physiology==='function')physiology();
};
const v25Metrics=[['hr','FC','bpm'],['spo2','SpO₂','%'],['etco2','EtCO₂','mmHg'],['rr','FR','/min'],['sap','SAP','mmHg'],['dap','DAP','mmHg'],['map','MAP','mmHg'],['co','CO','L/min'],['ci','CI','L/min/m²'],['sv','SV','mL'],['svi','SVI','mL/m²'],['svr','SVR','dyn·s/cm⁵'],['svri','SVRI','dyn·s·m²/cm⁵'],['ppv','PPV','%'],['spv','SPV','mmHg'],['dpdt','dP/dtmax','mmHg/ms'],['cce','CCE',''],['ea','Ea','mmHg/mL'],['cpo','CPO','W'],['preload','Precarico','%'],['afterload','Afterload','%'],['contractility','Contrattilità','%'],['mac','MAC','']];
function v25Event(txt){let t=(simClock.virtual-v25.start)/1000;v25.events.push({t,txt});if(v25.events.length>300)v25.events.shift();logEvent(txt);v25RenderEvents()}
function v25CaptureUntreatedBase(){v25.base={preload:clamp(phys.preload-v25.fx.preload,20,180),contractility:clamp(phys.contractility-v25.fx.contractility,20,180),vascularTone:clamp(phys.vascularTone-v25.fx.tone,30,180),hr:v25.base.hr||80}}
function v25Toggle(btn,key,label){let starting=!v25.inf[key],none=!v25.inf.fluid&&!v25.inf.dob&&!v25.inf.nor;if(starting&&none)v25CaptureUntreatedBase();v25.inf[key]=!v25.inf[key];if(key==='dob')v25.dobStoppedAt=v25.inf.dob?0:simClock.virtual;btn.classList.toggle('active-therapy',v25.inf[key]);btn.textContent=v25.inf[key]?'ATTIVA — Stop':'Avvia';const rateKey={fluid:'v25FluidRate',dob:'v25DobRate',nor:'v25NorRate'}[key];const unit={fluid:'mL/kg/h',dob:'µg/kg/min',nor:'µg/kg/min'}[key];v25Event(label+(v25.inf[key]?' avviata a '+(+$((rateKey)).value||0)+' '+unit:' arrestata'));v25Status()}
function v25Status(){let a=[];if(v25.inf.fluid)a.push('Cristalloidi '+(+$('v25FluidRate').value||0)+' mL/kg/h');if(v25.inf.dob)a.push('Dobutamina '+(+$('v25DobRate').value||0)+' µg/kg/min');if(v25.inf.nor)a.push('Noradrenalina '+(+$('v25NorRate').value||0)+' µg/kg/min');$('v25TherapyStatus').textContent=a.length?'Attive: '+a.join(' · '):'Nessuna infusione continua attiva.'}
function v25Flash(b){b.classList.add('pulse-therapy');setTimeout(()=>b.classList.remove('pulse-therapy'),700)}
function v25Setup(){
 $('v25FluidBtn').onclick=()=>v25Toggle($('v25FluidBtn'),'fluid','Cristalloidi');
 $('v25DobBtn').onclick=()=>v25Toggle($('v25DobBtn'),'dob','Dobutamina');
 $('v25NorBtn').onclick=()=>v25Toggle($('v25NorBtn'),'nor','Noradrenalina');
 $('v25FluidBolus').onclick=()=>{if(!v25.inf.fluid&&!v25.inf.dob&&!v25.inf.nor)v25CaptureUntreatedBase();v25.fluidBolusUntil=simClock.virtual+30000;v25Flash($('v25FluidBolus'));v25Event('Fluid challenge 2 mL/kg / 30 s')};
 $('v25EphBtn').onclick=()=>{const d=+$('v25EphDose').value;if(!Number.isFinite(d)||d<25||d>100){$('v25EphDose').value=clamp(Number.isFinite(d)?d:50,25,100);return;}if(!v25.inf.fluid&&!v25.inf.dob&&!v25.inf.nor&&simClock.virtual>=v25.fluidBolusUntil)v25CaptureUntreatedBase();v25.ephedrineBaselineMAP=(+$('sap').value+2*(+$('dap').value))/3;v25.ephedrineAt=simClock.virtual;v25.ephedrineDose=d;v25Flash($('v25EphBtn'));v25Event('Efedrina '+d+' µg/kg EV (bolo)')};
 $('v25AtBtn').onclick=()=>{v25.atropineUntil=simClock.virtual+120000;v25Flash($('v25AtBtn'));v25Event('Atropina '+(+$('v25AtDose').value||0)+' µg/kg')};
 $('etco2Set').addEventListener('input',()=>{const raw=+$('etco2Set').value;if(!Number.isFinite(raw))return;v25.etRef=clamp(raw,3,80);if(!v25.applying){manualSet('etco2',true);v25.etEffective=v25.etRef;v25.co2Pools=null;$('etco2').value=v25.etEffective;render()}});
 $('etco2Set').addEventListener('change',()=>v25Event('EtCO₂ impostata '+v25.etRef+' mmHg'));
 $('v25Window').addEventListener('change',()=>{
  v25Draw();
  // La scala e' una scelta del docente: aggiornamento immediato sul monitor studenti.
  if(!document.body.classList.contains('student')){
   simPublishStudentStatus();simPublishStudentHistory();
  }
 })
}
// PK-PD didattica: 3 compartimenti + sito d'effetto e compartimento vascolare rapido.
 // Ricalibrazione propofol: risposta vascolare sigmoide sensibile al picco di concentrazione,
 // non alla sola dose cumulativa; coefficienti didattici NON validati per uso clinico.
 const inductionPK={
  Propofol:{vc:.40,vf:.70,vs:3.10,qf:.55,qs:.13,cl:.055,ke0:.723,kv:3.5,ecv:4.5,vascularHill:5,ech:1.9,tone:-46,preload:-13,contractility:-22,hr:-7},
  Alfaxalone:{vc:.30,vf:.55,vs:1.20,qf:.45,qs:.10,cl:.059,ke0:1.0,kv:3.5,ecv:1.8,ech:1.65,tone:-27,preload:-7,contractility:-15,hr:12}
 };
 function v25InductionStep(dt,now){
  const i=v25.induction,p=inductionPK[i.drug];
  if(!p||!i.startedAt||!['induction','maintenance'].includes(i.phase))return;
  const age=(now-i.startedAt)/1000,rate=(age>=0&&age<=i.administrationSeconds)?i.dose/Math.max(1,i.administrationSeconds):0;
  const k=i.pk,cp=k.central/p.vc,cf=k.fast/p.vf,cs=k.slow/p.vs,minutes=dt/60;
  const fast=p.qf*(cp-cf),slow=p.qs*(cp-cs),elim=p.cl*cp;
  k.central=Math.max(0,k.central+rate*dt-(fast+slow+elim)*minutes);
  k.fast=Math.max(0,k.fast+fast*minutes);
  k.slow=Math.max(0,k.slow+slow*minutes);
  const plasma=k.central/p.vc;
  k.ce=Math.max(0,k.ce+(plasma-k.ce)*(1-Math.exp(-p.ke0*minutes)));
  k.cv=Math.max(0,k.cv+(plasma-k.cv)*(1-Math.exp(-p.kv*minutes)));
  const vascularHill=p.vascularHill||1;
  const vascular=Math.pow(k.cv,vascularHill)/(Math.pow(p.ecv,vascularHill)+Math.pow(k.cv,vascularHill)),hypnotic=k.ce/(p.ech+k.ce);
  i.effects={preload:p.preload*vascular,tone:p.tone*vascular,contractility:p.contractility*hypnotic,hr:p.hr*hypnotic,active:age>=0&&(age<=i.administrationSeconds||k.ce>.025||k.cv>.025)};
  const rateMgMin=i.dose*60/Math.max(1,i.administrationSeconds);
  i.apneaRisk=hypnotic>.53&&rateMgMin>(i.drug==='Propofol'?2:1)?'Elevato (stima qualitativa)':hypnotic>.32?'Presente (stima qualitativa)':'Basso / non quantificato';
 }
 function v25TherapyStep(dt,now){
 const approach=(cur,target,tau)=>cur+(target-cur)*(1-Math.exp(-dt/Math.max(.1,tau)));
 let fluidRate=clamp(+$('v25FluidRate').value||0,0,50),dob=clamp(+$('v25DobRate').value||0,0,30),nor=clamp(+$('v25NorRate').value||0,0,2);
 let responsive=(typeof window.simVentValid==='function'&&window.simVentValid())?clamp((+state.ppv-8)/14,0,1):clamp((100-phys.preload)/65,0,1);
 // Bolo di efedrina: aumento transitorio di frequenza, inotropismo e tono vascolare; decadimento didattico.
 const ephAge=v25.ephedrineAt?(now-v25.ephedrineAt)/1000:Infinity;
 const ephEffect=ephAge>=0&&ephAge<420?Math.exp(-ephAge/105)*clamp(v25.ephedrineDose/50,.5,2):0;
 const pm=typeof window.premedEffects==='function'?window.premedEffects():{tone:0,hr:0,contractility:0,active:false};const ind=v25.induction.effects;
 let pTarget=(v25.inf.fluid?clamp(fluidRate*.45,0,18):0)+(now<v25.fluidBolusUntil?(10+18*responsive):0)+ind.preload;
 let cTarget=(v25.inf.dob?clamp(dob*5.5,0,55):0)+22*ephEffect+pm.contractility+ind.contractility,dobTone=v25.inf.dob?clamp((dob-1.5)*.35,-.3,1.2):0,tTarget=(v25.inf.nor?clamp(55*Math.pow(nor,.9)/(Math.pow(nor,.9)+Math.pow(.5,.9)),0,55):0)+dobTone+18*ephEffect+pm.tone+ind.tone,hTarget=(now<v25.atropineUntil?clamp((+$('v25AtDose').value||0)*1.8,0,75):0)+8*ephEffect+pm.hr+ind.hr;
 v25.fx.preload=approach(v25.fx.preload,pTarget,pTarget?12:28);v25.fx.contractility=approach(v25.fx.contractility,cTarget,cTarget?8:18);v25.fx.tone=approach(v25.fx.tone,tTarget,tTarget?10:20);v25.fx.hr=approach(v25.fx.hr,hTarget,hTarget?7:18);if(!v25.inf.dob&&v25.dobStoppedAt&&now-v25.dobStoppedAt>=120000){v25.fx.contractility=0;if(!v25.inf.nor)v25.fx.tone=0;}
 let residual=Math.max(Math.abs(v25.fx.preload),Math.abs(v25.fx.contractility),Math.abs(v25.fx.tone));let hemoActive=v25.inf.fluid||v25.inf.dob||v25.inf.nor||now<v25.fluidBolusUntil||ephEffect>.005||pm.active||ind.active||residual>.05;if(hemoActive){phys.preload=clamp(v25.base.preload+v25.fx.preload,20,180);phys.contractility=clamp(v25.base.contractility+v25.fx.contractility,20,180);phys.vascularTone=clamp(v25.base.vascularTone+v25.fx.tone,30,180);setPhysInputs()}else{v25.fx.preload=0;v25.fx.contractility=0;v25.fx.tone=0;phys.preload=v25.base.preload;phys.contractility=v25.base.contractility;phys.vascularTone=v25.base.vascularTone;setPhysInputs()}
}
// V2.9.22: bilancio di massa della CO2 per VCV/PCV, con due riserve
// (circolo/alveoli e tessuti). Le costanti sono DIDATTICHE: non predicono
// PaCO2 o gas ematici individuali e non sostituiscono un'emogasanalisi.
// 0,863 * VCO2 (mL/min) / VA (L/min) = PaCO2 (mmHg) all'equilibrio.
// A 25 kg, Vt 12 mL/kg, FR 12, spazio morto 2 mL/kg: VA = 3 L/min.
// Con EtCO2 di riferimento 34 e gradiente 2,8: VCO2 ~128 mL/min.
function v25PerfusionEt(dt,ventData){
 const rhythm=$('rhythm').value;
 const arrest=['Fibrillazione ventricolare','Tachicardia ventricolare senza polso','PEA / attività elettrica','Asistolia'].includes(rhythm);
 const cpr=rhythm==='Artefatto massaggio cardiaco 120/min';
 // CO dal motore Frank-Starling/terapie; non proporzionalita' diretta CO/EtCO2.
 const co=Math.max(0,Number($('co').value)||0),perf=clamp(co/2.9,0,1.6);
 const flowDeficit=clamp((1-perf)/.85,0,1);
 const flowDeadSpace=clamp(.46*Math.pow(flowDeficit,1.15),0,.46);
 const vent=ventData||(typeof window.simVentCalc==='function'?window.simVentCalc():null);
 const weight=clamp(+$('weight').value||25,1,100);
 // Il vecchio andamento in spontanea resta per ora invariato: il modello
 // spontaneo ha un Vt didattico separato e sara' calibrato in un test dedicato.
 if(!vent?.controlled){
  v25.co2Pools=null;
  window.simDynamicPaCO2=null;
  window.simPulmonaryPerfusionState={mode:'spontaneous',cardiacOutput:co,relativeFlow:perf,
   flowDeadSpace,estimatedPaEtGradient:null,arterialCO2:null,
   note:'Ventilazione spontanea: modello CO2 semplificato; PaCO2 non stimata'};
  if(cpr)return 12;
  if(arrest)return 3;
  const rr=Math.max(1,+$('rr').value||18);
  const baselineAlveolar=3*Math.pow(weight/25,.8);
  const ratio=vent?baselineAlveolar/Math.max(.10,vent.alveolarMinute):12/rr;
  const ventilatoryDeficit=clamp(ratio,.40,4.8);
  const exponent=(vent?.postInduction&&!vent.controlled)?.36:.28;
  const rhythmFactor=rhythm==='Tachicardia ventricolare con polso'?
   clamp(.90-.12*clamp(((+$('hr').value||180)-120)/120,0,1),.78,.90):1;
  // In spontanea la quota di gas ipoperfuso diluisce il gas terminale.
  const perfusionMix=clamp(1-.60*flowDeadSpace-.16*flowDeficit,.50,1.10);
  return clamp(v25.etRef*perfusionMix*Math.pow(ventilatoryDeficit,exponent)*rhythmFactor-
   (vent?.etco2Gradient||0),3,80);
 }
 // VCO2 metabolica: allometria del peso con piccoli aggiustamenti per eta'
 // e BCS. In anestesia assumiamo una VCO2 basale sostanzialmente
 // costante, indipendente da CO e ventilazione. Modello didattico.
 const age=clamp(vent.age||6,.1,22),bcs=clamp(vent.bcs||5,1,9);
 const ageFactor=age<1?1.10:age>10?clamp(1-.015*(age-10),.82,1):1;
 const bcsFactor=bcs>=7?clamp(1-.025*(bcs-6),.90,1):1;
 // 105 mL/min e' il riferimento didattico per il cane anestetizzato
 // di 25 kg. Evitiamo che il comando EtCO2 modifichi il metabolismo.
 const metabolicVCO2=clamp(105*Math.pow(weight/25,.8)*ageFactor*bcsFactor,15,650);
 const alveolar=clamp(typeof window.simEgaAlveolarMinute==='function'?
  window.simEgaAlveolarMinute(vent):vent.alveolarMinute,.05,25);
 // Il flusso ridotto rallenta il trasporto della CO2 metabolica ai polmoni.
 const conductance=10*clamp(perf,.06,1.6);
 // Experimental terminal-expiratory gas mixing, NOT PaCO2 minus a fixed
 // gradient. Dead-space fraction denotes poorly perfused ALVEOLAR units only.
 // Perfusion fractions (low V/Q) and ventilated fractions (alveolar dead space)
 // are deliberately separate; shunt does not contribute expired gas.
 const ega=typeof window.simEgaGasFractions==='function'?
  window.simEgaGasFractions(vent):null;
 const dead=clamp(ega?.deadSpaceFraction??0,0,.85);
 const low=clamp(ega?.lowVQFraction??0,0,.8);
 const perfusedLow=low/(Math.max(.05,1-(ega?.shunt??0)));
 // Late expiration preferentially samples perfused alveoli. These teaching
 // weights represent regional emptying, not a measured volumetric capnogram.
 // Spazio morto funzionale da bassa perfusione, distinto da quello anatomico.
 const effectiveDead=clamp(dead+(1-dead)*flowDeadSpace,0,.90);
 const deadTerminal=clamp(dead*(.14+.14*flowDeficit)+
  (1-dead)*flowDeadSpace*.82,0,.78);
 const lowTerminal=clamp((1-deadTerminal)*perfusedLow*.30,0,1-deadTerminal);
 const normalTerminal=Math.max(0,1-deadTerminal-lowTerminal);
 if(!v25.co2Pools||!Number.isFinite(v25.co2Pools.arterial)||
    !Number.isFinite(v25.co2Pools.tissue)||v25.co2Pools.ref!==v25.etRef||
    v25.co2Pools.weight!==weight){
  // One fixed metabolic production model, shared with experimental EGA.
  // Do not calibrate VCO2 from the current ventilator setting: doing so
  // makes transient ventilator changes permanently bias CO2 equilibrium.
  const vco2=metabolicVCO2;
  const arterial=clamp(.863*vco2/alveolar,10,120);
  v25.co2Pools={arterial,tissue:clamp(arterial+vco2/conductance,4,160),
   ref:v25.etRef,weight,vco2};
 }
 // Keep VCO2 consistent even when an old simulator state is reused.
 v25.co2Pools.vco2=metabolicVCO2;
 const vco2=v25.co2Pools.vco2;
 const pool=v25.co2Pools,seconds=clamp(dt,0,1);
 window.simDynamicPaCO2=pool.arterial;
 const transfer=conductance*(pool.tissue-pool.arterial); // mL/min
 const elimination=alveolar*pool.arterial/.863; // mL/min
 // d(mL CO2 immagazzinati)/dt = ingresso - uscita.
 // Capacita' efficaci didattiche (mL/mmHg): compartimento centrale
 // rapido e riserva tissutale lenta. La riserva tissutale di 12, anziche'
 // 18, riduce il trascinamento residuo dopo la sospensione di un inotropo
 // senza azzerare l'inerzia del trasporto della CO2.
 const centralCapacity=4.5,tissueCapacity=12;
 pool.arterial=clamp(pool.arterial+(transfer-elimination)*seconds/(60*centralCapacity),4,160);
 pool.tissue=clamp(pool.tissue+(vco2-transfer)*seconds/(60*tissueCapacity),4,160);
 window.simDynamicPaCO2=pool.arterial;
 if(cpr||arrest){
  // Aggiorna la diagnostica a ogni passo: mai mostrare una misura polmonare
  // precedente come se fosse attuale durante assenza di circolo efficace.
  window.simPulmonaryPerfusionState={mode:cpr?'cpr':'arrest',cardiacOutput:co,
   relativeFlow:perf,flowDeadSpace,effectiveAlveolarDeadSpace:effectiveDead,
   alveolarVentilation:alveolar,metabolicVCO2:vco2,
   arterialCO2:pool.arterial,tissueCO2:pool.tissue,
   pulmonaryCO2Delivery:transfer,alveolarCO2Elimination:elimination,
   estimatedTerminalCO2:cpr?12:3,estimatedPaEtGradient:null,
   centralCO2Balance:transfer-elimination,tissueCO2Balance:vco2-transfer,
   totalCO2Balance:vco2-elimination,centralCapacity,tissueCapacity,
   note:'EtCO2 durante CPR/arresto: valore didattico imposto, non miscela alveolare'};
  return cpr?12:3;
 }
 // Regional end-alveolar PCO2: poorly perfused units contain little CO2,
 // while low V/Q units have a modestly higher alveolar PCO2. The resulting
 // EtCO2 is the weighted terminal gas concentration, not an imposed offset.
 const normalGas=pool.arterial;
 const lowGas=pool.arterial*1.08;
 const deadGas=pool.arterial*.10;
 const terminalGas=normalTerminal*normalGas+
  lowTerminal*lowGas+deadTerminal*deadGas;
 // Diagnostica interna, senza nuovi comandi docente.
 window.simPulmonaryPerfusionState={mode:'controlled',cardiacOutput:co,relativeFlow:perf,
  flowDeadSpace,effectiveAlveolarDeadSpace:effectiveDead,
  alveolarVentilation:alveolar,metabolicVCO2:vco2,
  arterialCO2:pool.arterial,tissueCO2:pool.tissue,
  pulmonaryCO2Delivery:transfer,alveolarCO2Elimination:elimination,
   estimatedTerminalCO2:terminalGas,
   estimatedPaEtGradient:pool.arterial-terminalGas,
   centralCO2Balance:transfer-elimination,tissueCO2Balance:vco2-transfer,
   totalCO2Balance:vco2-elimination,
   centralCapacity,tissueCapacity};
 return clamp(terminalGas,3,80);
}
// La SpO2 dipende qualitativamente da FiO2, reclutamento, sovradistensione
// e perfusione. In spontanea post-induzione mantiene la precedente risposta;
// in ventilazione controllata risponde ora anche alla PEEP. Nessuna delle
// stime costituisce una previsione clinica della PaO2 o della saturazione.
function v25PostInductionOxygenTarget(){
 const vent=typeof window.simVentCalc==='function'?window.simVentCalc():null;
 if(!vent)return null;
 // I vecchi casi attivi continuano a gestire autonomamente la SpO2;
 // un futuro scenario polmonare esplicito puo' invece usare questo modello.
 if(caseState.active&&vent.lungProfile==='healthy')return null;
 const fio2=vent.intubated?vent.fio2:.21;
 if(!vent.controlled){
  if(!vent.postInduction||patientModel!=='healthy')return null;
  return clamp(95.1+6.2*Math.max(0,fio2-.21),94.5,98.7);
 }
 const co=Number($('co')?.value);
 const perfusionLoss=Number.isFinite(co)?clamp((2.9-co)/2.9,0,.7):0;
 return clamp(97.8+2.5*Math.max(0,fio2-.21)+
  (vent.oxygenPeepEffect||0)-.8*perfusionLoss,80,99.5);
}

const inductionMarks=[30,60,120,300,600],inductionKeys=['hr','sap','dap','map','co','sv','svr'];
function inductionCurrent(){
 const read=k=>{const e=$(k),n=e?Number(e.value):NaN;return Number.isFinite(n)?n:null};
 return {hr:read('hr'),sap:read('sap'),dap:read('dap'),map:map(),co:read('co'),sv:read('sv'),svr:read('svr')};
}
function inductionStartReport(){
 const i=v25.induction,b=inductionCurrent();
 i.report={baseline:b,marks:{},minMap:{value:b.map,sec:0},minSvr:{value:b.svr,sec:0},maxHr:{value:b.hr,sec:0}};
 inductionRenderReport();
}
function inductionObserve(rec){
 const i=v25.induction,r=i.report;if(!r||!i.startedAt)return;
 const sec=rec.t-(i.startedAt-v25.start)/1000;if(sec<0)return;
 const values=Object.fromEntries(inductionKeys.map(k=>[k,Number.isFinite(rec[k])?rec[k]:null]));
 inductionMarks.forEach(mark=>{if(sec>=mark&&!r.marks[mark])r.marks[mark]={...values,sec}});
 if(sec<=600.5){
  [['minMap','map',true],['minSvr','svr',true],['maxHr','hr',false]].forEach(([field,key,min])=>{
   const v=values[key];if(v!=null&&(!r[field]||(min?v<r[field].value:v>r[field].value)))r[field]={value:v,sec};
  });
 }
 inductionRenderReport();
}
function inductionRows(){
 const r=v25.induction.report;
 return r?[{label:'Pre-induzione',sec:0,...r.baseline},...inductionMarks.map(t=>({label:t<60?t+' s':t/60+' min',...r.marks[t]}))]:[];
}
function inductionRenderReport(){
 const body=$('inductionReportRows'),info=$('inductionReportInfo'),ext=$('inductionReportExtrema'),btn=$('inductionExportCsv');
 if(!body||!info||!ext)return;
 const i=v25.induction,r=i.report;
 if(btn)btn.disabled=!r;
 if(!r){info.textContent='Il report inizia con «Avvia induzione».';body.innerHTML='<tr><td colspan="8">Nessuna induzione registrata.</td></tr>';ext.textContent='MAP minima, SVR minima e FC massima: —';return}
 const fmt=(v,k)=>v==null||!Number.isFinite(v)?'—':k==='co'?v.toFixed(2):Math.round(v).toLocaleString('it-IT');
 body.innerHTML=inductionRows().map(row=>'<tr><th scope="row" style="text-align:left;white-space:nowrap;padding:5px 7px">'+row.label+'</th>'+inductionKeys.map(k=>'<td style="text-align:right;padding:5px 7px">'+fmt(row[k],k)+'</td>').join('')+'</tr>').join('');
 info.textContent=i.drug+' '+i.dose+' mg/kg EV in '+i.administrationSeconds+' s · campionamento ~1 s · finestra '+i.windowMinutes+' min';
 const extfmt=(o,k,unit,base)=>{if(!o)return '—';const delta=base!=null&&Math.abs(base)>.001?' ('+((o.value-base)/base*100).toFixed(1)+'%)':'';return fmt(o.value,k)+' '+unit+delta+' a '+o.sec.toFixed(0)+' s'};
 ext.textContent='MAP minima: '+extfmt(r.minMap,'map','mmHg',r.baseline.map)+' · SVR minima: '+extfmt(r.minSvr,'svr','dyn·s/cm⁵',r.baseline.svr)+' · FC massima: '+extfmt(r.maxHr,'hr','bpm',r.baseline.hr)+' (primi 10 min).';
}
function inductionExportCsv(){
 const i=v25.induction;if(!i.report)return;
 const esc=v=>'"'+String(v).replaceAll('"','""')+'"';
 const meta=[['Farmaco',i.drug],['Dose mg/kg',i.dose],['Somministrazione secondi',i.administrationSeconds],['Finestra minuti',i.windowMinutes]];
 const head=['Fase','Secondi effettivi','FC bpm','SAP mmHg','DAP mmHg','MAP mmHg','CO L/min','SV mL','SVR dyn s/cm5'];
 const rows=inductionRows().map(r=>[r.label,r.sec==null?'':r.sec.toFixed(1),...inductionKeys.map(k=>r[k]==null?'':r[k])]);
 const extrema=[['MAP minima',i.report.minMap?.sec??'',i.report.minMap?.value??''],['SVR minima',i.report.minSvr?.sec??'',i.report.minSvr?.value??''],['FC massima',i.report.maxHr?.sec??'',i.report.maxHr?.value??'']];
 const csv='\uFEFF'+[...meta,head,...rows,[],['Estremo','Secondi','Valore'],...extrema].map(row=>row.map(esc).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
 a.href=url;a.download='induzione-'+i.drug.toLowerCase()+'-v2897.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function v25Sample(t){let rec={t};v25Metrics.forEach(([k])=>{if(['ppv','spv'].includes(k)&&([AV2,AV3].includes($('rhythm').value)||!(typeof window.simVentValid==='function'&&window.simVentValid())))rec[k]=null;else if(k==='map')rec[k]=map();else if((k==='hr'||k==='spo2')&&($('rhythm').value==='Artefatto massaggio cardiaco 120/min'||$('rhythm').value==='Fibrillazione ventricolare'||$('rhythm').value==='Asistolia'))rec[k]=null;else if(k==='spo2'&&($('rhythm').value==='Tachicardia ventricolare senza polso'||$('rhythm').value==='PEA / attività elettrica'||$('rhythm').value==='Asistolia'))rec[k]=null;else if(['svr','svri','ea','ppv','spv','co','ci','sv','svi','cpo','cce','dpdt'].includes(k)&&$('rhythm').value==='Artefatto massaggio cardiaco 120/min')rec[k]=null;else if(['svr','svri','ea','ppv','spv'].includes(k)&&($('rhythm').value==='Tachicardia ventricolare senza polso'||$('rhythm').value==='Fibrillazione ventricolare'||$('rhythm').value==='PEA / attività elettrica'||$('rhythm').value==='Asistolia'))rec[k]=null;else if(k==='etco2'&&typeof window.simNonIntubated==='function'&&window.simNonIntubated())rec[k]=null;else if(k==='mac')rec[k]=(typeof window.simNonIntubated==='function'&&window.simNonIntubated())?null:+$('mac').value;else if(k==='afterload')rec[k]=phys.vascularTone;else if(k==='preload')rec[k]=phys.preload;else if(k==='contractility')rec[k]=phys.contractility;else rec[k]=+(($(k)&&$(k).value)||state[k]||0)});v25.history.push(rec);if(v25.history.length>1800)v25.history.shift();inductionObserve(rec);try{simCaptureSnapshot()}catch(err){console.warn('Snapshot non disponibile:',err)}}
const v26Groups=[
 ['vitals',['hr','etco2','spo2']],
 ['pressure',['sap','dap','map']],
 ['flow',['co']],
 ['stroke',['sv']],
 ['resistance',['svr']],
 ['fluid',['ppv','spv']],
 ['contractility',['dpdt','cce']],
 ['coupling',['ea','cpo']]
];
const v26Colors=['#3bd6ff','#39ef8b','#ffd34e','#ff5364','#c78cff'];
const v26MonitorColors={hr:'#39ef8b',etco2:'#ffd34e',spo2:'#3bd6ff',sap:'#ff5364',dap:'#ff914d',map:'#ffce4b'};
function v26Fmt(v){if(v==null)return '—';v=Number(v);if(!Number.isFinite(v))return '—';return Math.abs(v)<10?v.toFixed(2):v.toFixed(1)}
function v26DrawGroup(name,keys,a,from,win){
 let c=$('trend-'+name);if(!c)return;let d=devicePixelRatio||1,r=c.getBoundingClientRect(),w=Math.max(260,r.width),h=document.body.classList.contains('student')?155:230;c.width=Math.floor(w*d);c.height=Math.floor(h*d);
 let g=c.getContext('2d');g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,w,h);g.strokeStyle='#20323e';g.lineWidth=1;for(let i=1;i<4;i++){let y=i*h/4;g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}
 v25.events.filter(e=>e.t>=from).forEach(e=>{let x=(e.t-from)/win*w;g.strokeStyle='rgba(255,211,78,.38)';g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()});if(a.length<2)return;
 // Ogni serie usa il proprio primo campione valido: EtCO2 e MAC possono iniziare dopo gli altri parametri.
 // Non convertire mai null in 0 o 1: falserebbe la scala comune e nasconderebbe la curva FC.
 const baselines={};keys.forEach(k=>{const first=a.find(q=>q[k]!=null&&Number.isFinite(Number(q[k]))&&Math.abs(Number(q[k]))>=.01);
 baselines[k]=first?Number(first[k]):1});
 let legend=[],pressure=name==='pressure',all=[];if(!pressure)keys.forEach(k=>{let b=baselines[k];a.forEach(q=>{let v=q[k]==null?NaN:Number(q[k]);if(Number.isFinite(v))all.push((v-b)/Math.max(Math.abs(b),.01)*100)})});let absMax=pressure?1:Math.max(5,...all.map(Math.abs));
 let pvals=pressure?keys.flatMap(k=>a.map(q=>(q[k]==null?NaN:Number(q[k]))).filter(Number.isFinite)):[],pmn=pressure?Math.min(...pvals)-8:0,pmx=pressure?Math.max(...pvals)+8:0;
 keys.forEach((key,j)=>{let def=v25Metrics.find(x=>x[0]===key)||[key,key,''],vals=a.map(q=>q[key]==null?NaN:Number(q[key])).filter(Number.isFinite);if(!vals.length){legend.push('<span style="color:'+(v26MonitorColors[key]||v26Colors[j%v26Colors.length])+'">●</span> '+def[1]+' —');return}let base=baselines[key];
 g.strokeStyle=v26MonitorColors[key]||v26Colors[j%v26Colors.length];g.lineWidth=2;g.beginPath();let drawing=false;a.forEach(q=>{let val=q[key]==null?NaN:Number(q[key]);if(!Number.isFinite(val)){if(drawing)g.stroke();g.beginPath();drawing=false;return;}let x=(q.t-from)/win*w,y=pressure?h*.91-((val-pmn)/Math.max(1,pmx-pmn))*h*.82:h*.5-(((val-base)/Math.max(Math.abs(base),.01)*100)/absMax)*h*.38;if(!drawing){g.moveTo(x,y);drawing=true}else g.lineTo(x,y)});if(drawing)g.stroke();
 let last=a[a.length-1][key];if(last==null){legend.push('<span style="color:'+(v26MonitorColors[key]||v26Colors[j%v26Colors.length])+'">●</span> '+def[1]+' —');return}let delta=(last-base)/Math.max(Math.abs(base),.01)*100;legend.push('<span style="color:'+(v26MonitorColors[key]||v26Colors[j%v26Colors.length])+'">●</span> '+def[1]+' '+v26Fmt(last)+(def[2]?' '+def[2]:'')+(pressure?'':' ('+(delta>=0?'+':'')+delta.toFixed(1)+'%)'))});
 if(!pressure){g.strokeStyle='rgba(255,255,255,.18)';g.beginPath();g.moveTo(0,h*.5);g.lineTo(w,h*.5);g.stroke()}let el=$('legend-'+name);if(el)el.innerHTML=legend.join(' &nbsp; ')
}
function v25Draw(){
 let win=+$('v25Window').value||120,now=(simClock.virtual-v25.start)/1000,from=Math.max(0,now-win),a=v25.history.filter(x=>x.t>=from);
 v26Groups.forEach(([name,keys])=>v26DrawGroup(name,keys,a,from,win));
}
function v25RenderEvents(){$('v25TrendEvents').textContent=v25.events.slice(-5).map(e=>{let m=Math.floor(e.t/60),s=Math.floor(e.t%60);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+' '+e.txt}).join(' · ')}

// Virtual simulation time is monotonic and independent of the browser clock.
const simClock={virtual:performance.now(),real:performance.now(),speed:1,paused:false,busy:false,accumulator:0};
window.simVirtualNow=()=>simClock.virtual;
function simAdvancePhysics(seconds){
 const n=Math.ceil(seconds/.25),step=seconds/n;
 for(let i=0;i<n;i++){
  simClock.virtual+=step*1000;
  v25.applying=true;
  v25InductionStep(step,simClock.virtual);v25TherapyStep(step,simClock.virtual);
  physiology();
  const ventData=typeof window.simVentCalc==='function'?window.simVentCalc():null;
  const target=v25PerfusionEt(step,ventData);
  const postInductionSpont=Boolean(ventData?.postInduction&&!ventData.controlled);
  // La ventilazione controllata ha gia' due compartimenti CO2 con inerzia
  // fisiologica: il filtro di 1,8 s simula solo il campionamento del monitor.
  const etTau=postInductionSpont?(ventData?.intubated?26:60):ventData?.controlled?1.8:2.2;
  v25.etEffective+=(target-v25.etEffective)*(1-Math.exp(-step/etTau));
  const spontIntubated=Boolean(ventData?.intubated&&!ventData.controlled);
  const cycle=60/Math.max(1,ventData?.rate||12);
  const breathIndex=Math.floor((Number.isFinite(window.simWaveTimeSeconds)?window.simWaveTimeSeconds:0)/cycle);
  const breathFactor=spontIntubated&&typeof window.simSpontCapBreathFactor==='function'?
   window.simSpontCapBreathFactor(breathIndex):1;
  if(!manualLocks.etco2)$('etco2').value=(v25.etEffective*breathFactor).toFixed(1);
  const spoTarget=v25PostInductionOxygenTarget();
  if(spoTarget!==null){
   if(manualLocks.spo2)v25.oxygenEffective=+$('spo2').value||98;
   else{
    v25.oxygenEffective+=(spoTarget-v25.oxygenEffective)*(1-Math.exp(-step/18));
    $('spo2').value=clamp(v25.oxygenEffective,80,100).toFixed(0);
   }
  }
  // Experimental V/Q module is the single oxygen source for SpO2 and EGA.
  // Preserve instructor manual lock and the existing pulseless-rhythm display.
  if(typeof window.simEgaOxygenSaturation==='function'){
   const egaSat=window.simEgaOxygenSaturation();
   if(Number.isFinite(egaSat)){
    if(manualLocks.spo2)v25.oxygenEffective=+$('spo2').value||98;
    else{
     v25.oxygenEffective=egaSat;
     $('spo2').value=clamp(egaSat,0,100).toFixed(0);
    }
   }
  }
  render();v25.applying=false;
  const sec=(simClock.virtual-v25.start)/1000;
  if(sec-v25.lastSample>=1){v25.lastSample=sec;v25Sample(sec)}
 }
 v25Draw();
}
function simTimeDisplay(){
 const s=Math.max(0,Math.floor((simClock.virtual-v25.start)/1000));
 const val=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
 $('v25Clock').textContent=val;$('simTimeReadout').textContent=val;
}
const simSnapshots=[];
const simCopy=x=>JSON.parse(JSON.stringify(x));
function simCaptureSnapshot(){
 const previous=simSnapshots[simSnapshots.length-1];
 if(previous&&simClock.virtual-previous.time<950)return;
 const values={};document.querySelectorAll('input[id],select[id]').forEach(el=>{if(el.type!=='checkbox')values[el.id]=el.value});
 const dynamics={};Object.keys(v25).forEach(k=>{if(!['history','events','applying'].includes(k))dynamics[k]=simCopy(v25[k])});
 simSnapshots.push({time:simClock.virtual,state:simCopy(state),phys:simCopy(phys),patientModel,lungProfile:window.simVentLungProfile||'healthy',airwayIntubated:window.simAirwayIntubated,dynamics,values});
 if(simSnapshots.length>1800)simSnapshots.shift();
}
function simRewind(minutes){
 if(simClock.busy)return;
 const desired=Math.max(v25.start,simClock.virtual-minutes*60000);
 const snap=[...simSnapshots].reverse().find(x=>x.time<=desired);
 if(!snap)return;
 simClock.virtual=snap.time;simClock.accumulator=0;simClock.real=performance.now();
 state=simCopy(snap.state);Object.assign(phys,simCopy(snap.phys));patientModel=snap.patientModel||'anesthetized';
  window.simAirwayIntubated=typeof snap.airwayIntubated==='boolean'?snap.airwayIntubated:snap.dynamics?.induction?.phase==='maintenance';
 Object.assign(v25,simCopy(snap.dynamics));v25.applying=false;
 Object.entries(snap.values).forEach(([id,value])=>{const el=$(id);if(el)el.value=value});
 if(typeof window.simVentSetLungProfile==='function')window.simVentSetLungProfile(snap.lungProfile||'healthy',true);
 const elapsed=(snap.time-v25.start)/1000;
 v25.history=v25.history.filter(x=>x.t<=elapsed);
 v25.events=v25.events.filter(x=>!Number.isFinite(x.t)||x.t<=elapsed);
 while(simSnapshots.length&&simSnapshots[simSnapshots.length-1].time>snap.time)simSnapshots.pop();
 render();v25Draw();inductionRenderReport();simTimeDisplay();
 simPublishStudentHistory();simPublishStudentStatus();
}
// Sync stato e trend: la console istruttore e' l'unica sorgente.
const studentStatusKey='recoverCaneStudentStatusV2891',studentHistoryKey='recoverCaneStudentHistoryV2891';
let studentLastStatusAt=0,studentLastHistoryAt=0;
function simPublishStudentStatus(){
 if(document.body.classList.contains('student'))return;
 try{localStorage.setItem(studentStatusKey,JSON.stringify({paused:simClock.paused,waveClock:{time:Number(window.simWaveTimeSeconds)||0,sentAt:Date.now()},airwayIntubated:window.simAirwayIntubated,anesthesiaPhase:v25.induction.phase,inductionStarted:v25.induction.startedAt>0,elapsed:(simClock.virtual-v25.start)/1000,sample:v25.history[v25.history.length-1]||null,trendWindow:+$('v25Window').value,events:v25.events.slice(-30),waveShape:{tone:window.macEffectiveTone??null,contractility:window.macEffectiveContractility??null,norFx:v25.fx.tone||0,norActive:!!v25.inf.nor,dex:typeof window.premedDexEffect==='function'?window.premedDexEffect():0},treatments:{infusions:{fluid:!!v25.inf.fluid,dob:!!v25.inf.dob,nor:!!v25.inf.nor},rates:{fluid:+$('v25FluidRate').value,dob:+$('v25DobRate').value,nor:+$('v25NorRate').value},mac:+$('mac').value,phase:v25.induction.phase}}))}
 catch(err){console.warn('Sincronizzazione studenti:',err)}
}
function simPublishStudentHistory(){
 if(document.body.classList.contains('student'))return;
 try{localStorage.setItem(studentHistoryKey,JSON.stringify({history:v25.history,events:v25.events,elapsed:(simClock.virtual-v25.start)/1000,paused:simClock.paused,trendWindow:+$('v25Window').value}))}
 catch(err){console.warn('Cronologia studenti:',err)}
}
function simStudentApplyTrendWindow(d){
 if(!d||!document.body.classList.contains('student'))return;
 const win=Number(d.trendWindow);
 if(![120,300,600,1800].includes(win))return;
 const select=$('v25Window');
 if(select)select.value=String(win);
 const label=$('studentTrendWindowStatus');
 if(label)label.textContent='Finestra '+(win/60)+' min · gestita dalla console';
}
function simStudentApplyStatus(d){
 if(!d||!document.body.classList.contains('student'))return;
 simStudentApplyTrendWindow(d);
 if(d.waveShape)window.simStudentWaveShape=d.waveShape;
 if(d.waveClock&&Number.isFinite(d.waveClock.time)&&Number.isFinite(d.waveClock.sentAt))window.simStudentWaveClock=d.waveClock;
 if(Number.isFinite(d.elapsed))simClock.virtual=v25.start+Math.max(0,d.elapsed)*1000;
 if(d.anesthesiaPhase)v25.induction.phase=d.anesthesiaPhase;
  if(typeof d.airwayIntubated==='boolean')window.simAirwayIntubated=d.airwayIntubated;
 if(typeof d.inductionStarted==='boolean')v25.induction.startedAt=d.inductionStarted?1:0;
 if(d.sample&&Number.isFinite(d.sample.t)){
  v25.history=v25.history.filter(x=>x.t<d.sample.t);
  v25.history.push(d.sample);
  if(v25.history.length>1800)v25.history.splice(0,v25.history.length-1800);
 }
 if(Array.isArray(d.events))v25.events=d.events;
 simClock.paused=Boolean(d.paused);
 if(typeof window.simWaveSetPaused==='function')window.simWaveSetPaused(simClock.paused);
 v25Draw();v25RenderEvents();simTimeDisplay();render();
}
function simStudentApplyHistory(d){
 if(!d||!document.body.classList.contains('student'))return;
 simStudentApplyTrendWindow(d);
 if(Array.isArray(d.history))v25.history=d.history;
 if(Array.isArray(d.events))v25.events=d.events;
 if(Number.isFinite(d.elapsed))simClock.virtual=v25.start+Math.max(0,d.elapsed)*1000;
 simClock.paused=Boolean(d.paused);
 if(typeof window.simWaveSetPaused==='function')window.simWaveSetPaused(simClock.paused);
 v25Draw();v25RenderEvents();simTimeDisplay();
}
function simStudentRestore(){
 if(!document.body.classList.contains('student'))return;
 try{
  const h=localStorage.getItem(studentHistoryKey);if(h)simStudentApplyHistory(JSON.parse(h));
  const p=localStorage.getItem(studentStatusKey);if(p)simStudentApplyStatus(JSON.parse(p));
 }catch(err){console.warn('Ripristino studenti:',err)}
}
function simTimeSetup(){
 $('simSpeed').onchange=()=>{simClock.speed=Number($('simSpeed').value)||1};
 $('simPause').onclick=()=>{
  simClock.paused=!simClock.paused;
  $('simPause').textContent=simClock.paused?'Riprendi':'Pausa';
  // Ferma anche ECG, pletismografia, capnografia e curva arteriosa.
  if(typeof window.simWaveSetPaused==='function')window.simWaveSetPaused(simClock.paused);
  simPublishStudentHistory();simPublishStudentStatus();
 };
 [[1,'simBack1'],[5,'simBack5'],[10,'simBack10']].forEach(([minutes,id])=>{$(id).onclick=()=>simRewind(minutes)});
 [[1,'simAdvance1'],[5,'simAdvance5'],[10,'simAdvance10']].forEach(([minutes,id])=>{
  $(id).onclick=()=>{
   if(simClock.busy)return;
   simClock.busy=true;
   const buttons=['simAdvance1','simAdvance5','simAdvance10'];buttons.forEach(k=>$(k).disabled=true);
   let left=minutes*60;
   function batch(){
    const span=Math.min(left,10);
    simAdvancePhysics(span);left-=span;simTimeDisplay();
    if(left>0)setTimeout(batch,0);
    else{simClock.busy=false;simClock.accumulator=0;simClock.real=performance.now();buttons.forEach(k=>$(k).disabled=false);simPublishStudentHistory();simPublishStudentStatus()}
   }
   batch();
  };
 });
}

function v25Loop(now){
 if(document.body.classList.contains('student')){simClock.real=now;requestAnimationFrame(v25Loop);return}
 const elapsed=Math.min(.5,Math.max(0,(now-simClock.real)/1000));simClock.real=now;
 if(!simClock.busy&&!simClock.paused){
  // Accumulate animation-frame time: at 60 fps a single frame is only
  // ~0.016 s, so the former 0.05 s threshold discarded every frame.
  simClock.accumulator+=elapsed*simClock.speed;
  if(simClock.accumulator>=.05){
   const delta=simClock.accumulator;
   simClock.accumulator=0;
   simAdvancePhysics(delta);
  }
 }
 simTimeDisplay();
 if(now-studentLastStatusAt>=1000){studentLastStatusAt=now;simPublishStudentStatus()}
 if(now-studentLastHistoryAt>=5000){studentLastHistoryAt=now;simPublishStudentHistory()}
 requestAnimationFrame(v25Loop);
}
v25Setup();simTimeSetup();try{simCaptureSnapshot()}catch(err){console.warn('Snapshot iniziale:',err)}requestAnimationFrame(v25Loop);
/* ===== end V2.8.2 ===== */

$('modeBtn').onclick=()=>{document.body.classList.toggle('student');let s=document.body.classList.contains('student');$('modeTitle').textContent=s?'Monitor studenti':'Console istruttore';$('modeBtn').textContent=s?'Torna alla console':'Modalità studenti'};
$('studentBtn').onclick=()=>{let u=new URL(location.href);u.searchParams.set('student','1');window.open(u.toString(),'_blank')};
$('fullBtn').onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()};
if(new URLSearchParams(location.search).get('student')==='1'){$('modeBtn').click()}
window.addEventListener('DOMContentLoaded',()=>{if(document.body.classList.contains('student'))simStudentRestore();else{simPublishStudentHistory();simPublishStudentStatus()}});

window.addEventListener('storage',e=>{
 if(document.body.classList.contains('student')&&e.newValue){
  if(e.key===studentStatusKey){try{simStudentApplyStatus(JSON.parse(e.newValue))}catch(err){console.warn(err)}return}
  if(e.key===studentHistoryKey){try{simStudentApplyHistory(JSON.parse(e.newValue));const p=localStorage.getItem(studentStatusKey);if(p)simStudentApplyStatus(JSON.parse(p))}catch(err){console.warn(err)}return}
 }
 if(e.key==='recoverCaneState'&&document.body.classList.contains('student')){let d=JSON.parse(e.newValue);state=d.state;active=d.active;$('name').value=d.name;$('weight').value=d.weight;$('rhythm').value=d.rhythm;Object.entries(state).forEach(([k,v])=>{if($(k))$(k).value=v});document.querySelectorAll('[data-toggle]').forEach(x=>x.checked=active[x.dataset.toggle]);
if(d.anesthesiaPhase)v25.induction.phase=d.anesthesiaPhase;
if(typeof d.airwayIntubated==='boolean')window.simAirwayIntubated=d.airwayIntubated;
if(typeof d.inductionStarted==='boolean')v25.induction.startedAt=d.inductionStarted?1:0;
if(d.patient)for(const [id,k] of [['patientAge','age'],['patientBreed','breed'],['patientMorph','morph'],['patientBodyType','bodyType'],['patientBCS','bcs']]){if($(id)&&d.patient[k]!=null)$(id).value=d.patient[k]}
if(d.vent&&typeof window.simVentApplySettings==='function')window.simVentApplySettings(d.vent);
if(d.caseState&&d.caseState.active){caseState=d.caseState;$('studentCaseBanner').style.display='block';$('studentCaseMinute').textContent=caseState.minute;$('studentCasePresentation').textContent=d.casePresentation;$('studentCaseEvolution').textContent=d.caseEvolutionText}else{$('studentCaseBanner').style.display='none'}
render()}});

setActive(true);setPhysInputs();manualSetup();physiology();

// Aggiornamenti GitHub Pages: disattiva il vecchio Service Worker e le sue cache.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('sim-emodinamico-')).map(key => caches.delete(key)));
      }
    } catch (err) { console.warn('Pulizia cache simulatore:', err); }
  });
}

/* Modulo sperimentale EGA/VQ: non modifica il motore emodinamico. */
window.addEventListener('DOMContentLoaded',function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const student=document.body.classList.contains('student');
 const KEY='simEmogasVQExperimental';
 const SETTINGS_KEY='simEmogasVQActiveSettings';
 const profiles={
  healthy:{label:'Polmone sano',shunt:.02,low:.04,dead:.25},
  hypoventilation:{label:'Ipoventilazione',shunt:.02,low:.04,dead:.25,ventFactor:.6},
  atelectasis:{label:'Atelettasia / shunt',shunt:.25,low:.18,dead:.25},
  bronchospasm:{label:'Broncospasmo',shunt:.05,low:.4,dead:.32},
  embolism:{label:'Spazio morto elevato',shunt:.02,low:.08,dead:.58},
  edema:{label:'Edema polmonare',shunt:.18,low:.34,dead:.3}
 };
 const fmt=(n,d=1)=>Number.isFinite(n)?n.toFixed(d).replace('.',','):'—';
 const panel=document.createElement('section');
 panel.className='card';panel.id='emogasVQPanel';
 panel.innerHTML='<h2>Scenario clinico polmonare <small style="font-size:11px;color:#9db6c4">Sperimentale</small></h2>'+
 '<p style="font-size:12px;color:#9db6c4">Modello didattico esplorativo, non validato per decisioni cliniche. Prelievo virtuale oppure aggiornamento continuo.</p>'+
 (student?'':'<div class="row" style="flex-wrap:wrap;gap:8px"><label>Scenario <select id="egaScenario">'+
 Object.entries(profiles).map(([k,v])=>'<option value="'+k+'">'+v.label+'</option>').join('')+
 '</select></label><label>Shunt (%) <input id="egaShunt" type="number" min="0" max="80" value="2" step="1"></label>'+
 '<label>Basso V/Q (%) <input id="egaLow" type="number" min="0" max="80" value="4" step="1"></label>'+
 '<label>Spazio morto alveolare (%) <input id="egaDead" type="number" min="0" max="85" value="25" step="1"></label>'+
 '<label>Hb (g/dL) <input id="egaHb" type="number" min="3" max="25" value="14" step=".5"></label>'+
 '</div>'+
 '<div class="row" style="gap:8px;flex-wrap:wrap;margin:8px 0"><button id="egaSample" type="button">Esegui prelievo arterioso</button>'+
 '<label><input id="egaLive" type="checkbox"> Monitoraggio continuo</label></div>')+
 '<div id="egaStatus" style="font-size:12px;color:#b7cbd3;margin:8px 0">In attesa del primo prelievo</div>'+
 '<div id="egaMetrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:7px"></div>'+
 '<h3 style="font-size:14px;margin:12px 0 6px">Distribuzione V/Q · quote di perfusione</h3>'+
 '<div id="egaCompartments"></div>'+
 '<p style="font-size:11px;color:#9db6c4">Il valore PaCO₂ è una stima stazionaria da VCO₂/ventilazione alveolare, non una replica della dinamica dell’EtCO₂. HCO₃⁻ segue automaticamente il compenso acuto atteso della PaCO₂; nessun disturbo misto o compenso renale.</p>';
 // Acid-base teaching chart: shown below PRAM only while the Emogas tab is selected.
 const hemo=document.querySelector('.hemo-wrap');
 const acidCard=document.createElement('section');
 acidCard.className='card';
 acidCard.id='egaAcidBaseCard';
 acidCard.hidden=true;
 acidCard.innerHTML='<h2>Equilibrio acido-base · pH / PaCO₂</h2>'+
 '<p style="font-size:12px;color:#9db6c4">Curva del compenso respiratorio acuto atteso: il punto indica il paziente, il cerchio tratteggiato il prelievo precedente.</p>'+
 '<svg id="egaAcidSvg" viewBox="0 0 700 320" role="img" aria-label="Diagramma acido-base con pH in verticale e PaCO₂ in orizzontale" style="width:100%;height:auto;display:block"></svg>'+
 '<div id="egaAcidSummary" style="font-size:12px;color:#b7cbd3">In attesa del prelievo arterioso</div>';
 if(!student&&hemo)hemo.insertAdjacentElement('afterend',acidCard);
 let referenceGas=null;
 let latestGas=null;
 // Reference remains fixed during continuous EGA sampling.
 function setReferenceBeforeAdjustment(){
  if(!latestGas)return;
  referenceGas={paCO2:latestGas.paCO2,ph:latestGas.ph};
  acidPlot(latestGas);
 }
 const activeEdits=new WeakSet();
 function isClinicalSetting(el){
  if(!(el instanceof HTMLElement)||!el.matches('input,select'))return false;
  if(el.id==='egaLive'||el.id==='egaLiveVent')return false;
  const id=(el.id||'').toLowerCase();
  if(/pause|speed|time|seek|scrub|live|sample|tab|trend|scroll/.test(id))return false;
  return Boolean(el.closest('#instructor-panel-ventilation,#instructor-panel-emogas,#instructor-panel-anesthesia,#instructor-panel-therapies,#instructor-panel-patient,#egaVentControls')||
   /^(ega(shunt|low|dead|hb|scenario)|vent|peep|fio2|rr|vt|mac|dose)/i.test(el.id||''));
 }
 document.addEventListener('input',e=>{
  const el=e.target;
  if(!isClinicalSetting(el)||activeEdits.has(el))return;
  activeEdits.add(el);
  setReferenceBeforeAdjustment();
 },true);
 document.addEventListener('change',e=>{
  const el=e.target;
  if(!isClinicalSetting(el))return;
  if(!activeEdits.has(el))setReferenceBeforeAdjustment();
  activeEdits.delete(el);
 },true);
 function acidPlot(r){
  if(!acidCard.isConnected||!r)return;
  const svg=$('egaAcidSvg');if(!svg)return;
  const X=v=>62+(Math.max(15,Math.min(100,v))-15)/85*610;
  const Y=v=>282-(Math.max(6.9,Math.min(7.8,v))-6.9)/.9*246;
  const rect=(x,y,w,h,fill)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fill+'"/>';
  const line=(x1,y1,x2,y2,stroke='#476170',dash='')=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+stroke+'" stroke-width="1" '+(dash?'stroke-dasharray="'+dash+'"':'')+'/>';
  const txt=(x,y,t,sz=12,fill='#b9d2df')=>'<text x="'+x+'" y="'+y+'" font-size="'+sz+'" fill="'+fill+'" font-family="system-ui,sans-serif">'+t+'</text>';
  let out=rect(0,0,700,320,'#0a1820');
  out+=rect(X(15),Y(7.8),X(100)-X(15),Y(6.9)-Y(7.8),'#10222d');
  for(let v=7;v<=7.8+.001;v+=.2){out+=line(62,Y(v),672,Y(v),'#27414f','3 5')+txt(9,Y(v)+4,v.toFixed(2),11)}
  for(let v=20;v<=100;v+=20){out+=line(X(v),36,X(v),282,'#27414f','3 5')+txt(X(v)-9,300,String(v),11)}
  out+=line(62,36,62,282)+line(62,282,672,282);
  out+=line(X(40),36,X(40),282,'#6c8794','4 5')+line(62,Y(7.4),672,Y(7.4),'#6c8794','4 5');
  out+=txt(270,316,'PaCO₂ (mmHg)',13)+txt(8,24,'pH',13);
  // Expected acute respiratory compensation curve (not a mixed-disorder band).
  const acuteCurve=[];
  for(let p=15;p<=100;p+=1){
   const bicar=24+(p>=40?.1:.2)*(p-40);
   const ph=6.1+Math.log10(bicar/(.03*p));
   acuteCurve.push(X(p).toFixed(1)+','+Y(ph).toFixed(1));
  }
  out+='<polyline points="'+acuteCurve.join(' ')+'" fill="none" stroke="#55e0a8" stroke-width="3" stroke-linejoin="round"/>';
  out+=txt(315,101,'Compenso acuto atteso',12,'#55e0a8');
  out+=txt(85,75,'Alcalosi respiratoria',13,'#8fb8e8');
  out+=txt(475,260,'Acidosi respiratoria',13,'#8fb8e8');
  if(referenceGas&&Number.isFinite(referenceGas.paCO2)&&Number.isFinite(referenceGas.ph)){
   out+='<circle cx="'+X(referenceGas.paCO2)+'" cy="'+Y(referenceGas.ph)+'" r="6" fill="none" stroke="#9aafbd" stroke-width="2" stroke-dasharray="3 2"/>';
  }
  out+='<circle cx="'+X(r.paCO2)+'" cy="'+Y(r.ph)+'" r="7" fill="#36d8f2" stroke="#fff" stroke-width="2"/>';
  svg.innerHTML=out;
  $('egaAcidSummary').textContent='Ultimo prelievo: pH '+fmt(r.ph,3)+' · PaCO₂ '+fmt(r.paCO2)+' mmHg · HCO₃⁻ '+fmt(r.hco3)+' mmol/L. Cerchio tratteggiato: riferimento prima dell’ultima modifica.';

 }
 function draw(result,stamp){
  if(!result)return;
  const entries=[['pH',fmt(result.ph,3)],['PaCO₂',fmt(result.paCO2)+' mmHg'],['PaO₂',fmt(result.paO2)+' mmHg'],['HCO₃⁻',fmt(result.hco3)+' mmol/L'],['SaO₂',fmt(result.saO2)+' %'],['DO₂',fmt(result.do2,0)+' mL/min'],['CaO₂',fmt(result.caO2,2)+' mL/dL'],['CvO₂',fmt(result.cvO2,2)+' mL/dL'],['SvO₂ stimata',fmt(result.svO2)+' %'],['Estrazione O₂',fmt(result.oxygenExtractionRatio)+' %'],['P/F',fmt(result.pfRatio,0)],['A–a',fmt(result.aaGradient)+' mmHg'],['PaCO₂ − EtCO₂',result.paEtGradient==null?'Non disponibile':fmt(result.paEtGradient)+' mmHg']];
  $('egaMetrics').innerHTML=entries.map(([k,v])=>'<div style="border:1px solid #29404d;border-radius:8px;padding:8px"><small>'+k+'</small><div style="font-size:18px;font-weight:700">'+v+'</div></div>').join('');
  const parts=result.compartments;
  $('egaCompartments').innerHTML=[['Normale',parts.normal,'#3ca7cc'],['Basso V/Q',parts.lowVQ,'#f4b65b'],['Shunt',parts.shunt,'#ed6974']].map(([k,v,c])=>
   '<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;font-size:12px"><span>'+k+'</span><span>'+fmt(v*100,0)+'%</span></div><div style="height:12px;background:#21323d;border-radius:6px;overflow:hidden"><div style="width:'+Math.max(0,v*100)+'%;height:100%;background:'+c+'"></div></div></div>').join('');
  const d=result.inputs;
  const effectiveInfo=' · quote V/Q effettive alla PEEP: shunt '+fmt(d.shunt*100,1)+'%, basso V/Q '+fmt(d.low*100,1)+'%, spazio morto alveolare '+fmt(d.dead*100,1)+'%';
  $('egaStatus').textContent='Ultimo campione arterioso · '+stamp+effectiveInfo+(result.oxygenSupplyWarning?' · '+result.oxygenSupplyWarning:'');
  latestGas={paCO2:result.paCO2,ph:result.ph,hco3:result.hco3};
  acidPlot(result);
 }
 // Shared effective alveolar minute ventilation for the CO2 pool and EGA.
 // Read the same instructor controls; no dependency on the current tab.
 // Shares the effective V/Q settings with the terminal-gas CO2 model.
 // These are alveolar dead-space and perfusion fractions; no separate
 // anatomical dead-space control is introduced.
 window.simEgaGasFractions=function(vent){
  const key=$('egaScenario')?.value||'healthy';
  return window.EmogasVQ.peepResponse({
   scenario:key,controlled:Boolean(vent?.controlled),peep:vent?.peep||0,
   shunt:clamp(+$('egaShunt')?.value/100||0,0,.8),
   lowVQFraction:clamp(+$('egaLow')?.value/100||0,0,.8),
   deadSpaceFraction:clamp(+$('egaDead')?.value/100||0,0,.85)
  });
 };
 window.simEgaAlveolarMinute=function(vent){
  if(!vent||!$('egaScenario'))return vent?.alveolarMinute||3;
  const key=$('egaScenario').value;
  const scenario=profiles[key]||profiles.healthy;
  const effective=window.EmogasVQ.peepResponse({
   scenario:key,controlled:Boolean(vent.controlled),peep:vent.peep||0,
   shunt:clamp(+$('egaShunt').value/100,0,.8),
   lowVQFraction:clamp(+$('egaLow').value/100,0,.8),
   deadSpaceFraction:clamp(+$('egaDead').value/100,0,.85)
  });
  const minute=vent.controlled?vent.minute:Math.max(.1,(vent.weight||25)*.12);
  return Math.max(.05,minute*(1-effective.deadSpaceFraction)*(scenario.ventFactor||1));
 };
 function data(){
  const vent=typeof window.simVentCalc==='function'?window.simVentCalc():null;
  const scenarioKey=$('egaScenario').value;
  const scenario=profiles[scenarioKey]||profiles.healthy;
  const baselineDead=clamp(+$('egaDead').value/100,0,.85);
  const effective=window.EmogasVQ.peepResponse({
   scenario:scenarioKey,controlled:Boolean(vent?.controlled),peep:vent?.peep||0,
   shunt:clamp(+$('egaShunt').value/100,0,.8),
   lowVQFraction:clamp(+$('egaLow').value/100,0,.8),
   deadSpaceFraction:baselineDead
  });
  const dead=effective.deadSpaceFraction;
  const rr=vent?.rate||12,weight=vent?.weight||25;
  const minute=vent?.controlled?vent.minute:Math.max(.1,weight*.12);
  // Spontaneous breathing: the ventilator's calculated tidal volume is a
  // mechanical placeholder, not a measured spontaneous minute ventilation.
  // Use a weight-scaled physiological teaching baseline (~120 mL/kg/min)
  // until spontaneous ventilation is explicitly modeled or measured.
  // Use the active ventilator's minute volume; dead-space control changes VA.
  const actualVA=window.simEgaAlveolarMinute(vent);
  // Metabolic production must not be recalibrated at every breath/sample:
  // otherwise changes in ventilation would cancel out PaCO2 responses.
  const metabolicCO2=clamp(105*Math.pow(weight/25,.8),15,650);
  // PaCO2 follows effective alveolar ventilation and CO2 production.
  // Shunt changes oxygen mixing, but must not impose an arbitrary
  // additive CO2 penalty when minute ventilation and dead space are fixed.
  const shunt=effective.shunt;
  const lowVQ=effective.lowVQFraction;
  const baselinePaCO2=clamp(.863*metabolicCO2/actualVA,10,120);
  return window.EmogasVQ.calculate({
   // Use the same dynamic arterial CO2 pool that drives the monitor
   // whenever controlled ventilation is active; otherwise use EGA steady state.
   paCO2:vent?.controlled&&Number.isFinite(window.simDynamicPaCO2)?
    clamp(window.simDynamicPaCO2,10,120):
    clamp(baselinePaCO2,10,120),
   fio2:vent?.intubated?vent.fio2:.21,
   alveolarVentilation:actualVA,metabolicCO2,
   cardiacOutput:typeof state!=='undefined'&&Number.isFinite(state.co)?state.co:3,
   hb:+$('egaHb').value||14,
   shunt,lowVQFraction:lowVQ,
   deadSpaceFraction:dead
  });
 }
 function clamp(x,a,b){return Math.min(b,Math.max(a,x))}
 if(student){
  const nav=document.querySelector('.student-tabs-nav');
  const host=document.querySelector('.student-tabs-shell');
  if(nav&&host){
   const btn=document.createElement('button');btn.type='button';btn.textContent='Emogas';btn.setAttribute('role','tab');
   nav.append(btn);panel.className='student-tab-panel';panel.hidden=true;host.append(panel);
   btn.onclick=()=>{nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected','false'));host.querySelectorAll('.student-tab-panel').forEach(p=>p.hidden=true);btn.setAttribute('aria-selected','true');panel.hidden=false};
   nav.querySelectorAll('button:not(:last-child)').forEach(b=>b.addEventListener('click',()=>{panel.hidden=true;btn.setAttribute('aria-selected','false')}));
  }
  let latestSettings=null;
  function showSettings(){
   if(!latestSettings)return;
   let line=$('egaActiveSettings');
   if(!line){line=document.createElement('div');line.id='egaActiveSettings';line.style.cssText='font-size:12px;color:#86d9ef;margin:8px 0';$('egaStatus').before(line)}
   const d=latestSettings;
   line.textContent='Scenario attivo · shunt '+fmt(d.shunt*100,1)+'% · basso V/Q '+fmt(d.low*100,1)+'% · spazio morto alveolare '+fmt(d.dead*100,1)+'%';
  }
  function receiveSettings(raw){try{latestSettings=JSON.parse(raw);showSettings()}catch(_){}}
  function receive(e){try{const x=JSON.parse(e);draw(x.result,x.stamp);showSettings()}catch(_){}}
  window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue)receive(e.newValue);if(e.key===SETTINGS_KEY&&e.newValue)receiveSettings(e.newValue)});
  try{const x=localStorage.getItem(KEY);if(x)receive(x);const settings=localStorage.getItem(SETTINGS_KEY);if(settings)receiveSettings(settings)}catch(_){}
  return;
 }
 const instructor=document.querySelector('#instructor-panel-ventilation');
 if(!instructor)return;
 const nav=document.querySelector('.instructor-tab-nav');
 const aside=instructor.parentElement;
 const btn=document.createElement('button');btn.id='instructor-tab-emogas';btn.type='button';btn.textContent='Emogas';btn.setAttribute('role','tab');
 const tab=document.createElement('div');tab.id='instructor-panel-emogas';tab.className='instructor-tab-panel';tab.setAttribute('role','tabpanel');
 tab.hidden=true;tab.append(panel);aside.append(tab);nav?.append(btn);
 btn.onclick=()=>{
  nav?.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-selected','false');b.classList.remove('active')});
  aside.querySelectorAll('.instructor-tab-panel').forEach(p=>p.hidden=true);
  btn.setAttribute('aria-selected','true');btn.classList.add('active');tab.hidden=false;
  document.body.dataset.instructorTab='emogas';
  acidCard.hidden=false;
  if(!$('egaAcidSvg')?.querySelector('circle'))drawInitialAcidChart();
 };
 nav?.querySelectorAll('button:not(:last-child)').forEach(b=>b.addEventListener('click',()=>{tab.hidden=true;acidCard.hidden=true;btn.setAttribute('aria-selected','false')}));
 // Second set of controls in Ventilazione; original Emogas controls remain the single source of truth.
 const ventCard=document.createElement('section');
 ventCard.className='card';
 ventCard.id='egaVentControls';
 ventCard.innerHTML='<h2>Scenario clinico polmonare <small style="font-size:11px;color:#9db6c4">Sperimentale</small></h2>'+
 '<p style="font-size:12px;color:#9db6c4">Stessi parametri della scheda Emogas. Le modifiche si applicano a entrambe le schede.</p>';
 const controlRows=panel.querySelectorAll('.row');
 const ids=['egaScenario','egaShunt','egaLow','egaDead','egaHb','egaSample','egaLive'];
 controlRows.forEach(row=>{
  const copy=row.cloneNode(true);
  copy.querySelectorAll('[id]').forEach(el=>{el.id+='Vent'});
  ventCard.append(copy);
 });
 const ventHost=$('ventilationPanel');
 if(ventHost)ventHost.insertAdjacentElement('beforebegin',ventCard);
 function refreshVentControls(){
  ids.forEach(id=>{
   const source=$(id),copy=$(id+'Vent');
   if(!source||!copy)return;
   if(source.type==='checkbox')copy.checked=source.checked;
   else if(source.tagName!=='BUTTON')copy.value=source.value;
  });
 }
 ids.forEach(id=>{
  const source=$(id),copy=$(id+'Vent');
  if(!source||!copy)return;
  if(id==='egaSample'){
   copy.addEventListener('click',()=>source.click());
   return;
  }
  const eventName=source.type==='checkbox'||source.tagName==='SELECT'?'change':'input';
  copy.addEventListener(eventName,()=>{
   if(source.type==='checkbox')source.checked=copy.checked;
   else source.value=copy.value;
   source.dispatchEvent(new Event(eventName,{bubbles:true}));
   refreshVentControls();
  });
  source.addEventListener(eventName,refreshVentControls);
 });
 // Scenario selection updates its dependent shunt/VQ/dead-space inputs.
 $('egaScenario')?.addEventListener('change',refreshVentControls);
 refreshVentControls();
 // Synchronize CURRENT settings separately from the time-stamped arterial
 // sample. A previous sample must never be presented as the active scenario.
 function publishActiveSettings(){
  try{
   const vent=typeof window.simVentCalc==='function'?window.simVentCalc():null;
   const d=typeof window.simEgaGasFractions==='function'?window.simEgaGasFractions(vent):null;
   if(!d)return;
   const active={shunt:d.shunt,low:d.lowVQFraction,dead:d.deadSpaceFraction};
   const serialized=JSON.stringify(active);
   if(serialized!==publishActiveSettings.last){
    publishActiveSettings.last=serialized;
    localStorage.setItem(SETTINGS_KEY,serialized);
   }
  }catch(err){console.warn('Sincronizzazione scenario studenti:',err)}
 }
 publishActiveSettings();
 setInterval(publishActiveSettings,500);
 let gasState=null;
 // One oxygen pool is shared by the continuous pulse oximeter and EGA samples.
 // Advance only with simulated time: pause, fast-forward and sample agree.
 function advanceGas(target){
  const now=typeof window.simVirtualNow==='function'?window.simVirtualNow():performance.now();
  if(!gasState||now<gasState.time)gasState={time:now,paCO2:target.paCO2,paO2:target.paO2};
  else{
   const dt=Math.min(3600,Math.max(0,(now-gasState.time)/1000));
   gasState.paCO2+=(target.paCO2-gasState.paCO2)*(1-Math.exp(-dt/65));
   gasState.paO2+=(target.paO2-gasState.paO2)*(1-Math.exp(-dt/18));
   gasState.time=now;
  }
  return gasState;
 }
 // Called by the monitor engine at each simulated step, independently of
 // whether the Emogas tab is open or continuous EGA sampling is enabled.
 window.simEgaOxygenSaturation=function(){
  try{
   if(!window.EmogasVQ||!$('egaScenario'))return null;
   const target=data();
   const gas=advanceGas(target);
   return Math.max(0,Math.min(100,100/(1+Math.pow(26.8/Math.max(1,gas.paO2),2.7))));
  }catch(err){console.warn('SpO2 V/Q:',err);return null}
 };
 function sample(){
  try{
   const target=data();
   advanceGas(target);
   const result=window.EmogasVQ.calculate({
    fio2:target.inputs.fio2,barometricPressure:target.inputs.pb,
    paCO2:gasState.paCO2,hb:target.inputs.hb,
    cardiacOutput:target.inputs.q,metabolicO2:target.inputs.vo2,
    alveolarVentilation:target.inputs.va,metabolicCO2:target.inputs.vco2,
    shunt:target.inputs.shunt,lowVQFraction:target.inputs.low,
    deadSpaceFraction:target.inputs.dead,
    respiratoryQuotient:target.inputs.rq
    // Keep the slowly equilibrating oxygen result distinct from its target.
   });
   const etco2=(typeof state!=='undefined'&&Number.isFinite(state.etco2)&&(typeof window.simVentCalc==='function'&&window.simVentCalc().intubated))?state.etco2:null;
   // All oxygen metrics must derive from the SAME time-lagged arterial PO2.
   // Previously PaO2/SaO2 were lagged but CaO2, CvO2, DO2 and SvO2
   // remained at steady state, producing mutually inconsistent readings.
   const oxygenSat=po2=>1/(1+Math.pow(26.8/Math.max(1,po2),2.7));
   const arterialSat=oxygenSat(gasState.paO2);
   const caO2=1.34*target.inputs.hb*arterialSat+.0031*gasState.paO2;
   const extraction=target.inputs.vo2/(10*target.inputs.q);
   const cvO2=Math.max(.05,caO2-extraction);
   const venousPo2=(()=>{let lo=0,hi=700;for(let i=0;i<45;i++){
    const mid=(lo+hi)/2;
    const c=1.34*target.inputs.hb*oxygenSat(mid)+.0031*mid;
    if(c<cvO2)lo=mid;else hi=mid;
   }return (lo+hi)/2})();
   const do2=10*target.inputs.q*caO2;
   const extractionRatio=100*target.inputs.vo2/Math.max(1,do2);
   const displayed={...result,
    paEtGradient:etco2==null?null:+(gasState.paCO2-etco2).toFixed(1),
    paO2:+gasState.paO2.toFixed(1),saO2:+(100*arterialSat).toFixed(1),
    caO2:+caO2.toFixed(2),cvO2:+cvO2.toFixed(2),
    do2:+do2.toFixed(0),svO2:+(100*oxygenSat(venousPo2)).toFixed(1),
    oxygenExtractionRatio:+extractionRatio.toFixed(1),
    oxygenSupplyWarning:extractionRatio>=60?'Estrazione O₂ elevata: VO₂ fissato; limite di estrazione non simulato.':null,
    pfRatio:+(gasState.paO2/target.inputs.fio2).toFixed(0),
    aaGradient:+Math.max(0,result.idealPAO2-gasState.paO2).toFixed(1)};
   const stamp=new Date().toLocaleTimeString('it-IT');draw(displayed,stamp);
   localStorage.setItem(KEY,JSON.stringify({result:displayed,stamp}));
  }catch(err){$('egaStatus').textContent='Errore modello: '+err.message;console.error(err)}
 }
 $('egaSample').onclick=sample;
 // Render the acid-base chart immediately when Emogas is opened, even
 // before the instructor requests the first arterial sample.
 // The plot must never remain an empty SVG while waiting for a sample.
 function drawInitialAcidChart(){
  if(!acidCard.isConnected)return;
  const baseline={paCO2:40,ph:6.1+Math.log10(24/(.03*40)),hco3:24};
  acidPlot(baseline);
  referenceGas=null;
  const summary=$('egaAcidSummary');
  if(summary)summary.textContent='Curva di riferimento: compenso respiratorio acuto atteso. Esegui un prelievo per visualizzare il valore del paziente.';
 }
 drawInitialAcidChart();
 $('egaScenario').onchange=()=>{
  const key=$('egaScenario').value;
  if(typeof window.simVentSetLungProfile==='function')window.simVentSetLungProfile(key);
  const p=profiles[key];
  $('egaShunt').value=Math.round(p.shunt*100);$('egaLow').value=Math.round(p.low*100);$('egaDead').value=Math.round(p.dead*100);
 };
 let last=0;
 setInterval(()=>{if($('egaLive')?.checked&&Date.now()-last>2500){last=Date.now();sample()}},1000);
})();

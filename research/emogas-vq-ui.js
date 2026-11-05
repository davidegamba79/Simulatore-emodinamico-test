/* Modulo sperimentale EGA/VQ: non modifica il motore emodinamico. */
window.addEventListener('DOMContentLoaded',function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const student=document.body.classList.contains('student');
 const KEY='simEmogasVQExperimental';
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
 panel.innerHTML='<h2>Emogasanalisi arteriosa · V/Q <small style="font-size:11px;color:#9db6c4">Sperimentale</small></h2>'+
 '<p style="font-size:12px;color:#9db6c4">Modello didattico esplorativo, non validato per decisioni cliniche. Prelievo virtuale oppure aggiornamento continuo.</p>'+
 (student?'':'<div class="row" style="flex-wrap:wrap;gap:8px"><label>Scenario <select id="egaScenario">'+
 Object.entries(profiles).map(([k,v])=>'<option value="'+k+'">'+v.label+'</option>').join('')+
 '</select></label><label>Shunt (%) <input id="egaShunt" type="number" min="0" max="80" value="2" step="1"></label>'+
 '<label>Basso V/Q (%) <input id="egaLow" type="number" min="0" max="80" value="4" step="1"></label>'+
 '<label>Spazio morto (%) <input id="egaDead" type="number" min="0" max="85" value="25" step="1"></label>'+
 '<label>Hb (g/dL) <input id="egaHb" type="number" min="3" max="25" value="14" step=".5"></label>'+
 '<label>HCO₃⁻ (mmol/L) <input id="egaHco3" type="number" min="4" max="60" value="24" step="1"></label></div>'+
 '<div class="row" style="gap:8px;flex-wrap:wrap;margin:8px 0"><button id="egaSample" type="button">Esegui prelievo arterioso</button>'+
 '<label><input id="egaLive" type="checkbox"> Monitoraggio continuo</label></div>')+
 '<div id="egaStatus" style="font-size:12px;color:#b7cbd3;margin:8px 0">In attesa del primo prelievo</div>'+
 '<div id="egaMetrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:7px"></div>'+
 '<h3 style="font-size:14px;margin:12px 0 6px">Distribuzione V/Q · quote di perfusione</h3>'+
 '<div id="egaCompartments"></div>'+
 '<p style="font-size:11px;color:#9db6c4">Il valore PaCO₂ è una stima stazionaria da VCO₂/ventilazione alveolare, non una replica della dinamica dell’EtCO₂. Il modello non simula la compensazione renale.</p>';
 function draw(result,stamp){
  if(!result)return;
  const entries=[['pH',fmt(result.ph,3)],['PaCO₂',fmt(result.paCO2)+' mmHg'],['PaO₂',fmt(result.paO2)+' mmHg'],['HCO₃⁻',fmt(result.hco3)+' mmol/L'],['SaO₂',fmt(result.saO2)+' %'],['P/F',fmt(result.pfRatio,0)],['A–a',fmt(result.aaGradient)+' mmHg'],['PaCO₂ − EtCO₂',result.paEtGradient==null?'Non disponibile':fmt(result.paEtGradient)+' mmHg']];
  $('egaMetrics').innerHTML=entries.map(([k,v])=>'<div style="border:1px solid #29404d;border-radius:8px;padding:8px"><small>'+k+'</small><div style="font-size:18px;font-weight:700">'+v+'</div></div>').join('');
  const parts=result.compartments;
  $('egaCompartments').innerHTML=[['Normale',parts.normal,'#3ca7cc'],['Basso V/Q',parts.lowVQ,'#f4b65b'],['Shunt',parts.shunt,'#ed6974']].map(([k,v,c])=>
   '<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;font-size:12px"><span>'+k+'</span><span>'+fmt(v*100,0)+'%</span></div><div style="height:12px;background:#21323d;border-radius:6px;overflow:hidden"><div style="width:'+Math.max(0,v*100)+'%;height:100%;background:'+c+'"></div></div></div>').join('');
  $('egaStatus').textContent='Campione virtuale · '+stamp;
 }
 function data(){
  const vent=typeof window.simVentCalc==='function'?window.simVentCalc():null;
  const dead=Math.min(.85,Math.max(0,+$('egaDead').value/100));
  const scenario=profiles[$('egaScenario').value]||profiles.healthy;
  const rr=vent?.rate||12,weight=vent?.weight||25;
  const minute=vent?.controlled?vent.minute:Math.max(.1,weight*.12);
  // Spontaneous breathing: the ventilator's calculated tidal volume is a
  // mechanical placeholder, not a measured spontaneous minute ventilation.
  // Use a weight-scaled physiological teaching baseline (~120 mL/kg/min)
  // until spontaneous ventilation is explicitly modeled or measured.
  // Use the active ventilator's minute volume; dead-space control changes VA.
  const actualVA=Math.max(.05,minute*(1-dead)*(scenario.ventFactor||1));
  // Metabolic production must not be recalibrated at every breath/sample:
  // otherwise changes in ventilation would cancel out PaCO2 responses.
  const metabolicCO2=clamp(105*Math.pow(weight/25,.8),15,650);
  // Disequilibrio V/Q: lo shunt e le unità a basso V/Q possono
  // incrementare PaCO2 anche senza variazioni proporzionali di EtCO2.
  // Correzione esplorativa, NON una legge clinicamente validata.
  const shunt=clamp(+$('egaShunt').value/100,0,.8);
  const lowVQ=clamp(+$('egaLow').value/100,0,1-shunt);
  const baselinePaCO2=clamp(.863*metabolicCO2/actualVA,10,120);
  const co2VqPenalty=30*Math.max(0,shunt-.02)+12*Math.max(0,lowVQ-.04);
  return window.EmogasVQ.calculate({
   paCO2:clamp(baselinePaCO2+co2VqPenalty,10,120),
   fio2:vent?.intubated?vent.fio2:.21,
   alveolarVentilation:actualVA,metabolicCO2,
   cardiacOutput:typeof state!=='undefined'&&Number.isFinite(state.co)?state.co:3,
   hb:+$('egaHb').value||14,bicarbonate:+$('egaHco3').value||24,
   shunt:+$('egaShunt').value/100,lowVQFraction:+$('egaLow').value/100,
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
  function receive(e){try{const x=JSON.parse(e);draw(x.result,x.stamp)}catch(_){}}
  window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue)receive(e.newValue)});
  try{const x=localStorage.getItem(KEY);if(x)receive(x)}catch(_){}
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
 };
 nav?.querySelectorAll('button:not(:last-child)').forEach(b=>b.addEventListener('click',()=>{tab.hidden=true;btn.setAttribute('aria-selected','false')}));
 let gasState=null;
 function sample(){
  try{
   const target=data();
   const now=typeof window.simVirtualNow==='function'?window.simVirtualNow():performance.now();
   if(!gasState||now<gasState.time){gasState={time:now,paCO2:target.paCO2,paO2:target.paO2}}
   else{
    const dt=Math.min(3600,Math.max(0,(now-gasState.time)/1000));
    // Didactic response times; simulation clock (pause freezes the gases).
    gasState.paCO2+=(target.paCO2-gasState.paCO2)*(1-Math.exp(-dt/65));
    gasState.paO2+=(target.paO2-gasState.paO2)*(1-Math.exp(-dt/18));
    gasState.time=now;
   }
   const result=window.EmogasVQ.calculate({
    fio2:target.inputs.fio2,barometricPressure:target.inputs.pb,
    paCO2:gasState.paCO2,bicarbonate:target.hco3,hb:target.inputs.hb,
    cardiacOutput:target.inputs.q,metabolicO2:target.inputs.vo2,
    alveolarVentilation:target.inputs.va,metabolicCO2:target.inputs.vco2,
    shunt:target.inputs.shunt,lowVQFraction:target.inputs.low,
    respiratoryQuotient:target.inputs.rq
    // Keep the slowly equilibrating oxygen result distinct from its target.
   });
   const etco2=(typeof state!=='undefined'&&Number.isFinite(state.etco2)&&(typeof window.simVentCalc==='function'&&window.simVentCalc().intubated))?state.etco2:null;
   const displayed={...result,paEtGradient:etco2==null?null:+(gasState.paCO2-etco2).toFixed(1),paO2:+gasState.paO2.toFixed(1),saO2:+(100/(1+Math.pow(26.8/Math.max(1,gasState.paO2),2.7))).toFixed(1),pfRatio:+(gasState.paO2/target.inputs.fio2).toFixed(0),aaGradient:+Math.max(0,result.idealPAO2-gasState.paO2).toFixed(1)};
   const stamp=new Date().toLocaleTimeString('it-IT');draw(displayed,stamp);
   localStorage.setItem(KEY,JSON.stringify({result:displayed,stamp}));
  }catch(err){$('egaStatus').textContent='Errore modello: '+err.message;console.error(err)}
 }
 $('egaSample').onclick=sample;
 $('egaScenario').onchange=()=>{
  const p=profiles[$('egaScenario').value];
  $('egaShunt').value=Math.round(p.shunt*100);$('egaLow').value=Math.round(p.low*100);$('egaDead').value=Math.round(p.dead*100);
 };
 let last=0;
 setInterval(()=>{if($('egaLive')?.checked&&Date.now()-last>2500){last=Date.now();sample()}},1000);
})();

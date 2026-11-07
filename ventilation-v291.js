/* V2.9.31 — tracciati e loop con palette didattica; interfaccia ventilatoria essenziale. */
(function(){
 'use strict';
 const el=id=>document.getElementById(id);
 const n=(id,defaultValue)=>{const x=Number(el(id)?.value);return Number.isFinite(x)&&el(id)?.value!==''?x:defaultValue};
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const ventIds=['ventMode','ventRate','ventVtKg','ventPeep','ventPinsp','ventIE','ventFio2','ventHoldEnabled','ventHoldSeconds'];
 const fmt=(v,decimals=1)=>Number.isFinite(v)?v.toFixed(decimals).replace('.',','):'—';
 const breedMorph={
  'Bulldog francese':'brachy','Bulldog inglese':'brachy','Carlino':'brachy',
  'Boxer':'brachy','Cavalier King Charles':'brachy','Chihuahua':'meso',
  'Levriero':'dolicho','Pastore tedesco':'meso','Bassotto':'meso'
 };
 // Archetipi didattici, non valori clinici validati per razza.
 const breedBody={'Levriero':'dolicho','Bulldog francese':'brachy',
  'Bulldog inglese':'brachy','Carlino':'brachy','Boxer':'brachy'};
 // Profili interni per futuri scenari clinici. Nessun selettore aggiunto
 // al monitor: il preset attuale resta 'healthy'. Sono curve qualitative
 // e NON soglie cliniche o predizioni di gas ematici.
 const lungProfiles=Object.freeze({
  healthy:Object.freeze({
   compliance:1,recruitability:.04,overdistension:.16,overdistStart:8,
   extraDeadspace:0,deadspaceRecruit:.09,deadspaceOverdist:.24,
   etGradient:1.6,oxygenDeficit:0,oxygenRecruit:.24,oxygenOverdist:.70
  }),
  atelectasis:Object.freeze({
   compliance:.67,recruitability:.43,overdistension:.14,overdistStart:12,
   extraDeadspace:.48,deadspaceRecruit:.47,deadspaceOverdist:.20,
   etGradient:1.2,oxygenDeficit:6.8,oxygenRecruit:5.5,oxygenOverdist:1.6
  }),
  hypoventilation:Object.freeze({
   compliance:1,recruitability:.04,overdistension:.16,overdistStart:8,
   extraDeadspace:0,deadspaceRecruit:.09,deadspaceOverdist:.24,
   etGradient:1.6,oxygenDeficit:0,oxygenRecruit:.24,oxygenOverdist:.70
  }),
  bronchospasm:Object.freeze({
   compliance:.94,recruitability:.04,overdistension:.20,overdistStart:9,
   extraDeadspace:.65,deadspaceRecruit:.05,deadspaceOverdist:.30,
   etGradient:2.8,oxygenDeficit:2.5,oxygenRecruit:.30,oxygenOverdist:.9,
   resistanceMultiplier:3.0,expiratoryMultiplier:2.2
  }),
  embolism:Object.freeze({
   compliance:.96,recruitability:.03,overdistension:.16,overdistStart:9,
   extraDeadspace:2.1,deadspaceRecruit:.03,deadspaceOverdist:.3,
   etGradient:7,oxygenDeficit:3,oxygenRecruit:.12,oxygenOverdist:.8
  }),
  edema:Object.freeze({
   compliance:.48,recruitability:.25,overdistension:.22,overdistStart:10,
   extraDeadspace:.65,deadspaceRecruit:.22,deadspaceOverdist:.3,
   etGradient:3,oxygenDeficit:7,oxygenRecruit:3.5,oxygenOverdist:1.3,
   resistanceMultiplier:1.3,expiratoryMultiplier:1.15
  }),
  poorly_recruitable:Object.freeze({
   compliance:.55,recruitability:.10,overdistension:.28,overdistStart:7,
   extraDeadspace:.40,deadspaceRecruit:.10,deadspaceOverdist:.45,
   etGradient:2.8,oxygenDeficit:5.0,oxygenRecruit:1.2,oxygenOverdist:2.0
  })
 });
 window.simVentLungProfiles=lungProfiles;
 window.simVentLungProfile=lungProfiles[window.simVentLungProfile]?window.simVentLungProfile:'healthy';
 // Predisposto per futuri scenari patologici; chiamata silenziosa usata
 // durante sincronizzazione e riavvolgimento della simulazione.
 window.simVentSetLungProfile=(name,silent=false)=>{
  const key=Object.prototype.hasOwnProperty.call(lungProfiles,name)?name:'healthy';
  window.simVentLungProfile=key;
  if(!silent){if(typeof physiology==='function')physiology();else refresh();}
  return key;
 };
 let lastData=null;
 // FR di riferimento solo dopo intubazione in spontanea. L'utente puo'
 // cambiarla; VCV/PCV conservano il riferimento precedente di 12/min.
 let autoSpontRate=false,previousVentMode='SPONT';
 const respDisplayKey='recoverCaneRespDisplayV293';
 const patientFields=['name','weight','patientAge','patientBreed','patientMorph','patientBodyType','patientBCS'];
 const patientCopies=new Map();

 // Le scale sono inizializzate UNA volta, alla prima VCV/PCV intubata.
 // Poi restano fisse: il solo istruttore puo' modificarle o adattarle.
 // Il riferimento e' un campione reale del modello al momento del salvataggio,
 // non un ricalcolo dei parametri correnti.
 const loopStorageKey='recoverCaneVentLoopsV2923';
 const loopInputIds={
  PV:{xMin:'ventPvXMin',xMax:'ventPvXMax',yMin:'ventPvYMin',yMax:'ventPvYMax'},
  FV:{xMin:'ventFvXMin',xMax:'ventFvXMax',yMin:'ventFvYMin',yMax:'ventFvYMax'}
 };
 let loopView={axes:null,reference:null};
 const isStudent=()=>document.body.classList.contains('student');
 let loopPointsCacheKey=null,loopPointsCacheValue=null;
 function loopPoints(d){
  // La forma di un respiro non cambia fra due frame finche' i
  // parametri meccanici sono identici: evita migliaia di campionamenti
  // e funzioni esponenziali ripetute durante la pausa inspiratoria.
  const key=[d.mode,d.controlled,d.rate,d.ti,d.te,d.flowTi,d.tau,
   d.crs,d.raw,d.vt,d.pip,d.plateau,d.peep,d.pinsp,d.hold,d.holdSeconds,
   d.pcvRiseTime,d.pcvFillEnd,d.curveShape,d.expResistance,d.expValveR,d.weight,d.trappedVolume].join('|');
  if(key===loopPointsCacheKey&&loopPointsCacheValue)return loopPointsCacheValue;
  const N=180,phaseEnd=d.ti/(60/d.rate);
  const point=phase=>({
   p:sample(d,'Pressure',phase),v:sample(d,'Volume',phase),f:sample(d,'Flow',phase)
  });
  const points={
   insp:Array.from({length:N+1},(_,i)=>point(i===N?Math.max(0,phaseEnd-1e-9):phaseEnd*i/N)),
   exp:Array.from({length:N+1},(_,i)=>point(phaseEnd+(1-phaseEnd)*i/N))
  };
  loopPointsCacheKey=key;loopPointsCacheValue=points;
  return points;
 }
 function autoLoopAxes(d){
  const {insp,exp}=loopPoints(d),points=insp.concat(exp);
  // La scala pressoria del loop P/V in ventilazione controllata parte
  // sempre da 0 cmH2O: a PEEP 0 il ciclo nasce esattamente all'origine.
  // Dopo la prima apertura la scala resta bloccata e modificabile solo
  // dalla console docente (anche per il monitor studenti).
  const pressureMin=d.controlled?0:-3;
  const pressureMax=d.controlled?Math.max(d.peep+6,d.pip+Math.max(1.8,(d.pip-d.peep)*.18)):3.5;
  const volumeMax=Math.max(50,d.vt*1.2);
  const flowMax=Math.max(.15,...points.map(p=>Math.abs(p.f)))*1.2;
  return {
   PV:{xMin:pressureMin,xMax:pressureMax,yMin:0,yMax:volumeMax},
   FV:{xMin:0,xMax:volumeMax,yMin:-flowMax,yMax:flowMax}
  };
 }
 function validAxes(a){
  return a&&['xMin','xMax','yMin','yMax'].every(k=>Number.isFinite(a[k])&&Math.abs(a[k])<=100000)&&
   a.xMax-a.xMin>.001&&a.yMax-a.yMin>.001;
 }
 function safeLoopView(raw){
  if(!raw||typeof raw!=='object')return null;
  const axes=raw.axes&&validAxes(raw.axes.PV)&&validAxes(raw.axes.FV)?
   {PV:{...raw.axes.PV},FV:{...raw.axes.FV}}:null;
  let reference=null;
  if(raw.reference&&typeof raw.reference==='object'){
   const r=raw.reference;
   const good=arr=>Array.isArray(arr)&&arr.length>=2&&arr.length<=400&&
    arr.every(p=>p&&['p','v','f'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<100000));
   if(good(r.insp)&&good(r.exp))reference={
    insp:r.insp.map(p=>({p:p.p,v:p.v,f:p.f})),
    exp:r.exp.map(p=>({p:p.p,v:p.v,f:p.f})),
    label:String(r.label||'Loop salvato').slice(0,160)
   };
  }
  return {axes,reference};
 }
 function publishLoopView(){
  if(isStudent())return;
  try{localStorage.setItem(loopStorageKey,JSON.stringify(loopView))}
  catch(err){console.warn('Sincronizzazione loop:',err)}
 }
 function loopReferenceText(){
  return loopView.reference?'Riferimento salvato: '+loopView.reference.label:
   'Nessun loop di riferimento salvato';
 }
 function updateLoopLabels(){
  const text=loopReferenceText();
  for(const id of ['ventLoopRefStatus','studentVentRefStatus']){
   const target=el(id);if(target)target.textContent=text;
  }
  for(const id of ['ventLoopRefKey','studentVentRefKey']){
   const target=el(id);if(target)target.hidden=!loopView.reference;
  }
 }
 function syncAxisInputs(force=false){
  if(!loopView.axes||isStudent())return;
  for(const kind of ['PV','FV']){
   for(const [key,id] of Object.entries(loopInputIds[kind])){
    const field=el(id);if(!field||(!force&&document.activeElement===field))continue;
    const v=loopView.axes[kind][key];
    field.value=Number(v.toFixed(kind==='PV'&&key.startsWith('x')?2:kind==='FV'&&key.startsWith('y')?3:1)).toString();
   }
  }
 }
 function ensureLoopAxes(d){
  if(!loopView.axes&&d.intubated&&d.controlled&&!isStudent()){
   loopView.axes=autoLoopAxes(d);
   syncAxisInputs(true);publishLoopView();
  }
  return loopView.axes||autoLoopAxes(d);
 }
 function loopMessage(message){
  const target=el('ventLoopMessage');if(target)target.textContent=message;
 }
 function setupLoopView(){
  if(isStudent()){
   try{loopView=safeLoopView(JSON.parse(localStorage.getItem(loopStorageKey)||'null'))||loopView}
   catch(err){console.warn('Lettura loop studenti:',err)}
   window.addEventListener('storage',e=>{
    if(e.key!==loopStorageKey)return;
    try{loopView=safeLoopView(e.newValue?JSON.parse(e.newValue):null)||{axes:null,reference:null};updateLoopLabels()}
    catch(err){console.warn('Aggiornamento loop studenti:',err)}
   });
   updateLoopLabels();return;
  }
  // Una nuova simulazione apre i loop senza un riferimento preesistente.
  loopView={axes:null,reference:null};
  publishLoopView();
  for(const kind of ['PV','FV']){
   for(const [key,id] of Object.entries(loopInputIds[kind])){
    const field=el(id);if(!field)continue;
    field.addEventListener('change',()=>{
     if(!loopView.axes)return;
     const value=Number(field.value);
     const next={...loopView.axes[kind],[key]:value};
     if(field.value.trim()===''||!validAxes(next)){
      loopMessage('Scala non valida: il massimo deve superare il minimo.');syncAxisInputs(true);return;
     }
     loopView.axes[kind]=next;
     loopMessage('Scala '+(kind==='PV'?'P/V':'F/V')+' aggiornata e bloccata.');
     syncAxisInputs(true);publishLoopView();
    });
   }
   const fit=el(kind==='PV'?'ventPvFit':'ventFvFit');
   if(fit)fit.addEventListener('click',()=>{
    const d=lastData||calc();
    if(!d.intubated){loopMessage('Intuba il paziente per adattare il loop.');return}
    if(!loopView.axes)loopView.axes=autoLoopAxes(d);
    loopView.axes[kind]=autoLoopAxes(d)[kind];
    syncAxisInputs(true);publishLoopView();
    loopMessage('Adattata solo la scala '+(kind==='PV'?'P/V':'F/V')+'. Le scale restano fisse.');
   });
  }
  const save=el('ventSaveLoop');
  if(save)save.addEventListener('click',()=>{
   const d=lastData||calc();
   if(!d.intubated){loopMessage('Intuba il paziente prima di salvare un loop.');return}
   const points=loopPoints(d);
   loopView.reference={...points,label:d.mode+' · Vt '+fmt(d.vt,0)+' mL · FR '+d.rate+'/min · PEEP '+fmt(d.peep,0)+' cmH₂O'};
   updateLoopLabels();publishLoopView();
   loopMessage('Loop P/V e F/V memorizzati: confronto attivo anche sul monitor studenti.');
  });
  const clear=el('ventClearLoop');
  if(clear)clear.addEventListener('click',()=>{
   loopView.reference=null;updateLoopLabels();publishLoopView();
   loopMessage('Loop di riferimento rimosso da entrambi i monitor.');
  });
  updateLoopLabels();
  loopMessage('Scale iniziali automatiche alla prima VCV/PCV; poi fisse fino a modifica dalla console.');
 }
 // Unico modello RC per il volume e il flusso in PCV: risposta
 // a una rampa pressoria finita seguita da pressione costante.
 function pcvFill(seconds,tau,rise){
  const t=Math.max(0,seconds),rc=Math.max(.03,tau),r=Math.max(.025,rise);
  if(t<=r){
   const e=Math.exp(-t/rc);
   return {fraction:Math.max(0,(t-rc*(1-e))/r),rate:(1-e)/r};
  }
  const atRise=1-rc/r*(1-Math.exp(-r/rc));
  const e=Math.exp(-(t-r)/rc);
  return {fraction:1-(1-atRise)*e,rate:(1-atRise)*e/rc};
 }
 // PCV: due compartimenti respiratori in parallelo con costanti di
 // tempo differenti (35% rapido, 65% lento). In un solo RC, flusso
 // contro volume e' una retta; la somma di due risposte RC crea una
 // decelerazione curva: il compartimento rapido si riempie prima,
 // mentre quello lento contribuisce alla coda inspiratoria.
 // fraction e rate sono la stessa funzione e la sua derivata:
 // onde temporali e loop F/V rimangono meccanicamente coerenti.
 // E' una rappresentazione didattica, non una misura dei compartimenti.
 function pcvRegionalFill(seconds,tau,rise){
  const fast=pcvFill(seconds,tau*.40,rise);
  const slow=pcvFill(seconds,tau*2.00,rise);
  return {
   fraction:.35*fast.fraction+.65*slow.fraction,
   rate:.35*fast.rate+.65*slow.rate
  };
 }
 // VCV: apertura inspiratoria breve e progressiva, poi flusso costante.
 // La derivata della frazione di riempimento e' il flusso normalizzato:
 // volume e flusso sono coerenti e l'integrale resta esattamente Vt.
 // VCV: rampa di flusso morbida all'inizio e alla fine di Ti.
 // L'integrale della curva resta esattamente Vt.
 // Una salita di 35-85 ms produceva un "gradino" nella Paw temporale:
 // la componente resistiva cresceva quasi istantaneamente alla
 // risoluzione del monitor. La rampa progressiva (fino a 180 ms)
 // inizia con flusso e derivata nulli, senza cambiare il Vt erogato.
 // Ai Ti molto brevi i raccordi si accorciano proporzionalmente.
 function vcvFill(seconds,flowTi){
  const ti=Math.max(.15,flowTi),t=clamp(seconds,0,ti);
  const rise=Math.min(.18,Math.max(.055,ti*.30),ti*.42);
  const fall=Math.min(.11,Math.max(.045,ti*.085),ti*.25);
  const area=ti-(rise+fall)/2;
  if(t<=rise){
   const u=t/rise;
   return {fraction:(t/2-rise*Math.sin(Math.PI*u)/(2*Math.PI))/area,
    rate:(1-Math.cos(Math.PI*u))/(2*area)};
  }
  if(t<ti-fall)return {fraction:(t-rise/2)/area,rate:1/area};
  const z=t-(ti-fall),u=z/fall;
  const integral=ti-fall-rise/2+z/2+fall*Math.sin(Math.PI*u)/(2*Math.PI);
  return {fraction:clamp(integral/area,0,1),
   rate:(1+Math.cos(Math.PI*u))/(2*area)};
 }
 // PCV: raccordo C1 negli ultimi 100 ms per smussare il passaggio
 // fra insufflazione ed espirazione conservando Vt e flusso integrato.
 function pcvSmoothFill(seconds,flowTi,tau,rise){
  const end=Math.max(.15,flowTi),t=clamp(seconds,0,end);
  const taper=Math.min(.10,Math.max(.045,end*.085)),begin=end-taper;
  if(t<=begin)return pcvRegionalFill(t,tau,rise);
  const a=pcvRegionalFill(begin,tau,rise),b=pcvRegionalFill(end,tau,rise);
  const u=(t-begin)/taper,u2=u*u,u3=u2*u;
  const fraction=(2*u3-3*u2+1)*a.fraction+
   (u3-2*u2+u)*taper*a.rate+(-2*u3+3*u2)*b.fraction;
  const rate=((6*u2-6*u)*a.fraction+
   (3*u2-4*u+1)*taper*a.rate+(-6*u2+6*u)*b.fraction)/taper;
  return {fraction:clamp(fraction,0,1),rate:Math.max(0,rate)};
 }
 // La pressione elastica varia con il volume: a Vt=10 mL/kg la
 // compliance cordale coincide con Crs; altrove emerge la curvatura.
 function elasticRecoil(d,volume){
  const v=Math.max(0,volume),u=clamp(v/Math.max(1,d.weight*10),0,2.2);
  const nonlinear=1+d.curveShape*(u-1)+.28*Math.pow(Math.max(0,u-1),2);
  return v/Math.max(.45,d.crs)*Math.max(.35,nonlinear);
 }
 // In PCV la pressione impostata determina il volume: risoluzione
 // monotona della relazione elastica non lineare. Non e' un valore
 // predittivo clinico, ma evita che una variazione di compliance
 // cambi soltanto il picco senza modificare il Vt.
 function pcvTidalVolume(d,drivingPressure,limit){
  let low=0,high=limit;
  for(let i=0;i<28;i++){
   const mid=(low+high)/2;
   if(elasticRecoil(d,mid)<drivingPressure)low=mid;
   else high=mid;
  }
  return (low+high)/2;
 }
 function calc(){
  const weight=clamp(n('weight',25),1,100),age=clamp(n('patientAge',6),.1,22),bcs=clamp(n('patientBCS',5),1,9);
  const morph=el('patientMorph')?.value||'meso';
  const breed=el('patientBreed')?.value||'Meticcio';
  const chosen=el('ventMode')?.value||'SPONT';
  const intubated=typeof v25!=='undefined'&&v25.induction.phase==='maintenance';
  const postInduction=typeof v25!=='undefined'&&v25.induction.startedAt>0&&
   ['induction','maintenance'].includes(v25.induction.phase);
  const controlled=intubated&&chosen!=='SPONT',mode=controlled?chosen:'SPONT';
  const rate=clamp(n('ventRate',12),4,50),peep=controlled?clamp(n('ventPeep',0),0,18):0;
  const ie=clamp(n('ventIE',2),1,3),fio2=clamp(n('ventFio2',.5),.21,1);
  const lungProfile=Object.prototype.hasOwnProperty.call(lungProfiles,window.simVentLungProfile)?
   window.simVentLungProfile:'healthy';
  const lung=lungProfiles[lungProfile];
  // Reclutamento cresce e si satura con la PEEP; la sovradistensione
  // compare oltre una soglia dipendente dalla reclutabilita' polmonare.
  const recruitment=controlled?1-Math.exp(-peep/3.8):0;
  const overdistension=controlled?Math.pow(Math.max(0,peep-lung.overdistStart)/8,2):0;
  // Il rapporto I:E selezionato riguarda il ventilatore. In spontanea
  // l'inspirazione e' piu' breve, coerente con il tracciato di riferimento.
  const cycle=60/rate,ti=controlled?cycle/(1+ie):cycle*.22,te=cycle-ti;
  const hold=controlled&&el('ventHoldEnabled')?.checked===true;
  const maxHold=Math.max(.1,Math.min(1.5,ti*.65,ti-.15));
  const holdSeconds=hold?clamp(n('ventHoldSeconds',.4),.1,maxHold):0;
  const flowTi=Math.max(.15,ti-holdSeconds);
  // PCV: salita pressoria rapida (40-85 ms), indipendente dalla pausa.
  // Il flusso raggiunge il picco quando Vt e' ancora basso (~10-15%
  // nel paziente sano), poi decresce secondo la costante RC.
  // La stessa rampa guida Paw, flusso, volume e loop F/V.
  const pcvRiseTime=Math.min(.085,Math.max(.04,ti*.035));
  // Compliance basale del cane normopeso con meccanica respiratoria conservata:
  // 1,10 mL/(kg*cmH2O). Valore didattico ricalibrato, NON una soglia clinica.
  // Le variazioni per eta', BCS e morfotipo sono ipotesi semplificate.
  const ageFactor=age<1?.90:age>8?clamp(1-.018*(age-8),.76,1):1;
  const bcsFactor=bcs>=6?clamp(1-.075*(bcs-5),.65,1):bcs<=3?.94:1;
  const morphFactor=morph==='brachy'?.78:morph==='dolicho'?1.12:1;
  const bodyType=el('patientBodyType')?.value||'meso';
  const bodyFactor=bodyType==='brachy'?.78:bodyType==='dolicho'?1.28:1;
  const breedFactor=breed==='Levriero'?1.10:
   ['Bulldog francese','Bulldog inglese'].includes(breed)?.88:1;
  const compliancePeepFactor=clamp(lung.compliance*
   (1+lung.recruitability*recruitment-lung.overdistension*overdistension),.30,1.60);
  const crs=clamp(weight*1.10*ageFactor*bcsFactor*morphFactor*bodyFactor*
   breedFactor*compliancePeepFactor,.45,160);
  const raw=clamp(8*Math.pow(weight/25,-.28)*
   (morph==='brachy'?2.0:morph==='dolicho'?.78:1)*
   (bodyType==='brachy'?1.15:bodyType==='dolicho'?.90:1)*
   (bcs>=7?1.12:1)*(lung.resistanceMultiplier||1),1.5,100);
  const tau=raw*crs/1000;
  const curveShape=clamp(
   (morph==='brachy'?.18:morph==='dolicho'?-.10:0)+
   (bodyType==='brachy'?.18:bodyType==='dolicho'?-.12:0)+
   Math.max(0,bcs-5)*.025+Math.max(0,age-9)*.012+
   (lungProfile==='poorly_recruitable'?.09:lungProfile==='atelectasis'?.06:0),-.32,.55);
  const expResistance=clamp(
   (morph==='brachy'?1.40:morph==='dolicho'?.80:1)*
   (bodyType==='brachy'?1.25:bodyType==='dolicho'?.83:1)*
   (bcs>=7?1.08:1)*(lung.expiratoryMultiplier||1),.55,5);
  const expValveR=clamp(raw*.30*expResistance,1.1,12); // R (cmH2O/(L/s)) * C (L/cmH2O) = secondi
  const tauE=Math.max(.12,tau*(1.35+.32*expResistance));
  const valveTime=clamp(.065+.025*expResistance+.08*tau,.07,.22);
  const endEffective=te-valveTime*(1-Math.exp(-te/valveTime));
  const expTail=Math.exp(-endEffective/tauE);
  const vtSet=clamp(n('ventVtKg',10),4,15)*weight;
  const pinsp=clamp(n('ventPinsp',12),4,30);
  // Dopo una vera induzione EV la ventilazione spontanea e' depressa:
  // Vt medio inferiore (stima didattica), senza modificare VCV/PCV.
  // In spontanea post-intubazione: atti piu' frequenti ma superficiali.
  // Con FR 20 e Vt ~3,55 mL/kg la ventilazione alveolare e' ridotta:
  // EtCO2 media attesa circa 55 mmHg per il paziente di riferimento.
  const pcvFillEnd=pcvSmoothFill(flowTi,flowTi,tau,pcvRiseTime).fraction;
  let vt=controlled?(mode==='VCV'?vtSet:
   pcvTidalVolume({crs,curveShape,weight},pinsp*pcvFillEnd,weight*22)):
   (postInduction?(intubated?3.55:5.3):7)*weight;
  vt=clamp(vt,1,weight*22);
  const pcvPeakFlow=mode==='PCV'?
   vt/1000*pcvSmoothFill(pcvRiseTime,flowTi,tau,pcvRiseTime).rate/
   Math.max(.001,pcvFillEnd):0;
  // Only obstructive scenarios accumulate end-expiratory gas.
  const trapping=controlled&&lungProfile==='bronchospasm'?
   clamp((expTail-.04)/.96,0,.90):0;
  const trappedVolume=trapping>0?Math.min(vt*3,vt*trapping/Math.max(.1,1-trapping)):0;
  const autoPeep=trappedVolume/Math.max(.45,crs);
  const plateau=controlled?peep+elasticRecoil({crs,curveShape,weight},vt)+autoPeep:null;
  const vcvPeakFlow=mode==='VCV'?vt/1000*vcvFill(flowTi*.5,flowTi).rate:0;
  const flow=controlled?(mode==='VCV'?vcvPeakFlow:vt/1000/Math.max(.1,flowTi)):0;
  const pip=controlled?(mode==='VCV'?plateau+raw*vcvPeakFlow:peep+pinsp):null;
  const driving=controlled?plateau-peep:null;
  // In assenza di pausa inspiratoria la Pplat non e' misurata:
  // il modello usa comunque la componente elastica per la fisiologia.
  const plateauMeasured=hold?plateau:null,drivingMeasured=hold?driving:null;
  // Cdyn = Vt / (PIP - PEEP), stima sotto ventilazione controllata.
  // Cstat = Vt / (Pplat - PEEP) richiede una pausa inspiratoria.
  // Raw = (PIP - Pplat) / flusso inspiratorio, applicabile qui
  // solo in VCV a flusso costante e con pausa; non in PCV decelerante.
  const cdyn=controlled&&pip>peep?vt/(pip-peep):null;
  const cstat=hold&&plateau>peep?vt/(plateau-peep):null;
  const rawMeasured=hold&&mode==='VCV'&&flow>0?(pip-plateau)/flow:null;
  // Spazio morto fisiologico efficace, in mL/kg: riferimento 2 mL/kg
  // per Golden Retriever adulto, BCS 5/9, mesocefalo/mesomorfo.
  // Eta', BCS e conformazione modulano la ventilazione alveolare.
  // La razza selezionata imposta automaticamente il morfotipo craniale
  // (breedMorph): NON e' una previsione clinica specifica di razza.
  const ageDeadspace=age<1?1.06:age>8?clamp(1+.022*(age-8),1,1.25):1;
  const bcsDeadspace=bcs>=6?1+.035*(bcs-5):bcs<=3?1.035:1;
  const morphDeadspace=morph==='brachy'?1.13:morph==='dolicho'?.96:1;
  const bodyDeadspace=bodyType==='brachy'?1.07:bodyType==='dolicho'?.98:1;
  const deadspaceMlKg=clamp(
   2*ageDeadspace*bcsDeadspace*morphDeadspace*bodyDeadspace+
   lung.extraDeadspace-lung.deadspaceRecruit*recruitment+
   lung.deadspaceOverdist*overdistension,1.5,5.5);
  const minute=vt/1000*rate,alveolarMinute=Math.max(.05,(vt-weight*deadspaceMlKg)/1000*rate);
  // Gradiente PaCO2-EtCO2 aggiuntivo qualitativo da disomogeneita'
  // ventilazione/perfusione. A PEEP alta l'EtCO2 puo' scendere mentre
  // l'eliminazione della CO2 e' compromessa: non equivale a normocapnia.
  const etco2Gradient=controlled?lung.etGradient*overdistension:0;
  // Effetto qualitativo sulla saturazione: reclutamento vs sovradistensione.
  // La FiO2 e la perfusione vengono considerate separatamente in app.js.
  const oxygenPeepEffect=controlled?
   -lung.oxygenDeficit+lung.oxygenRecruit*recruitment-
    lung.oxygenOverdist*overdistension:0;
  const pmean=controlled?peep+(plateau-peep)*ti/(ti+te)*.60:0;
  const preloadSensitivity=clamp(1+Math.max(0,100-(typeof phys!=='undefined'?phys.preload:100))*.012,1,1.9);
  const preloadFactor=controlled?clamp(1-.011*Math.max(0,pmean-2)*preloadSensitivity-.005*Math.max(0,(plateau||0)-19),.68,1):1;
  return {tauE,valveTime,expTail,trappedVolume,autoPeep,trapping,mode,chosen,intubated,postInduction,controlled,rate,peep,ie,ti,te,flowTi,pcvRiseTime,pcvPeakFlow,pcvFillEnd,vcvPeakFlow,pinsp,hold,holdSeconds,fio2,weight,age,bcs,morph,breed,bodyType,lungProfile,recruitment,overdistension,compliancePeepFactor,crs,raw,tau,curveShape,expResistance,expValveR,vt,pip,plateau,driving,plateauMeasured,drivingMeasured,cdyn,cstat,rawMeasured,minute,alveolarMinute,deadspaceMlKg,etco2Gradient,oxygenPeepEffect,pmean,preloadFactor};
 }
 window.simVentCalc=calc;
 window.simVentValid=()=>{
  const d=calc(),rh=el('rhythm')?.value||'';
  const regular=['Ritmo sinusale','Bradicardia sinusale','Tachicardia sinusale','Blocco AV I grado'].includes(rh);
  return d.controlled&&regular&&d.vt/d.weight>=7&&n('hr',80)/d.rate>=3.6;
 };
 window.simVentSettings=()=>({
  ...Object.fromEntries(ventIds.map(id=>[id,id==='ventHoldEnabled'?Boolean(el(id)?.checked):(el(id)?.value??'')])),
  lungProfile:window.simVentLungProfile
 });
 window.simVentApplySettings=settings=>{
  if(!settings||typeof settings!=='object')return;
  if(settings.lungProfile!=null)window.simVentSetLungProfile(settings.lungProfile,true);
  for(const id of ventIds){
   if(settings[id]==null||!el(id))continue;
   if(id==='ventHoldEnabled')el(id).checked=settings[id]===true||settings[id]==='true';
   else el(id).value=settings[id];
  }
  refresh();
 };
 function syncPatientCopies(){
  for(const [id,copy] of patientCopies){
   const original=el(id);
   if(original&&copy&&copy!==document.activeElement)copy.value=original.value;
  }
  const context=el('ventPatientContext'),preset=el('patientPresetStatus');
  if(context&&preset)context.textContent=preset.textContent;
  // Riepilogo sempre leggibile quando i campi sono richiusi.
  const compact=el('ventPatientCompact');
  if(compact){
   const weight=el('weight')?.value||'—',age=el('patientAge')?.value||'—';
   const breed=el('patientBreed')?.value||'Meticcio',bcs=el('patientBCS')?.value||'—';
   compact.textContent=weight+' kg · '+age+' anni · '+breed+' · BCS '+bcs+'/9';
  }
 }
 function createPatientMirror(){
  if(document.body.classList.contains('student'))return;
  const vent=el('ventilationPanel');
  if(!vent||!vent.parentElement||el('ventPatientCard'))return;
  // Come i salti temporali: i dati restano accessibili, ma sono chiusi
  // per impostazione predefinita e non occupano spazio durante il monitoraggio.
  const card=document.createElement('details');card.className='card vent-patient-card';card.id='ventPatientCard';
  card.innerHTML='<summary class="vent-patient-summary"><span class="vent-patient-summary-title">Dati paziente · ventilazione</span><span class="vent-patient-compact" id="ventPatientCompact">Paziente da impostare</span></summary>'+
   '<div class="vent-patient-content"><small style="color:var(--muted)">Modificabili anche qui; i valori restano sincronizzati con la scheda Paziente.</small><div class="cols" id="ventPatientFields" style="margin-top:9px"></div><div class="status" id="ventPatientContext" style="margin-top:8px"></div></div>';
  const box=card.querySelector('#ventPatientFields');
  for(const id of patientFields){
   const original=el(id),label=original?.closest('label');
   if(!original||!label)continue;
   const copyLabel=label.cloneNode(true),copy=copyLabel.querySelector('input,select');
   if(!copy)continue;
   copy.id='ventCopy_'+id;
   copy.value=original.value;
   copy.removeAttribute('name');
   copy.addEventListener('input',()=>{
    original.value=copy.value;
    original.dispatchEvent(new Event('input',{bubbles:true}));
    syncPatientCopies();
   });
   copy.addEventListener('change',()=>{
    original.value=copy.value;
    original.dispatchEvent(new Event('change',{bubbles:true}));
    syncPatientCopies();
   });
   box.append(copyLabel);patientCopies.set(id,copy);
   original.addEventListener('input',syncPatientCopies);
   original.addEventListener('change',syncPatientCopies);
  }
  vent.parentElement.insertBefore(card,vent);
  syncPatientCopies();
 }
 function setRespDisplay(options,write=false){
  const pressure=Boolean(options?.pressure),flow=Boolean(options?.flow);
  document.body.dataset.respPressure=String(pressure);
  document.body.dataset.respFlow=String(flow);
  if(el('showVentPressure'))el('showVentPressure').checked=pressure;
  if(el('showVentFlow'))el('showVentFlow').checked=flow;
  if(write&&!document.body.classList.contains('student')){
   try{localStorage.setItem(respDisplayKey,JSON.stringify({pressure,flow}))}catch(err){console.warn('Preferenze onde respiratorie:',err)}
  }
 }
 function setupRespDisplay(){
  let initial={pressure:false,flow:false};
  try{initial=JSON.parse(localStorage.getItem(respDisplayKey)||'null')||initial}catch(err){}
  setRespDisplay(initial);
  for(const [id,key] of [['showVentPressure','pressure'],['showVentFlow','flow']]){
   const input=el(id);if(!input)continue;
   input.addEventListener('change',()=>setRespDisplay({pressure:key==='pressure'?input.checked:el('showVentPressure')?.checked,flow:key==='flow'?input.checked:el('showVentFlow')?.checked},true));
  }
  window.addEventListener('storage',e=>{
   if(e.key!==respDisplayKey||!e.newValue)return;
   try{setRespDisplay(JSON.parse(e.newValue))}catch(err){}
  });
 }
 function refresh(){
  const d=calc();lastData=d;
  ensureLoopAxes(d);
  // I tracciati Paw, flusso, volume e i loop richiedono un tubo
  // endotracheale; la condizione e' condivisa con il monitor studenti.
  document.body.dataset.respIntubated=String(d.intubated);
  syncPatientCopies();
  // RR e' la frequenza del ventilatore (o spontanea, se non intubato).
  if(el('rr')&&Number(el('rr').value)!==d.rate)el('rr').value=d.rate;
  const vals={ventPip:fmt(d.pip),ventPplat:fmt(d.plateauMeasured),ventDriving:fmt(d.drivingMeasured),ventVt:fmt(d.vt,0),ventMinute:fmt(d.minute,2),ventCrs:fmt(d.crs),ventCstat:fmt(d.cstat),ventCdyn:fmt(d.cdyn),ventRaw:fmt(d.rawMeasured),ventMainPip:fmt(d.pip),ventMainVolumeValue:fmt(d.vt,0),ventMainFlowValue:fmt(d.controlled?d.mode==='VCV'?d.vcvPeakFlow:d.pcvPeakFlow:d.vt/1000*Math.PI/(2*d.ti),2)};
  for(const [id,value] of Object.entries(vals))if(el(id))el(id).textContent=value;
  const status=el('ventStatus');
  if(status)status.textContent=!d.intubated?'Paziente non intubato: tracciati Paw, flusso e volume non disponibili. Dopo l’intubazione si parte dalla respirazione spontanea.':d.controlled?d.mode+' attiva · PEEP '+fmt(d.peep,0)+' cmH₂O · I:E 1:'+d.ie+' · Ti '+fmt(d.ti,2)+' s'+(d.hold?' · insufflazione '+fmt(d.flowTi,2)+' s + pausa '+fmt(d.holdSeconds,2)+' s':' · nessuna pausa inspiratoria'):'Paziente intubato · respirazione spontanea'+(d.postInduction?' con ipoventilazione post-induzione e possibile aumento dell’EtCO₂.':'')+' Seleziona VCV o PCV per attivare la ventilazione controllata.';
  if(el('ventMode'))el('ventMode').disabled=!d.intubated;
  if(el('ventVtKg'))el('ventVtKg').disabled=d.mode!=='VCV';
  if(el('ventPinsp'))el('ventPinsp').disabled=d.mode!=='PCV';
  if(el('ventPeep'))el('ventPeep').disabled=!d.controlled;
  if(el('ventHoldEnabled'))el('ventHoldEnabled').disabled=!d.controlled;
  if(el('ventHoldSeconds')){
   const input=el('ventHoldSeconds');
   input.disabled=!d.hold;
   // La durata richiesta resta MEMORIZZATA anche se la FR o I:E
   // rendono temporaneamente piu' breve la pausa applicabile.
   // Non sovrascrivere input.value: al ritorno ai parametri basali
   // la curva deve riacquistare esattamente la morfologia originale.
   // Il modello applica il limite in calc(), senza mutare i controlli.
   const maxAllowed=Math.max(.1,Math.min(1.5,d.ti*.65,d.ti-.15));
   input.max='1.5';
   const requested=Number(input.value);
   input.title=d.hold&&Number.isFinite(requested)&&requested>maxAllowed+1e-6?
    'Pausa richiesta '+fmt(requested,2)+' s; pausa applicata '+fmt(d.holdSeconds,2)+' s (limitata dal Ti).':
    'Durata della pausa inspiratoria richiesta; il limite effettivo dipende da Ti.';
  }
  const patient=el('studentPhenotype');
  if(patient)patient.textContent=fmt(d.age,1)+' anni · '+(el('patientBreed')?.value||'Meticcio')+' · BCS '+d.bcs+'/9';
  for(const prefix of ['studentVent']){
   const root=el(prefix+'Readouts');
   if(!root)continue;
   for(const [key,value] of Object.entries({pip:fmt(d.pip),pplat:fmt(d.plateauMeasured),driving:fmt(d.drivingMeasured),vt:fmt(d.vt,0),minute:fmt(d.minute,2),crs:fmt(d.crs),cstat:fmt(d.cstat),cdyn:fmt(d.cdyn),raw:fmt(d.rawMeasured)})){
    const target=el(prefix+key.charAt(0).toUpperCase()+key.slice(1));if(target)target.textContent=value;
   }
   const headline=el(prefix+'Headline');
   if(headline)headline.textContent=d.controlled?d.mode+' · FR '+d.rate+'/min · PEEP '+fmt(d.peep,0)+' cmH₂O · FiO₂ '+Math.round(d.fio2*100)+'%'+(d.hold?' · Ti '+fmt(d.ti,2)+' s · flusso '+fmt(d.flowTi,2)+' s · pausa '+fmt(d.holdSeconds,2)+' s':' · senza pausa'):(d.intubated?'Ventilazione spontanea · intubato':'Paziente non intubato · spontanea');
  }
  return d;
 }
 window.simVentRefresh=refresh;
 // Richiamato nel momento esatto dell'intubazione, prima di pubblicare
 // lo stato alla finestra studenti: nessuna VCV/PCV implicita.
 window.simVentOnIntubation=()=>{
  const mode=el('ventMode'),rate=el('ventRate');
  if(mode)mode.value='SPONT';
  // La FR dell'esempio (5 respiri in 15 s) e' ~20/min.
  // Si applica solo al passaggio effettivo in spontanea post-intubazione.
  if(rate)rate.value='20';
  autoSpontRate=true;previousVentMode='SPONT';
  if(typeof physiology==='function')physiology();
  else refresh();
 };
 function studentPanel(){
  const panel=el('student-panel-ventilation');if(!panel)return;
  // I dati clinici ventilatori sono gia' presenti sotto le onde, accanto
  // ai loop: non creare una seconda scheda con il riepilogo paziente.
  const headline=document.createElement('div');
  headline.id='studentVentHeadline';headline.className='status';
  headline.textContent='In attesa dei dati dalla console docente';
  const readouts=document.createElement('div');
  readouts.id='studentVentReadouts';readouts.className='vent-readouts';
  readouts.innerHTML=
   [['Pip','PIP','cmH₂O'],['Pplat','Pplat','cmH₂O'],['Driving','Driving P','cmH₂O'],['Vt','Vt','mL'],['Minute','V̇E','L/min'],['Crs','Crs modellata','mL/cmH₂O'],['Cstat','Cstat','mL/cmH₂O'],['Cdyn','Cdyn','mL/cmH₂O'],['Raw','Raw','cmH₂O/(L/s)']]
   .map(x=>'<div><small>'+x[1]+'</small><b id="studentVent'+x[0]+'">—</b><small>'+x[2]+'</small></div>').join('');

  // Nella scheda studente i loop sono affiancati alle onde, uno sopra l'altro,
  // senza sottrarre spazio al riepilogo dei parametri ventilatori.
  const loops=document.createElement('section');loops.id='studentVentLoops';
  loops.className='student-vent-loops';loops.setAttribute('aria-label','Loop spirometrici');
  loops.innerHTML='<div class="vent-loop-grid">'+
   '<div class="vent-loop-card"><strong>Pressione / Volume</strong><canvas id="studentVentLoopPV" aria-label="Loop pressione volume"></canvas></div>'+
   '<div class="vent-loop-card"><strong>Flusso / Volume</strong><canvas id="studentVentLoopFV" aria-label="Loop flusso volume"></canvas></div></div>'+
   '<div class="vent-loop-legend"><span class="insp">● Inspirazione attuale</span><span class="exp">● Espirazione attuale</span></div>';
  const ref=document.createElement('div');ref.className='vent-loop-ref-status';ref.id='studentVentRefStatus';
  loops.append(ref);
  const refKey=document.createElement('div');refKey.id='studentVentRefKey';refKey.className='vent-loop-ref-key';refKey.textContent='- - - Riferimento memorizzato';refKey.hidden=true;loops.append(refKey);
  const layout=el('studentVentLayout');
  if(layout)layout.append(loops);
  else panel.append(loops);
  // Sposta i valori gia' sincronizzati (non li duplica) nello spazio
  // sotto l'ultima onda della colonna sinistra, immediatamente sotto IBP.
  // La scheda ventilazione resta l'unica in cui questo riquadro compare.
  const waveColumn=layout?.querySelector('.student-vent-wave-column');
  if(waveColumn){
   const metrics=document.createElement('section');
   metrics.id='studentVentMetrics';
   metrics.className='student-vent-metrics';
   metrics.setAttribute('aria-label','Parametri ventilatori');
   const title=document.createElement('h3');
   title.textContent='Dati della ventilazione';
   metrics.append(title);
   if(headline)metrics.append(headline);
   metrics.append(readouts);
   waveColumn.append(metrics);
  }
 }
 function sample(d,type,phase){
  // Il campione alla fase 1 rappresenta la FINE dell'espirazione,
  // non l'inizio del respiro successivo: essenziale per chiudere i loop.
  const cycle=60/d.rate,t=clamp(phase,0,1)*cycle;
  const inspir=t<d.ti;
  const activeSeconds=Math.min(t,d.flowTi);
  const expSeconds=clamp(t-d.ti,0,d.te);
  let volume=0,flow=0,pressure=0;
  // La VCV termina con flusso gia' smussato a zero: Paw e' gia'
  // scesa alla pressione elastica (Pplat). Durante la pausa NON deve
  // risalire artificialmente a PIP, altrimenti il loop P/V crea un
  // uncino orizzontale aggiuntivo. In PCV, invece, la Paw rimane
  // alla pressione impostata fino alla chiusura inspiratoria.
  const holdStartPressure=d.mode==='VCV'?d.plateau:d.pip;
  if(d.controlled){
   if(inspir){
    const holdPhase=d.hold&&t>=d.flowTi;
    if(d.mode==='VCV'){
     const fill=vcvFill(activeSeconds,d.flowTi);
     volume=d.vt*fill.fraction;
     flow=holdPhase?0:d.vt/1000*fill.rate;
    }else{
     // PCV: picco precoce e decelerazione curva per la distribuzione
     // di due costanti RC; volume e flusso restano derivata/integrale
     // dello stesso modello, non un semplice effetto grafico.
     const fill=pcvSmoothFill(activeSeconds,d.flowTi,d.tau,d.pcvRiseTime);
     volume=d.vt*fill.fraction/Math.max(.001,d.pcvFillEnd);
     flow=holdPhase?0:d.vt*fill.rate/(1000*Math.max(.001,d.pcvFillEnd));
    }
    if(holdPhase)volume=d.vt;
    if(holdPhase){
     // Rilassamento continuo dal valore effettivamente raggiunto
     // alla fine dell'insufflazione: nessun salto Paw in avanti.
     pressure=d.plateau+(holdStartPressure-d.plateau)*
      Math.exp(-(t-d.flowTi)/.035);
    }else{
     pressure=d.mode==='PCV'?
      d.peep+d.pinsp*Math.min(1,t/d.pcvRiseTime):
      d.peep+elasticRecoil(d,volume)+d.autoPeep+d.raw*flow;
    }
   }else{
    // Il ventilatore scarica Paw rapidamente verso la PEEP, mentre
    // la valvola espiratoria raggiunge il pieno flusso con una dinamica
    // lievemente piu' lenta. Paw NON e' la pressione alveolare:
    // il polmone continua a svuotarsi a Paw pressoche' costante (PEEP).
    // Volume e flusso restano derivata/integrale della stessa funzione.
    const valveTime=d.valveTime;
    const pressureReleaseTime=clamp(.075+.12*d.tau+.012*d.expResistance,.075,.22);
    const tauE=d.tauE;
    const effective=expSeconds-valveTime*(1-Math.exp(-expSeconds/valveTime));
    const endEffective=d.te-valveTime*(1-Math.exp(-d.te/valveTime));
    const tail=Math.exp(-endEffective/tauE);
    const decay=Math.exp(-effective/tauE),den=Math.max(.00001,1-tail);
    if(d.trappedVolume>0){
     // Relative tidal volume remains continuous between consecutive breaths.
     volume=(d.vt+d.trappedVolume)*decay-d.trappedVolume;
     flow=-(d.vt+d.trappedVolume)/1000*decay*
      (1-Math.exp(-expSeconds/valveTime))/tauE;
    }else{
     volume=d.vt*clamp((decay-tail)/den,0,1);
     flow=expSeconds>=d.te?0:
      -d.vt/1000*decay*(1-Math.exp(-expSeconds/valveTime))/(tauE*den);
    }
    // All'inizio dell'espirazione la pressione e' quella realmente
    // raggiunta a fine inspirazione, anche se c'e' stata una pausa.
    const release=d.hold?
     d.plateau+(holdStartPressure-d.plateau)*Math.exp(-d.holdSeconds/.035):
     holdStartPressure;
    const pressureTail=Math.exp(-d.te/pressureReleaseTime);
    const releaseFraction=clamp(
     (Math.exp(-expSeconds/pressureReleaseTime)-pressureTail)/
     Math.max(.00001,1-pressureTail),0,1);
    // Paw prossimale: scarico della pressione inspiratoria e piccola
    // contropressione di valvola, proporzionale al flusso espiratorio.
    // Non e' una stima della pressione alveolare.
    pressure=d.peep+(release-d.peep)*releaseFraction+
     d.expValveR*Math.abs(flow)*(1-releaseFraction);
   }
  }else{
   // Respiro spontaneo regolare: volume e flusso hanno estremi comuni
   // e il ciclo si chiude senza un salto artificiale.
   if(inspir){
    const u=clamp(t/Math.max(.1,d.ti),0,1);
    volume=d.vt*(1-Math.cos(Math.PI*u))/2;
    flow=d.vt/1000*Math.PI/(2*Math.max(.1,d.ti))*Math.sin(Math.PI*u);
   }else{
    const u=clamp(expSeconds/Math.max(.1,d.te),0,1);
    volume=d.vt*(1+Math.cos(Math.PI*u))/2;
    flow=-d.vt/1000*Math.PI/(2*Math.max(.1,d.te))*Math.sin(Math.PI*u);
   }
   // Pressione subatmosferica durante l'inspirazione spontanea,
   // lieve pressione positiva espiratoria; transizioni continue.
   pressure=inspir?-2*Math.sin(Math.PI*clamp(t/d.ti,0,1)):
    1.2*Math.sin(Math.PI*clamp(expSeconds/d.te,0,1));
  }
  if(type==='Volume')return volume;
  if(type==='Pressure')return pressure;
  return flow;
 }
 // Curve temporali e loop spirometrici: stessi campioni, un unico modello respiratorio.
 function canvasContext(canvas){
  if(!canvas||canvas.offsetParent===null)return null;
  const rect=canvas.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height);
  if(w<30||h<30)return null;
  const pixelRatio=Math.min(1.6,window.devicePixelRatio||1),cw=Math.round(w*pixelRatio),ch=Math.round(h*pixelRatio);
  if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch}
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
  ctx.clearRect(0,0,w,h);
  return {ctx,w,h};
 }
 function drawTimeWave(canvas,d,type,color,seconds){
  const target=canvasContext(canvas);if(!target)return;
  const {ctx,w,h}=target;
  const spontaneousPressure=type==='Pressure'&&!d.controlled;
  // La linea orizzontale e la trasformazione in pixel condividono
  // la STESSA origine: Paw = 0 cmH2O (PEEP 0) e Vt = 0 mL.
  // In precedenza la linea era a 88% dell'altezza, mentre il segnale
  // a pressione zero era a 90%: sembrava partire sotto lo zero.
  const baseline=spontaneousPressure||type==='Flow'?h*.50:h*.88;
  ctx.strokeStyle='#23404d';ctx.lineWidth=1;ctx.beginPath();
  ctx.moveTo(0,baseline);ctx.lineTo(w,baseline);ctx.stroke();
  if(type==='Pressure'){
   // Il riferimento 0 e' un valore di Paw, non il bordo sinistro:
   // il monitor continua a scorrere senza riavviare la fase respiratoria.
   ctx.fillStyle='#78919e';ctx.font='9px system-ui,-apple-system,sans-serif';
   ctx.textAlign='left';ctx.fillText('0',5,baseline-5);
  }
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineJoin='round';ctx.beginPath();
  const cycle=60/d.rate;
  // Autoscale in base ai flussi inspiratorio ed espiratorio reali.
  // Il picco di flusso e' lo stesso dei loop: riutilizza i campioni
  // memoizzati, evitando un nuovo scan del modello ad ogni frame.
  const flowMax=type==='Flow'?Math.max(.15,
   ...loopPoints(d).insp.map(p=>Math.abs(p.f)),
   ...loopPoints(d).exp.map(p=>Math.abs(p.f)))*1.18:1;
  const max=type==='Pressure'?(spontaneousPressure?4:Math.max(15,(d.pip||5)*1.2)):type==='Volume'?Math.max(50,d.vt*1.2):flowMax;
  const speed=typeof window.simClinicalWavePixelsPerSecond==='function'?window.simClinicalWavePixelsPerSecond(type):12.5*96/25.4;
  // La pausa inspiratoria modifica solo la forma dell'onda, senza bande o marcatori grafici.
  ctx.beginPath();
  // Paw usa un campione per pixel: con due pixel per campione una
  // rampa inspiratoria rapida appare come un salto verticale.
  // Flusso e volume mantengono la frequenza di campionamento precedente.
  const pixelStep=type==='Pressure'?1:2;
  for(let x=0;x<w;x+=pixelStep){
   const phase=(((seconds+x/speed)/cycle)%1+1)%1,v=sample(d,type,phase);
   const y=type==='Flow'?baseline-v/max*h*.38:
    spontaneousPressure?baseline-v/max*h*.36:baseline-v/max*h*.75;
   if(x===0)ctx.moveTo(x,clamp(y,2,h-2));else ctx.lineTo(x,clamp(y,2,h-2));
  }
  ctx.stroke();
 }
 function drawArrow(ctx,a,b,color){
  if(!a||!b)return;
  const dx=b[0]-a[0],dy=b[1]-a[1],angle=Math.atan2(dy,dx);
  ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.beginPath();
  ctx.moveTo(b[0]-7*Math.cos(angle-.48),b[1]-7*Math.sin(angle-.48));
  ctx.lineTo(b[0],b[1]);ctx.lineTo(b[0]-7*Math.cos(angle+.48),b[1]-7*Math.sin(angle+.48));ctx.stroke();
 }
 function drawLoop(canvas,d,kind,seconds){
  const target=canvasContext(canvas);if(!target)return;
  const {ctx,w,h}=target;
  // Sistema di coordinate fisso 340 × 240: ridimensionando la finestra
  // cambia soltanto la scala uniforme, mai la forma del loop.
  const baseW=340,baseH=240,scale=Math.min(w/baseW,h/baseH);
  ctx.save();
  ctx.translate((w-baseW*scale)/2,(h-baseH*scale)/2);
  ctx.scale(scale,scale);
  const margin={left:47,right:12,top:19,bottom:37};
  const pw=baseW-margin.left-margin.right,ph=baseH-margin.top-margin.bottom;
  const {insp:inspPoints,exp:expPoints}=loopPoints(d);
  const bounds=ensureLoopAxes(d)[kind];
  const xmin=bounds.xMin,xmax=bounds.xMax,ymin=bounds.yMin,ymax=bounds.yMax;
  const x=v=>margin.left+(v-xmin)/(xmax-xmin)*pw;
  const y=v=>margin.top+ph-(v-ymin)/(ymax-ymin)*ph;
  ctx.font='10px system-ui,-apple-system,sans-serif';
  ctx.strokeStyle='#1d3643';ctx.fillStyle='#9db8c6';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
   const xx=margin.left+pw*i/4,yy=margin.top+ph*i/4;
   ctx.beginPath();ctx.moveTo(xx,margin.top);ctx.lineTo(xx,margin.top+ph);ctx.stroke();
   ctx.beginPath();ctx.moveTo(margin.left,yy);ctx.lineTo(margin.left+pw,yy);ctx.stroke();
   const xValue=xmin+(xmax-xmin)*i/4,yValue=ymax-(ymax-ymin)*i/4;
   ctx.textAlign='center';ctx.fillText(fmt(xValue,xmax>50?0:1),xx,margin.top+ph+14);
   ctx.textAlign='right';ctx.fillText(fmt(yValue,Math.abs(ymax)>50?0:2),margin.left-5,yy+3);
  }
  ctx.strokeStyle='#607988';ctx.beginPath();
  ctx.moveTo(margin.left,margin.top);ctx.lineTo(margin.left,margin.top+ph);ctx.lineTo(margin.left+pw,margin.top+ph);ctx.stroke();
  if(kind==='FV'){
   ctx.strokeStyle='#66828c';ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(margin.left,y(0));ctx.lineTo(margin.left+pw,y(0));ctx.stroke();ctx.setLineDash([]);
  }else if(d.controlled){
   // Linea di riferimento Paw = PEEP, valida per VCV e PCV.
   ctx.strokeStyle='#587f8c';ctx.setLineDash([3,4]);ctx.beginPath();
   ctx.moveTo(x(d.peep),margin.top);ctx.lineTo(x(d.peep),margin.top+ph);
   ctx.stroke();ctx.setLineDash([]);
  }
  ctx.fillStyle='#c2dce6';ctx.font='10px system-ui,-apple-system,sans-serif';ctx.textAlign='center';
  ctx.fillText(kind==='PV'?'Pressione vie aeree (cmH₂O)':'Volume (mL)',margin.left+pw/2,baseH-4);
  ctx.textAlign='left';ctx.fillText(kind==='PV'?'Volume (mL)':'Flusso (L/s)',margin.left,11);
  const toPoint=p=>kind==='PV'?[x(p.p),y(p.v)]:[x(p.v),y(p.f)];
  const drawLimb=(list,color,dashed=false)=>{
   ctx.strokeStyle=color;ctx.lineWidth=dashed?1.8:2.3;ctx.lineJoin='round';ctx.setLineDash(dashed?[6,4]:[]);ctx.beginPath();
   list.forEach((p,i)=>{const xy=toPoint(p);if(i===0)ctx.moveTo(...xy);else ctx.lineTo(...xy)});
   ctx.stroke();ctx.setLineDash([]);
   if(!dashed){const mid=Math.floor(list.length*.58);drawArrow(ctx,toPoint(list[mid-2]),toPoint(list[mid]),color)}
  };
  // Le due fasi sono calcolate con lo stesso modello, ma il passaggio
  // dalla valvola inspiratoria a quella espiratoria puo' essere
  // istantaneo: in VCV senza pausa, per esempio, il flusso passa dal
  // valore positivo impostato a zero a volume costante. Il campionamento
  // separato dei due rami non deve lasciare il loop F/V aperto.
  // Rappresenta SOLO l'effettiva discontinuita' di commutazione,
  // senza aggiungere segmenti fittizi quando gli estremi coincidono.
  const connectTransition=(from,to,color,dashed=false)=>{
   const a=toPoint(from),b=toPoint(to);
   if(Math.hypot(b[0]-a[0],b[1]-a[1])<.35)return;
   ctx.strokeStyle=color;ctx.lineWidth=dashed?1.8:2.3;ctx.lineJoin='round';
   ctx.setLineDash(dashed?[6,4]:[]);
   ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
   ctx.setLineDash([]);
  };
  // Ritaglia alla finestra degli assi fissi: niente curve sulle etichette.
  ctx.save();ctx.beginPath();ctx.rect(margin.left,margin.top,pw,ph);ctx.clip();
  if(loopView.reference){
   const saved=loopView.reference;
   // Anche il riferimento deve includere i due raccordi del ciclo:
   // al cambio inspirazione/espirazione (flusso che passa a zero)
   // e tra fine espirazione e respiro successivo.
   // Disegnare soltanto i due rami lasciava aperto il loop F/V salvato.
   drawLimb(saved.insp,'#b0b9c7',true);
   connectTransition(saved.insp[saved.insp.length-1],saved.exp[0],'#b0b9c7',true);
   drawLimb(saved.exp,'#b0b9c7',true);
   connectTransition(saved.exp[saved.exp.length-1],saved.insp[0],'#b0b9c7',true);
  }
  drawLimb(inspPoints,'#4399ff');
  connectTransition(inspPoints[inspPoints.length-1],expPoints[0],'#4399ff');
  drawLimb(expPoints,'#c084fc');
  // Fine espirazione e nuovo inizio inspirazione devono coincidere
  // a V=0 e Paw=PEEP (o flusso=0). Un eventuale scarto numerico
  // sub-pixel non produce un artefatto visibile.
  connectTransition(expPoints[expPoints.length-1],inspPoints[0],'#c084fc');
  // Nessun marcatore grafico della pausa inspiratoria: la meccanica
  // resta rappresentata dalla forma dei tracciati e dei loop.
  const phase=((seconds/(60/d.rate))%1+1)%1;
  const p={p:sample(d,'Pressure',phase),v:sample(d,'Volume',phase),f:sample(d,'Flow',phase)};
  const marker=toPoint(p);
  ctx.fillStyle='#ffffff';ctx.strokeStyle='#071016';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(marker[0],marker[1],3.7,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.restore(); // clip del grafico
  ctx.restore(); // trasformazione geometrica
 }
 let waveSeconds=0,lastNow=performance.now(),lastDraw=0,ventDrawFailures=0;
 function draw(now){
  // Non interrompere la catena requestAnimationFrame se Safari genera
  // un errore transitorio durante il cambio della pausa inspiratoria.
  requestAnimationFrame(draw);
  try{
  const delta=clamp((now-lastNow)/1000,0,.25);lastNow=now;
  const paused=typeof simClock!=='undefined'&&simClock.paused;
  if(!paused)waveSeconds+=delta;
  if(now-lastDraw>=45){
   lastDraw=now;
   const d=lastData||calc();
   // Condividiamo la stessa base temporale del monitor ECG/ART/EtCO2.
   // Se il motore ECG e' momentaneamente indisponibile, Paw/flusso/Vt
   // continuano a scorrere usando il proprio orologio, senza fermarsi.
   const fresh=Number.isFinite(window.simWaveTimeSeconds)&&
    Number.isFinite(window.simWaveFrameTimestamp)&&
    performance.now()-window.simWaveFrameTimestamp<400;
   if(fresh&&!paused)waveSeconds=window.simWaveTimeSeconds;
   const timeline=fresh?window.simWaveTimeSeconds:waveSeconds;
   for(const [type,color] of [['Pressure','#ffd34e'],['Flow','#ff9a3c'],['Volume','#bd895a']]){
    drawTimeWave(el('ventMain'+type),d,type,color,timeline);
   }
   drawLoop(el('ventLoopPV'),d,'PV',timeline);
   drawLoop(el('ventLoopFV'),d,'FV',timeline);
   drawLoop(el('studentVentLoopPV'),d,'PV',timeline);
   drawLoop(el('studentVentLoopFV'),d,'FV',timeline);
  }
  ventDrawFailures=0;
  }catch(error){
   ventDrawFailures++;
   if(ventDrawFailures<=3||ventDrawFailures%300===0)
    console.warn('Ripristino animazione ventilatoria dopo errore di disegno:',error);
  }
 }
 function onControlsChanged(e){
  if(document.body.classList.contains('student'))return;
  if(e.target.id==='ventRate')autoSpontRate=false;
  if(e.target.id==='ventMode'){
   const mode=el('ventMode')?.value||'SPONT',rate=el('ventRate');
   if(autoSpontRate&&rate&&mode!==previousVentMode){
    if(mode==='SPONT')rate.value='20';
    else if(previousVentMode==='SPONT'&&Number(rate.value)===20)rate.value='12';
   }
   previousVentMode=mode;
  }
  if(e.target.id==='patientBreed'&&e.type==='change'){
   const selected=el('patientBreed')?.value||'Meticcio';
   if(el('patientMorph'))el('patientMorph').value=breedMorph[selected]||'meso';
   if(el('patientBodyType'))el('patientBodyType').value=breedBody[selected]||'meso';
  }
  if(typeof physiology==='function')physiology();else refresh();
  if(e.type==='change'&&typeof v25Event==='function'&&e.target.id.startsWith('vent'))v25Event('Ventilazione: '+(el('ventMode')?.value||'SPONT')+' · FR '+n('ventRate',12)+'/min · Vt '+n('ventVtKg',10)+' mL/kg · PEEP '+n('ventPeep',0)+' cmH₂O');
 }
 window.addEventListener('DOMContentLoaded',()=>{
  studentPanel();
  previousVentMode=el('ventMode')?.value||'SPONT';
  createPatientMirror();
  setupRespDisplay();
  setupLoopView();
  for(const id of [...ventIds,'weight','patientAge','patientBreed','patientMorph','patientBodyType','patientBCS']){
   const field=el(id);if(!field)continue;
   field.addEventListener('change',onControlsChanged);
   if(id!=='patientBreed')field.addEventListener('input',onControlsChanged);
  }
  if(document.body.classList.contains('student')){
   window.addEventListener('storage',e=>{
    if(e.key==='recoverCaneState'||e.key==='recoverCaneStudentStatusV2891')refresh();
   });
  }
  refresh();
  requestAnimationFrame(draw);
 });
})();

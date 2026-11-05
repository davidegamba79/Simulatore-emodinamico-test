/* V2.9.25 — animazione robusta: pausa inspiratoria indipendente dalla pausa globale. */
(()=>{const R=requestAnimationFrame.bind(window),E=i=>document.getElementById(i),N=i=>+(E(i)?.value||0),C=(v,a,b)=>Math.max(a,Math.min(b,v)),G=(x,m,s)=>Math.exp(-.5*((x-m)/s)**2),t0=performance.now()/1000;
let wavePaused=false,wavePauseAt=0,wavePausedTotal=0;
// Il tempo delle onde e' indipendente dalla velocita' della simulazione.
// Quando si mette in pausa, il canvas resta identico; alla ripresa
// si esclude il tempo trascorso durante la pausa, senza salti di fase.
window.simWaveSetPaused=paused=>{
 paused=Boolean(paused);
 if(paused===wavePaused)return;
 const now=performance.now()/1000;
 if(paused)wavePauseAt=now;
 else wavePausedTotal+=now-wavePauseAt;
 wavePaused=paused;
};
// Velocita' convenzionali di monitoraggio (mm/s), rese in CSS pixel.
 // CSS usa 96 px per pollice: la scala temporale resta stabile al resize,
 // ma la misura fisica in mm sul vetro dipende dal display e dal browser.
 const CSS_PIXELS_PER_MM=96/25.4;
 const CLINICAL_SPEED_MM_S=Object.freeze({
  ecg:25,art:25,pleth:25,capno:12.5,
  Pressure:12.5,Flow:12.5,Volume:12.5
 });
 const clinicalPps=key=>(CLINICAL_SPEED_MM_S[key]||25)*CSS_PIXELS_PER_MM;
 window.simClinicalWaveSpeed=CLINICAL_SPEED_MM_S;
 window.simClinicalWavePixelsPerSecond=clinicalPps;
 window.simWavePixelsPerSecond=clinicalPps('ecg');
 function fit(c){
  const r=c.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1);
  const w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
  if(c.width!==w||c.height!==h){c.width=w;c.height=h}
  const g=c.getContext("2d");g.setTransform(d,0,0,d,0,0);
  return [g,r.width,r.height];
 }
function ecg(q,r){if(r.includes("Artefatto massaggio")){const cyc=Math.floor(window.__cprWaveTime||0),mod=.83+.17*Math.sin(cyc*1.71)+.09*Math.sin(cyc*2.93),shift=.025*Math.sin(cyc*1.13),noise=.022*Math.sin(2*Math.PI*(7*q+cyc*.37))+.017*Math.sin(2*Math.PI*(13*q+cyc*.19));return mod*(.40*G(q,.18+shift,.078)-.32*G(q,.31+shift,.09)+.25*G(q,.49-shift,.12)-.13*G(q,.68,.1))+noise;}if(r==="Asistolia")return .003*Math.sin(q*20);if(r.includes("Fibrillazione")){let t=q/Math.max(.001,(N("hr")||80)/60);let slow=.5+.5*Math.sin(t*1.13+.9*Math.sin(t*.37)),amp=.45+.8*slow;let s=.095*Math.sin(t*33+1.4*Math.sin(t*2.3))+.075*Math.sin(t*49+1.1*Math.sin(t*1.7))+.05*Math.sin(t*71+.8*Math.sin(t*3.1))+.028*Math.sin(t*113);return amp*s;}if(r.includes("Tachicardia ventricolare"))return .34*Math.sin(2*Math.PI*q)+.13*Math.sin(4*Math.PI*q);return .06*G(q,.12,.034)-.07*G(q,.255,.015)+.47*G(q,.286,.013)-.16*G(q,.319,.017)+.13*G(q,.57,.072)}


function periodicG(t,offset,period,sigma){
 const d=((t-offset+period/2)%period+period)%period-period/2;
 return G(d,0,sigma);
}
// Secondo la traccia ECG didattica: P visibili, PR lungo, P bloccate e dissociazione AV.
function avTiming(r,ventHR){
 const cycle=60/Math.max(1,ventHR);
 if(r==="Blocco AV I grado")
  return {cycle,pPeriod:cycle,pOffset:Math.min(.085,cycle*.10),qrsOffset:Math.min(.405,cycle*.56)};
 if(r.startsWith("Blocco AV II grado")){
  // Due onde P equidistanti per ciclo ventricolare: la seconda non e' condotta.
  // La P bloccata e' ben separata dall'onda T, nella pausa T-P.
  const pOffset=cycle*.28;
  return {cycle,pPeriod:cycle/2,pOffset,blockedPOffset:pOffset+cycle/2,qrsOffset:pOffset+Math.min(.16,cycle*.14)};
 }
 // Frequenza atriale 118/min, non multipla della FC ventricolare.
 // Le onde P scorrono progressivamente rispetto ai QRS (dissociazione AV completa).
 return {cycle,pPeriod:60/118,pOffset:.12,qrsOffset:cycle*.21};
}
function avECG(t,r,hr){
 const c=avTiming(r,hr),p=(offset,period,sigma)=>periodicG(t,offset,period,sigma);
 const P=(r==="Blocco AV III grado"?.24:.195)*p(c.pOffset,c.pPeriod,r==="Blocco AV III grado"?.031:.037);
 if(r==="Blocco AV I grado"){
  // Conduzione 1:1: PR ~0,32 s a 80 bpm (marcatamente prolungato).
  return P-.085*p(c.qrsOffset-.035,c.cycle,.012)+.69*p(c.qrsOffset,c.cycle,.016)
    -.22*p(c.qrsOffset+.036,c.cycle,.019)+.16*p(c.qrsOffset+Math.min(.20,c.cycle*.24),c.cycle,.075);
 }
 if(r.startsWith("Blocco AV II grado")){
  // P condotta prima del QRS; P bloccata al centro dell’intervallo T-P, senza QRS o polso associati.
  const conductedP=.195*p(c.pOffset,c.cycle,.037);
  const blockedP=.23*p(c.blockedPOffset,c.cycle,.039);
  return conductedP+blockedP-.078*p(c.qrsOffset-.034,c.cycle,.013)+.70*p(c.qrsOffset,c.cycle,.017)
    -.21*p(c.qrsOffset+.040,c.cycle,.020)+.15*p(c.qrsOffset+Math.min(.17,c.cycle*.14),c.cycle,.055);
 }
 // Terzo grado: P a 118/min indipendenti dai QRS di scappamento piu' larghi.
 return P-.12*p(c.qrsOffset-.053,c.cycle,.027)+.68*p(c.qrsOffset,c.cycle,.033)
  -.25*p(c.qrsOffset+.065,c.cycle,.034)+.15*p(c.qrsOffset+.26,c.cycle,.092);
}
function art(q){if(E("rhythm")?.value==="Artefatto massaggio cardiaco 120/min")return .85*G(q,.22,.105)+.22*G(q,.4,.17);if((E("rhythm")?.value==="Fibrillazione ventricolare"||E("rhythm")?.value==="Tachicardia ventricolare senza polso"||E("rhythm")?.value==="PEA / attività elettrica"||E("rhythm")?.value==="Asistolia"))return 0;let pp=C((N("sap")-N("dap"))/60,.12,1.75),sv=C(N("sv")/36,.35,1.8),con=C((window.macEffectiveContractility||N("contractility"))/100,.2,1.9),dp=C((N("dpdt")||.8)/.8,.4,2.2),tone=C((window.macEffectiveTone||N("vascularTone"))/100,.3,2.1),comp=C(N("compliance")/100,.4,1.8);
// Baseline retains V2.8.22/V2.8.24 peripheral contour.
// Norepinephrine alone adds a concave systolic downslope, prominent systolic
// peak and near-horizontal post-dicrotic runoff as peripheral resistance rises.
let norFx=(typeof v25!=="undefined"&&v25.fx)?Math.max(0,v25.fx.tone||0):0;
let norActive=typeof v25!=="undefined"&&v25.inf&&v25.inf.nor;
let nor=C((norActive||norFx>2?norFx:0)/30,0,1);
 // Canine dexmedetomidine: high peripheral resistance prolongs arterial
 // runoff. Preserve the norepinephrine-specific contour independently.
 const dex=typeof window.premedDexEffect==='function'?window.premedDexEffect():0;
 const dexTone=C((tone-1)/.7,0,1)*C(dex,0,1);
let onset=.085,rise=C(.072/Math.pow(con*dp,.10),.055,.092);
let z=C((q-onset)/rise,0,1),up=z*z*(3-2*z);
let dt=Math.max(0,q-onset-rise),fall=C(.145+.015*comp-.012*tone,.115,.18);
let tail=1/(1+Math.pow(dt/(fall*(1+.70*dexTone)),1.65));
let baseline=up*tail;
let notchAt=C(.40+.025/comp,.39,.46),notch=C(.065+.012*tone,.045,.085)*G(q,notchAt,.020),dicrotic=C(.075+.018*tone,.055,.105)*G(q,notchAt+.078,.058);
let constrict=C((tone-1)/.40,0,1),reflection=C((tone-1)*.55,-.10,.46);
let reflected=reflection*G(q,C(.335-.035*constrict,.29,.36),.065),shoulder=.10*constrict*G(q,.235,.045);
baseline+=-notch*(1+.20*constrict)+dicrotic*(1+.25*constrict)+reflected+shoulder;
 baseline+=dexTone*(.10*G(q,.60,.21)+.055*G(q,.82,.16));
// Peripheral norepinephrine contour: early fast fall (concave in pressure),
// clear incisura and reflection, then sustained diastolic pressure plateau.
let systoleEnd=.395,peakAt=onset+rise;
let t=C((q-peakAt)/(systoleEnd-peakAt),0,1);
let concaveFall=1-.69*(1-Math.pow(1-t,3.1));
let early=up*concaveFall;
let dip=.115*G(q,.402,.016);
let rebound=.105*G(q,.472,.045);
let after=C((q-.46)/.12,0,1);after=after*after*(3-2*after);
let plateau=.26+.015*(tone-1);
let post=plateau*(1-.16*C((q-.62)/.38,0,1));
let norContour=q<.46?early-dip+rebound:early*(1-after)+post*after+rebound;
let end=C((1-q)/.23,0,1);end=end*end*(3-2*end);
let peak=C(1+.14*(dp-1)+.07*(sv-1),.75,1.35);let norSystolicBoost=1+nor*.32*G(q,peakAt,.082);
return C((baseline*(1-nor)+norContour*nor*norSystolicBoost)*end*peak,0,1.5)*pp}
function pleth(q){if(E("rhythm")?.value==="Artefatto massaggio cardiaco 120/min")return .16*G(q,.3,.13);if((E("rhythm")?.value==="Fibrillazione ventricolare"||E("rhythm")?.value==="Tachicardia ventricolare senza polso"||E("rhythm")?.value==="PEA / attività elettrica"||E("rhythm")?.value==="Asistolia"))return 0;let co=C(N("co")/3.2,.08,1.8),pp=C((N("sap")-N("dap"))/50,.15,1.7),tone=C((window.macEffectiveTone||N("vascularTone"))/100,.3,2),z=Math.max(0,q-.1),v=q>.1?(1-Math.exp(-z/.055))*Math.exp(-z*(2.7+.45*tone)):0;
// La curva pletismografica deve ricongiungersi al basale al termine di ogni
// ciclo: senza la coda a zero, il modulo (%) provoca un salto verticale.
const tail=C((q-.65)/.35,0,1),fade=1-tail*tail*(3-2*tail);
return (v+.08*G(q,.53,.075))*fade*C(Math.sqrt(co*pp/tone),.08,1.35)}
// EtCO2 atto per atto, con escursione didattica 0,78–1,20.
// Sequenza deterministica (anche sul monitor studenti), senza salti casuali
// durante il disegno. Per EtCO2 media ~55: picchi circa 44–66 mmHg.
function spontaneousBreathFactor(breath){
 const b=Number.isFinite(breath)?breath:0;
 return C(1+.14*Math.sin(b*1.28+2.36+.015*b*b)+
  .10*Math.sin(b*3.81+4.25+.022*b*b),.78,1.20);
}
window.simSpontCapBreathFactor=spontaneousBreathFactor;
// Profilo della figura di riferimento: salita ripida (fase II),
// sommità arrotondata e lievemente irregolare, NON un plateau rettilineo;
// discesa inspiratoria ripida e ritorno al basale. La durata della
// espirazione e la curvatura variano leggermente fra atti.
function spontaneousCap(q,vent,breath){
 const cycle=60/Math.max(1,vent.rate);
 const inspirFraction=C(vent.ti/cycle,.12,.45);
 if(q<=inspirFraction)return 0;
 const exp=C((q-inspirFraction)/(1-inspirFraction),0,1);
 const onset=.014+.014*Math.sin(breath*1.19+.3);
 const riseEnd=.19+.020*Math.sin(breath*1.67+1.2);
 const fallStart=.69+.035*Math.sin(breath*1.38+.4);
 const fallEnd=.985+.012*Math.sin(breath*1.91+.8);
 if(exp<=onset||exp>=fallEnd)return 0;
 if(exp<riseEnd){
  const z=C((exp-onset)/(riseEnd-onset),0,1);
  return .90*(1-Math.pow(1-z,3));
 }
 if(exp<fallStart){
  const z=C((exp-riseEnd)/(fallStart-riseEnd),0,1);
  const crest=Math.pow(z,1+.25*Math.sin(breath*1.73+.7));
  return .90+.10*Math.pow(Math.sin(Math.PI*crest),1.5);
 }
 const z=C((exp-fallStart)/(fallEnd-fallStart),0,1);
 return .90*(1-z*z*(3-2*z));
}
function cap(q,vent,breath){let m=E("capnoPattern")?.value||"Normale";
 if(m==="Normale"&&vent?.intubated&&!vent.controlled)return spontaneousCap(q,vent,breath);if(m.includes("Disconnessione"))return 0;let b=m.includes("Rebreathing")?.18:0,v=0;if(m.includes("Broncospasmo")){if(q<.07)v=0;else if(q<.42)v=C((q-.07)/.35,0,1)**1.8;else if(q<.69)v=.96+.06*(q-.42)/.27;else if(q<.82){let z=(q-.69)/.13;v=1.02*(1-z*z*(3-2*z))}}else{if(q<.08)v=0;else if(q<.14){let z=(q-.08)/.06;v=.94*(z*z*(3-2*z))}else if(q<.72){let z=(q-.14)/.58;v=.94+.09*z+.010*Math.sin(Math.PI*z)}else if(q<.78){let z=(q-.72)/.06;v=1.03*(1-(z*z*(3-2*z)))}else v=0;if(m.includes("Oscillazioni"))v+=.045*Math.sin(q*42)*C((q-.14)*4,0,1)*C((.78-q)*8,0,1)}return b+(1-b)*C(v,0,1.1)}
// Oscillazione respiratoria SPV calcolata una volta per frame, non per pixel.
let waveDrawFailures=0;
function draw(){
 // Il prossimo frame viene sempre prenotato PRIMA del disegno.
 // Un errore transitorio durante il cambio dei parametri ventilatori
 // non deve arrestare definitivamente ECG, ART, SpO2 ed EtCO2.
 R(draw);
 try{
  // Solo il comando Pausa/Play della simulazione puo' congelare le onde.
  // La pausa di fine inspirazione modifica la meccanica respiratoria,
  // ma non deve mai modificare questo stato.
  if(typeof simClock!=='undefined'&&Boolean(simClock.paused)!==wavePaused)
   window.simWaveSetPaused(Boolean(simClock.paused));
  if(wavePaused)return;
 const hr=Math.max(1,N("hr")||90),rr=Math.max(1,N("rr")||18),et=C(N("etco2")||38,3,80);
 const rh=E("rhythm")?.value||"Ritmo sinusale",av=rh.startsWith("Blocco AV "),timing=av?avTiming(rh,hr):null,now=performance.now()/1000-t0-wavePausedTotal;
 window.simWaveTimeSeconds=now;
 window.simWaveFrameTimestamp=performance.now();
 const vent=typeof window.simVentCalc==='function'?window.simVentCalc():null;
 const respActive=typeof window.simVentValid==='function'&&window.simVentValid();
 const respPulse=Math.max(1,N('sap')-N('dap')),respSpv=C(N('spv'),0,35),respRate=Math.max(1,N('rr')||12);
 const respiratoryPulse=ts=>respActive?C(1+respSpv/(2*respPulse)*Math.sin(2*Math.PI*ts*respRate/60-.3),.7,1.3):1;
 [["ecg","#39ef8b"],["pleth","#3bd6ff"],["capno","#f8fbff"],["art","#ff5364"]].forEach(([id,col])=>{
  const c=E(id);if(!c||c.offsetParent===null)return;
  const [g,w,h]=fit(c);g.clearRect(0,0,w,h);g.strokeStyle=col;g.lineWidth=2;g.beginPath();
  for(let x=0;x<w;x++){
   const ts=now+x/clinicalPps(id);let q,y;
   if(id==="capno"){
    const cycle=60/rr,phase=((ts/cycle)%1+1)%1;
    // L'espirazione inizia dopo la fase inspiratoria dei tracciati Paw/flow.
    // In controllata rimane la fase III; in spontanea la fase II e' rapida
    // e la sommita' e' una cupola, come nella traccia di riferimento.
    const tiFraction=vent?.intubated?C(vent.ti/cycle,.18,.65):1/3;
    // Capnografia controllata sincronizzata alla reale espirazione:
    // zero durante l'inspirazione, fase II dopo l'apertura della
    // valvola espiratoria e ritorno al basale prima del nuovo respiro.
    // La mappa 0.08..0.83 conserva la forma di cap() e copre anche
    // l'espirazione prolungata nel broncospasmo senza trascinarsi
    // nel successivo ciclo inspiratorio.
    q=vent?.controlled?(phase<tiFraction?0:
     .08+.75*(phase-tiFraction)/Math.max(.05,1-tiFraction)):phase;
    const breath=Math.floor(ts/cycle);
    const spontaneous=vent?.intubated&&!vent.controlled;
    const currentBreath=Math.floor(now/cycle);
    // et e' il valore numerico dell'atto corrente: normalizziamo
    // rispetto al suo fattore, poi moduliamo ciascun atto disegnato.
    const amplitude=spontaneous?spontaneousBreathFactor(breath)/spontaneousBreathFactor(currentBreath):1;
    // Scala separata per la spontanea: picchi 40–70 mmHg visibili
    // senza saturazione/clipping in alto; la quota segue la EtCO2 reale.
    y=spontaneous?
     .91-cap(q,vent,breath)*amplitude*C(et/80,.04,1.05)*.80:
     .86-cap(q,vent,breath)*C(et/40,.12,1.65)*.60;
   }else if(av){
    if(id==="ecg"){
     y=.58-avECG(ts,rh,hr)*.76;
    }else{
     // QRS, pressione arteriosa e pleth condividono lo stesso evento ventricolare.
     // A FC basse la sistole mantiene una durata realistica: la diastole si allunga.
     const delay=id==="art"?.055:.16,phase=((ts-timing.qrsOffset-delay)%timing.cycle+timing.cycle)%timing.cycle;
     q=phase/.75;
     if(id==="art"){
      const sap=N("sap"),dap=N("dap"),pulse=Math.max(1,sap-dap);
      const shape=q<=1?art(q)/C(pulse/60,.12,1.75):0;
      const pressure=dap+pulse*shape*respiratoryPulse(ts);
      y=.93-(pressure-30)/(145-30)*.91;
     }else{
      y=.84-(q<=1?pleth(q):0)*.48*respiratoryPulse(ts);
     }
    }
   }else{
    const rate=rh.includes("massaggio")?120:rh.includes("Tachicardia ventricolare")?Math.max(120,hr):hr,delay=id==="art"?.055:id==="pleth"?.16:0;
    q=((((ts-delay)/(60/rate))%1)+1)%1;
    if(id==="ecg"){
     if(rh.includes("Artefatto massaggio"))window.__cprWaveTime=Math.floor((ts-delay)*2);
     y=.58-ecg(q,rh)*.76;
    }else if(id==="art"){
     const sap=N("sap"),dap=N("dap"),pulse=Math.max(1,sap-dap),shape=art(q)/C(pulse/60,.12,1.75);
     const pressure=rh==="Artefatto massaggio cardiaco 120/min"?15+40*shape:(rh==="Fibrillazione ventricolare"||rh==="Tachicardia ventricolare senza polso"||rh==="PEA / attività elettrica"||rh==="Asistolia")?0:dap+pulse*shape*respiratoryPulse(ts);
     y=.93-(pressure-30)/(145-30)*.91;
    }else y=.84-pleth(q)*.48*respiratoryPulse(ts);
   }
   x?g.lineTo(x,C(y,.035,.965)*h):g.moveTo(x,C(y,.035,.965)*h);
  }
  g.stroke();

 });
 waveDrawFailures=0;
 }catch(error){
  waveDrawFailures++;
  if(waveDrawFailures<=3||waveDrawFailures%300===0)
   console.warn('Ripristino animazione onde dopo errore di disegno:',error);
 }
}
R(draw)})();
/* Experimental teaching-only left ventricular pressure-volume loop. */
(()=>{
 const get=id=>document.getElementById(id);
 const num=(id,fallback)=>{const el=get(id);const v=Number(el?.value);return el&&Number.isFinite(v)?v:fallback};
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 let reference=null;
 const panel=document.createElement('section');
 panel.id='lvPvTeaching';panel.className='card instructor-only';
 panel.innerHTML='<h2>Ventricolo sinistro — curva pressione/volume (modello didattico)</h2><p class="lv-pv-note">Modello didattico ispirato a Suga–Sagawa (elastanza variabile) e Denault–Gorcsan–Pinsky (interazione con ventilazione a pressione positiva). La funzione ventricolare segue gli scenari clinici e il motore fisiologico condiviso. Il loop distingue pressione pleurica stimata, riempimento e pressione transmurale; la pressione delle vie aeree non coincide con quella pleurica. Modello illustrativo, non misurazione ventricolare. La linea arancione tratteggiata indica la ESPVR, quella rossa tratteggiata indica Ea (elastanza arteriosa efficace) e quella grigia conserva il loop prima della terapia.</p><div class="lv-pv-actions"><label style="font-size:11px;color:#a9c2ce"><input type="checkbox" id="lvPvResp" checked> Modula con il respiro</label><button type="button" id="lvPvSave">Memorizza loop di riferimento</button><button type="button" id="lvPvClear">Rimuovi riferimento</button><span id="lvPvRefStatus">Nessun riferimento salvato</span></div><div class="lv-pv-layout"><canvas id="lvPvCanvas" aria-label="Loop pressione volume del ventricolo sinistro" role="img"></canvas><div class="lv-pv-values" id="lvPvValues"></div></div><div class="lv-pv-legend"><span>● Riempimento</span><span>● Contrazione isovolumetrica</span><span>● Eiezione</span><span>● Rilasciamento isovolumetrico</span><span class="lv-pv-key" style="color:#ff5757"><i style="border-color:#ff5757"></i>Ea</span><span class="lv-pv-key" style="color:#ffad70"><i style="border-color:#ffad70"></i>ESPVR</span></div>';
 const anchor=document.querySelector('.hemo-wrap');if(!anchor)return;
 anchor.insertAdjacentElement('afterend',panel);
 const css=document.createElement('style');css.textContent=`
 #lvPvTeaching{display:none;margin-top:8px;padding:12px}
 body:not(.student)[data-instructor-tab="hemodynamics"] #lvPvTeaching,
 body:not(.student)[data-instructor-tab="hemo"] #lvPvTeaching,
 body:not(.student)[data-instructor-tab="therapy"] #lvPvTeaching{display:block}
 .lv-pv-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:7px 0 10px}.lv-pv-actions button{font-size:11px;padding:7px 9px}.lv-pv-actions span{font-size:10px;color:#a9c2ce}
 #lvPvTeaching h2{font-size:14px;margin:0 0 5px}
 .lv-pv-note{color:#9bb5c1;font-size:11px;line-height:1.45;margin:0 0 8px}
 .lv-pv-layout{display:flex;flex-direction:column;gap:12px;align-items:stretch}
 #lvPvCanvas{width:100%;height:clamp(290px,38vw,440px);display:block;background:#081923;border:1px solid #244351;border-radius:8px}
 .lv-pv-values{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:6px}
 .lv-pv-value{background:#081923;border:1px solid #244351;border-radius:7px;padding:8px 6px}
 .lv-pv-value small{display:block;color:#9ab1be;font-size:10px}
 .lv-pv-value b{display:block;color:#e5f5fa;font-size:17px;margin-top:3px}
 .lv-pv-legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:7px;font-size:10px;color:#a6bfcb}
 .lv-pv-legend span:nth-child(1){color:#3dd5bb}.lv-pv-legend span:nth-child(2){color:#f3c969}.lv-pv-legend span:nth-child(3){color:#60b8ff}.lv-pv-legend span:nth-child(4){color:#d19afa}
 @media(max-width:900px){#lvPvCanvas{height:300px}.lv-pv-values{grid-template-columns:repeat(2,minmax(0,1fr))}}
 `;document.head.appendChild(css);
 const canvas=get('lvPvCanvas'),ctx=canvas.getContext('2d');let current=null;
 let respPhase=0,lastRenderAt=performance.now(),phaseClock=0;
 get('lvPvResp').addEventListener('change',draw);
 get('lvPvSave').addEventListener('click',()=>{if(!current)return;reference=JSON.parse(JSON.stringify(current));get('lvPvRefStatus').textContent='Riferimento salvato · tratteggio grigio';draw()});
 get('lvPvClear').addEventListener('click',()=>{reference=null;get('lvPvRefStatus').textContent='Nessun riferimento salvato';draw()});
 function draw(){
  // Keep producing student PV data even while the instructor views another tab.
  const hiddenPanel=getComputedStyle(panel).display==='none';
  if(hiddenPanel)panel.style.display='block';
  const box=canvas.getBoundingClientRect();if(box.width<20)return;
  const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(box.width*dpr),h=Math.round(box.height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  ctx.setTransform(dpr,0,0,dpr,0,0);const W=box.width,H=box.height;
  // Ventilator effects are intentionally modest: airway pressure is NOT
  // intrathoracic pressure. A fraction of mean airway pressure is transmitted.
  const vent=typeof window.simVentCalc==='function'?window.simVentCalc():null;
  const controlled=!!vent?.controlled;
  const rr=clamp(vent?.rate||num('rr',12),4,45);
  const now=performance.now(),dt=clamp((now-lastRenderAt)/1000,0,.3);lastRenderAt=now;
  if(!window.simWaveIsPaused)phaseClock+=dt;
  respPhase=(phaseClock*rr/60)%1;
  const inspFraction=clamp((vent?.ti||1.5)/(60/rr),.15,.75);
  const breath=respPhase<inspFraction
   ?Math.sin(Math.PI*.5*respPhase/inspFraction)**2
   :Math.cos(Math.PI*.5*(respPhase-inspFraction)/(1-inspFraction))**2;
  const respOn=get('lvPvResp').checked&&!!vent?.controlled;
  // Ventricular function follows the shared physiology engine and clinical scenarios.
  const pmean=respOn?clamp(Number(vent?.pmean)||0,0,35):0;
  const peep=respOn?clamp(Number(vent?.totalPeep)||0,0,30):0;
  const transmitted=respOn?clamp(Number(vent?.transmittedPressure)||0,0,20):0;
  const transmission=pmean>0?clamp(transmitted/pmean,.15,.8):.48;
  const plateau=respOn?clamp(Number(vent?.plateau)||0,0,55):0;
  const pleuralBase=peep*transmission;
  const pleuralSwing=Math.max(0,plateau-peep)*transmission*.65;
  const pleuralPressure=respOn?pleuralBase+pleuralSwing*breath:0;
  // Mean PEEP effect is already included in the core hemodynamic SV.
  // Apply only the cyclic excursion here to avoid double counting.
  const deltaPleural=respOn?pleuralSwing*(breath-.5):0;
  const cv=window.simCardiovascularState||null;
  const cvNum=(key,fallback)=>Number.isFinite(Number(cv?.[key]))?Number(cv[key]):fallback;
  const sap=clamp(cvNum('sap',num('sap',98)),30,240),dap=clamp(cvNum('dap',num('dap',48)),10,160);
  const baseSV=clamp(cvNum('sv',num('sv',36)),3,160);
  const preload=clamp(cvNum('preload',num('preload',100)),20,180)/100;
  const contract=clamp(cvNum('contractility',window.macEffectiveContractility||num('contractility',100))/100,.2,2);
  const tone=clamp(cvNum('tone',window.macEffectiveTone||num('vascularTone',100))/100,.3,2.2);
  const effectiveContract=contract;
  const afterload=clamp((sap*.7+dap*.3)/85*.75+tone*.25,.35,2.3);
  // End-systolic elastance is a teaching parameter (mmHg/mL), not measured.
  const v0=clamp(4+baseSV*.08,3,20);
  const emax=clamp(3.3*effectiveContract,0.55,8);
  // Ea is read from the same PRAM state; Pes = Ea * SV.
  // Using the instantaneous respiratory SV keeps the red Ea line's slope
  // identical to the displayed PRAM Ea throughout the respiratory cycle.
  const sharedEa=clamp(cvNum('ea',num('ea',2.5)),.01,15);
  // One end-systolic intersection shared by ESPVR and effective arterial
  // elastance: Pes = Ea * SV = Ees * (ESV - V0).
  // The hemodynamic engine remains authoritative for SV and Ea.
  const ees=emax;
  // Inspiratory pleural pressure reduces venous filling. Reduced LV
  // contractility from the shared engine increases afterload sensitivity.
  const fillingSensitivity=clamp(.008+Math.max(0,100-cvNum('preload',100))*.00012,.008,.018);
  const respFilling=respOn?clamp(-deltaPleural*fillingSensitivity,-.16,.16):0;
  const dysfunction=clamp((1-effectiveContract)/.65,0,1);
  const afterloadRelief=respOn?clamp(deltaPleural*.006*dysfunction,-.07,.07):0;
  const sv=clamp(baseSV*(1+respFilling+afterloadRelief),3,160);
  const endP=sharedEa*sv;
  const transmuralPes=Math.max(1,endP-pleuralPressure);
  const esv=v0+transmuralPes/ees;
  const edv=esv+sv;
  const peak=clamp(Math.max(sap*1.06,endP*1.12,dap+10),40,300);
  const compliance=clamp(cvNum('compliance',num('compliance',100))/100,.4,1.8);
  // EDPVR exponential, anchored at the current end-diastolic pressure.
  // Beta is an illustrative stiffness coefficient (1/mL), not a measured value.
  const beta=clamp(.028/compliance,.012,.075);
  const pMin=3;
  const edp=clamp(pMin+6.5*preload*Math.pow(edv/75,1.6),3.2,35);
  const diastolicP=v=>pMin+(edp-pMin)*Math.expm1(beta*Math.max(0,v-esv))/Math.max(1e-6,Math.expm1(beta*sv));
  const stiffness=(edp-pMin)*beta*Math.exp(beta*sv)/Math.max(1e-6,Math.expm1(beta*sv));
  // ESPVR slope Ees, with its reference point at the end-systolic volume.
  // The model remains illustrative: V0 and Ees are not invasively measured.
  // E(t) rises through isovolumetric contraction and falls in relaxation.
  const elastance=(t)=>.5-.5*Math.cos(Math.PI*clamp(t,0,1));
  const maxV=Math.max(130,Math.ceil((Math.max(edv,reference?.edv||0)+15)/25)*25),maxP=Math.max(150,Math.ceil((Math.max(peak,endP,reference?.peak||0)+20)/25)*25);
  const left=43,right=W-14,top=14,bottom=H-33;
  const x=v=>left+v/maxV*(right-left),y=p=>bottom-p/maxP*(bottom-top);
  ctx.clearRect(0,0,W,H);ctx.font='10px system-ui';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const v=i*maxV/4,p=i*maxP/4;ctx.strokeStyle='#1d3846';ctx.beginPath();ctx.moveTo(x(v),top);ctx.lineTo(x(v),bottom);ctx.moveTo(left,y(p));ctx.lineTo(right,y(p));ctx.stroke();ctx.fillStyle='#93adbb';ctx.textAlign='center';ctx.fillText(String(Math.round(v)),x(v),bottom+14);ctx.textAlign='right';ctx.fillText(String(Math.round(p)),left-7,y(p)+3)}
  ctx.fillStyle='#a9c5d1';ctx.textAlign='center';ctx.fillText('Volume ventricolare (mL)',(left+right)/2,H-4);
  ctx.save();ctx.translate(11,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.fillText('Pressione (mmHg)',0,0);ctx.restore();
  const trace=(points,color,dashed=false)=>{ctx.save();ctx.strokeStyle=color;ctx.lineWidth=dashed?2.4:3;ctx.lineJoin='round';ctx.setLineDash(dashed?[6,5]:[]);ctx.beginPath();points.forEach(([v,p],i)=>i?ctx.lineTo(x(v),y(p)):ctx.moveTo(x(v),y(p)));ctx.stroke();ctx.restore()};
  const fill=[],isoC=[],eject=[],isoR=[];
  // Four continuous phases: filling -> isovolumetric contraction ->
  // ejection -> isovolumetric relaxation. The isovolumetric pressure
  // follows a smooth time-varying elastance trajectory.
  for(let i=0;i<=48;i++){const t=i/48;const v=esv+sv*t;fill.push([v,diastolicP(v)])}
  const openP=Math.min(Math.max(dap+2,edp+8),endP*.93);
  for(let i=0;i<=36;i++){const t=i/36;isoC.push([edv,edp+(openP-edp)*elastance(t)])}
  for(let i=0;i<=64;i++){
   const t=i/64,v=edv-sv*t;
   const p=openP+(endP-openP)*t+(peak-Math.max(openP,endP))*Math.sin(Math.PI*t);
   eject.push([v,p]);
  }
  for(let i=0;i<=36;i++){const t=i/36;isoR.push([esv,endP+(3-endP)*elastance(t)])}
  // ESPVR is drawn as a separate dashed guide, not as the ejection phase.
  const espvrP=esvP=>pleuralPressure+ees*(esvP-v0);
  const guideEnd=clamp(esv+(maxP-endP)/ees,esv+5,maxV);
  const guideStart=clamp(v0,0,esv);
  ctx.save();ctx.strokeStyle='#ffad70';ctx.lineWidth=1.4;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(x(guideStart),y(Math.max(0,espvrP(guideStart))));ctx.lineTo(x(guideEnd),y(Math.min(maxP,espvrP(guideEnd))));ctx.stroke();ctx.restore();
  // Effective arterial elastance Ea = end-systolic pressure / stroke volume.
  // The negative slope joins (EDV, 0) to the end-systolic point (ESV, Pes).
  // This is a lumped ventricular-arterial coupling index, not arterial stiffness.
  const ea=sharedEa; // Single source: PRAM and PV-loop share effective arterial elastance.
  ctx.save();ctx.strokeStyle='#ff5757';ctx.lineWidth=2;ctx.setLineDash([7,5]);
  ctx.beginPath();ctx.moveTo(x(edv),y(0));ctx.lineTo(x(esv),y(endP));ctx.stroke();ctx.restore();
  current={edv,peak,segments:[fill,isoC,eject,isoR]};
 if(reference){reference.segments.forEach(seg=>trace(seg,'#a5b3bd',true))}
 trace(fill,'#3dd5bb');trace(isoC,'#f3c969');trace(eject,'#60b8ff');trace(isoR,'#d19afa');
  // Publish geometric data, not a second physiology calculation, for
  // the external read-only student display. Throttle to ~5 Hz.
  if(!document.body.classList.contains('student')&&Date.now()-(window.__lastStudentPvPublish||0)>190){
   window.__lastStudentPvPublish=Date.now();
   try{localStorage.setItem('sim_v30_student_pv',JSON.stringify({
    at:Date.now(),maxV,maxP,edv,esv,sv,ees,ea,endP,v0,pleuralPressure,
    segments:current.segments,reference:reference?.segments||null
   }))}catch(e){}
  }
  const cells=[['EDV',edv.toFixed(0)+' mL'],['ESV',esv.toFixed(0)+' mL'],['SV',sv.toFixed(0)+' mL'],['FE stimata',(100*sv/edv).toFixed(0)+'%'],['Ees (ESPVR)',ees.toFixed(2)+' mmHg/mL'],['Pes (cavitaria)',endP.toFixed(0)+' mmHg'],['Pes transmurale',transmuralPes.toFixed(0)+' mmHg'],['P pleurica stimata',pleuralPressure.toFixed(1)+' mmHg'],['PEEP totale',peep.toFixed(1)+' cmH₂O'],['Ea (PRAM / loop)',ea.toFixed(2)+' mmHg/mL'],['Ea/Ees',(ea/ees).toFixed(2)],['Rigidità TD (dP/dV)',stiffness.toFixed(3)+' mmHg/mL'],['Pressione TD',edp.toFixed(0)+' mmHg'],['Fase respiratoria',respOn?(respPhase<inspFraction?'Inspirazione':'Espirazione'):'Non modulata'],['V₀ ipotizzato',v0.toFixed(0)+' mL']];
  get('lvPvValues').innerHTML=cells.map(([k,v])=>'<div class="lv-pv-value"><small>'+k+'</small><b>'+v+'</b></div>').join('');
  if(hiddenPanel)panel.style.display='';
 }
 const obs=new MutationObserver(draw);obs.observe(document.body,{attributes:true,attributeFilter:['data-instructor-tab','class']});
 document.addEventListener('input',draw,true);document.addEventListener('change',draw,true);window.addEventListener('resize',draw);
 setInterval(draw,180);draw();
 // The student view receives only already-computed PV geometry.
 const initStudentPv=()=>{
 const studentCanvas=get('studentPvCanvas');
 if(studentCanvas&&!studentCanvas.dataset.pvInitialized){
  studentCanvas.dataset.pvInitialized='1';
  let studentData=null;
  const paintStudent=()=>{
   if(!document.body.classList.contains('student')||!studentData||!studentCanvas.isConnected)return;
   const parent=get('studentPvSide');if(!parent||parent.hidden)return;
   const rect=studentCanvas.getBoundingClientRect();if(rect.width<40)return;
   const ratio=Math.min(2,window.devicePixelRatio||1);
   studentCanvas.width=Math.round(rect.width*ratio);studentCanvas.height=Math.round(rect.height*ratio);
   const c=studentCanvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);
   const W=rect.width,H=rect.height,L=39,R=W-12,T=12,B=H-29;
   const x=v=>L+v/studentData.maxV*(R-L),y=p=>B-p/studentData.maxP*(B-T);
   c.clearRect(0,0,W,H);c.font='10px system-ui';c.lineWidth=1;
   for(let i=0;i<=4;i++){
    const v=i*studentData.maxV/4,p=i*studentData.maxP/4;
    c.strokeStyle='#1d3846';c.beginPath();c.moveTo(x(v),T);c.lineTo(x(v),B);c.moveTo(L,y(p));c.lineTo(R,y(p));c.stroke();
    c.fillStyle='#9ab4c0';c.textAlign='center';c.fillText(Math.round(v),x(v),B+13);c.textAlign='right';c.fillText(Math.round(p),L-5,y(p)+3);
   }
   c.fillStyle='#a9c5d1';c.textAlign='center';c.fillText('Volume (mL)',(L+R)/2,H-3);
   const line=(points,color,dash=[])=>{
    if(!points?.length)return;c.save();c.strokeStyle=color;c.lineWidth=dash.length?1.7:2.5;c.setLineDash(dash);c.beginPath();
    points.forEach(([v,p],i)=>i?c.lineTo(x(v),y(p)):c.moveTo(x(v),y(p)));c.stroke();c.restore();
   };
   if(studentData.reference)studentData.reference.forEach(seg=>line(seg,'#a5b3bd',[5,4]));
   const {ees,ea,esv,edv,endP,v0,pleuralPressure,maxP,maxV}=studentData;
   line([[v0,pleuralPressure],[Math.min(maxV,esv+(maxP-endP)/ees),Math.min(maxP,pleuralPressure+ees*(Math.min(maxV,esv+(maxP-endP)/ees)-v0))]],'#ffad70',[3,5]);
   line([[edv,0],[esv,endP]],'#ff5757',[7,5]);
   ['#3dd5bb','#f3c969','#60b8ff','#d19afa'].forEach((color,i)=>line(studentData.segments[i],color));
   const readings=get('studentPvReadings');
   if(readings)readings.innerHTML=[['SV',studentData.sv.toFixed(0)+' mL'],['Ees',ees.toFixed(2)],['Ea',ea.toFixed(2)],['EDV',edv.toFixed(0)+' mL'],['ESV',esv.toFixed(0)+' mL'],['Pes',endP.toFixed(0)+' mmHg']].map(([k,v])=>'<div><small>'+k+'</small>'+v+'</div>').join('');
  };
  const receive=raw=>{try{const d=JSON.parse(raw);if(d&&Array.isArray(d.segments)){studentData=d;paintStudent()}}catch(e){}};
  window.addEventListener('storage',e=>{if(e.key==='sim_v30_student_pv'&&e.newValue)receive(e.newValue)});
  receive(localStorage.getItem('sim_v30_student_pv'));
  setInterval(paintStudent,550);
 }
 };
 initStudentPv();
 // Student monitor layout is constructed later by index.html.
 document.addEventListener('DOMContentLoaded',initStudentPv);
 const studentInitTimer=setInterval(()=>{initStudentPv();if(get('studentPvCanvas'))clearInterval(studentInitTimer)},300);
})();

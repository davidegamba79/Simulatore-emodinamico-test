/* Experimental teaching-only left ventricular pressure-volume loop. */
(()=>{
 const get=id=>document.getElementById(id);
 const num=(id,fallback)=>{const el=get(id);const v=Number(el?.value);return el&&Number.isFinite(v)?v:fallback};
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 let reference=null;
 const panel=document.createElement('section');
 panel.id='lvPvTeaching';panel.className='card instructor-only';
 panel.innerHTML='<h2>Ventricolo sinistro — curva pressione/volume (modello didattico)</h2><p class="lv-pv-note">Modello didattico ispirato a Suga–Sagawa (elastanza variabile) e Denault–Gorcsan–Pinsky (interazione con ventilazione a pressione positiva). Il loop varia con emodinamica e fase respiratoria; non è una misurazione ventricolare. Il tratteggio grigio conserva il loop prima della terapia.</p><div class="lv-pv-actions"><label style="font-size:11px;color:#a9c2ce"><input type="checkbox" id="lvPvResp" checked> Modula con il respiro</label><label style="font-size:11px;color:#a9c2ce"><input type="checkbox" id="lvPvFail"> Funzione ventricolare depressa (scenario)</label><button type="button" id="lvPvSave">Memorizza loop di riferimento</button><button type="button" id="lvPvClear">Rimuovi riferimento</button><span id="lvPvRefStatus">Nessun riferimento salvato</span></div><div class="lv-pv-layout"><canvas id="lvPvCanvas" aria-label="Loop pressione volume del ventricolo sinistro" role="img"></canvas><div class="lv-pv-values" id="lvPvValues"></div></div><div class="lv-pv-legend"><span>● Riempimento</span><span>● Contrazione isovolumetrica</span><span>● Eiezione</span><span>● Rilasciamento isovolumetrico</span></div>';
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
 .lv-pv-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(125px,1fr);gap:12px;align-items:center}
 #lvPvCanvas{width:100%;height:260px;display:block;background:#081923;border:1px solid #244351;border-radius:8px}
 .lv-pv-values{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
 .lv-pv-value{background:#081923;border:1px solid #244351;border-radius:7px;padding:8px 6px}
 .lv-pv-value small{display:block;color:#9ab1be;font-size:10px}
 .lv-pv-value b{display:block;color:#e5f5fa;font-size:17px;margin-top:3px}
 .lv-pv-legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:7px;font-size:10px;color:#a6bfcb}
 .lv-pv-legend span:nth-child(1){color:#3dd5bb}.lv-pv-legend span:nth-child(2){color:#f3c969}.lv-pv-legend span:nth-child(3){color:#60b8ff}.lv-pv-legend span:nth-child(4){color:#d19afa}
 @media(max-width:900px){.lv-pv-layout{grid-template-columns:1fr}#lvPvCanvas{height:230px}}
 `;document.head.appendChild(css);
 const canvas=get('lvPvCanvas'),ctx=canvas.getContext('2d');let current=null;
 let respPhase=0,lastRenderAt=performance.now(),phaseClock=0;
 get('lvPvResp').addEventListener('change',draw);get('lvPvFail').addEventListener('change',draw);
 get('lvPvSave').addEventListener('click',()=>{if(!current)return;reference=JSON.parse(JSON.stringify(current));get('lvPvRefStatus').textContent='Riferimento salvato · tratteggio grigio';draw()});
 get('lvPvClear').addEventListener('click',()=>{reference=null;get('lvPvRefStatus').textContent='Nessun riferimento salvato';draw()});
 function draw(){
  if(getComputedStyle(panel).display==='none')return;
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
  const paused=!!window.simWaveIsPaused;
  if(!paused)phaseClock+=dt;
  respPhase=(phaseClock*rr/60)%1;
  const respSwing=Math.sin(2*Math.PI*respPhase-.5);
  const respOn=get('lvPvResp').checked&&controlled;
  const transmitted=clamp(Number(vent?.transmittedPressure)||0,0,16);
  const pressureCoupling=respOn?clamp(.018+transmitted*.006,.018,.10):0;
  const failure=get('lvPvFail').checked;
  const sap=clamp(num('sap',98),30,240),dap=clamp(num('dap',48),10,160);
  const baseSV=clamp(num('sv',36),3,160);
  const preload=clamp(num('preload',100),20,180)/100;
  const contract=clamp((window.macEffectiveContractility||num('contractility',100))/100,.2,2);
  const tone=clamp((window.macEffectiveTone||num('vascularTone',100))/100,.3,2.2);
  const effectiveContract=contract*(failure?.47:1);
  const afterload=clamp((sap*.7+dap*.3)/85*.75+tone*.25,.35,2.3);
  // End-systolic elastance is a teaching parameter (mmHg/mL), not measured.
  const v0=clamp(4+baseSV*.08,3,20);
  const emax=clamp(3.3*effectiveContract,0.55,8);
  const peak=clamp(sap*1.06,40,255);
  // ESPVR: end-systolic volume is determined by end-systolic pressure/Emax.
  const esv0=v0+Math.max(10,sap*.88)/emax;
  const edv0=esv0+baseSV;
  // Normal heart: positive-pressure breaths chiefly reduce filling.
  // Depressed ventricle: reduced transmural afterload partly offsets this.
  const respFilling=respOn?(-pressureCoupling*respSwing*(failure?.42:1)):0;
  const respEjection=respOn&&failure?pressureCoupling*.38*respSwing:0;
  const edv=clamp(edv0*(1+respFilling),baseSV+v0+5,260);
  const sv=clamp(baseSV*(1+respFilling*.8+respEjection),3,Math.max(3,edv-v0-3));
  const esv=edv-sv;
  const edp=clamp(3+6.5*preload*Math.pow(edv/75,1.6),3,35);
  // E(t) rises through isovolumetric contraction and falls in relaxation.
  const elastance=(t)=>.5-.5*Math.cos(Math.PI*clamp(t,0,1));
  const maxV=Math.max(130,Math.ceil((Math.max(edv,reference?.edv||0)+15)/25)*25),maxP=Math.max(150,Math.ceil((Math.max(peak,reference?.peak||0)+20)/25)*25);
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
  for(let i=0;i<=48;i++){const t=i/48;fill.push([esv+sv*t,3+(edp-3)*Math.pow(t,3)])}
  const openP=Math.max(dap+2,edp+8),endP=clamp(sap*.82,openP*.7,peak);
  for(let i=0;i<=36;i++){const t=i/36;isoC.push([edv,edp+(openP-edp)*elastance(t)])}
  for(let i=0;i<=64;i++){
   const t=i/64,v=edv-sv*t;
   const p=openP+(endP-openP)*t+(peak-Math.max(openP,endP))*Math.sin(Math.PI*t);
   eject.push([v,p]);
  }
  for(let i=0;i<=36;i++){const t=i/36;isoR.push([esv,endP+(3-endP)*elastance(t)])}
  current={edv,peak,segments:[fill,isoC,eject,isoR]};
 if(reference){reference.segments.forEach(seg=>trace(seg,'#a5b3bd',true))}
 trace(fill,'#3dd5bb');trace(isoC,'#f3c969');trace(eject,'#60b8ff');trace(isoR,'#d19afa');
  const cells=[['EDV',edv.toFixed(0)+' mL'],['ESV',esv.toFixed(0)+' mL'],['SV',sv.toFixed(0)+' mL'],['FE stimata',(100*sv/edv).toFixed(0)+'%'],['Emax didattica',emax.toFixed(2)+' mmHg/mL'],['Pressione TD',edp.toFixed(0)+' mmHg'],['Fase respiratoria',respOn?(respSwing>0?'Inspirazione':'Espirazione'):'Non modulata'],['V₀ ipotizzato',v0.toFixed(0)+' mL']];
  get('lvPvValues').innerHTML=cells.map(([k,v])=>'<div class="lv-pv-value"><small>'+k+'</small><b>'+v+'</b></div>').join('');
 }
 const obs=new MutationObserver(draw);obs.observe(document.body,{attributes:true,attributeFilter:['data-instructor-tab','class']});
 document.addEventListener('input',draw,true);document.addEventListener('change',draw,true);window.addEventListener('resize',draw);
 setInterval(draw,180);draw();
})();

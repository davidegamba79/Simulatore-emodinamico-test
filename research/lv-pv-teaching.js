  // Increased pleural pressure reduces venous filling; in depressed
  // ventricles, reduced LV transmural afterload can partly compensate.
  const respFilling=respOn?clamp(-deltaPleural*fillingSensitivity,-.16,.16):0;
  const afterloadRelief=respOn&&failure?clamp(deltaPleural*.006,-.07,.07):0;
  const sv=clamp(baseSV*(1+respFilling+afterloadRelief),3,160);
  // Intracavitary Pes remains tied to PRAM Ea. Transmural Pes subtracts
  // the external pleural pressure; the ESPVR is plotted in cavity
  // coordinates by adding that external pressure back.
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
  const cells=[['EDV',edv.toFixed(0)+' mL'],['ESV',esv.toFixed(0)+' mL'],['SV',sv.toFixed(0)+' mL'],['FE stimata',(100*sv/edv).toFixed(0)+'%'],['Ees (ESPVR)',ees.toFixed(2)+' mmHg/mL'],['Pes (cavitaria)',endP.toFixed(0)+' mmHg'],['Pes transmurale',transmuralPes.toFixed(0)+' mmHg'],['P intratoracica stimata',pleuralPressure.toFixed(1)+' mmHg'],['PEEP totale',peep.toFixed(1)+' cmH₂O'],['Ea (PRAM / loop)',ea.toFixed(2)+' mmHg/mL'],['Ea/Ees',(ea/ees).toFixed(2)],['Rigidità TD (dP/dV)',stiffness.toFixed(3)+' mmHg/mL'],['Pressione TD',edp.toFixed(0)+' mmHg'],['Fase respiratoria',respOn?(respPhase<inspFraction?'Inspirazione':'Espirazione'):'Non modulata'],['V₀ ipotizzato',v0.toFixed(0)+' mL']];
  get('lvPvValues').innerHTML=cells.map(([k,v])=>'<div class="lv-pv-value"><small>'+k+'</small><b>'+v+'</b></div>').join('');
 }
 const obs=new MutationObserver(draw);obs.observe(document.body,{attributes:true,attributeFilter:['data-instructor-tab','class']});
 document.addEventListener('input',draw,true);document.addEventListener('change',draw,true);window.addEventListener('resize',draw);
 setInterval(draw,180);draw();
})();

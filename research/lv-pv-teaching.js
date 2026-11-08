/* Experimental teaching-only left ventricular pressure-volume loop. */
(()=>{
 const get=id=>document.getElementById(id);
 const num=(id,fallback)=>{const el=get(id);const v=Number(el?.value);return el&&Number.isFinite(v)?v:fallback};
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const panel=document.createElement('section');
 panel.id='lvPvTeaching';panel.className='card instructor-only';
 panel.innerHTML='<h2>Ventricolo sinistro — curva pressione/volume (modello didattico)</h2><p class="lv-pv-note">Il loop si modifica con precarico, contrattilità, postcarico, pressione arteriosa e gittata sistolica. Stima illustrativa, non misurazione ventricolare.</p><div class="lv-pv-layout"><canvas id="lvPvCanvas" aria-label="Loop pressione volume del ventricolo sinistro" role="img"></canvas><div class="lv-pv-values" id="lvPvValues"></div></div><div class="lv-pv-legend"><span>● Riempimento</span><span>● Contrazione isovolumetrica</span><span>● Eiezione</span><span>● Rilasciamento isovolumetrico</span></div>';
 const anchor=document.querySelector('.hemo-wrap');if(!anchor)return;
 anchor.insertAdjacentElement('afterend',panel);
 const css=document.createElement('style');css.textContent=`
 #lvPvTeaching{display:none;margin-top:8px;padding:12px}
 body:not(.student)[data-instructor-tab="hemodynamics"] #lvPvTeaching,
 body:not(.student)[data-instructor-tab="hemo"] #lvPvTeaching,
 body:not(.student)[data-instructor-tab="therapy"] #lvPvTeaching{display:block}
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
 const canvas=get('lvPvCanvas'),ctx=canvas.getContext('2d');let lastKey='',lastWidth=0;
 function draw(){
  if(getComputedStyle(panel).display==='none')return;
  const box=canvas.getBoundingClientRect();if(box.width<20)return;
  const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(box.width*dpr),h=Math.round(box.height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  ctx.setTransform(dpr,0,0,dpr,0,0);const W=box.width,H=box.height;
  const sv=clamp(num('sv',36),3,160),sap=clamp(num('sap',98),30,240),dap=clamp(num('dap',48),10,160);
  const preload=clamp(num('preload',100),20,180)/100,contract=clamp(num('contractility',100),20,180)/100,tone=clamp(num('vascularTone',100),30,180)/100;
  const afterload=clamp((sap*.7+dap*.3)/85*.75+tone*.25,.35,2.3);
  const ef=clamp(.55*Math.pow(contract,.43)/Math.pow(afterload,.22),.28,.78);
  const edv=clamp(sv/ef,sv+5,250),esv=edv-sv;
  const edp=clamp(4+7*preload*Math.pow(edv/70,.45),3,28);
  const peak=clamp(sap*1.06,40,255);
  const maxV=Math.max(130,Math.ceil((edv+15)/25)*25),maxP=Math.max(150,Math.ceil((peak+20)/25)*25);
  const left=43,right=W-14,top=14,bottom=H-33;
  const x=v=>left+v/maxV*(right-left),y=p=>bottom-p/maxP*(bottom-top);
  ctx.clearRect(0,0,W,H);ctx.font='10px system-ui';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const v=i*maxV/4,p=i*maxP/4;ctx.strokeStyle='#1d3846';ctx.beginPath();ctx.moveTo(x(v),top);ctx.lineTo(x(v),bottom);ctx.moveTo(left,y(p));ctx.lineTo(right,y(p));ctx.stroke();ctx.fillStyle='#93adbb';ctx.textAlign='center';ctx.fillText(String(Math.round(v)),x(v),bottom+14);ctx.textAlign='right';ctx.fillText(String(Math.round(p)),left-7,y(p)+3)}
  ctx.fillStyle='#a9c5d1';ctx.textAlign='center';ctx.fillText('Volume ventricolare (mL)',(left+right)/2,H-4);
  ctx.save();ctx.translate(11,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.fillText('Pressione (mmHg)',0,0);ctx.restore();
  const trace=(points,color)=>{ctx.strokeStyle=color;ctx.lineWidth=3;ctx.lineJoin='round';ctx.beginPath();points.forEach(([v,p],i)=>i?ctx.lineTo(x(v),y(p)):ctx.moveTo(x(v),y(p)));ctx.stroke()};
  const fill=[],isoC=[],eject=[],isoR=[];
  for(let i=0;i<=48;i++){const t=i/48;const v=esv+sv*t;fill.push([v,3+(edp-3)*Math.pow(t,3)])}
  for(let i=0;i<=30;i++){const t=i/30;isoC.push([edv,edp+(peak-edp)*(.5-.5*Math.cos(Math.PI*t))])}
  for(let i=0;i<=60;i++){const t=i/60;const v=edv-sv*t;const p=dap+(peak-dap)*Math.sin(Math.PI*Math.pow(t,.75))*.78+(peak-dap)*.20*(1-t);eject.push([v,Math.max(dap,p)])}
  // End of ejection at aortic closing pressure; relaxation returns to filling pressure.
  const closeP=eject[eject.length-1][1];
  for(let i=0;i<=30;i++){const t=i/30;isoR.push([esv,closeP+(3-closeP)*(.5-.5*Math.cos(Math.PI*t))])}
  trace(fill,'#3dd5bb');trace(isoC,'#f3c969');trace(eject,'#60b8ff');trace(isoR,'#d19afa');
  const cells=[['EDV',edv.toFixed(0)+' mL'],['ESV',esv.toFixed(0)+' mL'],['SV',sv.toFixed(0)+' mL'],['FE stimata',(100*sv/edv).toFixed(0)+'%'],['P sistolica',sap.toFixed(0)+' mmHg'],['Pressione TD',edp.toFixed(0)+' mmHg']];
  get('lvPvValues').innerHTML=cells.map(([k,v])=>'<div class="lv-pv-value"><small>'+k+'</small><b>'+v+'</b></div>').join('');
 }
 const obs=new MutationObserver(draw);obs.observe(document.body,{attributes:true,attributeFilter:['data-instructor-tab','class']});
 document.addEventListener('input',draw,true);document.addEventListener('change',draw,true);window.addEventListener('resize',draw);
 setInterval(draw,700);draw();
})();

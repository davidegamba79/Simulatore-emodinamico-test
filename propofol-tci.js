(()=>{'use strict';
const $=id=>document.getElementById(id);
const now=()=>window.simVirtualNow?.()||performance.now();
const tci={active:false,target:3.5,rate:0,total:0,history:[],lastSample:-Infinity,mode:'inhaled'};
window.simPropofolTCIRate=(i,p,dt,t)=>{
 if(!tci.active||i.phase!=='maintenance')return 0;
 const cp=i.pk.central/p.vc,ce=i.pk.ce;
 // Predictive effect-site controller, 30 s horizon, positive infusion only.
 // This is a teaching algorithm, not a validated clinical pump.
 const horizon=.5,ke=p.ke0,ef=Math.exp(-ke*horizon);
 const desiredCp=(tci.target-ce*ef)/(1-ef);
 const peripheral=(p.qf*(cp-i.pk.fast/p.vf)+p.qs*(cp-i.pk.slow/p.vs)+p.cl*cp);
 const mgKgMin=Math.max(0,Math.min(.8,(desiredCp-cp)*p.vc/horizon+peripheral));
 tci.rate=mgKgMin*60;
 return mgKgMin/60;
};
window.simPropofolTCIStep=(i,p,dt,rate,t)=>{
 if(tci.active&&i.phase==='maintenance')tci.total+=rate*dt;
 if(t-tci.lastSample>=1000){tci.lastSample=t;tci.history.push({t,cp:i.pk.central/p.vc,ce:i.pk.ce});if(tci.history.length>1800)tci.history.shift();}
};
function draw(canvas,rows,unit){
 if(!canvas)return;
 const rect=canvas.getBoundingClientRect();if(rect.width<10)return;
 const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(rect.width*dpr),h=Math.round(160*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w/dpr,h/dpr);
 const W=w/dpr,H=h/dpr,L=35,R=W-10,T=12,B=H-23;
 ctx.strokeStyle='#52616d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(L,T);ctx.lineTo(L,B);ctx.lineTo(R,B);ctx.stroke();
 const latest=rows.at(-1)?.t||now(),first=Math.max(rows[0]?.t||latest,latest-30*60000);
 const pts=rows.filter(p=>p.t>=first),max=Math.max(1,...pts.flatMap(p=>[p.cp||0,p.ce||0]))*1.15;
 ctx.fillStyle='#c4d0dc';ctx.font='11px sans-serif';ctx.fillText(max.toFixed(1),3,18);ctx.fillText('0',19,B);ctx.fillText('−30 min',L,B+16);ctx.fillText('Ora',R-20,B+16);
 for(const [key,color] of [['cp','#36c9ff'],['ce','#f3b85c']]){
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();
  pts.forEach((p,j)=>{const x=L+(p.t-first)/Math.max(1000,latest-first)*(R-L),y=B-(Math.max(0,p[key]||0)/max)*(B-T);if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke();
 }
}
function setup(){
 if(document.body.classList.contains('student'))return;
 const induction=$('inductionPanel'),mac=$('mac'),inhaled=$('instructorInhaledCard'),fent=$('fentanylPanel');if(!induction||!mac||!inhaled)return;
 const control=document.createElement('div');control.id='propofolTCIControl';control.innerHTML='<div class="cols"><label>Mantenimento<select id="propMode"><option value="inhaled">Inalatorio (MAC)</option><option value="tiva">TIVA — TCI propofol (Ce)</option></select></label><label>Ce target (µg/mL)<input id="propTarget" type="number" min="1" max="8" step="0.1" value="3.5"></label></div><div class="row" style="margin-top:8px"><button type="button" id="propStart">Avvia TCI</button><button type="button" id="propStop">Interrompi TCI</button></div><div class="status" id="propStatus">TCI non attiva</div><div class="status" id="propStats">Cp — · Ce — · Infusione 0 mg/kg/h · Dose TCI 0 mg/kg</div><canvas id="propPKChart" style="width:100%;height:160px;display:block"></canvas><small>Cp azzurro · Ce arancione · Beths/Brás; controllo TCI didattico, non utilizzabile clinicamente.</small>';
 induction.insertBefore(control,induction.firstElementChild?.nextSibling||null);
 const fentChart=document.createElement('div');fentChart.innerHTML='<div class="status" id="fentPKStats">Cp — · Ce —</div><canvas id="fentPKChart" style="width:100%;height:160px;display:block"></canvas><small>Cp azzurro · Ce arancione · Sano per Cp; Ce illustrativa, non validata.</small>';if(fent){const controls=fent.querySelector('.cols');if(controls)controls.after(fentChart);else fent.append(fentChart);}
 const mode=$('propMode'),target=$('propTarget'),start=$('propStart'),stop=$('propStop');
 const sync=()=>{tci.mode=mode.value;const tiva=tci.mode==='tiva';inhaled.style.display=tiva?'none':'';mac.disabled=tiva;document.body.dataset.propofolMode=tci.mode;if(!tiva){tci.active=false;tci.rate=0;}};
 mode.onchange=sync;
 start.onclick=()=>{const n=Number(target.value);if(mode.value!=='tiva'||!Number.isFinite(n)||n<1||n>8||!window.simAirwayIntubated)return;tci.target=n;tci.active=true;};
 stop.onclick=()=>{tci.active=false;tci.rate=0;};
 target.onchange=()=>{const n=Number(target.value);if(Number.isFinite(n)&&n>=1&&n<=8)tci.target=n;else target.value=tci.target;};
 const i=()=>window.simPropofolState?.();
 function frame(){
  const state=i();const p=state?.pk;
  if(p){const cp=p.central/.78;const ce=p.ce;$('propStats').textContent='Cp '+cp.toFixed(2)+' · Ce '+ce.toFixed(2)+' µg/mL · Infusione '+(tci.active?tci.rate:0).toFixed(2)+' mg/kg/h · Dose TCI '+tci.total.toFixed(2)+' mg/kg';}
  $('propStatus').textContent=tci.active?'TCI attiva · Ce target '+tci.target.toFixed(1)+' µg/mL':'TCI non attiva';
  start.disabled=mode.value!=='tiva'||!window.simAirwayIntubated||tci.active;
  stop.disabled=!tci.active;
  if(mode.value==='tiva'){inhaled.style.display='none';mac.disabled=true;}
  draw($('propPKChart'),tci.history);
  if(typeof window.simFentanylPK==='function'){
   const f=window.simFentanylPK(now());if(f){$('fentPKStats').textContent='Cp '+f.cp.toFixed(2)+' · Ce '+f.ce.toFixed(2)+' ng/mL';draw($('fentPKChart'),f.history);}
  }
  requestAnimationFrame(frame);
 }
 sync();requestAnimationFrame(frame);
}
window.simPropofolTCI=tci;
if(document.readyState==='complete')setTimeout(setup,0);else document.addEventListener('DOMContentLoaded',()=>setTimeout(setup,0),{once:true});
})();
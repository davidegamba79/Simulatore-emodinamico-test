(()=>{'use strict';
const $=id=>document.getElementById(id), targets=Array.from({length:15},(_,i)=>(.6+i*.1).toFixed(1));
const bolus=[.8,1,1.2,1.4,1.5,1.6,1.8,1.8,2.1,2.2,2.2,2.5,2.6,2.7,2.8];
const times=[0,5,10,15,20,30,45,75,105];
const rates=[
[8,8,9,10,12,13,15,16,16,18,20,20,22,23,25],
[6,7.5,8.5,9.5,10,11,12,14,14.5,15,16,18,18,20,21],
[5.5,6.5,7.5,8.5,9,10,11,12,12.5,14,14,16,16,17,18],
[5.2,6.2,6.8,7.3,8,8.7,10,10,11,12,13,13,15,15,16],
[4,5,5.8,6.5,7,7.8,8.5,9.5,9.5,11,11,12,13,14,14],
[3.7,4,4.8,5.3,6,6.3,7,7.5,8,8.7,9.5,9.8,11,11,11.5],
[3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.6,8.9,9.5,10],
[3,3.5,3.8,4.2,4.7,5.1,5.7,6,6.6,7,7.5,7.8,8.2,8.7,9],
[3,3.5,3.8,4.2,4.5,5.1,5.5,6,6.4,7,7.3,7.8,8.2,8.7,9]
];
let runs=[],events=[],active=null;
const bolusDurationMs=30000;
function addBolus(dose,t){events.push({time:t,dose,duration:bolusDurationMs})}
function delivered(e,t){return e.dose*Math.max(0,Math.min(1,(t-e.time)/(e.duration||bolusDurationMs)))}
// Modello didattico a risposta limitata: esposizione relativa da boli e infusione.
// Non e' il modello PK di Sano, ne' una stima di Cp clinicamente validata.
const tauFast=7,tauSlow=55;
function exposureAt(t){
 let sum=0;
 for(const e of events){const a=Math.max(0,(t-e.time)/60000),dur=(e.duration||bolusDurationMs)/60000,b=Math.max(0,a-dur);if(a>0){const coeff=e.dose/dur;sum+=coeff*(.65*tauFast*(Math.exp(-b/tauFast)-Math.exp(-a/tauFast))+.35*tauSlow*(Math.exp(-b/tauSlow)-Math.exp(-a/tauSlow)))}}
 for(const r of runs){
  const end=Math.min(t,r.end===null?Infinity:r.end);if(end<=r.start)continue;
  for(let j=0;j<times.length;j++){
   const start=r.start+times[j]*60000,stop=j+1<times.length?r.start+times[j+1]*60000:end;
   const b=Math.min(end,stop);if(b<=start)continue;
   const rate=rates[j][r.col]/60;
   const d1=(t-b)/60000,d2=(t-start)/60000;
   sum+=rate*(.65*tauFast*(Math.exp(-d1/tauFast)-Math.exp(-d2/tauFast))+.35*tauSlow*(Math.exp(-d1/tauSlow)-Math.exp(-d2/tauSlow)));
  }
 }
 return Math.max(0,sum);
}
window.simFentanylEffects=(t=now())=>{
 const exposure=exposureAt(t);
 const intensity=Math.min(1.5,exposure/(2.5+exposure)*1.5);
 return {exposure,intensity,analgesicIndex:Math.round(100*intensity/1.5)};
};

const now=()=>typeof window.simVirtualNow==='function'?window.simVirtualNow():performance.now();
window.simFentanylRewind=t=>{events=events.filter(e=>e.time<=t);runs=runs.filter(r=>r.start<=t);for(const r of runs)if(r.end!==null&&r.end>t)r.end=null;active=runs.length?runs[runs.length-1]:null;};
const kg=()=>Math.max(0,Number($('weight').value)||0);
const fmt=(n,d=2)=>Number(n).toFixed(d).replace('.',',');
function rateAt(minutes,col){let k=0;while(k+1<times.length&&minutes>=times[k+1])k++;return rates[k][col]}
function integrate(run,t){let end=Math.min(t,run.end===null?Infinity:run.end);let cursor=run.start;if(end<=cursor)return 0;let sum=0;while(cursor<end){let elapsed=(cursor-run.start)/60000,j=0;while(j+1<times.length&&elapsed>=times[j+1])j++;let boundary=j+1<times.length?run.start+times[j+1]*60000:end,next=Math.min(end,boundary);if(next<=cursor)break;sum+=rates[j][run.col]*(next-cursor)/3600000;cursor=next}return sum}
function refresh(){const t=now(),r=active&&active.start<=t&&active.end===null?active:null;
const pending=events.filter(e=>t>=e.time&&t<e.time+(e.duration||bolusDurationMs));
const latest=pending[pending.length-1];
$('fentBolusClock').textContent=latest?'Bolo EV in corso · 00:'+String(Math.min(30,Math.floor((t-latest.time)/1000))).padStart(2,'0')+' / 00:30':events.length?'Bolo completato · 00:30 / 00:30':'Pronto · 00:00 / 00:30';
$('fentBolusGive').disabled=Boolean(latest);
let total=events.reduce((a,e)=>a+delivered(e,t),0)+runs.reduce((a,v)=>a+integrate(v,t),0);

$('fentRate').textContent=fmt(r?rateAt((t-r.start)/60000,r.col):0)+' µg/kg/h';
$('fentElapsed').textContent=active?fmt(Math.max(0,(Math.min(t,active.end===null?t:active.end)-active.start)/60000),1)+' min':'—';
$('fentTotal').textContent=fmt(total)+' µg/kg · '+fmt(total*kg())+' µg';
$('fentState').textContent=r?'TCI attiva · target '+targets[r.col]+' ng/mL':'TCI non attiva';
$('fentStart').disabled=Boolean(r);$('fentStop').disabled=!r;
requestAnimationFrame(refresh)}
function log(message){$('fentLog').textContent=message+' · '+$('simTimeReadout').textContent}
$('fentStart').onclick=()=>{let t=now(),raw=Number($('fentTarget').value),col=Math.round((raw-.6)*10);if(!Number.isFinite(raw)||raw<.6||raw>2||Math.abs(raw-(.6+col*.1))>.00001||col<0||col>=targets.length||!kg())return;addBolus(bolus[col],t);active={start:t,end:null,col};runs.push(active);log('TCI avviata · bolo iniziale '+fmt(bolus[col])+' µg/kg')};
$('fentStop').onclick=()=>{if(!active||active.end!==null)return;active.end=now();log('TCI interrotta')};
$('fentBolusGive').onclick=()=>{let dose=Number($('fentBolus').value);if(!Number.isFinite(dose)||dose<=0||dose>20)return;addBolus(dose,now());log('Bolo aggiuntivo EV '+fmt(dose)+' µg/kg')};
$('fentTarget').onchange=()=>{if(active&&active.end===null)$('fentTarget').value=targets[active.col]};
refresh();
})();
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
const now=()=>typeof window.simVirtualNow==='function'?window.simVirtualNow():performance.now();
const kg=()=>Math.max(0,Number($('weight').value)||0);
const fmt=(n,d=2)=>Number(n).toFixed(d).replace('.',',');
function rateAt(minutes,col){let k=0;while(k+1<times.length&&minutes>=times[k+1])k++;return rates[k][col]}
function integrate(run,t){let end=Math.min(t,run.end===null?Infinity:run.end);let cursor=run.start;if(end<=cursor)return 0;let sum=0;while(cursor<end){let elapsed=(cursor-run.start)/60000,j=0;while(j+1<times.length&&elapsed>=times[j+1])j++;let boundary=j+1<times.length?run.start+times[j+1]*60000:end,next=Math.min(end,boundary);if(next<=cursor)break;sum+=rates[j][run.col]*(next-cursor)/3600000;cursor=next}return sum}
function refresh(){const t=now(),r=active&&active.start<=t&&active.end===null?active:null;
let total=events.filter(e=>e.time<=t).reduce((a,e)=>a+e.dose,0)+runs.reduce((a,v)=>a+integrate(v,t),0);
$('fentRate').textContent=fmt(r?rateAt((t-r.start)/60000,r.col):0)+' µg/kg/h';
$('fentElapsed').textContent=active?fmt(Math.max(0,(Math.min(t,active.end===null?t:active.end)-active.start)/60000),1)+' min':'—';
$('fentTotal').textContent=fmt(total)+' µg/kg · '+fmt(total*kg())+' µg';
$('fentState').textContent=r?'TCI attiva · target '+targets[r.col]+' ng/mL':'TCI non attiva';
$('fentStart').disabled=Boolean(r);$('fentStop').disabled=!r;
requestAnimationFrame(refresh)}
function log(message){$('fentLog').textContent=message+' · '+$('simTimeReadout').textContent}
$('fentStart').onclick=()=>{let t=now(),col=targets.indexOf($('fentTarget').value);if(col<0||!kg())return;events.push({time:t,dose:bolus[col]});active={start:t,end:null,col};runs.push(active);log('TCI avviata · bolo iniziale '+fmt(bolus[col])+' µg/kg')};
$('fentStop').onclick=()=>{if(!active||active.end!==null)return;active.end=now();log('TCI interrotta')};
$('fentBolusGive').onclick=()=>{let dose=Number($('fentBolus').value);if(!Number.isFinite(dose)||dose<=0||dose>20)return;events.push({time:now(),dose});log('Bolo aggiuntivo EV '+fmt(dose)+' µg/kg')};
$('fentTarget').onchange=()=>{if(active&&active.end===null)$('fentTarget').value=targets[active.col]};
refresh();
})();
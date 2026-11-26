(()=>{const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));let events=[],level=50,active=false;
const zero=()=>({sym:0,drive:0,async:0,metabolic:1});let state=zero();
window.simStimulusState=()=>state;
window.simStimulusReset=()=>{events=[];active=false;state=zero();render()};
window.simStimulusRewind=t=>{events=events.filter(e=>e.t<=t);active=events.at(-1)?.active||false;level=events.at(-1)?.level??level;state=events.at(-1)?.state||zero();render()};
window.simStimulusStudent=x=>{state=x||zero()};
window.simStimulusStep=(dt,t)=>{if(document.body.classList.contains('student'))return;
const ce=Math.max(0,window.simFentanylPK?.(t)?.ce||0),pm=window.simPremedAnalgesia?.(t)||0;
const f=ce/(2+ce),analgesia=1-(1-pm)*(1-.94*f);
const p=window.simPropofolState?.(),mac=Number(document.getElementById('mac')?.value)||0;
const tiva=document.body.dataset.propofolMode==='tiva',maintenance=p?.phase==='maintenance';
const hyp=tiva||!maintenance?clamp((p?.pk?.ce||0)/5,0,1.5):clamp(mac/1.5,0,1.5);
const inhaled=maintenance&&!tiva?clamp((mac-.6)*.25,0,.35):0;
const residual=(active?level/100:0)*(1-analgesia)*(1-inhaled);
const sym=clamp(residual*(1-.35*clamp(hyp/1.3)));
const drive=clamp((residual-.18)*1.65*(1-.65*clamp(hyp/1.2)));
const asy=clamp((drive-.12)*2.5);
const approach=(x,y,tau)=>x+(y-x)*(1-Math.exp(-dt/tau));
state={sym:approach(state.sym,sym,sym>state.sym?4:8),drive:approach(state.drive,drive,4),async:approach(state.async,asy,4),metabolic:1};
state.metabolic=1+.28*state.sym;render();
};
function record(){const t=window.simVirtualNow?.()||0;events.push({t,active,level,state:{...state}});if(typeof v25Event==='function')v25Event(active?'Stimolo chirurgico '+level+'%':'Stimolo chirurgico interrotto')}
function render(){const b=document.getElementById('stim101Button'),o=document.getElementById('stim101Level'),s=document.getElementById('stim101Range');if(!b)return;b.textContent=active?'Interrompi stimolo chirurgico':'Applica stimolo chirurgico';b.style.background=active?'#8b2028':'#c83240';o.textContent=level+'%';s.value=level;}
window.addEventListener('DOMContentLoaded',()=>{if(document.body.classList.contains('student'))return;const anchor=document.getElementById('inductionPanel');if(!anchor)return;const panel=document.createElement('section');panel.id='stim101Panel';panel.className='card';panel.innerHTML='<h2>Stimolo chirurgico</h2><label>Intensità <input id="stim101Range" type="range" min="0" max="100" step="5" value="50"><b id="stim101Level">50%</b></label><button type="button" id="stim101Button" style="width:100%;background:#c83240;color:white;margin-top:8px">Applica stimolo chirurgico</button>';anchor.after(panel);const css=document.createElement('style');css.textContent='#stim101Panel{display:none!important}body:not(.student)[data-instructor-tab="anesthesia"] #stim101Panel{display:block!important}';document.head.append(css);document.getElementById('stim101Range').oninput=e=>{level=Number(e.target.value);render()};document.getElementById('stim101Range').onchange=()=>{if(active)record()};document.getElementById('stim101Button').onclick=()=>{active=!active;record();render()};render()});
})();
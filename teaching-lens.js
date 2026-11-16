(()=>{'use strict';
if(new URLSearchParams(location.search).has('lensMirror'))return;
const KEY='simTeachingLensV1';
const student=document.body.classList.contains('student');
const state={enabled:false,x:.5,y:.5,zoom:2.5,locked:false};
let glass,stage,toolbar,lastDraw=0;
function publish(){if(student)return;try{localStorage.setItem(KEY,JSON.stringify({...state,updated:Date.now()}));}catch(_){}}
function setup(){
 const style=document.createElement('style');
 style.textContent=`
 #teachingLensToolbar{position:fixed;right:12px;bottom:12px;z-index:99990;background:#0b2632;border:1px solid #79a3b6;border-radius:10px;padding:7px;display:flex;gap:7px;align-items:center;color:#fff;font:13px system-ui;box-shadow:0 3px 18px #0009}
 #teachingLensToolbar button,#teachingLensToolbar select{background:#153b4a;color:white;border:1px solid #527a8b;border-radius:7px;padding:7px}
 #teachingLensGlass{position:fixed;z-index:99980;width:220px;height:220px;border:3px solid #e0f6ff;border-radius:50%;overflow:hidden;pointer-events:none;box-shadow:0 5px 30px #000b;background:#081721;display:none}
 #teachingLensStage{position:absolute;inset:0;overflow:hidden;pointer-events:none}
 #teachingLensStage .lens-copy{position:absolute;transform-origin:top left;pointer-events:none;max-width:none!important;max-height:none!important}
 body.student #teachingLensToolbar{display:none}
 `;
 document.head.append(style);
 glass=document.createElement('div');glass.id='teachingLensGlass';
 stage=document.createElement('div');stage.id='teachingLensStage';glass.append(stage);document.body.append(glass);
 if(!student){
  toolbar=document.createElement('div');toolbar.id='teachingLensToolbar';
  toolbar.innerHTML='<button type="button" id="lensToggle" aria-pressed="false">Lente: OFF</button><label>Zoom <select id="lensZoom"><option>1.5</option><option>2</option><option selected>2.5</option><option>3</option><option>4</option></select></label><button type="button" id="lensLock">Blocca</button>';
  document.body.append(toolbar);
  const toggle=toolbar.querySelector('#lensToggle'),lock=toolbar.querySelector('#lensLock');
  toggle.onclick=()=>{state.enabled=!state.enabled;state.locked=false;toggle.textContent=state.enabled?'Lente: ON':'Lente: OFF';toggle.setAttribute('aria-pressed',String(state.enabled));publish();render();};
  toolbar.querySelector('#lensZoom').onchange=e=>{state.zoom=Number(e.target.value);publish();render();};
  lock.onclick=()=>{state.locked=!state.locked;lock.textContent=state.locked?'Sblocca':'Blocca';publish();};
  document.addEventListener('pointermove',e=>{if(!state.enabled||state.locked||toolbar.contains(e.target))return;state.x=Math.max(0,Math.min(1,e.clientX/innerWidth));state.y=Math.max(0,Math.min(1,e.clientY/innerHeight));publish();render();},{passive:true});
  document.addEventListener('pointerdown',e=>{if(!state.enabled||state.locked||toolbar.contains(e.target))return;if(e.pointerType==='pen'||e.pointerType==='touch'){state.x=e.clientX/innerWidth;state.y=e.clientY/innerHeight;publish();render();}},{passive:true});
 }else{
  window.addEventListener('storage',e=>{if(e.key!==KEY)return;try{Object.assign(state,JSON.parse(e.newValue||'{}'));render();}catch(_){}});
  try{Object.assign(state,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(_){}
 }
 function tick(t){if(state.enabled&&t-lastDraw>150){lastDraw=t;render();}requestAnimationFrame(tick);}
 requestAnimationFrame(tick);render();
}
function chooseSource(x,y){
 const el=document.elementFromPoint(x,y);
 if(!el||el===glass||glass.contains(el)||el===toolbar||toolbar?.contains(el))return null;
 // Il contenuto e' copiato direttamente dalla console visibile, mai da una seconda pagina.
 const card=el.closest('.card,.metric,.wave,.hemo-wrap,.therapy,.student-tab-panel,.controls,.monitor,section');
 if(card&&card!==document.body)return card;
 return el.parentElement||el;
}
function copyValues(src,dst){
 const originals=[src,...src.querySelectorAll('*')],copies=[dst,...dst.querySelectorAll('*')];
 for(let i=0;i<Math.min(originals.length,copies.length);i++){
  const a=originals[i],b=copies[i];
  if(a instanceof HTMLCanvasElement&&b instanceof HTMLCanvasElement){
   try{b.width=a.width;b.height=a.height;b.getContext('2d')?.drawImage(a,0,0);}catch(_){}
  }
  if(a instanceof HTMLInputElement&&b instanceof HTMLInputElement){b.value=a.value;b.checked=a.checked;}
  if(a instanceof HTMLSelectElement&&b instanceof HTMLSelectElement)b.value=a.value;
  if(a instanceof HTMLTextAreaElement&&b instanceof HTMLTextAreaElement)b.value=a.value;
 }
 dst.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
 dst.querySelectorAll('script,iframe,video').forEach(el=>el.remove());
}
function render(){
 if(!glass)return;
 glass.style.display=state.enabled?'block':'none';if(!state.enabled){stage.replaceChildren();return;}
 const cx=state.x*innerWidth,cy=state.y*innerHeight;
 const left=Math.max(0,Math.min(innerWidth-226,cx-113)),top=Math.max(0,Math.min(innerHeight-226,cy-113));
 glass.style.left=left+'px';glass.style.top=top+'px';
 const src=chooseSource(cx,cy);if(!src){stage.replaceChildren();return;}
 const rect=src.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const clone=src.cloneNode(true);copyValues(src,clone);clone.classList.add('lens-copy');
 const css=getComputedStyle(src);clone.style.width=rect.width+'px';clone.style.height=rect.height+'px';
 clone.style.margin='0';clone.style.boxSizing='border-box';clone.style.position='absolute';
 clone.style.overflow='visible';clone.style.transform='scale('+state.zoom+')';
 clone.style.left=(110-(cx-rect.left)*state.zoom)+'px';
 clone.style.top=(110-(cy-rect.top)*state.zoom)+'px';
 // Gli elementi fuori dalla porzione visibile non devono comparire come contenuto inventato.
 stage.replaceChildren(clone);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
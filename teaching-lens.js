(()=>{'use strict';
/* Lente didattica sperimentale: istanza di sola lettura, attivata solo su richiesta. */
if(window.top!==window||new URLSearchParams(location.search).has('lensMirror'))return;
const KEY='simTeachingLensV1';
const student=document.body.classList.contains('student');
const state={enabled:false,x:.5,y:.5,zoom:2.5,locked:false,updated:0};
let glass,frame,toolbar,lastPoint=null,lastTab='';
function counterpart(el){
 const doc=frame?.contentDocument;if(!doc||!el||el.nodeType!==1)return null;
 if(el.id){const found=doc.getElementById(el.id);if(found)return found;}
 const path=[];let node=el;
 while(node&&node!==document.body){const parent=node.parentElement;if(!parent)return null;path.unshift(Array.prototype.indexOf.call(parent.children,node));node=parent;}
 if(node!==document.body)return null;
 node=doc.body;for(const index of path){node=node?.children[index];if(!node)return null;}return node;
}
function syncAllScroll(){
 const doc=frame?.contentDocument;if(!doc)return;
 // Sincronizza tutti i contenitori scrollabili, anche quando la posizione e' zero.
 // L'iframe e' un secondo documento: il suo scroll non segue quello della console.
 for(const el of document.body.querySelectorAll('*')){
  if(el===glass||glass?.contains(el)||el===toolbar||toolbar?.contains(el))continue;
  if(el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1)continue;
  const target=counterpart(el);if(!target)continue;
  if(target.scrollTop!==el.scrollTop)target.scrollTop=el.scrollTop;
  if(target.scrollLeft!==el.scrollLeft)target.scrollLeft=el.scrollLeft;
 }
 const target=doc.scrollingElement,source=document.scrollingElement;
 if(target&&source){target.scrollTop=source.scrollTop;target.scrollLeft=source.scrollLeft;}
}
function scheduleSync(){
 if(!state.enabled)return;
 if(scheduleSync.pending)return;
 scheduleSync.pending=true;
 requestAnimationFrame(()=>{scheduleSync.pending=false;update();});
}

function publish(){if(student)return;try{localStorage.setItem(KEY,JSON.stringify({...state,updated:Date.now()}));}catch(_){}}
function setup(){
 const style=document.createElement('style');
 style.textContent=`
 #teachingLensToolbar{position:fixed;right:12px;bottom:12px;z-index:99990;background:#0b2632;border:1px solid #79a3b6;border-radius:10px;padding:7px;display:flex;gap:7px;align-items:center;color:#fff;font:13px system-ui;box-shadow:0 3px 18px #0009}
 #teachingLensToolbar button,#teachingLensToolbar select{background:#153b4a;color:white;border:1px solid #527a8b;border-radius:7px;padding:7px}
 #teachingLensGlass{position:fixed;z-index:99980;width:220px;height:220px;border:3px solid #e0f6ff;border-radius:50%;overflow:hidden;pointer-events:none;box-shadow:0 5px 30px #000b;display:none;background:#081721}
 #teachingLensGlass iframe{position:absolute;border:0;pointer-events:none;transform-origin:0 0}
 body.student #teachingLensToolbar{display:none}
 `;
 document.head.append(style);
 glass=document.createElement('div');glass.id='teachingLensGlass';document.body.append(glass);
 if(!student){
  toolbar=document.createElement('div');toolbar.id='teachingLensToolbar';
  toolbar.innerHTML='<button type="button" id="lensToggle" aria-pressed="false">Lente: OFF</button><label>Zoom <select id="lensZoom"><option>1.5</option><option>2</option><option selected>2.5</option><option>3</option><option>4</option></select></label><button type="button" id="lensLock">Blocca</button>';
  document.body.append(toolbar);
  const toggle=toolbar.querySelector('#lensToggle'),lock=toolbar.querySelector('#lensLock');
  toggle.onclick=()=>{state.enabled=!state.enabled;state.locked=false;toggle.textContent=state.enabled?'Lente: ON':'Lente: OFF';toggle.setAttribute('aria-pressed',String(state.enabled));publish();update();};
  toolbar.querySelector('#lensZoom').onchange=e=>{state.zoom=Number(e.target.value);publish();update();};
  lock.onclick=()=>{state.locked=!state.locked;lock.textContent=state.locked?'Sblocca':'Blocca';publish();};
  document.addEventListener('pointermove',e=>{
   if(!state.enabled||state.locked||toolbar.contains(e.target))return;
   lastPoint={x:e.clientX,y:e.clientY};state.x=Math.min(1,Math.max(0,e.clientX/innerWidth));state.y=Math.min(1,Math.max(0,e.clientY/innerHeight));publish();update();
  },{passive:true});
  document.addEventListener('scroll',scheduleSync,{capture:true,passive:true});
  window.addEventListener('scroll',scheduleSync,{passive:true});
  const tabObserver=new MutationObserver(scheduleSync);tabObserver.observe(document.body,{attributes:true,attributeFilter:['data-instructor-tab']});
  document.addEventListener('pointerdown',e=>{if(e.pointerType==='pen'&&state.enabled&&!toolbar.contains(e.target)){state.x=e.clientX/innerWidth;state.y=e.clientY/innerHeight;publish();update();}},{passive:true});
 }else{
  window.addEventListener('storage',e=>{if(e.key!==KEY)return;try{Object.assign(state,JSON.parse(e.newValue||'{}'));update();}catch(_){}});
  try{Object.assign(state,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(_){}
 }
 update();
}
function update(){
 if(!glass)return;
 glass.style.display=state.enabled?'block':'none';
 if(!state.enabled)return;
 const cx=state.x*innerWidth,cy=state.y*innerHeight;
 glass.style.left=Math.max(0,Math.min(innerWidth-226,cx-113))+'px';
 glass.style.top=Math.max(0,Math.min(innerHeight-226,cy-113))+'px';
 if(!frame){
  frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');
  frame.tabIndex=-1;frame.src=location.pathname+'?lensMirror=1';
  glass.append(frame);
  frame.addEventListener('load',()=>{lastTab='';try{frame.contentWindow.document.documentElement.style.scrollBehavior='auto';}catch(_){} scheduleSync();});
 }
 const z=state.zoom;
 if(!student){try{const source=document.querySelector('.monitor');const mirrored=frame.contentDocument?.querySelector('.monitor');const tab=document.body.dataset.instructorTab||'patient';if(tab!==lastTab){const button=frame.contentDocument?.getElementById('instructor-tab-'+tab);if(button){button.click();lastTab=tab;requestAnimationFrame(scheduleSync);}}syncAllScroll();if(tab!==''&&tab===lastTab&&source&&mirrored){mirrored.scrollTop=source.scrollTop;mirrored.scrollLeft=source.scrollLeft;}frame.contentWindow?.scrollTo(window.scrollX,window.scrollY);}catch(_){}}
 frame.style.width=innerWidth+'px';frame.style.height=innerHeight+'px';
 frame.style.transform='translate('+ (110-cx*z)+'px,'+(110-cy*z)+'px) scale('+z+')';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
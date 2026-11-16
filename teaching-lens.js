(()=>{'use strict';
if(new URLSearchParams(location.search).has('lensMirror'))return;
const KEY='simTeachingLensV1',student=document.body.classList.contains('student');
const state={enabled:false,x:.5,y:.5,zoom:2.5,locked:false};
let glass,canvas,ctx,toolbar,dirty=true,lastPaint=0;
const visible=(r,v)=>r.width>0&&r.height>0&&r.right>v.left&&r.left<v.right&&r.bottom>v.top&&r.top<v.bottom;
function publish(){if(student)return;try{localStorage.setItem(KEY,JSON.stringify({...state,updated:Date.now()}));}catch(_){}}
function setup(){
 const style=document.createElement('style');
 style.textContent='#teachingLensToolbar{position:fixed;right:12px;bottom:12px;z-index:99990;background:#0b2632;border:1px solid #79a3b6;border-radius:10px;padding:7px;display:flex;gap:7px;align-items:center;color:#fff;font:13px system-ui;box-shadow:0 3px 18px #0009}#teachingLensToolbar button,#teachingLensToolbar select{background:#153b4a;color:white;border:1px solid #527a8b;border-radius:7px;padding:7px}#teachingLensGlass{position:fixed;z-index:99980;width:220px;height:220px;border:3px solid #e0f6ff;border-radius:50%;overflow:hidden;pointer-events:none;box-shadow:0 5px 30px #000b;background:#081721;display:none}#teachingLensGlass canvas{width:220px;height:220px;display:block}body.student #teachingLensToolbar{display:none}';
 document.head.append(style);
 glass=document.createElement('div');glass.id='teachingLensGlass';canvas=document.createElement('canvas');glass.append(canvas);document.body.append(glass);
 ctx=canvas.getContext('2d',{alpha:false});const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(220*dpr);canvas.height=Math.round(220*dpr);
 if(!student){
  toolbar=document.createElement('div');toolbar.id='teachingLensToolbar';
  toolbar.innerHTML='<button type="button" id="lensToggle" aria-pressed="false">Lente: OFF</button><label>Zoom <select id="lensZoom"><option>1.5</option><option>2</option><option selected>2.5</option><option>3</option><option>4</option></select></label><button type="button" id="lensLock">Blocca</button>';
  document.body.append(toolbar);
  const toggle=toolbar.querySelector('#lensToggle'),lock=toolbar.querySelector('#lensLock');
  toggle.onclick=()=>{state.enabled=!state.enabled;state.locked=false;toggle.textContent=state.enabled?'Lente: ON':'Lente: OFF';toggle.setAttribute('aria-pressed',String(state.enabled));publish();dirty=true;};
  toolbar.querySelector('#lensZoom').onchange=e=>{state.zoom=Number(e.target.value);publish();dirty=true;};
  lock.onclick=()=>{state.locked=!state.locked;lock.textContent=state.locked?'Sblocca':'Blocca';publish();};
  document.addEventListener('pointermove',e=>{if(!state.enabled||state.locked||toolbar.contains(e.target))return;state.x=Math.max(0,Math.min(1,e.clientX/innerWidth));state.y=Math.max(0,Math.min(1,e.clientY/innerHeight));publish();dirty=true;},{passive:true});
  document.addEventListener('pointerdown',e=>{if(!state.enabled||state.locked||toolbar.contains(e.target))return;if(e.pointerType==='pen'||e.pointerType==='touch'){state.x=e.clientX/innerWidth;state.y=e.clientY/innerHeight;publish();dirty=true;}},{passive:true});
 }else{
  window.addEventListener('storage',e=>{if(e.key!==KEY)return;try{Object.assign(state,JSON.parse(e.newValue||'{}'));dirty=true;}catch(_){}});
  try{Object.assign(state,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(_){}
 }
 function tick(t){if(state.enabled&&(dirty||t-lastPaint>100)){lastPaint=t;dirty=false;paint();}else if(!state.enabled&&glass.style.display!=='none')glass.style.display='none';requestAnimationFrame(tick);}
 requestAnimationFrame(tick);
}
function roundedRect(c,x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function colorVisible(s){return s&&s!=='transparent'&&s!=='rgba(0, 0, 0, 0)'&&s!=='none';}
function box(c,el,r,css){
 const bg=css.backgroundColor;
 if(colorVisible(bg)){c.fillStyle=bg;c.fillRect(r.left,r.top,r.width,r.height);}
 const bw=parseFloat(css.borderTopWidth)||0;
 if(bw&&css.borderTopStyle!=='none'&&colorVisible(css.borderTopColor)){c.strokeStyle=css.borderTopColor;c.lineWidth=bw;c.strokeRect(r.left+bw/2,r.top+bw/2,Math.max(0,r.width-bw),Math.max(0,r.height-bw));}
}
function drawText(c,text,x,y,css,maxWidth){
 if(!text||!text.trim())return;
 c.fillStyle=css.color||'#fff';c.font=css.font||'13px sans-serif';c.textBaseline='alphabetic';
 c.fillText(text,x,y,Math.max(1,maxWidth));
}
function textNode(c,node,css){
 const value=node.textContent;if(!value||!value.trim())return;
 const range=document.createRange();range.selectNodeContents(node);const rects=range.getClientRects();
 if(!rects.length)return;
 const parent=node.parentElement,pr=parent.getBoundingClientRect(),fs=parseFloat(css.fontSize)||13;
 if(rects.length===1){const r=rects[0];drawText(c,value,r.left,r.top+(r.height+fs)*.5,css,r.width+4);return;}
 // Linee multiple: misura parole singole per mantenere la posizione effettiva.
 const re=/\S+/g;let m,count=0;
 while((m=re.exec(value))&&count++<250){range.setStart(node,m.index);range.setEnd(node,m.index+m[0].length);const r=range.getBoundingClientRect();if(r.width)drawText(c,m[0],r.left,r.top+(r.height+fs)*.5,css,r.width+3);}
}
function drawControl(c,el,r,css){
 if(el instanceof HTMLCanvasElement){try{c.drawImage(el,r.left,r.top,r.width,r.height);}catch(_){}return true;}
 if(el instanceof HTMLInputElement){
  if(el.type==='checkbox'||el.type==='radio'){if(el.checked){c.fillStyle='#168dff';c.fillRect(r.left,r.top,r.width,r.height);c.fillStyle='white';c.font='bold '+Math.max(10,r.height*.8)+'px sans-serif';c.fillText('✓',r.left+2,r.bottom-2);}return true;}
  if(el.type==='range'){const min=Number(el.min)||0,max=Number(el.max)||100,val=Number(el.value)||0,f=Math.max(0,Math.min(1,(val-min)/(max-min||1)));c.strokeStyle='#a7b5c2';c.lineWidth=4;c.beginPath();c.moveTo(r.left+8,r.top+r.height/2);c.lineTo(r.right-8,r.top+r.height/2);c.stroke();c.fillStyle='#e9f2f6';c.beginPath();c.arc(r.left+8+(r.width-16)*f,r.top+r.height/2,8,0,Math.PI*2);c.fill();return true;}
  drawText(c,el.value||el.placeholder||'',r.left+Math.min(10,r.width*.08),r.top+r.height/2+(parseFloat(css.fontSize)||13)*.35,css,r.width-12);return true;
 }
 if(el instanceof HTMLSelectElement){drawText(c,el.selectedOptions?.[0]?.textContent||'',r.left+8,r.top+r.height/2+(parseFloat(css.fontSize)||13)*.35,css,r.width-14);return true;}
 if(el instanceof HTMLTextAreaElement){drawText(c,el.value||'',r.left+8,r.top+18,css,r.width-16);return true;}
 if(el instanceof HTMLImageElement&&el.complete){try{c.drawImage(el,r.left,r.top,r.width,r.height);}catch(_){}return true;}
 return false;
}
function drawTree(c,root,viewport){
 let seen=0;
 function walk(node){
  if(++seen>3500)return;
  if(node.nodeType===3){const parent=node.parentElement;if(parent&&getComputedStyle(parent).visibility!=='hidden')textNode(c,node,getComputedStyle(parent));return;}
  if(node.nodeType!==1)return;
  const el=node;
  if(el===glass||el===toolbar||glass.contains(el)||toolbar?.contains(el)||['SCRIPT','STYLE','IFRAME','NOSCRIPT'].includes(el.tagName))return;
  const css=getComputedStyle(el);
  if(css.display==='none'||css.visibility==='hidden'||Number(css.opacity)===0)return;
  const r=el.getBoundingClientRect();
  if(!visible(r,viewport))return;
  c.save();
  // Ritaglio dei contenitori scrollabili: evita di mostrare contenuti fuori vista.
  if((css.overflowX==='auto'||css.overflowX==='scroll'||css.overflowX==='hidden'||css.overflowY==='auto'||css.overflowY==='scroll'||css.overflowY==='hidden')&&el!==document.body){
   c.beginPath();c.rect(r.left,r.top,r.width,r.height);c.clip();
  }
  box(c,el,r,css);
  if(!drawControl(c,el,r,css)){for(const child of el.childNodes)walk(child);}
  c.restore();
 }
 walk(root);
}
function paint(){
 if(!glass||!ctx)return;
 glass.style.display='block';
 const cx=state.x*innerWidth,cy=state.y*innerHeight,z=state.zoom;
 const left=Math.max(0,Math.min(innerWidth-226,cx-113)),top=Math.max(0,Math.min(innerHeight-226,cy-113));
 glass.style.left=left+'px';glass.style.top=top+'px';
 const dpr=canvas.width/220;
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#081721';ctx.fillRect(0,0,220,220);
 ctx.save();ctx.translate(110,110);ctx.scale(z,z);ctx.translate(-cx,-cy);
 const radius=110/z,viewport={left:cx-radius,top:cy-radius,right:cx+radius,bottom:cy+radius};
 try{drawTree(ctx,document.body,viewport);}catch(err){console.warn('Lente didattica: errore rendering',err);}
 ctx.restore();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
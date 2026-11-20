(()=>{'use strict';
if(document.body.classList.contains('student'))return;
const init=()=>{
 const sel=document.getElementById('ivScenario'),mod=document.getElementById('interventisticaModule');
 if(!sel||!mod)return;
 if(!sel.querySelector('option[value="ct"]'))sel.add(new Option('Cardio TC','ct'));
 const panel=document.createElement('section');panel.id='ivCardioTC';panel.className='iv-card';panel.hidden=true;
 panel.innerHTML='<h3>Cardio TC · remifentanil e apnea di acquisizione</h3><div class="iv-row"><label>Remifentanil CRI (µg/kg/min) <input id="ctRemiDose" type="number" min="0" max="1" step="0.05" value="0.20" style="width:95px"></label><button id="ctRemiStart">Avvia CRI</button><button id="ctRemiStop">Interrompi CRI</button><strong id="ctRemiStatus">CRI non avviata</strong></div><div class="iv-row"><span id="ctRemiNumbers">Cp — · Ce — · FC —</span></div><canvas id="ctRemiChart" style="height:165px;width:100%"></canvas><div class="iv-row"><label>Durata apnea TC (s) <input id="ctApneaSeconds" type="number" min="3" max="30" step="1" value="10" style="width:75px"></label><button id="ctScanStart">Avvia scansione TC + apnea</button><button id="ctScanStop">Termina apnea</button><strong id="ctScanStatus">Scansione non avviata</strong></div><p class="iv-note">Modello PK/PD illustrativo nel cane: clearance 63 mL/kg/min, Vss 231 mL/kg, ke0 0,48/min; compartimento centrale didattico distinto (110 mL/kg). La risposta cronotropa varia con la dose e l’atropina; non è un modello clinicamente validato per guidare la somministrazione. L’apnea è una manovra ventilatoria controllata, non un effetto del remifentanil.</p>';
 mod.insertBefore(panel,mod.querySelector('.iv-card'));
 const st=window.simCardioCTState={active:false,running:false,dose:0,cp:0,ce:0,apnea:false,apneaUntil:0};
 const $=id=>document.getElementById(id);
 let last=typeof window.simVirtualNow==='function'?window.simVirtualNow():performance.now();
 let samples=[],nextSample=last;
 const updateScenario=()=>{
  const ct=sel.value==='ct';panel.hidden=!ct;st.active=ct;
  $('ivAction').style.display=ct?'none':'';$('ivReset').style.display=ct?'none':'';
  $('ivStatus').textContent=ct?'Cardio TC · controllo FC e scansione in apnea':$('ivStatus').textContent;
  const catheter=mod.querySelector('.iv-card:not(#ivCardioTC)'),loops=mod.querySelector('.iv-grid');
  if(catheter)catheter.style.display=ct?'none':'';if(loops)loops.style.display=ct?'none':'';
  if(!ct){st.running=false;st.dose=0;stopApnea();}
 };
 sel.addEventListener('change',updateScenario);
 $('ctRemiStart').onclick=()=>{st.dose=Math.max(0,Math.min(1,Number($('ctRemiDose').value)||0));st.running=st.dose>0};
 $('ctRemiStop').onclick=()=>{st.running=false;st.dose=0};
 $('ctRemiDose').onchange=()=>{if(st.running)st.dose=Math.max(0,Math.min(1,Number($('ctRemiDose').value)||0))};
 function stopApnea(){st.apnea=false;st.apneaUntil=0;window.simCardioCTApnea=false;document.body.classList.remove('ct-apnea-active');$('ctScanStatus').textContent='Apnea terminata'}
 $('ctScanStart').onclick=()=>{
  if(!window.simAirwayIntubated){$('ctScanStatus').textContent='Intubare prima della scansione';return}
  const now=window.simVirtualNow?.()??performance.now();
  st.apnea=true;st.apneaUntil=now+Math.max(3,Math.min(30,Number($('ctApneaSeconds').value)||10))*1000;
  window.simCardioCTApnea=true;document.body.classList.add('ct-apnea-active');
 };
 $('ctScanStop').onclick=stopApnea;
 function draw(){
  const c=$('ctRemiChart'),w=c.clientWidth||450,h=c.clientHeight||165,d=Math.min(2,devicePixelRatio||1);
  if(c.width!==Math.round(w*d)||c.height!==Math.round(h*d)){c.width=Math.round(w*d);c.height=Math.round(h*d)}
  const g=c.getContext('2d');g.setTransform(d,0,0,d,0,0);g.fillStyle='#081923';g.fillRect(0,0,w,h);
  g.strokeStyle='#355366';g.beginPath();g.moveTo(36,12);g.lineTo(36,h-25);g.lineTo(w-8,h-25);g.stroke();
  if(samples.length<2)return;
  const max=Math.max(5,...samples.map(x=>Math.max(x.cp,x.ce)));
  for(const [key,color] of [['cp','#60b8ff'],['ce','#f3c969']]){
   g.strokeStyle=color;g.lineWidth=2;g.beginPath();
   samples.forEach((x,i)=>{const px=36+(w-48)*i/Math.max(1,samples.length-1),py=h-25-(h-40)*x[key]/max;i?g.lineTo(px,py):g.moveTo(px,py)});
   g.stroke();
  }
  g.font='11px system-ui';g.fillStyle='#60b8ff';g.fillText('Cp',42,17);g.fillStyle='#f3c969';g.fillText('Ce',75,17);
  g.fillStyle='#b9d1de';g.fillText('ng/mL',w-55,17);
 }
 function tick(){
  const now=window.simVirtualNow?.()??performance.now(),dt=Math.max(0,Math.min(2,(now-last)/1000));last=now;
  if(dt>0){
   // 1-compartment approximation of measured canine clearance/Vss,
   // plus first-order effect-site equilibration. ng/mL from µg/kg/min.
   const elimination=63/110/60,ke0=.48/60; // Vc didattico 110 mL/kg, distinto da Vss 231; rapida eliminazione iniziale
   const steady=(st.running?st.dose:0)*1000/63;
   st.cp=steady+(st.cp-steady)*Math.exp(-elimination*dt);
   st.ce=st.cp+(st.ce-st.cp)*Math.exp(-ke0*dt);
  }
  if(st.apnea&&now>=st.apneaUntil)stopApnea();
  if(st.active&&!panel.hidden){
   $('ctRemiStatus').textContent=st.running?'CRI attiva · '+st.dose.toFixed(2)+' µg/kg/min':'CRI interrotta';
   $('ctRemiNumbers').textContent='Cp '+st.cp.toFixed(2)+' ng/mL · Ce '+st.ce.toFixed(2)+' ng/mL · FC '+(document.getElementById('hr')?.value||'—')+' bpm';
   if(st.apnea)$('ctScanStatus').textContent='Apnea TC · '+Math.ceil((st.apneaUntil-now)/1000)+' s rimanenti';
   if(now>=nextSample){samples.push({cp:st.cp,ce:st.ce});if(samples.length>150)samples.shift();nextSample=now+1000}
   draw();
  }
  requestAnimationFrame(tick);
 }
 updateScenario();requestAnimationFrame(tick);
};
document.addEventListener('sim:interventistica-ready',init,{once:true});
if(document.readyState!=='loading'&&document.getElementById('ivScenario'))init();
})();
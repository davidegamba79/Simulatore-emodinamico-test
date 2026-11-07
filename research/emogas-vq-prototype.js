/* Emogasanalisi/VQ - prototipo isolato, NON collegato alla UI.
 * Unita': pressioni mmHg, FiO2 frazione, V_A L/min, Q L/min, Hb g/dL.
 * Modello didattico steady-state; non sostituisce emogasanalisi clinica.
 * API: window.EmogasVQ.calculate({fio2,barometricPressure,paCO2,
 *   bicarbonate,hb,cardiacOutput,alveolarVentilation,shunt,
 *   lowVQFraction,deadSpaceFraction,respiratoryQuotient,temperature})
 */
(function(root){
 'use strict';
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 const sat=po2=>1/(1+Math.pow(26.8/Math.max(1,po2),2.7));
 const content=(po2,hb)=>1.34*hb*sat(po2)+.0031*po2;
 const inverse=(c,hb)=>{let a=0,b=700;for(let i=0;i<48;i++){const m=(a+b)/2;if(content(m,hb)<c)a=m;else b=m;}return (a+b)/2;};
 // PEEP response: qualitative recruitment and overdistension, shared by
 // effective perfusion fractions and effective physiological dead space.
 // Baseline values are the instructor-selected fractions at PEEP=0.
 function peepResponse(input={}){
  const peep=clamp(Number(input.peep)||0,0,18);
  const scenario=String(input.scenario||'healthy');
  const controlled=input.controlled===true;
  const baselineShunt=clamp(Number(input.shunt)||0,0,.8);
  const baselineLow=clamp(Number(input.lowVQFraction)||0,0,1-baselineShunt);
  const baselineDead=clamp(Number(input.deadSpaceFraction)||0,0,.85);
  if(!controlled)return Object.freeze({shunt:baselineShunt,lowVQFraction:baselineLow,
   deadSpaceFraction:baselineDead,recruitment:0,overdistension:0});
  const cfg={
   healthy:[.06,.04,.01,7,7],
   hypoventilation:[.06,.04,.01,7,7],
   atelectasis:[.67,.38,.10,10,5],
   bronchospasm:[.10,.08,.06,7,6],
   embolism:[.04,.04,.12,6,5],
   edema:[.46,.30,.12,9,5.5]
  }[scenario]||[.06,.04,.01,7,7];
  const recruitment=1-Math.exp(-peep/(scenario==='atelectasis'?4.8:5.2));
  const overdistension=Math.pow(Math.max(0,peep-cfg[3])/cfg[4],2);
  // Opening previously perfused but unventilated units decreases shunt;
  // excessive distension can worsen V/Q without requiring SpO2 to fall.
  const shunt=clamp(baselineShunt*(1-cfg[0]*recruitment)+
   cfg[2]*.22*overdistension,0,.8);
  const lowVQFraction=clamp(baselineLow*(1-cfg[1]*recruitment)+
   cfg[2]*.28*overdistension,0,1-shunt);
  const deadSpaceFraction=clamp(baselineDead-
   (scenario==='atelectasis'?.055:scenario==='edema'?.035:.008)*recruitment+
   cfg[2]*overdistension,0,.85);
  return Object.freeze({shunt,lowVQFraction,deadSpaceFraction,recruitment,overdistension});
 }
 function calculate(input={}){
  const fio2=clamp(+input.fio2||.21,.21,1);
  const pb=clamp(+input.barometricPressure||760,400,800);
  const dead=clamp(input.deadSpaceFraction==null?.25:+input.deadSpaceFraction,0,.85);
  const va=clamp(input.minuteVentilation!=null?
    +input.minuteVentilation*(1-dead):(+input.alveolarVentilation||3),.05,30);
  // 0.863 converts metabolic VCO2 (mL/min) / VA (L/min) to mmHg.
  // A supplied PaCO2 takes precedence for isolated gas-exchange experiments.
  const vco2=clamp(+input.metabolicCO2||140,15,650);
  const paco2=clamp(input.paCO2!=null?+input.paCO2:.863*vco2/va,10,120);
  const hco3=clamp(+input.bicarbonate||24,4,60);
  const hb=clamp(+input.hb||14,3,25);
  const q=clamp(+input.cardiacOutput||3,.1,30);
  
  const shunt=clamp(+input.shunt||0,0,.8);
  const low=clamp(+input.lowVQFraction||0,0,1-shunt);
  
  const rq=clamp(+input.respiratoryQuotient||.8,.6,1.2);
  const pio2=fio2*(pb-47);
  const idealPAO2=clamp(pio2-paco2/rq,1,700);
  // Three perfused compartments. Oxygen content, not partial pressure,
  // is mixed. The mixed venous content must be calculated from the resulting
  // arterial content (Fick), not from ideal end-capillary oxygen content.
  // With fixed VO2 and cardiac output, solve the recirculation balance:
  // Ca = (1-s-low)*Cc_normal + low*Cc_low + s*(Ca - VO2/(10*Q)).
  // Therefore Ca*(1-s) = (1-s-low)*Cc_normal + low*Cc_low
  //                        - s*VO2/(10*Q).
  // This avoids an FiO2-dependent venous estimate anchored to ideal PAO2.
  const vo2=clamp(+input.metabolicO2||180,20,800);
  const normalO2=content(idealPAO2,hb);
  const lowPAO2=clamp(idealPAO2*(.22+.28*clamp(va/q,0,2)),8,idealPAO2);
  const lowO2=content(lowPAO2,hb);
  const extraction=vo2/(10*q);
  const caO2=clamp(((1-shunt-low)*normalO2+low*lowO2-shunt*extraction)/
    Math.max(.2,1-shunt),.5,normalO2);
  const cvO2=clamp(caO2-extraction,.05,caO2);
  const pao2=inverse(caO2,hb);
  const ph=6.1+Math.log10(hco3/(.03*paco2));
  return Object.freeze({
   ph:+ph.toFixed(3),paCO2:+paco2.toFixed(1),
   paO2:+pao2.toFixed(1),hco3:+hco3.toFixed(1),
   saO2:+(100*sat(pao2)).toFixed(1),
   pfRatio:+(pao2/fio2).toFixed(0),
   aaGradient:+Math.max(0,idealPAO2-pao2).toFixed(1),
   idealPAO2:+idealPAO2.toFixed(1),
   // EtCO2 is a separate dynamic state in the simulator; do not replace it
   // with a simple function of physiological dead space.
   paEtGradient:null,
   compartments:Object.freeze({normal:1-shunt-low,lowVQ:low,shunt}),
   inputs:Object.freeze({fio2,pb,q,va,vco2,vo2,shunt,low,dead,rq,hb}),
   warning:'Modello didattico esplorativo: V/Q, equilibrio venoso e acido-base semplificati; PaCO2 stazionaria, non validato clinicamente.'
  });
 }
 root.EmogasVQ=Object.freeze({calculate,peepResponse});
})(typeof window!=='undefined'?window:globalThis);

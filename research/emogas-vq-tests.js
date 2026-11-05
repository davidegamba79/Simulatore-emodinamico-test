/* Run in browser console after loading emogas-vq-prototype.js.
 * No modifications to the production simulator.
 */
(function(){
 const calc=window.EmogasVQ.calculate;
 const base={fio2:.21,alveolarVentilation:3,metabolicCO2:140,
  cardiacOutput:3,metabolicO2:180,hb:14,bicarbonate:24};
 const normal=calc(base);
 const hypo=calc({...base,alveolarVentilation:1.8});
 const shunt=calc({...base,shunt:.25});
 const low=calc({...base,lowVQFraction:.35});
 const dead=calc({...base,minuteVentilation:4,deadSpaceFraction:.55});
 const deadControl=calc({...base,minuteVentilation:4,deadSpaceFraction:.25});
 const highFi=calc({...base,fio2:.6});
 const checks={
  normalRange:normal.paCO2>35&&normal.paCO2<45&&normal.ph>7.3&&normal.ph<7.5,
  hypoventilation:hypo.paCO2>normal.paCO2&&hypo.ph<normal.ph,
  shuntHypoxemia:shunt.paO2<normal.paO2&&shunt.aaGradient>normal.aaGradient,
  lowVQHypoxemia:low.paO2<normal.paO2,
  deadSpaceHypercapnia:dead.paCO2>deadControl.paCO2,
  fio2Response:highFi.paO2>normal.paO2,
  noFalseEtCO2:normal.paEtGradient===null,
  increasedVentilationLowersCO2:calc({...base,alveolarVentilation:4}).paCO2<normal.paCO2,
  reducedCOLowersShuntPaO2:calc({...base,shunt:.25,cardiacOutput:1}).paO2<calc({...base,shunt:.25,cardiacOutput:5}).paO2,
  bicarbonateControlsPH:calc({...base,bicarbonate:16}).ph<normal.ph,
  normalCompartmentsSum:Math.abs(Object.values(normal.compartments).reduce((a,b)=>a+b,0)-1)<1e-9,
  extremeValuesFinite:Object.values(calc({...base,shunt:1,lowVQFraction:1,fio2:1,cardiacOutput:.1})).filter(v=>typeof v==='number').every(Number.isFinite)
 };
 const rows={normal,hypoventilation:hypo,shunt,lowVQ:low,deadSpace:dead,highFiO2:highFi};
 console.table(Object.entries(rows).map(([scenario,x])=>({scenario,
  pH:x.ph,PaCO2:x.paCO2,PaO2:x.paO2,SaO2:x.saO2,PF:x.pfRatio,AA:x.aaGradient})));
 console.table(checks);
 if(Object.values(checks).some(v=>!v))throw Error('Emogas V/Q: one or more qualitative checks failed');
 return {rows,checks};
})();

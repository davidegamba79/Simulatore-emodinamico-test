/* Deterministic grid regression: 1440 parameter combinations.
 * Browser console: load prototype.js then this file.
 */
(function(){
 const calculate=window.EmogasVQ.calculate;
 let cases=0,failures=[];
 for(const fio2 of [.21,.3,.5,1])
 for(const alveolarVentilation of [.1,.5,1,2,4,10])
 for(const shunt of [0,.05,.25,.6])
 for(const lowVQFraction of [0,.2,.5])
 for(const cardiacOutput of [.1,.5,1,3,10]){
  const x=calculate({fio2,alveolarVentilation,shunt,lowVQFraction,cardiacOutput});
  cases++;
  const sum=Object.values(x.compartments).reduce((a,b)=>a+b,0);
  if(![x.ph,x.paCO2,x.paO2,x.saO2,x.pfRatio,x.aaGradient].every(Number.isFinite)||
    x.paO2<0||x.saO2<0||x.saO2>100||x.aaGradient<0||
    Math.abs(sum-1)>1e-8||x.compartments.normal<0){
   failures.push({fio2,alveolarVentilation,shunt,lowVQFraction,cardiacOutput,x});
  }
 }
 if(failures.length)throw Error('EGA stress tests failed: '+JSON.stringify(failures.slice(0,3)));
 console.info('EGA stress tests PASS',cases,'parameter combinations');
 return {cases,failures:0};
})();

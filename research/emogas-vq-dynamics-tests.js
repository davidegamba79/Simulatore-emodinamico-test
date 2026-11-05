/* Qualitative tests for the experimental first-order arterial gas response.
   Run with JS interpreter; independent of DOM and main simulator. */
(function(){
 const evolve=(current,target,dt,tau)=>current+(target-current)*(1-Math.exp(-Math.max(0,dt)/tau));
 const a=evolve(40,70,10,65),b=evolve(a,70,55,65);
 const oxygen=evolve(90,60,18,18);
 const tests={
  paCO2MovesGradually:a>40&&a<70,
  paCO2ApproachesTarget:b>a&&b<70,
  paO2MovesGradually:oxygen<90&&oxygen>60,
  pauseFreezes:evolve(40,70,0,65)===40,
  timeStepComposition:Math.abs(evolve(evolve(40,70,20,65),70,40,65)-evolve(40,70,60,65))<1e-9,
  noOvershoot:evolve(40,70,3600,65)<=70
 };
 if(Object.values(tests).some(v=>!v))throw Error('Dynamic gas response regression failure');
 console.table(tests);
 return tests;
})();

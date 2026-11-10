# SIMULATORE ANESTESIA V3.0 — protocollo di regressione fisiologica
Data: 2026-11-10. Ambito: solo repository sperimentale.

## Stato del motore verificato nel codice
- `app.js`: `v25PerfusionEt(dt,ventData)` usa CO corrente, ventilazione alveolare, frazioni regionali di spazio morto e low V/Q.
- Due compartimenti CO₂ (centrale e tissutale); produzione metabolica basale indipendente dalla regolazione corrente del ventilatore.
- `window.simPulmonaryPerfusionState` espone diagnostica interna per confronto quantitativo.
- Il ramo della ventilazione spontanea usa ancora un'approssimazione separata: non equiparare i risultati ai test in VCV/PCV.

## Protocollo manuale (25 kg, anestesia inalatoria, VCV)
1. **Basale**: FR 12/min, Vt 12 mL/kg, PEEP 0, FiO₂ 0,50. Attendere stabilizzazione. Annotare FC, SV, CO, MAP, EtCO₂, PaCO₂, ventilazione alveolare, VCO₂ e gradiente Pa–Et.
2. **Dobutamina**: attivare 2 µg/kg/min. Campionare a 0, 30, 60, 120, 300 s. Controllare che SV/CO rispondano e che EtCO₂ segua la dinamica del trasporto, senza salti arbitrari.
3. **Washout**: sospendere dobutamina, campionare per almeno 5 min. Verificare recupero emodinamico e assenza di drift progressivo della CO₂.
4. **Riduzione CO**: diminuire contrattilità mantenendo costanti Vt e FR. Verificare incremento dello spazio morto alveolare funzionale e riduzione iniziale di EtCO₂; distinguere PaCO₂ da EtCO₂.
5. **Ventilazione**: riportare CO basale, modificare FR 12→16→12 a Vt costante. Verificare variazione di PaCO₂ ed EtCO₂ nella direzione attesa e ritorno verso basale.
6. **PEEP**: PEEP 0→5→0 a VCV, verificare interazione con precarico, CO e trasporto polmonare della CO₂, senza imporre un effetto fisso indipendente dalla meccanica.
7. **Low V/Q, shunt, spazio morto**: modificare una sola variabile alla volta; verificare che shunt non sia contato come gas espirato e che spazio morto anatomico resti distinto da quello alveolare.
8. **Interfaccia**: iPad docente con monitor persistente, schermo esteso studenti read-only, pausa/play sincronizzati, trend nella sola scheda Trend, loop e riferimenti salvati invariati.

## Diagnostica console (solo sviluppo)
```js
console.table(window.simPulmonaryPerfusionState || {});
console.log('PaCO2 dinamica', window.simDynamicPaCO2);
```

## Criteri di accettazione
- Nessun NaN, Infinity, CO negativa o EtCO₂ fuori range durante i test.
- Produzione metabolica CO₂ invariata quando cambia soltanto FR o Vt.
- Dopo stabilizzazione, bilancio totale CO₂ vicino a zero: `totalCO2Balance = metabolicVCO2 - alveolarCO2Elimination`.
- Il gradiente Pa–Et è un risultato della miscela alveolare, non una sottrazione fissa.
- Il recupero dopo washout non deve richiedere reset manuali.
- Nessuna modifica al repository di produzione.

## Osservazioni da approfondire prima della prossima modifica
- Nel codice corrente il riferimento docente `etRef` è memorizzato nei pool, ma il calcolo di VCO₂ usa un valore allometrico fisso: verificare la coerenza tra controllo manuale EtCO₂ e motore dinamico.
- La diagnostica `simPulmonaryPerfusionState` è assegnata dopo le uscite anticipate per CPR/arresto: evitare di interpretare dati diagnostici precedenti come correnti.
- Il tempo `dt` è limitato a 1 s per aggiornamento: verificare accelerazione del tempo simulato e salti temporali.

# Emogasanalisi / V-Q — stato sperimentale

Questo ramo NON modifica la versione stabile pubblicata su GitHub Pages.

## Modello
- PaCO2 stazionaria da 0.863 * VCO2 / ventilazione alveolare.
- pH da Henderson-Hasselbalch con HCO3 impostato; compensazione renale NON simulata.
- PAO2 da equazione alveolare semplificata.
- Tre compartimenti perfusi: normale, basso V/Q, shunt; contenuto arterioso O2 miscelato.
- O2 venoso misto approssimato con VO2 e gittata cardiaca.
- Spazio morto applicato alla ventilazione alveolare efficace.
- EtCO2 rimane governata dal modello esistente; non e' stata aggiunta una falsa formula PaCO2-EtCO2.

## Test eseguiti
12 asserzioni nel file emogas-vq-tests.js: superate (modello eseguito in runtime JS).
Controlli aggiuntivi manuali: 13/13 superati.
Parsing sintattico dei due moduli JS: superato.

## Interfaccia implementata
Scheda Emogas per istruttore, prelievo virtuale, modalita' continua opzionale, scenari, parametri V/Q.
Scheda Emogas per studenti sola lettura via localStorage.
Nessuna modifica ad app.js, ventilation-v291.js, wave-v2.js nella feature.

## LIMITAZIONI / BLOCCANTI prima di un merge in main
1. Eseguire test visuali e funzionali in browser Safari iPad con schermo esteso.
2. Verificare che i tab preesistenti continuino a funzionare in entrambi i monitor.
3. La PaCO2 e' uno steady-state istantaneo: non e' ancora sincronizzata temporalmente con le due riserve CO2 del motore EtCO2. Non interpretare il gradiente PaCO2-EtCO2 come clinicamente affidabile.
4. Shunt e V/Q sono parametrizzati e non emergono ancora da reclutamento, PEEP e curva pressione-volume del motore ventilatorio.
5. La saturazione e' una curva approssimata, senza effetti di temperatura, pH, 2,3-DPG o differenze di specie.
6. I preset rappresentano scenari didattici, non diagnosi automatiche.
7. Verificare la risposta a cambiamenti di massa corporea, FiO2 e ventilazione minuto su piu' simulazioni.

NON usare i risultati per decisioni cliniche reali.
\n## Modifiche successive\n- La scheda studenti Emogas riapre il contenitore delle schede anche dopo Ventilazione.\n- PaCO2 e PaO2 nel pannello Emogas hanno un primo filtro dinamico sull'orologio virtuale; la pausa congela l'evoluzione, il riavvolgimento reimposta lo stato. Le costanti 65 s e 18 s sono puramente didattiche.\n- Il preset di ipoventilazione applica un fattore 0,6 alla ventilazione alveolare del solo modulo EGA; NON modifica i controlli del ventilatore né le onde.\n- Non è stato eseguito un test end-to-end con Safari su iPad e display esteso: pubblicazione ancora bloccata.\n
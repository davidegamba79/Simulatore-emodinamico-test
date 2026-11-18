# Caso sperimentale PDA–ACDO | Specifica di progetto v0.1
**Stato:** progettazione; NON integrato nel motore; NON validato clinicamente. **Ambito:** repository TEST soltanto.
## Paziente
Cane, PDA sinistro-destro emodinamicamente significativo, compensato, senza edema polmonare né insufficienza cardiaca congestizia. Peso iniziale didattico 10 kg (modificabile); ritmo sinusale. Dilatazione atriale/ventricolare sinistra da sovraccarico volumetrico; flusso diastolico aorto-polmonare continuo. Nessuna ipertensione polmonare grave e nessuno shunt inverso.
## Variabili necessarie (nuovo sottosistema)
- Qs = portata sistemica efficace; Qp = portata polmonare; Qduct = Qp−Qs per shunt esclusivamente sinistro-destro. Non identificare CO del monitor con Qp senza dichiararlo.
- Resistenza conduttanza del dotto (Gduct), differenza di pressione aortica/polmonare, resistenza vascolare sistemica/polmonare, compliance arteriosa e compartimento di ritorno polmonare.
- LV EDV, ESV, SV totale, SV sistemica efficace, Ea, Ees, dP/dt, loop P/V, pressione aortica sistolica/diastolica, MAP, frequenza.
- Stato di occlusione [0,1], flusso residuo, tempi distinti di risposta baroriflessa (secondi), Anrep (minuti), rimodellamento volumetrico (minuti–ore).
## Sequenza eventi comandata dal docente
1. **Baseline PDA aperto**: shunt continuo; Qp/Qs>1; EDV elevato; pressione differenziale ampia e diastolica relativamente bassa; FC compatibile con paziente compensato.
2. **Premedicazione/induzione**: usare farmaci reali del simulatore e relativi effetti PK/PD, senza forzare una curva pressoria fissa; registrare dosi e tempi.
3. **Intubazione/ventilazione controllata**: effetti PEEP/pressione intratoracica su precarico e ventricolo; EtCO2 coerente con perfusione polmonare e ventilazione.
4. **Accesso vascolare e cateterismo**: evento senza perturbazione obbligatoria; opzionale ectopia transitoria, con ECG corrispondente.
5. **Posizionamento ACDO (non rilasciato)**: nessuna occlusione completa automatica; opzionale occlusione temporanea parziale con parametro 0–100%.
6. **Rilascio e occlusione del PDA**: riduzione progressiva Qduct fino a residuo selezionabile; scomparsa del runoff diastolico; aumento DAP e riduzione ampiezza pressione differenziale, aumento del postcarico effettivo LV, riduzione del volume di ritorno polmonare e del precarico LV nel tempo.
7. **Riflesso di Nicoladoni–Branham**: possibile bradicardia baroriflessa in risposta all'aumento pressorio, modulata da anestesia, oppioidi, atropina e sensibilità baroriflessa; non obbligatoria.
8. **Risposta di Anrep**: componente inotropa lenta dopo incremento di postcarico, dipendente da riserva miocardica; non incremento istantaneo imposto.
9. **Fine procedura**: riduzione MAC impostata dal docente; la chiusura del dotto NON riduce automaticamente il fabbisogno di anestetico. Monitorare risposta a modifica MAC e analgesia.
## Vincoli di coerenza
- ECG: bradicardia sinusale solo quando la FC si riduce davvero; ectopie solo su evento.
- IBP: dopo occlusione il runoff diastolico si attenua; modificare forma d'onda e DAP, non soltanto MAP numerica.
- SpO2: generalmente conservata in PDA sinistro-destro compensato, salvo altra patologia; nessuna desaturazione automatica da occlusione.
- EtCO2: dipende da ventilazione alveolare, Qp efficace, CO2 trasportata e spazio morto; NON imporre un salto fisso dopo rilascio.
- Loop P/V: EDV e ampiezza del loop rispondono al sovraccarico volumetrico e alla sua rimozione; Ea aumenta relativamente quando si elimina lo shunt a bassa resistenza; Ees/Anrep evolvono con ritardo.
- Qp, Qs, Qduct, SV totale e SV sistemica devono rispettare il bilancio dei flussi. Nessuna doppia contabilizzazione della portata.
- Salti temporali, pausa e monitor studenti devono usare lo stesso stato deterministico degli eventi.
## Interfaccia
Pannello docente **Procedura PDA–ACDO** nel caso clinico: cronologia, pulsanti eventi, slider occlusione 0–100%, flusso residuo, sensibilità riflesso, riserva Anrep, note docente. Nessun comando chirurgico sul monitor studenti. Monitor studenti: indicatori Qp/Qs e flusso duttale, stato dispositivo, curve ECG/IBP/EtCO2, loop P/V e trend di DAP, SAP, MAP, FC, EDV, ESV, Qs, Qp.
## Parametri di prova (NON valori clinici predittivi)
Definire dopo revisione della letteratura e calibrazione: peso, HR baseline, pressione differenziale, Qp/Qs, conduttanza dotto, EDV indicizzato, PVR, SVR, tempi risposta e ampiezza riflessi. Nessun valore clinico numerico deve essere inventato per far tornare la dimostrazione.
## Piano sviluppo con criteri di accettazione
A. Prototipo separato dal TEST index: visualizzazione pannello ed eventi senza effetti sul motore.
B. Sottosistema shunt Qp/Qs e IBP aortica: test bilancio flussi prima/dopo chiusura.
C. Collegamento a precarico/postcarico e loop P/V: verifiche di EDV, Ea e traiettoria dinamica.
D. Riflesso barocettivo/Anrep con ritardi e interazioni farmaci; controlli per evitare doppi effetti.
E. EtCO2, SpO2, ECG e monitor studenti; test di pause, salti temporali, Mac/iPad schermo esteso.
F. Validazione didattica rispetto a riferimenti veterinari, con esplicita distinzione tra tendenze robuste e risposte individuali.
**Non unire al TEST index né alla produzione senza conferma esplicita dell'utente.**

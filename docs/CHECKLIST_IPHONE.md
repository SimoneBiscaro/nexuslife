# NexusLife — installazione e collaudo

App: **https://simonebiscaro.github.io/nexuslife/**

## Installazione

### iPhone (Safari)
1. Apri il link qui sopra **in Safari** (non funziona da Chrome o da un'app di messaggi).
2. Tocca **Condividi** (il quadrato con la freccia in su).
3. Scorri e tocca **Aggiungi alla schermata Home** → **Aggiungi**.
4. Apri NexusLife dall'icona sulla Home: si apre a tutto schermo, senza barre di Safari.
5. Dopo ogni aggiornamento compare "Nuova versione disponibile": tocca **Ricarica**.

### Mac (Safari 17 o successivo)
1. Apri il link in Safari.
2. Menu **File → Aggiungi al Dock…** → **Aggiungi**.
3. NexusLife compare nel Dock e in Launchpad come un'app normale, con la propria finestra.

> Su Mac l'app installata dal Dock ha un archivio separato da quello di Safari: i dati si
> allineano con la sincronizzazione (Impostazioni → Account e sync) o con un pacchetto di backup.

## Prima del collaudo
- Su Supabase hai eseguito `docs/supabase.sql`, creato l'utente e disattivato le nuove iscrizioni.
- Hai a portata di mano email, password e una passphrase nuova (almeno 12 caratteri).
- Per i punti con due dispositivi servono iPhone **e** Mac con l'app installata.

## Checklist di collaudo (20 punti)

Spunta ogni riga solo se il risultato è esattamente quello descritto.

### Avvio e sezioni
- [ ] **1. Prima apertura.** Oggi mostra il saluto, la data e le 4 card di riepilogo; in basso la barra con Oggi · Auto · Casa · Spesa · Salute; nessun contenuto sotto il notch o sotto la barra Home.
- [ ] **2. Auto.** Aggiungi la tua auto (targa, immatricolazione, km, ultimo tagliando). Compaiono il T-Cross disegnato e i 4 indicatori Bollo, Assicurazione, Revisione, Tagliando, con i giorni che mancano.
- [ ] **3. Scadenza auto.** Imposta la scadenza del bollo, poi **Segna come rinnovato**: la nuova data proposta è +12 mesi e l'indicatore torna verde.
- [ ] **4. Chilometri.** Aggiorna i km: il grafico si aggiorna e "Tagliando previsto" mostra una data (o "stima generica" se ci sono poche letture).
- [ ] **5. Casa: affitto.** Imposta totale, tua quota e giorno di scadenza: compaiono la rata del mese e quella successiva; **Segna come pagato** la mette in verde.
- [ ] **6. Casa: bollette e manutenzioni.** Aggiungi una bolletta e una manutenzione (es. caldaia ogni 12 mesi): il grafico dell'anno e la prossima data sono corretti.
- [ ] **7. Spesa: aggiunta rapida.** Scrivi `latte x2!` e invio: compare "Latte ×2" in Freschi con bagliore ambra "Urgente". Scrivi `riso*`: va in Dispensa come "Scorta".
- [ ] **8. Spesa: spunta e annulla.** Spunta un articolo (tocco o swipe a destra): compare "Annulla" per 5 secondi e funziona. Poi **Concludi spesa**: gli articoli spuntati spariscono e finiscono nello storico (icona orologio).
- [ ] **9. Salute.** Aggiungi una visita (domani alle 10:00) e un vaccino con data di richiamo: la card "Prossima visita" mostra il conto alla rovescia.
- [ ] **10. Oggi.** Gli avvisi in alto sono ordinati per gravità; ✕ o swipe nasconde un avviso per 24 ore. Con più di 6 avvisi compare "Mostra altri N avvisi".

### Blocco Salute
- [ ] **11. PIN.** Alla prima apertura di Salute scegli un PIN di 4–6 cifre. Esci dall'app per più di 5 minuti e rientra in Salute: il PIN viene richiesto; con un PIN sbagliato il tastierino vibra e dopo 5 errori attende 30 secondi.
- [ ] **12. Face ID.** Impostazioni → Blocco Salute → **Usa Face ID / Touch ID**; blocca Salute e sbloccala col volto. Nel multitasking (scorri dal basso) la schermata di Salute appare oscurata.

### Offline
- [ ] **13. Senza rete.** Attiva la modalità aereo, chiudi del tutto l'app (scorri via dal multitasking) e riaprila: si apre in meno di un secondo con tutti i dati; il puntino di stato diventa grigio "Offline".
- [ ] **14. Modifiche offline.** Sempre in modalità aereo aggiungi un articolo alla spesa; disattiva la modalità aereo: entro pochi secondi il puntino torna verde "Sincronizzato" e in Impostazioni "In attesa di invio" è 0.

### Sincronizzazione tra due dispositivi
- [ ] **15. Primo dispositivo (Mac).** Impostazioni → Account e sync → accedi → crea la passphrase (spunta "Ho capito") → il puntino in sidebar diventa verde; "Record nel cloud" è uguale a "Record su questo dispositivo".
- [ ] **16. Secondo dispositivo (iPhone).** Accedi con lo stesso utente e inserisci la passphrase: prima prova una passphrase sbagliata (deve essere rifiutata), poi quella giusta. Auto, Casa, Spesa e Salute mostrano i dati del Mac e il tuo nome nel saluto resta quello del Mac.
- [ ] **17. Modifica e conflitto.** Aggiungi "pane" sull'iPhone, poi sul Mac tocca **Sincronizza ora**: il pane compare. Modifica lo stesso articolo su entrambi con la rete spenta, riaccendila: alla fine entrambi mostrano l'ultima modifica fatta, senza doppioni.

### Promemoria e backup
- [ ] **18. Calendario.** Impostazioni → Promemoria → **Esporta tutti i promemoria** → apri il file con Calendario → **Aggiungi tutto**: trovi le scadenze con gli avvisi (es. bollo 30, 7 e 1 giorno prima alle 09:00). Riesportando e reimportando non si creano doppioni.
- [ ] **19. Pacchetto di backup.** Impostazioni → Backup → **Scarica pacchetto di oggi** → **Salva su File**. In File apri lo .zip: dentro ci sono `nexuslife.json`, `riepilogo.html` (stampabile), `manifest.json` e la cartella `csv` (un CSV apre correttamente colonne e accenti in Numbers o Excel).
- [ ] **20. Ripristino cifrato.** Scarica il pacchetto con **Proteggi con passphrase** (.nxbak). In **Ripristina da pacchetto** scegli il file: con una passphrase sbagliata viene rifiutato; con quella giusta compare "Integrità verificata" e l'anteprima per sezione; **Unisci** non crea doppioni.

## Se qualcosa non va
- **Puntino ambra "Passphrase richiesta"**: Impostazioni → Account e sync → inserisci la passphrase (con "Ricorda su questo dispositivo" non la richiede più).
- **"Tabelle mancanti su Supabase"**: esegui di nuovo `docs/supabase.sql` (è sicuro rieseguirlo).
- **"Orologio del dispositivo: indietro di N min · corretto"** in Account e sync: l'orologio dell'iPhone è sfasato; l'app corregge da sola le date delle modifiche, ma conviene attivare Impostazioni iOS → Generali → Data e ora → Automatiche.
- **Prestazioni (facoltativo)**: collega l'iPhone al Mac, Safari → Sviluppo → [iPhone] → NexusLife → Timeline. Aprendo Spesa o Casa con molti elementi non devono comparire task oltre 100 ms.

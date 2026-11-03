# CLAUDE.md — NexusLife PWA

Questo file è il contesto permanente per Claude Code. Leggilo per intero prima di ogni attività.

## 1. Cos'è
NexusLife è una suite personale di Simo, in italiano, con 5 sezioni fisse: **Oggi, Auto, Casa, Spesa, Salute**.
È una **PWA** (Progressive Web App) installabile su iPhone e Mac con "Aggiungi a Home", ospitata su **GitHub Pages** e sincronizzata tramite **Supabase** (piano gratuito).
- Utente unico. Nessuna analytics, nessun tracker, nessun CDN a runtime.
- **Offline-first**: l'app funziona senza rete e sincronizza quando la rete torna.
- **Cifratura end-to-end**: Supabase riceve solo payload cifrati. I dati sanitari non devono mai essere leggibili dal fornitore.
- **Costo zero**: niente servizi a pagamento, niente piani di prova.

## 2. Stack (vincolante)
- **Nessun build step.** HTML + CSS + JavaScript ES modules serviti così come sono.
- UI: **Preact + htm**, file ESM copiati in `app/vendor/` (scaricati da npm una volta sola, poi committati). Vietato importare da CDN a runtime.
- Persistenza locale: **IndexedDB** (wrapper minimale scritto da noi, nessuna libreria).
- Cloud: **Supabase** via `fetch` su REST (PostgREST + GoTrue). Niente SDK `@supabase/supabase-js`.
- Crittografia: **WebCrypto** (AES-GCM 256, chiave derivata con PBKDF2-SHA256, 600.000 iterazioni).
- Test: **`node --test`** sui moduli di dominio puri (Node 20+, nessuna dipendenza).
- Deploy: **GitHub Actions → GitHub Pages**, cartella `app/` pubblicata tale e quale.
- Lingua UI `it-IT`, valuta EUR (`Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'})`), date `Intl.DateTimeFormat('it-IT')`.

## 3. Struttura del repository
```
/
├── CLAUDE.md
├── docs/                     # note tecniche, SQL, checklist
│   └── supabase.sql
├── app/                      # ← pubblicata su GitHub Pages
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── sw.js                 # service worker (cache app-shell, versione in costante)
│   ├── config.js             # SUPABASE_URL e SUPABASE_ANON_KEY (pubblici per design)
│   ├── icons/                # icone PWA generate in SVG/PNG
│   ├── vendor/               # preact, htm (ESM)
│   ├── styles/
│   │   ├── tokens.css        # variabili colore, spaziature, raggi, ombre, motion
│   │   ├── base.css
│   │   └── components.css
│   └── src/
│       ├── main.js           # bootstrap, router, registrazione SW
│       ├── router.js         # hash router: #/oggi #/auto #/casa #/spesa #/salute #/impostazioni
│       ├── store/            # db.js (IndexedDB), repo.js (CRUD + tombstone), state.js (segnali)
│       ├── domain/           # logiche PURE e testate (nessun accesso a DOM o IndexedDB)
│       │   ├── dates.js  deadlines.js  service.js  mileage.js
│       │   ├── rent.js   groceries.js  suggestions.js  reminders.js
│       │   └── dedupe.js
│       ├── sync/             # crypto.js, auth.js, api.js, sync.js
│       ├── backup/           # zip.js (writer/reader STORE + CRC32), csv.js, report.js, package.js, restore.js
│       ├── ui/               # componenti: GlassCard, HudGauge, DigitalTwin, NeonBadge, Sheet, TabBar, Sidebar, Banner, Toast
│       └── views/            # oggi/, auto/, casa/, spesa/, salute/, impostazioni/
├── tests/                    # *.test.js per src/domain
└── .github/workflows/        # pages.yml, keepalive.yml
```
Usa sempre **percorsi relativi** (`./src/...`): il sito vive sotto `https://<utente>.github.io/<repo>/`.

## 4. Regole ferree
1. Codice completo e funzionante. Niente `TODO`, niente stub, niente dati finti lasciati nel prodotto. È ammesso un pulsante "Carica dati demo" in Impostazioni, separato e cancellabile.
2. Le logiche in `src/domain/` sono funzioni pure, ricevono `today` come parametro (mai `new Date()` interno) e hanno test.
3. Prima di dichiarare finita una fase: `node --test tests/` verde, nessun errore in console aprendo `app/index.html` con un server statico (`npx serve app` o `python3 -m http.server -d app`), controllo visivo a 390 px e a 1280 px.
4. Accessibilità: contrasto AA sul testo, `aria-label` su icone e gauge, focus visibile, `prefers-reduced-motion` rispettato.
5. Mai committare la `service_role` key né password. In `config.js` stanno solo URL e chiave `anon`.
6. Ogni modifica allo schema dati locale incrementa la versione IndexedDB con migrazione esplicita.
7. Ogni modifica ai file dell'app shell incrementa `CACHE_VERSION` in `sw.js`.
8. Messaggi di commit in italiano, brevi, all'imperativo.

## 5. Design system "Super WOW"
Dark mode unico. Stile: Spatial Glassmorphism + card "Digital Twin". Livello Apple Design Award.

**Colori (`tokens.css`)**
```
--obsidian:#0A0A0C; --obsidian-elevated:#121216; --obsidian-raised:#1A1B20;
--titanium-deep:#2A2C31; --titanium:#5C5F66; --titanium-light:#8E9196; --titanium-specular:#C7CAD1;
--champagne:#D9BF8C; --champagne-light:#F2E3C2; --champagne-deep:#9C8355;   /* accento principale */
--electric-blue:#3D8BFF; --electric-blue-glow:#6FA8FF;
--mint:#3DDC97; --amber:#FFB020; --alarm-red:#FF453A; --health:#FF6B8B;
--text-primary:#F5F5F7; --text-secondary:#A1A1A6; --text-tertiary:#6E6E73;
```
Stato → colore: `ok` mint · `warning` amber · `critical` alarm-red · `overdue` alarm-red con pulsazione · `unknown` titanium.

**Font**: `--font-rounded: ui-rounded,'SF Pro Rounded',Nunito,system-ui,sans-serif;` per UI e numeri; `--font-serif:'New York',ui-serif,Newsreader,Georgia,serif;` per titoli di sezione. Nunito e Newsreader self-hosted in `app/fonts/` (woff2), nessuna richiesta a Google a runtime. Numeri con `font-variant-numeric: tabular-nums`.

**Sfondo**: base obsidian + 2–3 gradienti radiali molto morbidi (champagne 6%, electric-blue 5%) che si spostano lentamente (animazione 40 s, disattivata con reduced-motion).

**Ricetta vetro (GlassCard)**
```
background: linear-gradient(155deg, rgba(255,255,255,.09), rgba(255,255,255,.03));
backdrop-filter: blur(24px) saturate(160%); -webkit-backdrop-filter: blur(24px) saturate(160%);
border: 1px solid rgba(255,255,255,.10); border-radius: 24px;
box-shadow: 0 1px 0 rgba(255,255,255,.12) inset,          /* specular highlight superiore */
            0 -1px 0 rgba(0,0,0,.35) inset,
            0 2px 4px rgba(0,0,0,.25), 0 12px 24px rgba(0,0,0,.30), 0 32px 64px rgba(0,0,0,.35);
```
Più un riflesso radente: pseudo-elemento `::before` con gradiente lineare diagonale bianco 0→8%→0 che segue il puntatore (solo con `hover:hover`).

**Motion**: molle simulate con `cubic-bezier(.34,1.56,.64,1)` 450 ms per entrate e pressioni; transizioni di pagina 300 ms fade + translateY 8 px; pressione card `scale(.97)`. Haptics: `navigator.vibrate(10)` dove supportato (su iOS non c'è, va bene così).

**Componenti chiave**
- **HudGauge**: anello SVG 270°, traccia titanium-deep, arco colorato per stato con glow (`filter: drop-shadow`), valore centrale grande (giorni o km) e etichetta. **Si svuota** con il tempo: riempimento = porzione di periodo rimanente (D2).
- **DigitalTwin**: T-Cross grigio metallizzato in **SVG vettoriale disegnato a mano**, vista 3/4 anteriore, ~10 layer (ombra a terra, carrozzeria con gradiente metallico, linea di cintura, vetri scuri con riflesso, cerchi a razze, fari LED con alone champagne, barre portapacchi, specchietti, luce radente animata che scorre sulla carrozzeria). Supporta un'immagine opzionale `app/assets/tcross.jpg` se presente (D8). Intorno, i 4 HudGauge: Bollo, Assicurazione, Revisione, Tagliando.
- **NeonBadge**: pill con bordo luminoso; urgente = ambra, urgente da > 2 giorni = rosso, con pulsazione lenta.
- **Navigazione**: su viewport < 900 px TabBar inferiore in vetro con 5 voci fisse (D3) e `env(safe-area-inset-bottom)`; ≥ 900 px Sidebar sinistra in vetro + contenuto a colonna/dettaglio, scorciatoie tastiera `1`–`5` per le sezioni, `N` nuovo elemento, `/` ricerca, `Esc` chiudi sheet.
- **Sheet**: pannello modale dal basso su mobile, dialog centrato su desktop.

## 6. Modello dati
Ogni record: `{ id (UUID v4), entity, createdAt, updatedAt (ISO), deleted (bool), ...campi }`. Le eliminazioni sono **tombstone** (`deleted:true`), eliminate davvero dopo 180 giorni.

| entity | campi principali |
|---|---|
| `vehicle` | name, make, model, plate, color, registrationDate, currentKm, serviceIntervalKm (15000), serviceIntervalMonths (12), lastServiceDate, lastServiceKm, photo (false) |
| `vehicleDeadline` | vehicleId, type (`bollo`/`assicurazione`/`revisione`), dueDate, amount?, provider?, recurrenceMonths?, notes |
| `mileageReading` | vehicleId, date, km |
| `vehicleExpense` | vehicleId, date, category (tagliando/riparazione/gomme/carburante/altro), amount, km?, description |
| `rentContract` | totalAmount, personalShare, dueDay, startDate, landlord?, notes |
| `rentInstallment` | contractId, periodKey (`yyyy-MM`), dueDate, amount, paidAt? |
| `bill` | kind (luce/gas/internet/acqua/rifiuti/altro), dueDate, amount, paidAt?, provider?, notes |
| `homeMaintenance` | title, intervalMonths, lastDoneDate, notes |
| `homePurchase` | name, category (arredamento/ferramenta/detersivi/bricolage/altro), priority (alta/media/bassa), estimatedPrice?, done |
| `groceryItem` | name, normName, quantity, urgency (`urgente`/`normale`/`scorta`), categoryId, addedAt, checkedAt?, archived |
| `groceryPurchase` | normName, name, date, categoryId |
| `groceryCategory` | name, normName, icon, color, builtin (bool), order |
| `suggestionFeedback` | normName, muted (bool), snoozeUntil? |
| `medicalVisit` | type (dentista/oculista/controllo annuale/altro), dateTime, doctor, place, notes, postNotes |
| `vaccine` | name, date, lot?, boosterDate?, notes |
| `settings` | (record unico id fisso `settings`) healthLockEnabled (true, D7), reminderHour (9), dismissedBanners, lastBackupAt |

Categorie spesa predefinite (D6): Freschi, Dispensa, Bevande, Cura Casa, Altro + personalizzate. Nessun allegato (D9).

## 7. Logiche di dominio (da implementare e testare esattamente così)
- **Stato scadenza** con `d` = giorni di calendario da oggi: `ok` d>30 · `warning` 8≤d≤30 · `critical` 0≤d≤7 · `overdue` d<0 · `unknown` data mancante.
- **Tagliando**: `nextDate = lastServiceDate + intervalMonths`; `nextKm = lastServiceKm + intervalKm`; `usedRatio = (currentKm − lastServiceKm)/intervalKm` → ok <0,85 · warning 0,85–0,95 · critical 0,95–1,0 · overdue >1,0. Stato finale = il più grave tra data e km.
- **Stima km/giorno**: regressione lineare sulle letture degli ultimi 180 giorni (≥ 2 letture distanti ≥ 14 giorni), pendenza limitata a [0, 500]; altrimenti 33 km/giorno con etichetta "stima generica". Serve a stimare la data in cui si raggiungono i km del tagliando.
- **Rinnovi proposti** (dopo "Segna come rinnovato"): bollo +12 mesi; assicurazione +12 mesi (o +6 se `recurrenceMonths=6`); revisione: la prima a fine mese di immatricolazione + 4 anni, le successive +24 mesi.
- **Affitto**: genera la rata del mese corrente e del successivo (chiave `periodKey`), giorno di scadenza oltre fine mese → ultimo giorno. Stato `paid` se `paidAt`; altrimenti `overdue` se oggi > dueDate; altrimenti `pending`. Mostra totale e quota personale (D5), entrambi chiesti al primo avvio.
- **Suggerimenti spesa**: storico 180 giorni per `normName`; ≥ 3 acquisti (stesso giorno = 1); `ciclo = mediana(intervalli)`; `variabilità = devstd/media`; `maturità = giorni dall'ultimo acquisto / ciclo`. Suggerisci se maturità ≥ 0,85, non già in lista, non muted, non in snooze. Confidenza alta <0,25, media <0,5, bassa altrimenti (bassa solo con maturità ≥ 1,0). Max 8, ordinati per maturità. Esempio di test obbligatorio: latte ogni 7 giorni, ultimo 6 giorni fa → 0,857 → suggerito.
- **Aggiunta rapida spesa**: `latte x2!` → quantità 2, urgente; `*` finale → scorta; `x3` o `3x` → quantità. Categoria proposta: ultima usata per quel `normName` → dizionario italiano di parole chiave (latte→Freschi, acqua→Bevande, detersivo→Cura Casa…) → Dispensa.
- **Spesa, comportamenti**: bagliore ambra se urgente, rosso se urgente da > 2 giorni; spunta con "Annulla" per 5 s; "Concludi spesa" crea i `groceryPurchase` e archivia gli spuntati; spuntati da > 6 h archiviati automaticamente all'avvio; snooze suggerimento 3 giorni; categoria eliminata → articoli in Altro.
- **Normalizzazione nomi**: minuscolo, trim, spazi singoli, senza accenti (NFD), plurali comuni non toccati.
- **Banner Oggi**: elementi in warning/critical/overdue entro 30 giorni, ordinati per gravità poi data; swipe o ✕ = nascosto 24 h.
- **Preavvisi** (per export calendario): auto 30/7/1 giorni e giorno stesso; affitto e bollette 3 giorni e giorno stesso; manutenzioni casa 7 giorni; visite 24 h e 2 h; richiami vaccino 30 e 7 giorni; ora predefinita 09:00 Europe/Rome.
- **Deduplicazione** (dopo sync): veicolo per targa normalizzata; scadenza auto per (veicolo, tipo); rata per (contratto, periodKey) con vince la pagata; feedback per normName (muted OR, snooze max); categoria per normName; articolo aperto per normName (quantità max, urgenza più alta). Il perdente diventa tombstone.

## 8. Sync e sicurezza
- Tabella unica `records(user_id, entity, id, updated_at, deleted, iv, payload, server_ts)` con RLS `user_id = auth.uid()`. `payload` = JSON del record cifrato AES-GCM, base64. Solo `entity`, `id`, `updated_at`, `deleted` sono in chiaro.
- Tabella `vault(user_id, salt, verifier, iterations)`: il `verifier` è una stringa nota cifrata con la chiave, serve a controllare la passphrase. La passphrase non lascia mai il dispositivo; la chiave derivata è non estraibile e resta in memoria (opzionalmente in IndexedDB come `CryptoKey` non estraibile se l'utente sceglie "ricorda su questo dispositivo").
- Scrittura tramite RPC `upsert_records(jsonb)`: aggiorna solo se `updated_at` in arrivo è più recente (last-writer-wins per record). Lettura incrementale per `server_ts > cursor`.
- Auth: email + password Supabase (`/auth/v1/token?grant_type=password`), refresh token gestito, iscrizioni nuove disattivate dopo la creazione dell'account.
- Coda in uscita in IndexedDB; sync all'avvio, al ritorno online, ogni 60 s in primo piano, e con pulsante manuale. Stato sync visibile (puntino in sidebar/tab).
- **Blocco Salute** (D7): PIN locale di 4–6 cifre (hash PBKDF2 salvato in locale), richiesto aprendo Salute dopo 5 minuti di inattività. WebAuthn (Face ID/Touch ID) offerto come alternativa dove disponibile.
- **Promemoria**: niente web push. Export `.ics` (VEVENT + VALARM per ogni preavviso) da Impostazioni e dal dettaglio di ogni scadenza, da aprire con Calendario.
- **Pacchetto di backup** (Impostazioni → Backup → "Scarica pacchetto di oggi"): un file `NexusLife_backup_AAAA-MM-GG.zip` con la fotografia dei dati a quel giorno. Lo ZIP è generato in puro JS da `src/backup/zip.js` (formato STORE senza compressione + CRC32, nessuna libreria). Contenuto:
  - `nexuslife.json`: tutti i record non eliminati, con `schemaVersion`, `appVersion`, `exportedAt`. È il file usato per il ripristino.
  - `csv/<entity>.csv`: un CSV per entità, UTF-8 con BOM, separatore `;`, decimali con virgola, date `GG/MM/AAAA`, così si apre direttamente in Excel italiano.
  - `riepilogo.html`: pagina autonoma stampabile (stile chiaro, adatto alla stampa) con lo stato a quel giorno: scadenze auto, km, rate affitto e bollette dell'anno, manutenzioni, lista spesa aperta, prossime visite, libretto vaccini.
  - `manifest.json`: elenco dei file con numero di record e SHA-256 di ciascuno, per verificare l'integrità.
  - Opzione **"Proteggi con passphrase"**: invece dello ZIP scarica `NexusLife_backup_AAAA-MM-GG.nxbak`, cioè lo stesso ZIP cifrato AES-GCM con chiave PBKDF2 (salt e iterazioni nell'intestazione). Consigliata se il file finisce su iCloud Drive, email o chiavette.
  - Opzione "Escludi Salute" per un pacchetto da condividere (es. col coinquilino per l'affitto).
- **Ripristino**: Impostazioni → Backup → "Ripristina da pacchetto" accetta `.zip`, `.nxbak` o `nexuslife.json`. Verifica gli hash del manifest, mostra un'anteprima (record per sezione, data del pacchetto), poi offre due modalità: **Unisci** (merge per `updatedAt`, poi dedupe) oppure **Sostituisci tutto** (doppia conferma; i record attuali diventano tombstone, così anche il cloud si allinea).
- Su iPhone il download usa `navigator.share({files})` quando disponibile ("Salva su File"), altrimenti un link di download. Si registrano `lastBackupAt` e l'elenco degli ultimi 10 pacchetti (data, dimensione, record). In Oggi compare un promemoria se l'ultimo pacchetto ha più di 30 giorni (soglia modificabile: 7/14/30/60).

# NexusLife

La suite personale di Simo, in italiano: cinque sezioni — **Oggi, Auto, Casa, Spesa, Salute** — più il Giardino zen (una pianta per categoria che mostra a colpo d'occhio cosa è in sospeso) e Impostazioni.
Scadenze dell'auto con gemello digitale del T-Cross, affitto e bollette, lista della spesa che suggerisce cosa
ricomprare, visite e vaccini con blocco a PIN o Face ID.

**App: https://simonebiscaro.github.io/nexuslife/**
Si installa come un'app: su iPhone Safari → Condividi → *Aggiungi alla schermata Home*; su Mac Safari → File → *Aggiungi al Dock*.
Istruzioni complete e collaudo in [`docs/CHECKLIST_IPHONE.md`](docs/CHECKLIST_IPHONE.md).

## Privacy
- **I dati restano tuoi.** L'app funziona anche offline: tutto è salvato sul dispositivo (IndexedDB).
- **Sincronizzazione cifrata end-to-end.** Prima di lasciare il dispositivo ogni record è cifrato con AES-GCM 256,
  con una chiave derivata dalla tua passphrase (PBKDF2-SHA256, 600.000 iterazioni). Supabase vede solo tipo, id,
  data di modifica e testo illeggibile: nemmeno il fornitore può leggere i dati, quelli sanitari compresi.
  La passphrase non viene mai inviata: **se la perdi, i dati nel cloud non sono recuperabili** (quelli sul dispositivo sì).
- Nessuna pubblicità, analytics o tracciamento; nessuna risorsa caricata da altri siti. Costo zero (GitHub Pages + Supabase Free).

## Backup
Impostazioni → Backup → **Scarica pacchetto di oggi** crea `NexusLife_backup_AAAA-MM-GG.zip` con:
`nexuslife.json` (per il ripristino), un CSV per sezione (si apre in Excel/Numbers), `riepilogo.html` stampabile
e `manifest.json` con gli SHA-256 per verificare l'integrità.
- **Proteggi con passphrase** produce invece un file `.nxbak` cifrato: consigliato se finisce su iCloud Drive, email o chiavette.
- **Ripristina da pacchetto** accetta `.zip`, `.nxbak` o `nexuslife.json`: verifica gli hash, mostra un'anteprima e
  permette di **unire** o **sostituire tutto**.
- Oggi ti ricorda di fare un backup dopo 30 giorni (soglia modificabile: 7/14/30/60).

## Per lo sviluppo
HTML, CSS e moduli JavaScript serviti così come sono (Preact + htm in `app/vendor/`), senza build step.
- Avvio locale: `python3 -m http.server -d app 8080` e apri http://localhost:8080/
- Test: `node --test tests/` (Node 20+, nessuna dipendenza)
- Deploy: ogni push su `main` pubblica `app/` su GitHub Pages (`.github/workflows/pages.yml`).
- Database: `docs/supabase.sql`. Keepalive del progetto gratuito: `.github/workflows/keepalive.yml` (secrets `SUPABASE_URL` e `SUPABASE_ANON_KEY`).
- In Pages la sorgente deve essere "GitHub Actions" (Settings → Pages).
- Catalogo dei componenti: `#/impostazioni/design` (o 5 tocchi sulla riga "Versione" in Impostazioni).
- `app/vendor/`: preact, preact/hooks e htm copiati da npm (versioni in `app/vendor/VERSIONS.txt`);
  `app/fonts/`: Nunito e Newsreader da `@fontsource` (licenza OFL).
- Ogni modifica ai file dell'app shell richiede di incrementare `CACHE_VERSION` in `app/sw.js`;
  `tests/app-shell.test.js` segnala i file mancanti dall'elenco `SHELL`, `tests/budget.test.js` il peso della shell.
- Regole del progetto: [`CLAUDE.md`](CLAUDE.md).

# NexusLife

Suite personale PWA (Oggi, Auto, Casa, Spesa, Salute), offline-first, senza build step.
Specifiche vincolanti in [CLAUDE.md](CLAUDE.md).

## Avvio in locale

```bash
python3 -m http.server -d app 8080
```

Poi apri http://localhost:8080/. Il catalogo dei componenti è in `#/impostazioni/design`
(oppure tocca 5 volte la riga "Versione" in Impostazioni).

## Test

```bash
node --test tests/
```

## Deploy

Ogni push su `main` esegue i test e pubblica la cartella `app/` su GitHub Pages
(`.github/workflows/pages.yml`). Nelle impostazioni del repository, sezione Pages,
la sorgente deve essere "GitHub Actions".

## Note

- `app/vendor/`: preact, preact/hooks e htm copiati da npm (versioni in `app/vendor/VERSIONS.txt`).
- `app/fonts/`: Nunito e Newsreader da `@fontsource` (licenza OFL).
- Ogni modifica ai file dell'app shell richiede di incrementare `CACHE_VERSION` in `app/sw.js`;
  il test `tests/app-shell.test.js` segnala i file mancanti dall'elenco `SHELL`.

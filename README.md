# AGOAD

Prototipo RPG top-down, giocabile da browser, con struttura modulare pronta per espansioni.

## Avvio

Da root progetto:

```bash
node server/index.mjs
```

Apri `http://localhost:8080`.

## Ambienti

- Test locale: `http://localhost:8080`
- Produzione giocatori: `https://ordwa.github.io/AGOAD/`

### Configurazione Cloud Sync (Google + GitHub)

Per login Google e salvataggi server-side in Git (per-account), copia il file esempio:

```bash
cp .env.example .env
```

Poi aggiorna in `.env` i valori reali (`SESSION_SECRET`, `GITHUB_TOKEN`, ecc.) e avvia:

```bash
node server/index.mjs
```

Configura il client id in `index.html`:

- meta tag: `<meta name="google-client-id" content="...">`

Per produzione (frontend su GitHub Pages + backend su dominio separato):

- backend env: `COOKIE_SAMESITE="None"` e `COOKIE_SECURE="1"`
- in GitHub repo imposta `Settings > Secrets and variables > Actions`:
  - `Variables`: `API_BASE_URL`
  - opzionale: `GOOGLE_CLIENT_ID` (se vuoi iniettarlo a deploy, senza virgolette)

### Deploy backend gratis (Render)

Il progetto include gia' `render.yaml` per deploy rapido del backend Node.

1. Vai su Render e crea un account (login con GitHub).
2. `New +` -> `Blueprint`, seleziona questo repository.
3. Conferma il servizio `agoad-backend` (plan `free`).
4. In Render imposta gli env richiesti:
   - `GOOGLE_CLIENT_ID`
   - `GITHUB_TOKEN` (permesso `contents:write`)
5. Attendi deploy e copia URL pubblico backend, esempio:
   - `https://agoad-backend.onrender.com`
6. Verifica: apri `https://agoad-backend.onrender.com/api/health` e controlla `{"ok":true}`.
7. Su GitHub repository imposta `Settings > Secrets and variables > Actions > Variables`:
   - `API_BASE_URL=https://agoad-backend.onrender.com`
8. Fai push su `main`/`master` per rifare deploy Pages.

Note:

- `GITHUB_TOKEN` deve avere permessi di scrittura sui contenuti repo (`contents:write`).
- `CORS_ALLOWED_ORIGINS` deve includere sempre `https://ordwa.github.io` in produzione.
- I progressi giocatore sono salvati in `server-data/players/<google-sub>.json` nel repo.
- I dati globali GM (classi/nemici) sono salvati in `server-data/game-data.json` nel repo.

## Deploy GitHub Pages (configurato)

Nel progetto e' gia' presente il workflow:

- `.github/workflows/deploy-pages.yml`

Fa deploy automatico su GitHub Pages ad ogni push su `main` o `master`.

Importante: GitHub Pages e' solo statico.  
Le API (`/api/*`) per login Google e salvataggi su Git devono girare su un server Node separato (o su una piattaforma serverless compatibile).

### Cosa devi fare una volta sola su GitHub

1. Crea un repository su GitHub e pusha questo progetto.
2. Vai in `Settings > Pages`.
3. In `Source` seleziona `GitHub Actions`.
4. Fai un push (anche piccolo) su `main` o `master`.
5. Aspetta il workflow in `Actions` (1-3 minuti).
6. Otterrai l'URL pubblico tipo:
   - `https://<utente>.github.io/<repo>/`
7. Per collegare il backend in produzione, imposta `API_BASE_URL` nelle Actions Variables e rifai push.

### Uso da telefono

1. Apri l'URL GitHub Pages dal browser del telefono.
2. Aggiungi alla home:
   - iPhone (Safari): `Condividi > Aggiungi a schermata Home`
   - Android (Chrome): `Menu > Aggiungi a schermata Home` o `Installa app`
3. Da quel momento lo apri da icona, senza PC acceso e senza LAN.

### Come funzionano gli aggiornamenti

1. Modifichi il codice in locale.
2. `git add . && git commit -m \"...\" && git push`
3. GitHub Actions rifa il deploy automaticamente.
4. Sul telefono apri/ricarica la pagina e vedi la nuova versione.

Nota: se il browser tiene cache vecchia, fai una ricarica forzata o riapri dalla home.

## Meccaniche implementate

- Setup iniziale: scelta nome personaggio e classe
- Tre classi base: Guerriero, Mago, Ladro (statistiche e abilita' speciali diverse)
- Esplorazione mappa tile-based (movimento a griglia)
- Collisioni base (alberi/acqua non attraversabili)
- NPC con dialogo
- Incontri casuali nell'erba alta
- Battaglia turn-based con menu stile classico (`FIGHT`, `BAG`, `SKILLS`, `RUN`)
- In battaglia: `FIGHT` contiene `ATTACK`, `SKILLS` contiene l'abilita' speciale classe (consumo mana)
- In battaglia: `BAG` apre una schermata inventario dedicata per usare oggetti
- Fine battaglia: nessun recupero automatico; HP/MP si ripristinano andando a dormire al punto di cura
- Schermata profilo/inventario con accesso rapido (`I` inventario, `P` personaggio)
- HP e inventario persistenti tra scene

## Controlli

- `WASD` / frecce: movimento o navigazione menu
- `Invio`: conferma
- `Spazio` o `Esc`: indietro / chiudi menu
- `I`: apri inventario
- `P`: apri schermata personaggio
- Touch input testo: pulsanti `ABC` (inserisci testo) e `CANC` (backspace), dove previsti
- In battaglia: inventario solo tramite `BAG`; `I/P` non aprono le schede
- Nella schermata iniziale: inserisci il nome e conferma classe con `Invio`
- Nel menu iniziale: supporto touch (tap sulle voci; in `OPTIONS` usa i pulsanti `+/-`)

## Struttura

- `src/core`: game loop, input, classe scena
- `src/data`: costanti e dati di gioco
- `src/scenes`: `SetupScene`, `WorldScene`, `BattleScene`, `ProfileScene`

## Nota stile

Palette e resa pixel sono ispirate ai classici RPG GBA, senza usare asset originali proprietari.

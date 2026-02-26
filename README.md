# Mini Browser RPG

Prototipo RPG top-down, giocabile da browser, con struttura modulare pronta per espansioni.

## Avvio

Da root progetto:

```bash
python3 -m http.server 8080
```

Apri `http://localhost:8080`.

## Deploy GitHub Pages (configurato)

Nel progetto e' gia' presente il workflow:

- `.github/workflows/deploy-pages.yml`

Fa deploy automatico su GitHub Pages ad ogni push su `main` o `master`.

### Cosa devi fare una volta sola su GitHub

1. Crea un repository su GitHub e pusha questo progetto.
2. Vai in `Settings > Pages`.
3. In `Source` seleziona `GitHub Actions`.
4. Fai un push (anche piccolo) su `main` o `master`.
5. Aspetta il workflow in `Actions` (1-3 minuti).
6. Otterrai l'URL pubblico tipo:
   - `https://<utente>.github.io/<repo>/`

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

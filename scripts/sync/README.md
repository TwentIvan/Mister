# Script di sincronizzazione API-Football

Script TypeScript per importare i dati Serie A da API-Football v3 nel DB locale.

## Avvio dry-run (nessuna connessione al DB, nessuna chiamata HTTP)

```bash
pnpm --filter @workspace/scripts sync:players  --dry-run
pnpm --filter @workspace/scripts sync:teams    --dry-run
pnpm --filter @workspace/scripts sync:fixtures --dry-run --rounds=1,2,3,4
pnpm --filter @workspace/scripts sync:stats    --dry-run --rounds=1
```

## Modalità live (bloccata fino al task 5c)

Il flag `--live` causa un errore esplicito:

> live mode disabled in task 5b — abilitare solo nel task 5c dopo aver configurato API_FOOTBALL_KEY

Sarà sbloccato nel task 5c quando `API_FOOTBALL_KEY` sarà configurato come Secret.

## Struttura del progetto

```
scripts/sync/
├── lib/
│   ├── client.ts       — client HTTP (mock/live), rate limiter 10 req/min
│   ├── checkpoint.ts   — checkpoint persistente in .checkpoint.json
│   └── role-mapper.ts  — mappa posizioni inglesi API → tipi DB
├── players.ts          — sync anagrafica giocatori
├── teams.ts            — sync squadre (mappa team_id → nome)
├── fixtures.ts         — sync calendario (report, non scrive in DB)
├── stats.ts            — sync statistiche giocatore per partita
└── fixtures-mock/      — file JSON di esempio per ogni endpoint
    ├── leagues.json
    ├── teams.json
    ├── players.json
    ├── players-squads.json
    ├── players-topscorers.json
    ├── fixtures.json
    ├── fixtures-players.json
    └── fixtures-statistics.json
```

## Aggiungere un mock

1. Posizionare il file `.json` in `scripts/sync/fixtures-mock/`
2. Registrare la chiave endpoint in `lib/client.ts` nella costante `ENDPOINT_TO_MOCK`

## Checkpoint

Il checkpoint è salvato in `scripts/sync/.checkpoint.json` (ignorato da git).
Permette di riprendere un sync interrotto dall'ultima pagina completata.

```typescript
import { loadCheckpoint, saveCheckpoint, clearCheckpoint } from "./lib/checkpoint.js";

const state = loadCheckpoint("players") as { lastPage?: number } | null;
saveCheckpoint("players", { lastPage: 5 });
clearCheckpoint("players");
```

## Mapping ruoli

| API-Football (`games.position`) | DB `role_classic` |
|---------------------------------|-------------------|
| `Goalkeeper`                    | `GK`              |
| `Defender`                      | `DEF`             |
| `Midfielder`                    | `MID`             |
| `Attacker`                      | `ATT`             |

La funzione `mapRoleClassic()` lancia un errore esplicito su input sconosciuto — nessun fallback silente.

**Nota**: il DB usa `GK/DEF/MID/ATT`, non le abbreviazioni italiane `P/D/C/A`.

## Rate limit

| Modalità | Intervallo minimo |
|----------|------------------|
| mock     | nessuno          |
| live     | 6 secondi (10 req/min) |

## Ordine di esecuzione consigliato (live, task 5c)

1. `sync:teams` — popola la mappa team_id → nome
2. `sync:players` — anagrafica giocatori (dipende da team names)
3. `sync:fixtures` — calendario (fixture_id → round mapping)
4. `sync:stats` — statistiche per partita (dipende da players + fixtures)

## Schema DB coinvolto

- `players` — anagrafica statica giocatori (PK = API-Football player_id)
- `player_giornata_stats` — una riga per giocatore × giornata

**Attenzione**: `player_giornata_stats` non ha attualmente una unique constraint
su `(player_id, fixture_id)`. Prima di attivare la modalità live sarà necessario
aggiungere tale constraint per garantire gli upsert idempotenti.
Documentato qui — nessuna modifica allo schema effettuata in questo task.

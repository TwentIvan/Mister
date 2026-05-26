# Survey API-Football v3 — Mister (Serie A 2024)

> **Scope**: Serie A 2024 (league=135, season=2024) — 20 squadre, ~500 giocatori, 38 giornate totali.
> **Subset test**: prime 10 giornate.
> **Nessuna chiamata reale effettuata**. Tutti gli esempi provengono dalla documentazione pubblica api-sports.io.

---

## Rate limit e piano

| Piano | Richieste/giorno | Richieste/minuto |
|-------|-----------------|-----------------|
| Free  | 100             | 10              |
| Pro   | 7.500           | 10              |
| Ultra | 30.000          | 10              |

Per lo scope completo (38 giornate) sono necessarie circa **3.400–3.900 richieste**. Il piano Free è insufficiente per il popolamento iniziale. Il piano Pro copre il seeding ma richiede distribuzione su più giorni. Il piano Ultra copre tranquillamente l'intera stagione in un singolo run.

---

## Endpoint 1 — `/leagues`

**URL completo**: `GET https://v3.football.api-sports.io/leagues`

**Parametri obbligatori**: nessuno (ma senza filtri ritorna tutti i campionati)

**Parametri utili**:

| Parametro | Valore | Descrizione |
|-----------|--------|-------------|
| `id`      | `135`  | Serie A italiana |
| `season`  | `2024` | Stagione 2024/25 |
| `current` | `true` | Solo campionati in corso |

**Cardinalità risposta**: 1 item (la lega richiesta con array `seasons`). Senza filtri: centinaia di leghe.

**Paginazione**: nessuna per singola lega.

**Note**: La risposta contiene il flag `coverage` che indica quali dati sono disponibili per quella stagione (lineups, statistiche giocatori, ecc.). Da verificare prima di avviare il sync.

**Mock**: `scripts/sync/fixtures-mock/leagues.json`

**Stima request**: **1** (una-tantum, seeding)

---

## Endpoint 2 — `/teams`

**URL completo**: `GET https://v3.football.api-sports.io/teams`

**Parametri obbligatori**: almeno uno tra `id`, `name`, `league`+`season`, `country`

**Parametri utili**:

| Parametro | Valore | Descrizione |
|-----------|--------|-------------|
| `league`  | `135`  | Filtra per lega |
| `season`  | `2024` | Stagione di riferimento |

**Cardinalità risposta**: 20 items (tutte le squadre Serie A 2024 in una sola risposta). Include dati stadio.

**Paginazione**: nessuna (20 squadre stano in una pagina).

**Note**: I `team.id` restituiti sono i riferimenti stabili da usare per `/players/squads` e come FK in tutti gli endpoint fixture. Memorizzare la mappa `team_id → team_name` prima del sync dei giocatori.

**Mock**: `scripts/sync/fixtures-mock/teams.json`

**Stima request**: **1** (una-tantum, seeding)

---

## Endpoint 3 — `/players`

**URL completo**: `GET https://v3.football.api-sports.io/players`

**Parametri obbligatori**: `league`+`season` oppure `team`+`season` oppure `id`+`season`

**Parametri utili**:

| Parametro | Valore  | Descrizione |
|-----------|---------|-------------|
| `league`  | `135`   | Serie A |
| `season`  | `2024`  | Stagione |
| `page`    | `1`..N  | Paginazione (20 giocatori/pagina) |

**Cardinalità risposta**: 20 giocatori/pagina. Per Serie A 2024: circa 500–520 giocatori → **26 pagine**.

**Paginazione**: obbligatoria. Il campo `paging.total` indica il numero di pagine da richiedere.

**Note**: La risposta include sia dati anagrafici (`player.*`) che statistiche aggregate di stagione (`statistics[]`). Le statistiche aggregate sono utili per il valore iniziale del giocatore, ma i dati granulari per giornata vengono da `/fixtures/players`. L'oggetto `games.position` usa label inglesi ("Goalkeeper", "Defender", "Midfielder", "Attacker") da mappare ai ruoli Classico del DB (`GK`, `DEF`, `MID`, `ATT`).

**Mock**: `scripts/sync/fixtures-mock/players.json`

**Stima request**:
- Seeding iniziale (tutte le pagine): **26**
- Aggiornamento settimanale (solo profili modificati): non supportato direttamente — rifare le 26 pagine o usare per-team

---

## Endpoint 4 — `/players/squads`

**URL completo**: `GET https://v3.football.api-sports.io/players/squads`

**Parametri obbligatori**: `team` oppure `player`

**Parametri utili**:

| Parametro | Valore | Descrizione |
|-----------|--------|-------------|
| `team`    | es. `505` | ID squadra (Inter) |

**Cardinalità risposta**: 1 item per team, con array `players` (tipicamente 25–30 giocatori). Non include statistiche — solo anagrafica base + numero maglia + posizione.

**Paginazione**: nessuna.

**Note**: Endpoint rapido per verificare la rosa corrente senza scaricare le statistiche complete. Utile per il sync incrementale: confrontare con il DB e rilevare nuovi acquisti/cessioni. Non include la `season` come parametro — ritorna la rosa attuale al momento della richiesta.

**Mock**: `scripts/sync/fixtures-mock/players-squads.json`

**Stima request**:
- Seeding iniziale (20 squadre): **20**
- Aggiornamento rosa (settimanale): **20**

---

## Endpoint 5 — `/fixtures`

**URL completo**: `GET https://v3.football.api-sports.io/fixtures`

**Parametri obbligatori**: almeno uno tra `id`, `live`, `date`, `league`+`season`, `team`+`season`

**Parametri utili**:

| Parametro | Valore | Descrizione |
|-----------|--------|-------------|
| `league`  | `135`  | Serie A |
| `season`  | `2024` | Stagione |
| `round`   | `"Regular Season - 1"` | Singola giornata |
| `from`/`to` | date ISO | Range date |

**Cardinalità risposta**: 10 items per giornata (10 partite Serie A). Senza filtro `round`: 380 items (tutte le partite della stagione) in una sola risposta.

**Paginazione**: nessuna per stagione completa (380 item stano in una pagina).

**Note**: Per il seeding conviene richiedere tutte le 380 partite in una sola chiamata (senza `round`). Il campo `fixture.id` è il riferimento primario per `/fixtures/players` e `/fixtures/statistics`. I campi `league.round` usano il formato `"Regular Season - N"` (N da 1 a 38). Il campo `fixture.status.short` vale `"FT"` (fine partita), `"NS"` (non iniziata), `"1H"`/`"2H"` (in corso), ecc.

**Mock**: `scripts/sync/fixtures-mock/fixtures.json`

**Stima request**:
- Seeding completo (stagione intera): **1**
- Per giornata singola: **1**
- Subset test 10 giornate: **10** (una per round) oppure **1** con filtro date

---

## Endpoint 6 — `/fixtures/players`

**URL completo**: `GET https://v3.football.api-sports.io/fixtures/players`

**Parametri obbligatori**: `fixture`

**Parametri utili**:

| Parametro | Valore    | Descrizione |
|-----------|-----------|-------------|
| `fixture` | es. `1208098` | ID partita |
| `team`    | es. `505` | Filtra per una sola squadra (opzionale) |

**Cardinalità risposta**: 2 items (una voce per squadra), ciascuno con array `players` (11 titolari + sostituzioni, tipicamente 14–18 giocatori). Totale: ~28–36 statistiche giocatore per partita.

**Paginazione**: nessuna.

**Note**: Questo è l'endpoint chiave per il calcolo del **voto Mister** giornaliero. La risposta include per ogni giocatore: minuti giocati, gol, assist, tiri, passaggi, tackle, duelli, dribbling, falli, cartellini, rigori, rating grezzo API-Football. Tutti questi valori vanno in `player_giornata_stats.stats_json`. Il campo `games.rating` è il voto grezzo API-Football — **non usarlo come voto finale**: è solo un input dell'algoritmo Mister.

**Mock**: `scripts/sync/fixtures-mock/fixtures-players.json`

**Stima request**:
- Per giornata (10 partite × 1 req/partita): **10**
- Stagione completa (38 giornate × 10): **380**
- Subset test (10 giornate): **100**

---

## Endpoint 7 — `/fixtures/statistics`

**URL completo**: `GET https://v3.football.api-sports.io/fixtures/statistics`

**Parametri obbligatori**: `fixture`

**Parametri utili**:

| Parametro | Valore    | Descrizione |
|-----------|-----------|-------------|
| `fixture` | es. `1208098` | ID partita |
| `team`    | es. `505` | Filtra per una sola squadra (opzionale) |
| `type`    | es. `"Ball Possession"` | Filtra tipo statistica (opzionale) |

**Cardinalità risposta**: 2 items (una voce per squadra), ciascuno con array di 16 statistiche di squadra (possesso, tiri, corner, falli, cartellini, passaggi, ecc.).

**Paginazione**: nessuna.

**Note**: Statistiche aggregate di squadra per partita. Utili per arricchire la narrazione del match engine (possesso palla, tiri in porta, ecc.) e potenzialmente come input secondario all'algoritmo voto (contesto di partita). Non contengono dati per-giocatore — quelli sono in `/fixtures/players`.

**Mock**: `scripts/sync/fixtures-mock/fixtures-statistics.json`

**Stima request**:
- Per giornata (10 partite × 1 req/partita): **10**
- Stagione completa (38 giornate × 10): **380**
- Subset test (10 giornate): **100**

---

## Endpoint 8 — `/players/topscorers`

**URL completo**: `GET https://v3.football.api-sports.io/players/topscorers`

**Parametri obbligatori**: `league` + `season`

**Parametri utili**:

| Parametro | Valore | Descrizione |
|-----------|--------|-------------|
| `league`  | `135`  | Serie A |
| `season`  | `2024` | Stagione |

**Cardinalità risposta**: 20 items (top 20 marcatori della stagione). Formato identico a `/players` (anagrafica + statistiche).

**Paginazione**: nessuna (fisso a 20 risultati).

**Note**: Endpoint one-shot per l'aggiornamento della classifica cannonieri. Non paginato. Utile per la dashboard lega (sezione "Classifica marcatori reale") e come signal per il valore dinamico dei giocatori (`player_value_dynamic` flag). Endpoint analogo `/players/topassists` per gli assist (non censito in questo task ma struttura identica).

**Mock**: `scripts/sync/fixtures-mock/players-topscorers.json`

**Stima request**:
- Aggiornamento settimanale: **1**
- Aggiornamento post-giornata: **1**

---

## Tabella riepilogativa

| Feature richiesta | Endpoint | Una-tantum / Per-giornata | Req. subset 10 gg | Req. stagione 38 gg |
|---|---|---|---|---|
| Seeding campionato (nome lega, copertura) | `/leagues` | Una-tantum | 1 | 1 |
| Seeding squadre (nomi, loghi, stadi) | `/teams` | Una-tantum | 1 | 1 |
| Profili giocatori (anagrafica, ruolo, foto) | `/players` | Una-tantum + sync | 26 | 26 |
| Rosa corrente per squadra | `/players/squads` | Settimanale | 20 | 20 |
| Calendario partite (fixture_id, data, risultato) | `/fixtures` | Una-tantum + aggiornamento | 1 | 1 |
| Statistiche giocatore per giornata → voto Mister | `/fixtures/players` | Per-partita | 100 | 380 |
| Statistiche di squadra per match engine / narrazione | `/fixtures/statistics` | Per-partita | 100 | 380 |
| Classifica marcatori per dashboard lega | `/players/topscorers` | Settimanale | 1 | 1 |
| **Totale subset test (10 giornate)** | | | **~250** | |
| **Totale stagione completa (38 giornate)** | | | | **~810** |

### Note sui totali

- Il totale subset (~250) include il seeding una-tantum + 10 giornate di statistiche.
- Il totale stagione (~810) è per un singolo ciclo di import completo ex-novo.
- In produzione, il sync incrementale (solo giornate nuove) si riduce a **~90–95 req/giornata** (`/fixtures/players` × 10 + `/fixtures/statistics` × 10 + margine).
- Con il piano Pro (7.500 req/giorno, 10 req/min) il seeding completo si completa in **meno di 2 ore** senza rate-limit issues, distribuendo le chiamate a 10/min.
- Con il piano Free (100 req/giorno) il seeding iniziale richiede **9+ giorni** — inadeguato per produzione.

---

## Mapping campi API → schema DB

| Campo API-Football | Tabella DB | Colonna DB | Note |
|---|---|---|---|
| `player.id` | `players` | `id` | PK, stabile tra stagioni |
| `player.name` | `players` | `name` | Nome breve |
| `player.firstname + lastname` | `players` | `full_name` | Concatenazione |
| `statistics[0].team.name` | `players` | `real_team` | Squadra attuale |
| `statistics[0].games.position` | `players` | `role_classic` | Mappare: Goalkeeper→GK, Defender→DEF, Midfielder→MID, Attacker→ATT |
| `player.birth.date` | `players` | `birth_date` | Formato ISO yyyy-mm-dd |
| `player.nationality` | `players` | `nationality` | |
| `player.height` | `players` | `height_cm` | Strip " cm", parse int |
| `player.photo` | `players` | `photo_url` | |
| `fixture.id` | `player_giornata_stats` | `fixture_id` | |
| `league.season` | `player_giornata_stats` | `season` | |
| `league.round` | `player_giornata_stats` | `round` | Estrarre N da "Regular Season - N" |
| `statistics[0]` (intero oggetto) | `player_giornata_stats` | `stats_json` | Dump grezzo completo |
| `statistics[0].games.rating` | `player_giornata_stats` | `stats_json.rating` | Input algoritmo, NON voto finale |

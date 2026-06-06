## 9. Matrice di propagazione (generata da `registro.json`)

*Non modificare a mano: rigenerata da `genera.py`. Per cambiare le relazioni si edita `registro.json`.*

### 9.1 Token → componenti → schermate

| Token | Componenti che lo usano | Schermate impattate |
|---|---|---|
| `T-carta` --cream/--cream2/--paper | — | **tutte** |
| `T-verde` --green/-d/-l | C-card-evento, C-classifica-row, C-barra-panchina | **tutte** |
| `T-erba` --pitch/--pitch2 | C-area-tecnica, C-marcature | S-formazione-d, S-formazione-m, S-partita-d, S-partita-m |
| `T-oro` --gold/--gold-l | C-badge, C-area-tecnica, C-card-evento, C-barra-panchina | S-config-asta, S-feed, S-formazione-d, S-formazione-m, S-paletta, S-partita-d, S-partita-m, S-rosa, S-scheda, S-tabellone |
| `T-live` --live | C-card-evento, C-classifica-row | S-classifica, S-dettaglio, S-feed |
| `T-neutri` --muted/--line | — | **tutte** |
| `T-ruolo` --rP/D/C/A + --ring* + --let* | C-badge, C-classifica-row | S-classifica, S-config-asta, S-dettaglio, S-formazione-d, S-formazione-m, S-paletta, S-partita-d, S-partita-m, S-rosa, S-scheda, S-tabellone |
| `T-club` mappa colori club (bicolore) | C-badge, C-crest, C-classifica-row | S-classifica, S-config-asta, S-dettaglio, S-federazione, S-feed, S-formazione-d, S-formazione-m, S-mercato, S-paletta, S-partita-d, S-partita-m, S-rosa, S-scheda, S-tabellone |
| `T-font` --disp / --mono | C-badge, C-area-tecnica, C-card-evento, C-classifica-row, C-barra-panchina | **tutte** |
| `T-phone` --phone-w + no-squish | — | — |

### 9.2 Componente → schermate

| Componente | Schermate |
|---|---|
| C-badge (Badge giocatore) | S-config-asta, S-tabellone, S-paletta, S-rosa, S-scheda, S-formazione-d, S-formazione-m, S-partita-d, S-partita-m |
| C-crest (Crest bicolore) | S-tabellone, S-feed, S-federazione, S-dettaglio, S-mercato, S-rosa, S-scheda, S-formazione-d, S-formazione-m, S-partita-d, S-partita-m, S-classifica |
| C-area-tecnica (Area tecnica) | S-formazione-d, S-partita-d, S-partita-m |
| C-marcature (Marcature campo) | S-formazione-d, S-formazione-m, S-partita-d, S-partita-m |
| C-card-evento (Card-evento) | S-feed |
| C-classifica-row (Riga classifica) | S-dettaglio, S-classifica |
| C-barra-panchina (Barra-panchina) | S-partita-d |

### 9.3 Regola → ambito

| Regola | Ambito |
|---|---|
| R-oro — Oro riservato a denaro/valore | **tutte le schermate** |
| R-server — Server-authoritative | **tutte le schermate** |
| R-mister-toy — Mister inciso != allenatore (toy) | C-area-tecnica |
| R-rosa — Rosa 25 / panca 14 | S-rosa, S-formazione-d, S-formazione-m, S-partita-d, S-partita-m |
| R-classico-gol — Conversione GF/GS | S-classifica, S-partita-d, S-partita-m |
| R-mobile-nosquish — 390px fisso + scroll | S-paletta, S-feed, S-federazione, S-dettaglio, S-mercato, S-rosa, S-scheda, S-formazione-m, S-partita-m, S-classifica |
| R-marcature — Centrocampo unico testa-a-testa | C-marcature, S-partita-d, S-partita-m |
| R-fonte-strato — Una fonte per strato | **tutte le schermate** |

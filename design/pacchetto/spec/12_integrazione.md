## 12. Brief di integrazione (per l'agente Replit) — generato da `registro.json`

*Per schermata: componenti · regole da far rispettare lato server · dati · azioni. Generato; non modificare a mano.*

### Sequenza di cablaggio consigliata
1. **Sblocco** pendenze pre-deploy (login/magic-link + OAuth, `JWT_SECRET`, copy/i18n) — vedi modulo 10.
2. **Quick-win in lettura**: `S-classifica`, poi `S-feed`.
3. **Milestone asta** (real-time, server-authoritative): `S-config-asta` → `S-tabellone` + `S-paletta`.
4. **Il resto**: `S-rosa`, `S-scheda`, `S-formazione-d/m`, `S-partita-d/m`, `S-dettaglio`, `S-mercato`, `S-federazione`.

### Regole globali (ogni schermata)
- R-oro (Oro riservato a denaro/valore) · R-server (Server-authoritative) · R-fonte-strato (Una fonte per strato)

#### S-config-asta — Configurazione asta (desktop · `config_asta.html`)
- **Componenti**: C-badge
- **Regole server**: solo globali
- **Dati**: regole ereditate dalla lega (budget, struttura rosa 3-8-8-6, mode) read-only; finestra = Asta iniziale; elenco partecipanti; ordine di chiamata
- **Azioni**: legge regole-lega (sola lettura, link a Regole di lega); scrive config asta (formato, svolgimento, base, tempi, ordine); avvia asta -> crea sessione live

#### S-tabellone — Tabellone live (desktop · `tabellone_desktop.html`)
- **Componenti**: C-badge, C-crest
- **Regole server**: solo globali
- **Dati**: stato asta live (giocatore corrente, base, offerta+team, timer); board 8 squadre (budget, slot, rose 25); ticker ultimi colpi
- **Azioni**: banditore: chiama giocatore (ricerca fuzzy), aggiudica, prossimo, pausa, annulla; riceve eventi real-time; SOLO mostra le offerte (non rilancia)

#### S-paletta — Paletta asta (mobile · `paletta_mobile.html`)
- **Componenti**: C-badge
- **Regole server**: R-mobile-nosquish
- **Dati**: giocatore in asta; mia offerta / stato 'superato'; budget e slot mancanti
- **Azioni**: rilancia +1/+5/+10 e 'a X'; autobid (offerta max); parla (voce); real-time col tabellone

#### S-feed — Feed / Home (mobile · `feed_home.html`)
- **Componenti**: C-card-evento, C-crest
- **Regole server**: R-mobile-nosquish
- **Dati**: eventi di sistema (asta-live, colpi, trattative, risultati, finestre, albo) taggati per lega/federazione; reazioni/commenti
- **Azioni**: legge feed paginato; reagisce/commenta (ancorato all'evento); tap evento -> naviga al contesto

#### S-federazione — Federazione (mobile · `federazione_home.html`)
- **Componenti**: C-crest
- **Regole server**: R-mobile-nosquish
- **Dati**: identità (nome, stemma, motto, numeri); albo d'oro (campioni per stagione); bacheche titoli per società; leghe della federazione; regole del mondo (mode, algoritmo voto, punteggio/ruoli, convalida)
- **Azioni**: legge identità/albo/regole; (owner) governance e modifica regole

#### S-dettaglio — Dettaglio lega (mobile · `lega_dettaglio.html`)
- **Componenti**: C-classifica-row, C-crest
- **Regole server**: R-mobile-nosquish
- **Dati**: tua società (budget, posizione, rosa); prossimo impegno; classifica mini; mercato (finestra, tipi, trattative)
- **Azioni**: legge panoramica; naviga sub-nav (Rosa/Formazione/Mercato/Classifica/Società)

#### S-mercato — Mercato (mobile · `lega_mercato.html`)
- **Componenti**: C-crest
- **Regole server**: R-mobile-nosquish
- **Dati**: finestre (stato conclusa/programmata, date); countdown prossima finestra; trattative aperte
- **Azioni**: legge ritmo finestre; apre trattativa (si concretizza all'apertura della finestra)

#### S-rosa — Rosa (mobile · `lega_rosa.html`)
- **Componenti**: C-badge, C-crest
- **Regole server**: R-rosa, R-mobile-nosquish
- **Dati**: rosa (giocatori: ruolo, club, quotazione, pagato); riepilogo FM liberi / completezza per ruolo; slot liberi
- **Azioni**: legge rosa e riepilogo

#### S-scheda — Scheda giocatore (mobile · `scheda_giocatore.html`)
- **Componenti**: C-badge, C-crest
- **Regole server**: R-mobile-nosquish
- **Dati**: anagrafica (sistema); contesto-lega (quotazione, pagato, proprietario); rendimento fanta (fantamedia, presenze, ultime giornate); statistiche API-Sports (per ruolo); storico stagioni e storico in lega
- **Azioni**: legge (aggrega dato di sistema + dato di lega)

#### S-formazione-d — Formazione (desktop · `lega_formazione.html`)
- **Componenti**: C-badge, C-crest, C-area-tecnica, C-marcature
- **Regole server**: R-mister-toy, R-rosa, R-marcature
- **Dati**: rosa + panchina (panchina = non schierati); modulo; contesto-giornata e scadenza; allenatore
- **Azioni**: schiera/sostituisce, imposta capitano; salva formazione (server valida ruoli-slot, completezza, scadenza)

#### S-formazione-m — Formazione (mobile · `formazione_mobile.html`)
- **Componenti**: C-badge, C-crest, C-marcature
- **Regole server**: R-rosa, R-mobile-nosquish, R-marcature
- **Dati**: XI + 14 panchinari; modulo + allenatore; scadenza
- **Azioni**: tab Campo/Panchina; sostituzione a tocco (titolare -> entrante); salva (stesse validazioni server della desktop)

#### S-partita-d — Partita (desktop · `lega_partita.html`)
- **Componenti**: C-badge, C-crest, C-area-tecnica, C-marcature, C-barra-panchina
- **Regole server**: R-mister-toy, R-rosa, R-classico-gol, R-marcature
- **Dati**: due squadre (XI + panchine da 14); voti/pagelle (S.V. finché non arrivano); totali, GF/GS; allenatori
- **Azioni**: legge tabellino e campo affacciato; (live) aggiorna voti man mano che arrivano

#### S-partita-m — Partita (mobile · `partita_mobile.html`)
- **Componenti**: C-badge, C-crest, C-area-tecnica, C-marcature
- **Regole server**: R-mister-toy, R-rosa, R-classico-gol, R-mobile-nosquish, R-marcature
- **Dati**: due squadre (campo affacciato); pagelle e panchine per squadra; totali
- **Azioni**: legge; segmentato Pagelle/Panchine + selettore La mia/Avversario

#### S-classifica — Classifica (mobile · `lega_classifica.html`)
- **Componenti**: C-classifica-row, C-crest
- **Regole server**: R-classico-gol, R-mobile-nosquish
- **Dati**: standings per squadra (G,V,N,P,GF,GS,Pt,PF, movimento); competizione e giornata
- **Azioni**: legge la graduatoria della competizione


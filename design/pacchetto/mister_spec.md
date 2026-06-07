# Mister — Specifica (documento modulare)

*Documento vivo, v2 modulare. Da vedere e rivedere.*

Mister è un'app di fantacalcio manageriale (backend Replit/Drizzle/Postgres, frontend React/Vite). Questa specifica è la **fonte di verità del design**, organizzata in moduli indipendenti.

## Come è fatto (e come si refactora veloce)

- **Moduli**: ogni concern è un file in `spec/`. Si modifica un modulo senza toccare gli altri.
- **ID stabili**: token `T-*`, componenti `C-*`, schermate `S-*`, regole `R-*`. I riferimenti sono per ID, non per prosa.
- **Registro**: `registro.json` tiene il grafo delle relazioni (chi usa cosa).
- **Generatore**: `genera.py` **valida** i riferimenti e **genera** la Matrice di propagazione (modulo 09) dal registro, poi **assembla** tutti i moduli in `mister_spec.md` (la copia leggibile). La matrice non si scrive a mano: si rigenera.
- **Token**: `tokens.css` è la fonte unica; `propaga.py` la inietta in tutte le schermate.

Ciclo di refactoring:
1. cambi un **token** → edita `tokens.css` → `python3 propaga.py`.
2. cambi un **componente/regola/architettura** → edita il modulo `spec/` relativo e, se cambiano le relazioni, `registro.json` → `python3 genera.py` (rivalida + rigenera matrice + riassembla).

## Moduli
01 Principi · 02 Token · 03 Brand · 04 Filosofia di layout · 05 Modello a strati · 06 Componenti · 07 Schermate · 08 Regole · 09 Matrice (generata) · 10 Stato & pendenze · 11 Allegati · 12 Brief di integrazione (generato)

---

## 1. Principi

1. **Una sola fonte di verità per ogni "lettera".** Token in `tokens.css`. Componenti definiti una volta nel modulo 06. Le schermate **usano**, non ridefiniscono.
2. **Se cambi una lettera, si propaga.** Per i token: `tokens.css` + `propaga.py` (tecnico). Per componenti/regole/architettura: il **registro** + la **Matrice (09)** dicono dove guardare; `genera.py` rivalida e rigenera.
3. **Verificare la resa, non solo che compili.** I mockup vanno guardati renderizzati; le correzioni si fanno alla fonte (token/componente), non con pezze locali.

Maturità: alfabeto e schermate esistono come mockup statici, dati e loghi **segnaposto**. Restano test e integrazione runtime.

---

## 2. Token (l'alfabeto) → `tokens.css`

Valori esatti in `tokens.css`. Qui significato e ID.

- **T-carta** `--cream/--cream2/--paper` — carta: sfondo, superfici, card (estetica almanacco).
- **T-verde** `--green/-d/-l` — verde istituzione: marchio, testo su carta, fondi scuri, accenti/link, "sale".
- **T-erba** `--pitch/--pitch2` — **solo** il manto del campo.
- **T-oro** `--gold/--gold-l` — **riservato** (vedi R-oro): denaro/FM/valore/prezzi/prestigio/marchio.
- **T-live** `--live` — in diretta; "scende" in classifica; timer.
- **T-neutri** `--muted/--line` — testo secondario, bordi.
- **T-ruolo** — tre registri dello stesso ruolo P/D/C/A: riga su scuro `--rP/rD/rC/rA` (ocra·verde·teal·mattone) · anello chip su erba `--ringP..A` · lettera su carta `--letP..A`.
- **T-club** — mappa `realTeam → API-Football team ID` (20 club Serie A). **Loghi reali SÌ**: `https://media.api-sports.io/football/teams/{id}.png`, in contenitore neutro crema (`#f2ead8`, bordo `#d0c5ae`), dimensione uniforme. Fallback: monogramma su fondo crema quando l'immagine non è disponibile. **Non** più disco bicolore. Barra split 90° (feed/classifica) rimane per le squadre **fanta** (Disco-Squadra), non per i club reali.
- **T-font** `--disp` Fraunces (titoli, cognomi, numeri-valore, cerimonie) · `--mono` JetBrains Mono (corpo, dati, etichette).
- **T-phone** `--phone-w` (390px) + regola no-squish (vedi R-mobile-nosquish) — cornice telefono.

---

## 3. Brand → `mister_brand.zip`

Concept: **almanacco editoriale × terminale manageriale**. Marchio **M-formazione** (la M come schieramento 2-3-3-2, nodi oro).

Asset: `wordmark_mister.svg` / `wordmark_mister_crema.svg` (logotipo carta/scuro) · `icona_M_formazione.svg`, `mark_M_formazione.svg`, `segno_M_carta.svg` (il segno) · `lockup_impilato.svg` · `mister_volto_inciso.png` (**acquaforte del Mister**: accento di marca **raro** — login/testate/cerimonie; *non* è il volto allenatore nei badge, vedi R-mister-toy).

---

## 4. Filosofia di layout → `mappa_guscio.html`

### Tre altitudini
1. **Globale / tu** = Home: feed-gazzetta + tue leghe/federazioni + profilo. Nativa mobile.
2. **Federazione** = il tuo mondo, identità: nome+stemma, albo d'oro, premiazioni, regole/governance. Snella ma **ricca d'identità**; è il **differenziante**, visibile da subito anche con una sola lega.
3. **Lega** = workspace operativo: competizioni, mercati, rosa, formazione, classifica, partecipanti.

### Mobile vs desktop
- **Mobile** per il quotidiano: bottom-tab (Home/Leghe/Notifiche/Profilo) + ☰.
- **Desktop** per il denso e scenico: config asta, tabellone, formazione, partita.
- **Asta live = coppia**: tabellone desktop (scena) + paletta mobile (rilancio personale).

### La Home è il feed
Eventi di sistema in **voce d'almanacco** (aste/colpi/risultati/finestre/premiazioni) + social leggero **ancorato agli affari**. Niente chat generica.

### Mercati = finestre
Vivono in **finestre** del calendario. Fuori si **tratta** (always-on); dentro si **esegue**. L'asta è **un tipo** di mercato.

---

## 5. Modello a strati (la grammatica)

Una lega appartiene **sempre** a una federazione (implicita/automatica nel caso "una sola lega": l'admin non vede il gergo).

- **Globale/sistema** — il dato reale: anagrafica giocatori, giornate Serie A, voti grezzi (API-Sports).
- **Federazione** — l'istituzione: **identità** (nome+logo) · **regole** (algoritmo voto + punteggio/ruoli **flessibili**, non rigido classic/mantra) · **convalida** · **memoria/prestigio** (albo d'oro). Catena: lega organizza → federazione convalida → premiabile → albo d'oro. Strato **latente**: affiora come identità+albo (visibile) e governance (owner).
- **Lega** — l'organizzatore: competizioni · **mercati** (asta/scambi/svincoli) · **quotazioni** · partecipanti · rosa · budget. I mercati sono di **lega**, non di federazione. Ogni lega legge/congela uno **snapshot** della federazione.
- **Competizione** — punteggi · calendario · classifica. Organizzata dalla lega.
- **Modelli/template** — ricette di default che seminano valori alla creazione. Trasversali, **non** legati alla federazione, **non** voce di menu. Es. "Classico" semina le finestre abituali, tutte **editabili**.

Divisioni: **non** esistono ora (futuro).

---

## 6. Componenti (le parole) → `libreria_componenti.html`

> **Fonte unica in codice: `componenti.py`.** Centralizza il volto toy (`FACE`), la mappa colori club (`CLUBS`, 14 squadre) e la logica colore (`grad_crest` 135° / `grad_bar` 90°), ed espone `badge()` come generatore canonico. Tutti i `build_*.py` importano da qui: cambi il volto o un colore club → rigeneri → si propaga in ogni vista. La migrazione del *markup* del chip al generatore canonico è incrementale (oggi i dati e i colori sono già centralizzati; i wrapper di stile restano per-vista, governati dai token).


### C-badge — Badge giocatore (un solo DNA, più tier)
DNA: **anello colore-ruolo** + **volto toy** (immagine scaricata e "toyzzata", stessa pipeline giocatori e allenatori) + **crest/barra club bicolore** + **cognome** (Fraunces) + slot opzionali: **pillola** alto-dx (prezzo oro in asta / voto in partita) e **disco capitano** alto-sx (oro).
*Regola pillola*: sta **fuori** dal cerchio del volto (l'avatar ha `overflow:hidden`); è figlia del chip, sovrapposta — mai figlia dell'avatar.
Tier: Hero/scheda · Roster (riga) · Tabellone (compatto: colore-ruolo+crest+cognome+**prezzo oro**, senza volto) · Formazione (chip) · Partita (chip+voto) · Medaglione (scheda).

### C-crest — Crest club reale
Logo reale del club (API-Football CDN: `https://media.api-sports.io/football/teams/{id}.png`), in contenitore neutro crema (`#f2ead8`, bordo `#d0c5ae`), dimensione uniforme per schermata. Dimensione piccola (20 px rosa-riga, 26 px scheda-hero), non invade la palette editoriale. Fallback: monogramma su fondo crema quando il logo non è disponibile o il club non è mappato. **Non** è il Disco-Squadra: il Disco-Squadra fanta (monogramma + team.color) rimane invariato per owner/competizione.

### C-area-tecnica — Area tecnica
Rettangolo **tratteggiato** sul verde, interno trasparente, nel **margine erboso sinistro** ("campo per destinazione"), **appena fuori dalla linea laterale**, **in basso nella propria metà**. Contiene volto allenatore (**toy**) + nome (+ modulo nel desktop). Nella partita: due, una per metà.

### C-marcature — Marcature campo
Singola squadra: campo verticale con area di rigore e cerchio. **Testa a testa**: ogni metà disegna solo porta e lati; **riga di centrocampo + cerchio tondo + dischetto** = **un solo** elemento condiviso sul confine; corridoio centrale; campo alto abbastanza da non tagliare il portiere.

### C-card-evento — Card-evento (feed)
Voce d'almanacco, accento sinistro per tipo: **rosso** live · **oro** colpo (FM) · **oro tratteggiato** trattativa · neutro risultato/finestra · **verde scuro cerimoniale** albo d'oro. Social leggero ancorato all'evento.

### C-classifica-row — Riga classifica
Posizione + freccia movimento · disco squadra · nome+allenatore · colonne G·V·N·P·GF·GS·Pt·PF. Riga propria evidenziata; capolista col filo verde.

### C-barra-panchina — Barra-panchina (partita)
Barra **verticale** col logo (disco) + nome ruotato 90° ("tettoia"). Le righe panchina dividono l'altezza del box in parti uguali (`flex:1`).

---

## 7. Schermate (le frasi)

Inventario e ID in `registro.json`. Dettaglio per schermata:

- **S-config-asta** (desktop, `config_asta.html`) — pagina unica. Striscia "Ereditato dalla lega" read-only (budget, rosa 3·8·8·6, mode, link a Regole di lega). Formato (live / busta chiusa). Svolgimento (a giro / per ruolo / libera) + voce. Base (Libera=1 / Quotazione). Tempi. Partecipanti & ordine. Niente budget editabile / flag spendi-tutto / conduttore (ruolo runtime).
- **S-tabellone** (desktop, `tabellone_desktop.html`) — plancia broadcast: hero 3 zone (giocatore+base oro / timer / comandi banditore con voce) + board 8 squadre (rose 25) + ticker. **Mostra**, non agisce.
- **S-paletta** (mobile, `paletta_mobile.html`) — coppia del tabellone: badge, timer-barra, offerta oro, "superato", rilanci +1/+5/+10, autobid, Parla, budget+slot.
- **S-feed** (mobile, `feed_home.html`) — gazzetta: testata, card-evento taggate, social leggero, bottom-tab + ☰.
- **S-federazione** (mobile, `federazione_home.html`) — il tuo mondo: hero identità, **albo d'oro**, bacheche, leghe, "Le regole del mondo" (niente mercati).
- **S-dettaglio** (mobile, `lega_dettaglio.html`) — panoramica: sub-nav pills, tua società, prossimo impegno, classifica mini, mercato.
- **S-mercato** (mobile, `lega_mercato.html`) — finestre in scroll, countdown, trattative aperte.
- **S-rosa** (mobile, `lega_rosa.html`) — riepilogo (FM/rosa/completezza) + lista unica di badge-roster; slot liberi visibili.
- **S-scheda** (mobile, `scheda_giocatore.html`) — hero medaglione; contesto-lega; rendimento fanta; statistiche API-Sports; storico stagioni/lega. Larghezza bloccata (R-mobile-nosquish).
- **S-formazione-d** (desktop, `lega_formazione.html`) — topbar+tab; sidebar filtri (ruolo×club) e rosa = **panchina automatica**; campo 4-3-3; **area tecnica** col Mister.
- **S-formazione-m** (mobile, `formazione_mobile.html`) — tab **Campo/Panchina**; sostituzione **a tocco** (titolare → entrante); 14 panchinari; striscia modulo+allenatore. **Interattiva.**
- **S-partita-d** (desktop, `lega_partita.html`) — punteggio; due panchine (barra-panchina) a sx; campo affacciato + due aree tecniche + centrocampo unico; due pagelle a dx. Panche da **14**.
- **S-partita-m** (mobile, `partita_mobile.html`) — punteggio; campo verticale affacciato; sotto, segmentato **Pagelle/Panchine** + selettore **La mia/Avversario**. **Interattiva.**
- **S-classifica** (mobile, `lega_classifica.html`) — tabella **# · Squadra · G · V·N·P · GF · GS · Pt · PF**. Punti/gol inchiostro (non FM).

---

## 8. Regole trasversali

- **R-oro** — Oro (`T-oro`) solo per denaro/FM/valore/prezzi/prestigio/marchio. Punti fanta, voti, gol, posizioni **non** sono denaro → inchiostro/verde.
- **R-server** — Server-authoritative: ogni vincolo (budget, slot ruolo, finestra, punteggio) è applicato dal server; il client mostra e propone.
- **R-mister-toy** — L'acquaforte del Mister è accento di marca raro; il **badge allenatore** usa l'**avatar toy** (pipeline giocatori), distinto con anello oro.
- **R-rosa** — Rosa = **25** (3P·8D·8C·6A); schieri 11 → panca **14**; in 4-3-3 la panca è 2P·4D·5C·3A.
- **R-classico-gol** — Il punteggio di giornata si converte in **GF/GS** (soglie classico); **PF** = spareggio in classifica.
- **R-mobile-nosquish** — Telefono a larghezza fissa `--phone-w` + `body{overflow-x:auto}`; **mai** `max-width:100%`; scrollbar sotto-nav nascosta.
- **R-marcature** — Centrocampo testa-a-testa = **un solo** elemento sul confine; metà disegnano solo porte/lati; campo alto a sufficienza; corridoio per gli attaccanti.
- **R-fonte-strato** — Ogni strato ha una sola fonte per il suo dato; gli strati sotto leggono/congelano snapshot, non duplicano.

---

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

---

## 10. Stato & pendenze

**Fatto (mockup):** token + `propaga.py`, libreria componenti, mappa-guscio, 14 schermate (desktop/mobile), brand, documento modulare + registro + `genera.py`.

**Da fare / decidere:**
- **[PARZIALE]** Componenti a fonte unica: `componenti.py` centralizza già **volto + colori club + logica colore** e i `build_*.py` lo importano (rigenerazione verificata byte-identica). Resta da migrare il **markup del chip** al generatore canonico `badge()` (incrementale, per non regredire le viste approvate).
- Classifica: viste sorelle **Marcatori** / **Andamento** (se servono; marcatori per giocatore reale o squadra fanta).
- Vincolo di ruolo nello scambio Formazione mobile (oggi permissivo).
- Sostituzione segnaposto: volti toy reali, loghi club (IP), dati API-Sports.
- Pre-deploy (fuori dal giro design): `JWT_SECRET` reale (≥32), copy/i18n, fix logo-login, magic-link + Google OAuth, fondamenta brand.

---

## 11. Allegati

(Esclusi i file di processo: brief/checkpoint/diagnostiche all'agente.)

**Sistema / riferimento:** `tokens.css` (token) · `propaga.py` (compilatore token) · `componenti.py` (fonte unica componenti: volto, club, logica colore, `badge()`) · `registro.json` (grafo) · `genera.py` (validatore+generatore) · `spec/` (moduli) · `mister_spec.md` (assemblato) · `libreria_componenti.html` · `lingua_visiva.html` · `mappa_guscio.html`.

**Desktop:** `config_asta.html` · `tabellone_desktop.html` · `lega_formazione.html` · `lega_partita.html`.

**Mobile:** `feed_home.html` · `federazione_home.html` · `lega_dettaglio.html` · `lega_mercato.html` · `lega_rosa.html` · `scheda_giocatore.html` · `paletta_mobile.html` · `formazione_mobile.html` · `partita_mobile.html` · `lega_classifica.html`.

**Brand:** `mister_brand.zip`.

---

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

## 6. Componenti (le parole) → `libreria_componenti.html`

> **Fonte unica in codice: `componenti.py`.** Centralizza il volto toy (`FACE`), la mappa colori club (`CLUBS`, 14 squadre) e la logica colore (`grad_crest` 135° / `grad_bar` 90°), ed espone `badge()` come generatore canonico. Tutti i `build_*.py` importano da qui: cambi il volto o un colore club → rigeneri → si propaga in ogni vista. La migrazione del *markup* del chip al generatore canonico è incrementale (oggi i dati e i colori sono già centralizzati; i wrapper di stile restano per-vista, governati dai token).


### C-badge — Badge giocatore (un solo DNA, più tier)
DNA: **anello colore-ruolo** + **volto toy** (immagine scaricata e "toyzzata", stessa pipeline giocatori e allenatori) + **crest/barra club bicolore** + **cognome** (Fraunces) + slot opzionali: **pillola** alto-dx (prezzo oro in asta / voto in partita) e **disco capitano** alto-sx (oro).
*Regola pillola*: sta **fuori** dal cerchio del volto (l'avatar ha `overflow:hidden`); è figlia del chip, sovrapposta — mai figlia dell'avatar.
Tier: Hero/scheda · Roster (riga) · Tabellone (compatto: colore-ruolo+crest+cognome+**prezzo oro**, senza volto) · Formazione (chip) · Partita (chip+voto) · Medaglione (scheda).

### C-crest — Crest bicolore
Disco split diagonale coi colori reali del club; monogramma per le squadre fanta. Logo reale = segnaposto.

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

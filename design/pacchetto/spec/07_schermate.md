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

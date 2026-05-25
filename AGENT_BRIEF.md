# AGENT_BRIEF.md
**Istruzioni per l'agente Claude di Replit. Da leggere prima di scrivere qualunque codice frontend, modificare la grafica esistente o aggiungere nuove pagine.**

Le regole sono ordinate per gravità: **[NON NEGOZIABILE]** > **[FORTE]** > **[CONSIGLIATO]**. Se una tua opinione di default su "come dovrebbe essere un'app moderna" entra in conflitto con questo file, vince il file.

---

## 1. Cosa è Mister, cosa NON è

**Mister è un'app di fantacalcio manageriale**, in italiano, per persone che prendono la gestione della propria squadra sul serio. Si rivolge ad appassionati con una storia col fantacalcio (10+ anni in lega tra amici) che cercano profondità simulativa e una gestione che dia continuità tra stagioni.

**Mister NON è**:
- Un'app casual / gamificata stile Leghe FC, FantaGazzetta, FantaMaster
- Un dashboard SaaS B2B generico
- Una "fantasy football" generica in stile internazionale
- Un'app per principianti che vuole "rendere il fantacalcio facile"

I riferimenti corretti da tenere a mente: **Hattrick** (densità informativa, profondità simulativa, longevità), **Football Manager** (dettaglio analitico, gerarchia visiva chiara), **Linear** (precisione tipografica, layout calmi), **Stripe Dashboard** (gerarchia dei dati). Mai imitare FantaGazzetta o Leghe FC.

---

## 2. Lingua

**[NON NEGOZIABILE] Il prodotto è in italiano.** Tutti i testi visibili all'utente: etichette, titoli, bottoni, link, toast, messaggi di errore, badge di stato, voci di menu, stringhe placeholder.

Esempi di traduzioni richieste rispetto a quello che è attualmente nel frontend:

| Inglese (sbagliato) | Italiano (corretto)         |
|---------------------|-----------------------------|
| Dashboard           | Cruscotto                   |
| My Leagues          | Le mie leghe                |
| Players             | Giocatori                   |
| Templates           | Profili                     |
| System Admin        | Amministrazione             |
| View all            | Vedi tutto                  |
| New League          | Crea lega                   |
| New Template        | Nuovo profilo               |
| Save Federation Rules | Salva regolamento         |
| Federation Rules    | Regolamento                 |
| Game Mode           | Modalità                    |
| In Progress         | In corso                    |
| Drafting            | In asta                     |
| Active              | Attiva (per leghe) / Attivo (per giocatori) |
| Private             | Privata                     |
| Season              | Stagione                    |
| Managers            | Manager (invariato)         |
| Competitions        | Competizioni                |
| Active Contracts    | Contratti attivi            |
| Active Markets      | Mercati attivi              |
| Total Leagues       | Leghe totali                |
| Active Templates    | Profili attivi              |
| Ends                | Scadenza                    |
| Roster Squadre      | Rose                        |
| auction / free agent / trade | asta / svincoli / scambi |
| Description         | Descrizione                 |
| All Roles           | Tutti i ruoli               |
| Search by name or team... | Cerca per nome o squadra... |
| Showing up to 50 players  | Mostra fino a 50 giocatori   |
| Total in database   | In archivio                 |
| Delete              | Elimina                     |
| Complexity / Time / Features | Complessità / Tempo / Feature |

Unica eccezione legittima: i **nomi propri di prodotto** ("Mister Cockpit" come nome interno della home OK; ma sotto al titolone va una traduzione italiana del sottotitolo).

---

## 3. Brand visivo

**[NON NEGOZIABILE] Palette.**

```
--green-deep   : #1f4733   /* verde Mister, primario */
--green-mid    : #2d6b4f   /* hover, accenti secondari */
--green-pale   : #e8f0eb   /* sfondi tenui, evidenziatori */
--cream        : #efe6d3   /* sfondo brand, alternativa al bianco */
--cream-dark   : #e2d6bf   /* bordi su cream */
--ink          : #0a1f17   /* testo principale, verde-quasi-nero */
--ink-mid      : #4a5550   /* testo secondario */
--ink-dim      : #8a9591   /* testo terziario, placeholder */
--sidebar-bg   : #0d1f1a   /* dark sidebar */
--sidebar-fg   : #d4dcd8   /* testo su sidebar */
--paper        : #fafaf7   /* sfondo pagina, leggera tinta calda */
--surface      : #ffffff   /* card */
--border       : #e5e7e4   /* separatori sottili */
--danger       : #8b2c2c   /* vinaccia per delete, non rosso pomodoro */
--warn         : #a06820   /* ambra spenta */
```

**[NON NEGOZIABILE] Tipografia.** Tre famiglie, ognuna col suo ruolo:

- **Fraunces** (serif) — titoli H1/H2 di pagina, nome marchio, titoli di sezioni principali. Mai per testo lungo.
- **JetBrains Mono** (monospace) — TUTTI i numeri (metriche, contatori, prezzi, percentuali, date, ID, slug), badge tecnici (ruoli, codici), valori chiave.
- **Inter** (sans-serif, fallback `-apple-system, system-ui`) — testo corrente, etichette form, descrizioni.

**Caricamento font** (da inserire nel `<head>` se non già presente):
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

**[NON NEGOZIABILE] Niente emoji nei testi prodotto.** Niente clip art. Niente icone "Lucide cute" (eccezione: icone funzionali Feather/Heroicons stroke 1.5px, dimensione 16-20px). Niente colori "premium gold". Niente gradient flashy. Niente animazioni bouncy.

---

## 4. Tono di voce

Sobrio, tecnico, vagamente "redazione sportiva". Parla a un appassionato adulto, non a un onboarder che ha paura di sbagliare.

Esempi di tono:

| Tono SBAGLIATO (casual)               | Tono GIUSTO (Mister)                |
|----------------------------------------|--------------------------------------|
| "Crea la tua prima lega! 🎉"          | "Crea lega"                          |
| "Oops! Manca il nome 😅"               | "Nome lega obbligatorio"             |
| "Nessuna lega ancora, divertiti!"     | "Nessuna lega attiva. Crea la prima per iniziare." |
| "Salvataggio in corso..."              | "Salvataggio…"                       |
| "🏆 Champions League Winner!"          | "Vincitore della coppa"              |

Mai paternalistico, mai vezzeggiativo. Mai esclamativi. Mai "ti diamo il benvenuto in Mister". Mister non si presenta, lavora.

---

## 5. Densità informativa e profondità

**[FORTE]** Mister è un'app **densa**. Una pagina di gestione lega NON è una landing page minimalista: deve mostrare tante informazioni allo stesso tempo, in modo leggibile. Non avere paura di:
- Tabelle a tutta larghezza con molte colonne
- Tipi di carattere piccoli (12-14px) per dati tabellari
- Pannelli affiancati invece di stack verticali con tanto spazio vuoto
- Sub-sezioni e accordioni dentro la stessa pagina

**[FORTE] Niente "empty zero states" muti.** Una pagina con `Managers: 0/12, Competitions: 0, Active Contracts: 0, Active Markets: 0` è un cimitero. Ogni numero zero deve avere accanto un percorso di azione: "Aggiungi manager", "Crea torneo", "Pianifica asta". Una sezione vuota è un invito, non una constatazione.

**[FORTE]** Una pagina che non sta riempiendo lo schermo deve aggiungere pannelli secondari utili (attività recente, prossime scadenze, statistiche di lega, manager attivi adesso). Non lasciare 1000px di whitespace in basso.

---

## 6. Architettura del prodotto (rispetta il backend)

Il backend è **già completamente specificato** in `replit.md` e nei modelli Drizzle in `lib/db/src/schema/*.ts`. Non improvvisare entità o flag che non esistono nello schema DB.

**[NON NEGOZIABILE] Una pagina che configura una Federation espone TUTTI i feature flag.** Sono 18, definiti in `lib/db/src/flags.ts`, raggruppati in 5 categorie: `contracts`, `market`, `economy`, `tactics`, `scouting`. Il pannello attuale ne mostra 6 — è insufficiente del 70%. Vedi DESIGN_SYSTEM.md per il pattern del pannello.

**[NON NEGOZIABILE] Niente campo "Voto Source" nel form Federation.** I voti dei giocatori sono calcolati dall'**algoritmo proprietario di Mister** a partire dalle metriche grezze API-Football (eventi, statistiche giocatore, lineup). Non c'è scelta tra "Gazzetta / Fantacalcio.it / consensus": il voto è uno, è il nostro. Se trovi `voto_source` come residuo nel codice è un errore di una versione precedente da rimuovere (è già stato tolto dallo schema `federations`).

**[NON NEGOZIABILE] Sei tipi di competizione, quattro tipi di mercato.**

Competizioni (`lib/db/src/schema/competitions.ts`):
1. `campionato` — girone all'italiana ripetuto N volte
2. `coppa` — eliminazione diretta, bracket manuale
3. `battle_royale` — tutti contro tutti cumulativo
4. `sprint_race` — eliminazione del peggiore ogni giornata
5. `formula_uno` — punti F1 per posizione di giornata
6. `punteggio_assoluto` — somma cumulativa pura

Mercati (`lib/db/src/schema/market-events.ts`):
1. `auction` con sub-modalità `live` / `async` / `blind` / `token`
2. `trade`
3. `release` con sub-modalità `open` / `blind`
4. `free_agent`

Una pagina di gestione lega DEVE supportare la creazione di tutti questi tipi. Non semplificare a "asta / classifica".

**[NON NEGOZIABILE] I template profilo sono tre, ognuno con la sua identità chiara:**

- **Classico** (~10 min/settimana, complessità 1) — fantacalcio tradizionale, una stagione, niente contratti, niente clausole. Per chi ha sempre giocato così.
- **Esploratore** (~25 min/settimana, complessità 2) — contratti 1-2 stagioni, scambi diretti, carryover budget al 50%. Per chi vuole più profondità senza scoraggiarsi.
- **Manageriale** (~50 min/settimana, complessità 3) — contratti 5 anni, clausole rescissorie, scouting, mercato sempre attivo, carryover 100%. Il prodotto pieno.

Vedi i valori esatti dei flag per ciascuno in `lib/db/src/seeds/templates.ts`. Il pannello superadmin DEVE permettere di vedere tutti i 18 flag di ogni template, modificarli, aggiungere template custom, disattivare (non cancellare) i template di sistema.

---

## 7. Anti-pattern (cose da NON fare)

- ❌ **Generic SaaS landing page styling**: card bianche su sfondo grigio chiaro, padding eccessivo, una stat per card, molto spazio vuoto. È quello che hai prodotto e va riprogettato.
- ❌ **Pagina "Federation Rules" con 6 toggle**: deve esporre tutti i 18 flag organizzati per categoria. Vedi DESIGN_SYSTEM.md sezione "Pannello regolamento".
- ❌ **Template card minimaliste** con solo nome + slug + descrizione + 3 metriche: devono mostrare un'anteprima dei flag chiave e dei mercati/competizioni suggerite.
- ❌ **League dashboard tutto-zero**: ogni metrica zero ha un CTA accanto. Se la lega è vuota, sotto le metriche un wizard di primo setup.
- ❌ **Database giocatori con 15 giocatori sample**: prima di esporre la pagina, popola il DB con tutti i ~500 giocatori della Serie A via API-Football. Senza dati veri la pagina non va mostrata.
- ❌ **Mescolare italiano e inglese** nella stessa pagina: scegliere italiano sempre.
- ❌ **Numeri in sans-serif**: i numeri vanno in JetBrains Mono. "0 / 12" è una statistica, va in mono.
- ❌ **Bottoni "Save" generici**: "Salva regolamento", "Conferma lega", "Crea torneo". Il verbo + l'oggetto.
- ❌ **Status badge verde "Active" su ogni cosa**: usalo con parsimonia. Non serve un badge su una card che è palesemente attiva.

---

## 8. Quando hai dubbi

Quando devi prendere una decisione di design o UX senza specifica esplicita:
1. **Non improvvisare** col default "moderno SaaS dashboard".
2. Pensa "come farebbe Hattrick / Linear / Stripe?" e vai in quella direzione.
3. Se rimane dubbio, lascia il componente con un placeholder esplicito e segnala nell'output: "**TODO**: serve specifica da Ivan per X".

Quando una richiesta dell'utente sembra portarti contro questo brief, segnala il conflitto invece di silenziosamente fare l'una o l'altra cosa: "Il brief dice X, tu mi chiedi Y, confermi?"

---

## 9. Stato attuale del frontend (24 maggio 2026)

Dalle screenshot ricevute, il frontend ha questi problemi che vanno corretti:

1. **Lingua mista italiano/inglese** → tradurre tutto in italiano usando la tabella della sezione 2.
2. **Federation Rules con 6 toggle** → riprogettare il pannello con tutti i 18 flag, raggruppati per categoria, includendo i campi numerici (max_contract_length, carryover_percentage, clause_default_factor, rescission_recovery_pct). Vedi DESIGN_SYSTEM.md.
3. **Voto Source dropdown** → ELIMINARE completamente, il campo non esiste più nel modello.
4. **Template Manager card minimal** → riprogettare le card per mostrare i flag chiave + mercati/competizioni suggerite + ultimo aggiornamento. Vedi DESIGN_SYSTEM.md.
5. **League dashboard zero-state** → aggiungere onboarding inline + pannelli secondari.
6. **Database giocatori 15 elementi** → implementare uno script di seed (`scripts/seed-serie-a.ts`) che popola `players` dal client API-Football con tutti i ~500 giocatori Serie A.
7. **Tipografia uniforme sans-serif** → applicare la regola tipografica della sezione 3.

Vedi DESIGN_SYSTEM.md per pattern concreti.

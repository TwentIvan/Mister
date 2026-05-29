# Mister
Fantacalcio manageriale in italiano per appassionati che cercano profondità simulativa, contratti pluriennali, e una gestione che dia continuità tra stagioni. **Anti-tesi consapevole delle app casual del segmento** (Leghe FC, FantaGazzetta, FantaMaster).

## Run & Operate

* `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
* `pnpm run typecheck` — full typecheck across all packages
* `pnpm run build` — typecheck + build all packages
* `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
* `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
* `pnpm --filter @workspace/db run seed` — popola i template profili di sistema (Classico/Esploratore/Manageriale)
* Required env: `DATABASE_URL` — Postgres connection string, `API_FOOTBALL_KEY`, `ANTHROPIC_API_KEY`, `SUPERADMIN_KEY`

## Stack

* pnpm workspaces, Node.js 24, TypeScript 5.9
* API: Express 5
* DB: PostgreSQL + Drizzle ORM
* Validation: Zod (`zod/v4`), `drizzle-zod`
* API codegen: Orval (from OpenAPI spec)
* Build: esbuild (CJS bundle)
* External: API-Football (dati Serie A), Anthropic (narratore Claude Sonnet)

## Where things live

* **Identità di prodotto + non negoziabili**: `AGENT_BRIEF.md` (root) — leggere PRIMA di qualunque lavoro UI
* **Design tokens + componenti**: `DESIGN_SYSTEM.md` (root) — CSS variables, tipografia, esempi HTML
* **Catalogo dei 18 feature flag**: `lib/db/src/flags.ts`
* **Schema DB (source of truth)**: `lib/db/src/schema/*.ts` (Drizzle)
* **Seed dei 3 template di sistema**: `lib/db/src/seeds/templates.ts`
* **Contratto API (source of truth)**: `lib/api-spec/openapi.yaml` (Orval-driven codegen)
* **Zod schemas generati**: `lib/api-zod/src/generated/`
* **React Query hooks generati**: `lib/api-client-react/src/generated/`

## Architecture decisions

* **Lingua del prodotto: italiano**. Tutti i testi utente, etichette, bottoni in italiano. Vedi `AGENT_BRIEF.md` sezione 2 per tabella di traduzioni.
* **Voto giocatore: algoritmo proprietario Mister** calcolato sui dati grezzi API-Football (eventi, statistiche, lineup). **Non c'è una `voto_source` configurabile**: nessuna scelta fra Gazzetta/Italia/consensus. Se trovi `voto_source` nel codice è un residuo da rimuovere.
* **Template snapshot, non riferimento vivo**: i tre template profilo vivono in `template_profiles` (DB), modificabili dal superadmin. Quando una Lega nasce da un template, i feature flag vengono COPIATI nella sua Federation. Cambi successivi al template non impattano leghe esistenti — questo evita di rompere retroattivamente leghe in corso.
* **18 feature flag in 5 categorie**: contracts, market, economy, tactics, scouting. Catalogo canonico in `lib/db/src/flags.ts`. Aggiungere un flag nuovo richiede code change (non solo toggle dal pannello superadmin) perché serve implementare il comportamento.
* **6 tipi di competizione**: `campionato`, `coppa`, `battle_royale`, `sprint_race`, `formula_uno`, `punteggio_assoluto`. Tiebreaker dinamici per tipo, ammessi/vietati validati lato schema in `competitions.ts`.
* **4 tipi di mercato**: `auction` (con sub-modi live/async/blind/token), `trade`, `release` (open/blind), `free_agent`.
* **Contratti multi-stagione**: ammortamento lineare (prezzo/durata), clausola rescissoria default = residuo × 0.8 (alzabile pagando), penale rescissione con coefficienti decrescenti per anno (1.5x → 1.0x).
* **Diritto di pareggio in asta**: alla scadenza naturale, il detentore uscente può pareggiare in TEMPO REALE i rilanci, non post-asta. Tie-breaking asimmetrico: a parità di importo vince il detentore.

## Product

Mister è un'app di fantacalcio manageriale, in italiano. Si rivolge ad appassionati con 10+ anni di esperienza in lega tra amici che cercano profondità simulativa, **non** principianti che vogliono "rendere il fantacalcio facile".

**Tre esperienze di onboarding (template profilo):**

* **Classico** (~10 min/sett, complessità 1) — fantacalcio tradizionale, una stagione per volta, niente contratti, niente clausole. Per chi ha sempre giocato così.
* **Esploratore** (~25 min/sett, complessità 2) — contratti 1-2 stagioni, trattative dirette, carryover budget al 50%. Ponte verso la profondità.
* **Manageriale** (~50 min/sett, complessità 3) — contratti fino a 5 stagioni, clausole rescissorie, scouting, mercato sempre attivo, carryover 100%. Il prodotto pieno.

**Tre pilastri di differenziazione**:
1. Asta live con AI battitore e riconoscimento vocale
2. **Mister AI** come agente unificato (consigliere d'asta, vice per squadre abbandonate, advisor di formazione)
3. Match engine con narrazione testuale generata da Claude Sonnet

## User preferences

* **Lingua del prodotto: italiano**. Non mescolare con inglese — neanche per termini tecnici comuni. "Dashboard" → "Cruscotto". "View all" → "Vedi tutto". Vedi tabella in `AGENT_BRIEF.md` sezione 2.
* **Tono**: sobrio, tecnico, da redazione sportiva. Niente emoji, niente vezzeggiativi, niente esclamativi. Niente toast "Oops!".
* **Riferimenti estetici**: Hattrick, Football Manager, Linear, Stripe Dashboard. **NON** FantaGazzetta, Leghe FC, Sorare.
* **Densità informativa alta**: niente landing-page minimalismo, niente empty state muti ("0 manager" deve avere CTA accanto), niente molto spazio vuoto sotto il fold.
* **Tipografia tri-famiglia**: Fraunces serif per titoli H1/H2, JetBrains Mono per **tutti i numeri** (metriche, ID, slug, prezzi, date), Inter sans per body. Mai tutto-sans-serif uniforme — è il primo segno della "SaaS dashboard generico".
* **Palette brand**: verde `#1f4733`, crema `#efe6d3`, sidebar dark `#0d1f1a`. NO gradient flashy, NO oro premium, NO colori squillanti.

## Gotchas

* **Ordine di lettura per task UI**: `replit.md` → `AGENT_BRIEF.md` → `DESIGN_SYSTEM.md` → file specifici del dominio. In quest'ordine. Le decisioni di brand/lingua/tono vincono sulle assunzioni di default.
* **Federation Rules deve esporre tutti i 18 flag**, raggruppati per categoria. La versione attuale (giugno 2026) ne mostra ~6 — è un bug.
* **Non aggiungere `voto_source` ai modelli**. Mai. È stato rimosso.
* **Voti = algoritmo Mister**. Nessuna UI deve mostrare scelta di fonte voto.
* **Empty state SEMPRE con CTA**. Mai un numero zero senza "Crea/Aggiungi/Invita ←" accanto.
* **Drizzle e Orval sono layer separati**. Modificare uno schema Drizzle NON aggiorna automaticamente `openapi.yaml`. Vanno tenuti coerenti a mano (o usare `drizzle-zod` come ponte). Quando aggiungi un campo allo schema DB, verifica anche se va esposto in API e aggiorna `openapi.yaml` di conseguenza.
* **I template di sistema (Classico/Esploratore/Manageriale) non si cancellano dal pannello superadmin, si disattivano.** Solo i template custom (is_system=false) hanno il bottone Elimina.
* **Script lineup/contracts — STRICT su contracts table**: ogni script che genera lineup, contratti, o dati per-team DEVE leggere il proprio pool player da `contracts WHERE fanta_team_id = X AND season_start = Y`. MAI usare pool globali (`GK_ACTIVE`, `DEF_ACTIVE`, ecc.) per costruire lineup: il PRNG shuffle con seed diverso produce player ID diversi da quelli in contracts → player "fantasma" invisibili nella UI. Causa root di T122 (bug confermato, corretto in T124c).
* **Avatar — residui colletto/maglia (es. Ballo-Touré #30533)**: capita che PicWish includa nell'alpha una striscia di maglia sotto il mento. 851-labs/background-remover NON è un fix valido: mantiene testa+busto, produce una bbox più grande e dopo normalizzazione il volto risulta ancora più piccolo nel cerchio. Le opzioni corrette sono: (1) script sharp mirato che azzera l'alpha sotto la riga del mento nelle zone non-carnagione; (2) secondo pass PicWish sullo stesso player se i crediti lo permettono (produce cutout variabile); (3) per il prototipo, accettare il caso singolo — non è un bug ricorrente.

## Pointers

* See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
* `AGENT_BRIEF.md` — identità prodotto, lingua, brand, tono, anti-pattern
* `DESIGN_SYSTEM.md` — token CSS, tipografia, componenti pronti HTML/CSS
* `lib/db/src/flags.ts` — catalogo dei 18 feature flag (source of truth)
* `lib/db/src/seeds/templates.ts` — i tre template Classico/Esploratore/Manageriale come seed

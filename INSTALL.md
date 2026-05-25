# Mister · Drop-in package per Replit

Questo pacchetto contiene quattro tipi di file da inserire nel tuo repo Replit:

## 1. File alla root del repo (sovrascrivere)

| File | Dove va | Cosa fa |
|---|---|---|
| `replit.md` | Root del repo (sovrascrivi quello esistente) | System prompt persistente per l'agente Replit. Include product context, decisioni architetturali, gotchas. |
| `AGENT_BRIEF.md` | Root del repo (nuovo) | Manifesto di identità, lingua, brand, tono. L'agente lo legge prima di toccare la UI. |
| `DESIGN_SYSTEM.md` | Root del repo (nuovo) | Token CSS, scala tipografica, componenti HTML/CSS pronti. |

## 2. Schema Drizzle (sovrascrivere i file esistenti)

Tutti i file vanno in `lib/db/src/`:

| File | Note |
|---|---|
| `lib/db/src/flags.ts` | NUOVO. Catalogo canonico dei 18 feature flag. |
| `lib/db/src/schema/template-profiles.ts` | Sovrascrive. |
| `lib/db/src/schema/federations.ts` | Sovrascrive. NO `voto_source`. |
| `lib/db/src/schema/leagues.ts` | Sovrascrive. |
| `lib/db/src/schema/competitions.ts` | Sovrascrive. 6 tipi con sub-config. |
| `lib/db/src/schema/market-events.ts` | Sovrascrive. 4 tipi canonici. |
| `lib/db/src/schema/contracts.ts` | Sovrascrive. Con helper di calcolo (ingaggio, residuo, clausola, penale). |
| `lib/db/src/schema/fanta-teams.ts` | Sovrascrive. |
| `lib/db/src/schema/players.ts` | Sovrascrive. Include `playerGiornataStats`. |
| `lib/db/src/schema/index.ts` | Sovrascrive. Re-export di tutti gli schema. |
| `lib/db/src/seeds/templates.ts` | NUOVO. I tre seed con feature flag values completi. |

## 3. Cosa fare dopo aver caricato

In ordine:

1. **`pnpm install`** (verificare che drizzle-orm, drizzle-zod, drizzle-kit, pg, zod siano già installati — dovrebbero esserlo dal pnpm-workspace).

2. **`pnpm --filter @workspace/db run push`** per applicare lo schema al DB (in dev). Se hai dati esistenti che vuoi mantenere, scrivi prima una migration.

3. **Eseguire il seed dei template**: aggiungi uno script che chiama `seedSystemTemplates(db)` da `lib/db/src/seeds/templates.ts` allo startup dell'API server (o creare un comando `pnpm --filter @workspace/db run seed`).

4. **Sincronizzare OpenAPI yaml**: lo schema Drizzle è ora la fonte di verità della forma dei dati, ma `lib/api-spec/openapi.yaml` è separato (è il contratto API). Bisogna aggiornarlo per esporre le nuove forme — in particolare i 18 flag, i 6 tipi competizione, i 4 tipi mercato. Lascia che l'agente Replit faccia questo lavoro guidato dal nuovo schema.

5. **Rifare la UI** dei due pannelli più rotti (Federation Rules a 18 flag + Template Manager card ricche), guidato da `DESIGN_SYSTEM.md` sezioni 11 e 12.

## 4. Istruzione iniziale da dare all'agente Replit

In una nuova conversazione su Replit, primo messaggio:

> Ho aggiornato il progetto con un set di file nuovi:
> - `replit.md` riscritto con product context e architecture decisions
> - `AGENT_BRIEF.md` e `DESIGN_SYSTEM.md` come istruzioni persistenti di brand e UX
> - `lib/db/src/flags.ts` e tutti gli schema in `lib/db/src/schema/` riscritti
> - `lib/db/src/seeds/templates.ts` con i seed dei tre template di sistema
>
> Prima di toccare codice, leggi nell'ordine: `replit.md`, `AGENT_BRIEF.md`, `DESIGN_SYSTEM.md`, `lib/db/src/flags.ts`, `lib/db/src/seeds/templates.ts`.
> Confermami che hai letto. Poi:
> 1. Esegui `pnpm --filter @workspace/db run push` per aggiornare il DB.
> 2. Aggiungi al server uno startup hook che chiama `seedSystemTemplates(db)`.
> 3. Aggiorna `lib/api-spec/openapi.yaml` per esporre la forma completa di Federation (con tutti i 18 flag in `featureFlags`), TemplateProfile (con `suggestedMarkets` e `suggestedCompetitions`), Competition (con i 6 tipi e sub-config), MarketEvent (con i 4 tipi).
> 4. Rigenera `lib/api-zod` e `lib/api-client-react` via `pnpm --filter @workspace/api-spec run codegen`.
> 5. Fermati e fammi screenshot di un endpoint nuovo (es. GET /api/templates) che restituisce ora i template con flag completi.
>
> NON toccare ancora la UI. La UI si fa nella fase 2, una pagina per volta, guidata da `DESIGN_SYSTEM.md` sezione 15 (ordine di priorità).

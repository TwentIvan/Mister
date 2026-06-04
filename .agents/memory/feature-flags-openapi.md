---
name: FeatureFlags OpenAPI schema
description: Il parser Zod generato da Orval stripa le chiavi non dichiarate in FeatureFlags. Ogni nuovo flag va aggiunto esplicitamente allo schema.
---

## Regola

`lib/api-spec/openapi.yaml` → schema `FeatureFlags` ha `properties` esplicite per ciascun flag. Se manca una proprietà, `GetFederationResponse.parse()` (generato da Orval) la stripa silenziosamente dalla risposta.

**Why:** Orval genera Zod schemas con `strict` o equivalente per i campi dichiarati; chiavi extra vengono ignorate.

**How to apply:** Ogni volta che si aggiunge un flag a `lib/db/src/flags.ts`, aggiungerlo anche a `FeatureFlags` in `openapi.yaml` e runnare `pnpm --filter @workspace/api-spec run codegen`.

Lo schema ha anche `additionalProperties: true` (aggiunto in Fase 2) come safety net per flags futuri, ma le proprietà esplicite restano necessarie per la documentazione.

## Segnale diagnostico

Server risponde con N-2 flag ma il bundle ha tutti i flag nel FLAGS array e `owner_user_id` (o altro campo nuovo) appare correttamente → causa è lo schema OpenAPI, non il bundle.

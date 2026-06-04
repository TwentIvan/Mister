---
name: Zod route stripping after mapper changes
description: Quando si aggiunge un campo al mapper (mapLeague, mapFederation...) senza eseguire codegen, il campo viene strisciato dal GetXxxResponse.parse() in route.
---

# Regola

Ogni volta che si aggiunge un campo a un mapper (es. `mapLeague`), il campo deve anche essere:
1. Aggiunto all'OpenAPI spec nella schema corrispondente (es. `League`)
2. Codegen eseguito: `pnpm --filter @workspace/api-spec run codegen`
3. Server ricostruito: `pnpm --filter @workspace/api-server run build` + restart workflow

**Why:** Le route usano `GetLeagueResponse.parse(mapLeague(row))` — il parse Zod striscia i campi non dichiarati nello schema. Il mapper può restituire il campo, ma Zod lo dropa silenziosamente se non è nell'OpenAPI → schema generato.

**How to apply:** Prima di aggiungere qualsiasi campo a un mapper, aggiorna prima openapi.yaml, poi codegen, poi modifica il mapper.

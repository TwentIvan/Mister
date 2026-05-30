---
name: RosterSnapshot vs flat array
description: La colonna fanta_teams.roster nel DB è sempre RosterSnapshot {gk,def,mid,att}, ma l'OpenAPI schema dichiara roster come array[integer]. Mismatch da gestire nel mapper.
---

## Regola

`mapFantaTeam` DEVE appiattire il RosterSnapshot a un array di player ID prima di restituirlo. Non restituire mai `t.roster` direttamente — la Zod validation dei response schema fallisce con "Expected array, received object".

**Why:** Il DB schema (`lib/db/src/schema/fanta-teams.ts`) usa `RosterSnapshot = { gk: number[], def: number[], mid: number[], att: number[] }` come tipo JSONB. L'OpenAPI spec (`lib/api-spec/openapi.yaml`) dichiara `roster: array[integer]` che Orval compila in `zod.array(zod.number())`. Il mismatch causa ZodError 500 su `GET /leagues/:id/teams`.

**How to apply:** In `artifacts/api-server/src/lib/mappers.ts`, `mapFantaTeam`:

```typescript
roster: (() => {
  const r = t.roster as unknown;
  if (!r) return [];
  if (Array.isArray(r)) return r as number[];
  const s = r as Record<string, number[]>;
  return [...(s.gk ?? []), ...(s.def ?? []), ...(s.mid ?? []), ...(s.att ?? [])];
})(),
```

Nota: anche `leagues.ts` POST wizard salva `roster: []` (array vuoto) per i nuovi team, coerente con il formato atteso.

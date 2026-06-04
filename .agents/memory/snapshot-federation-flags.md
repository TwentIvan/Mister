---
name: Snapshot federation flags
description: La prima asta di una lega congela i flag della federation nelle colonne snapshot_* della lega. Il bid handler usa snapshot > live federation.
---

## Regola

Trigger: `POST /auctions` — se `league.snapshotLockedAt IS NULL` e la lega ha `federationId`, il server:
1. Legge i flag live della federation (merge `defaultFlagValues() + featureFlags DB`)
2. Scrive `snapshot_feature_flags`, `snapshot_rules`, `snapshot_locked_at` nella lega dentro la stessa transaction
3. Imposta `snapshotLockedAt = now()`

Bid handler (`auctions.ts`): usa `league.snapshotFeatureFlags` se disponibile, altrimenti fallback a federation live + merge.

**Why:** Garantisce che le regole di una lega non cambino retroattivamente durante la stagione anche se il superadmin modifica la federation.

**How to apply:** Non resettare `snapshot_locked_at` manualmente. Per "resettare" le regole di una lega, serve un endpoint admin dedicato (non ancora implementato).

## Schema DB

- `leagues.snapshot_feature_flags` JSONB (nullable)
- `leagues.snapshot_rules` JSONB (nullable)
- `leagues.snapshot_locked_at` timestamp (nullable — null = non ancora snapshot)

---
name: Fase 2 Inviti — architettura slot
description: Decisioni e vincoli tecnici del sistema slot-based per l'ingresso in lega.
---

## Regola
POST /leagues crea N slot vuoti (manager_user_id=NULL, societa_id=NULL). Il creatore non occupa uno slot d'ufficio — entra in league_members come admin ma sceglie il proprio slot tramite /claim come gli altri.

**Why:** separare identità di lega (admin) da identità di squadra (manager). Permette leghe dove l'admin non gioca.

**How to apply:** quando si crea una lega, il body è `{ team_count: N, ... }` (non `fanta_teams: [...]`). I N slot vengono inseriti con `creditsRemaining = budget_initial`, `roster = {}`.

## Invite link format
`https://${REPLIT_DOMAINS.split(',')[0]}/join/${league.id}/${league.invitationCode}`

Route frontend: `/join/:leagueId/:code` — fuori da ProtectedRoute (pubblica, auth gestita inline).

## Atomic claim (J6)
UPDATE fanta_teams SET societa_id=X, manager_user_id=Y WHERE id=Z AND league_id=L AND manager_user_id IS NULL.
Se 0 righe aggiornate → 409 SLOT_TAKEN. Nessun lock esplicito necessario.

## Zod in api-server
`zod` deve essere dipendenza diretta in `artifacts/api-server/package.json` (`"zod": "catalog:"`) per importare `zod/v4` nelle route inline. Il workspace catalog ha `zod: ^3.25.76` che supporta il subpath `/v4`.

## manager_user_id nullable
`fanta_teams.manager_user_id` è nullable (`references(() => users.id, { onDelete: "set null" })`). ALTER TABLE applicato via psql (Drizzle push blocca su modifiche NOT NULL interattive).

---
name: Auth Passo A
description: Users table, bcrypt+JWT cookie auth, league_members owner propagation
---

## Implementazione

**Approccio**: JWT firmato in cookie HTTP-only `mister_auth`, 7d scadenza. bcrypt rounds=12. `optionalAuth` globale in app.ts (non per-route). Passo B (requireAuth per gating) è **deferred**.

**Endpoints**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`

**JWT_SECRET**: fallback `"dev-secret-CHANGE-IN-PROD"` per sviluppo. Prod richiede secret Replit.

## Regola critica: FK su league_members

`league_members.userId` ha FK su `users.id`. Insert con `userId="demo-user"` crasha (utente non esiste in users). Fix: l'insert in `league_members` è **condizionale su `req.user`**. Le leghe create da non-loggati NON hanno un'entry in league_members — Passo B aggiungerà `requireAuth`.

**Why:** la tabella `users` non contiene "demo-user" quindi qualsiasi insert con userId fittizio causa FK violation e rollback dell'intera transazione di creazione lega.

**How to apply:** In qualsiasi route che inserisce in `league_members`, verificare sempre che `req.user` esista prima dell'insert.

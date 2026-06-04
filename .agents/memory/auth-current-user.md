---
name: CurrentUser shape frontend vs server JWT
description: Il tipo CurrentUser frontend ha id (non sub); il payload JWT server usa sub — non mescolare
---

**Frontend** (`AuthContext.tsx`):
```typescript
interface CurrentUser { id: string; email: string; display_name: string; }
```

**Server JWT payload** (`auth.ts`):
```typescript
{ sub: string; email: string; displayName: string; }
```

**Why:** Divergenza storica — il server firma con `sub` (OpenID standard), ma il frontend idrida da `GET /auth/me` che restituisce `id`.

**How to apply:**
- Nel frontend, confronti ownership → `user.id` (es. `federation.owner_user_id === user?.id`).
- Sul server, nei guard → `req.user.sub`.
- Non usare `user?.sub` nel codice React — non esiste nel tipo e TypeScript lo segnala come TS2339.

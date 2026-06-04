---
name: Auth cookie pattern
description: Come funziona l'autenticazione server — cookie HTTP-only, non Bearer token nel body della risposta login
---

Il server imposta un cookie HTTP-only alla login (via `setAuthCookie`). La risposta di `POST /api/auth/login` restituisce solo l'oggetto utente, **non** un campo `token`.

**Why:** Il JWT è nel cookie, non nel body. Qualsiasi tentativo di estrarre `response.token` fallisce silenziosamente.

**How to apply:**
- Curl test: usare `-c cookiejar.txt` al login e `-b cookiejar.txt` nelle richieste successive.
- Frontend: il cookie viene inviato automaticamente con `credentials: 'include'` (già configurato nel custom-fetch).
- Non cercare `token`, `access_token`, o `jwt` nella risposta di login — non ci sono.

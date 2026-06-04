---
name: Federation adopt/create
description: POST /leagues accetta federation_id opzionale. SetupLegaPage legge ?federation_id da query param per il path "adopt".
---

## Regola

`POST /leagues` (`artifacts/api-server/src/routes/leagues.ts`):
- Se `federation_id` è nel body → valida che esista nel DB, usa quella federation (path "adopt")
- Se assente → auto-crea una federation dedicata con `defaultFlagValues()` (path "create")
- Federation inesistente → lancia errore con `code: 404`, il catch block risponde 404

`SetupLegaPage.tsx` (`artifacts/mister-web/src/pages/SetupLegaPage.tsx`):
- Usa `useSearch()` da wouter per leggere `?federation_id=xxx`
- Passa `federation_id` alla mutation `useCreateLeague` solo se presente

**Why:** Permette di creare una lega nell'ambito di una federation esistente (es. dalla pagina dettaglio federation) senza aggiungere step UI.

**How to apply:** Per linkare "Nuova lega" dalla pagina federation, navigare verso `/lega/nuova?federation_id=fed-xxx`.

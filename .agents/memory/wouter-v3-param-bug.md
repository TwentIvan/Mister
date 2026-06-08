---
name: Wouter v3 SPA param bug
description: useParams() con component= prop ritorna il template (":param") al primo render SPA; fix con useRouteId hook condiviso
---

## Regola

Non usare `useParams()` direttamente nelle pagine. Usare sempre `useRouteId(name)` da `@/hooks/useRouteId.tsx`.

## Il bug

Wouter 3.3.x con `<Route path="/foo/:id" component={Page} />` può restituire il template della route — la stringa `":id"` — come valore truthy del param al primo render durante la navigazione SPA client-side. Con URL diretto (full page load) non si verifica.

Conseguenze:
- Se la pagina ha un fallback hardcoded (`?? "comp-mvp-campionato-2024"`), carica silenziosamente i dati sbagliati
- Se non ha fallback, il hook gira con `":id"` → fetch a `/api/foo/:id` → 404 → `isError=true` → "Errore nel caricamento"
- `navigate(-1 as unknown as string)` causa lo stesso problema: wouter naviga al path letterale `"-1"` che matcha la route con `id="-1"`

## Fix implementato

Shared hook: `artifacts/mister-web/src/hooks/useRouteId.tsx`

```typescript
export function useRouteId(name: string): string | undefined {
  const params = useParams<Record<string, string>>();
  const value = params[name];
  if (!value || value.startsWith(":")) return undefined;
  return value;
}
```

Pattern d'uso obbligatorio (hooks prima del guard):
```typescript
const competitionId = useRouteId("competitionId");
const { data } = useGetSomething(competitionId ?? "");  // enabled: false se ""
if (!competitionId) return <RouteIdLoading />;          // dopo tutti gli hook
```

Back button: usare `window.history.back()` invece di `navigate(-1 as unknown as string)`.

## Pagine corrette

- ClassificaPage: rimosso `?? "comp-mvp-campionato-2024"` + back button
- CoppaPage: rimosso filtro manuale `.startsWith(":")`
- RosaPage: rimosso `?? "ft-mvp-1"`
- SchedaPage: rimosso `parseInt(?? "312", 10)`
- MatchDetailPage: rimosso `parseInt(?? "0", 10)`
- HubPage: rimosso destructuring + back button

**Why:** Fallback hardcoded mascherano il bug e caricano dati di un'altra entità senza errore visibile.

**How to apply:** Ogni nuova pagina mobile con `<Route component=>` deve usare `useRouteId`, mai `useParams` diretto.

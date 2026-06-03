---
name: Voice chiamo — svincolati non filtrata
description: La lista svincolati per il riconoscimento vocale deve venire da una query separata senza filtro di ricerca.
---

## Regola

In AstaLivePage, `useGetAuctionQueue` viene chiamato DUE volte in chiamata mode:

1. **`queueData`** — query filtrata da `callSearch` (UI: lista visibile nella sezione Chiama)
2. **`queueVoiceData`** — query sempre senza filtro (`params = undefined`), usata per `svincolatiForVoice`

`svincolatiForVoice` deve provenire ESCLUSIVAMENTE da `queueVoiceData`.

**Why:** Se si usasse `queueData` (filtrata), un `callSearch` attivo con ≥2 caratteri (es. "berardi") causa una query filtrata. Se il giocatore cercato è già skipped/called, i risultati sono `[]`. Questo azzera `svincolati` → `parseIntent` salta silenziosamente il branch "chiamo" (guard `svincolati?.length` è falsy) → il comando vocale non funziona senza alcun feedback.

**How to apply:** Quando si modifica la logica di ricerca in AstaLivePage, NON collegare `svincolatiForVoice` alla query filtrata. Mantenere due chiamate `useGetAuctionQueue` separate con query key distinte.

## Query keys

- Filtrata: `getGetAuctionQueueQueryKey(auctionId, { search: "..." })` — staleTime 10s
- Voce (unfiltered): `getGetAuctionQueueQueryKey(auctionId, undefined)` — staleTime 30s

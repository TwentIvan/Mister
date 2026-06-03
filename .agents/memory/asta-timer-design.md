---
name: AstaLivePage timer design
description: Architettura del timer deadline-based in AstaLivePage.tsx e comportamento corretto durante pausa.
---

## Regola

Il timer usa un **deadline assoluto** (`deadlineTs: number | null` in epoch ms), non un contatore decrementale.

- `deadlineTs = null` → idle, timer mostra "—"
- `deadlineTs = Date.now() + TIMER_SECONDS * 1000` → avviato a ogni bid riuscito
- `timerActive = deadlineTs !== null && !isPaused` — DEVE includere `!isPaused`
- `timerExpired = deadlineTs !== null && !isPaused && remaining === 0`

## Perché

Approccio precedente (setInterval che decrementa un contatore) produceva:
- Race condition su re-bid: il vecchio intervallo continuava sul vecchio contatore
- State machine rotta: `timerActive` veniva settato a `true` da più path (handleBid E bids_history effect)
- Pausa: `timerActive` rimaneva `true` anche quando `isPaused=true`

## Come applicare

- `handleBid`: dopo `mutateAsync` ok → `setDeadlineTs(Date.now() + TIMER_SECONDS * 1000)`
- `handleSalta/handleAggiudica`: `setDeadlineTs(null)` prima del mutation
- `currentPlayerId` effect: `setDeadlineTs(null)` → garantisce reset al cambio giocatore
- `handlePauseResume` pausa: salva `remainingMsOnPauseRef.current = Math.max(0, deadlineTs - Date.now())`
- `handlePauseResume` riprendi: `setDeadlineTs(Date.now() + remainingMsOnPauseRef.current)`
- Timer effect deps: `[deadlineTs, isPaused]` — si ferma automaticamente se `isPaused=true`

## Playwright timing

Il Playwright test environment impiega ~6 secondi reali per step (proxy HTTPS + evaluate overhead). Il timer parte sempre da 8 secondi — ma quando il test agente legge il DOM "100ms dopo il bid", sono in realtà trascorsi ~6s reali → mostra 2. Non è un bug del codice. Usare confronto `data-deadline-ts` (D2 > D1) per verificare reset, non valori istantanei.

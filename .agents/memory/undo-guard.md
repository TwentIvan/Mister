---
name: Undo guard server-authoritative
description: Come funziona il meccanismo anti-doppio-undo nell'asta live
---

## Regola
La colonna `auctions.last_undoable_action` (text, nullable) è l'unica sorgente di verità per sapere se esiste un'azione annullabile. Il frontend legge `auction.undoable` dal JSON dell'API, NON mantiene uno `useState` locale.

## Comportamento
- `bid / skip / assign` → imposta `last_undoable_action = 'bid'/'skip'/'assign'`
- `undo` → controlla che sia non-null (altrimenti risponde `{undone: null}`), poi esegue il rollback e lo azzera a null
- `mapAuction` espone `undoable: boolean = (lastUndoableAction != null)`

**Why:** uno stato locale nel frontend può diventare stale (refresh, connessione persa) e permettere doppi undo che corrompono lo stato della rosa. Il controllo server-side è atomico.

**How to apply:** ogni nuova azione che deve supportare undo deve (1) impostare `last_undoable_action` nella propria write, (2) l'endpoint undo deve già gestirla.

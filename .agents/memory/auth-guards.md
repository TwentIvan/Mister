---
name: isLeagueAdmin checks league_members
description: guardLeagueAdmin controlla league_members.role='admin', non la colonna admin_user_id sulla tabella leagues
---

`isLeagueAdmin(userId, leagueId)` fa una query su `league_members` cercando `role = 'admin'`.

**Why:** La colonna `admin_user_id` su `leagues` è metadato/display, non è usata per l'autorizzazione. La membership con ruolo è la fonte di verità.

**How to apply:**
- Per test di integrazione con un utente come admin: inserire una riga in `league_members` con `role='admin'`, non aggiornare `leagues.admin_user_id`.
- `UPDATE leagues SET admin_user_id=...` non dà accesso alle route protette da `guardLeagueAdmin`.

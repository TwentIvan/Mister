## 10. Stato & pendenze

**Fatto (mockup):** token + `propaga.py`, libreria componenti, mappa-guscio, 14 schermate (desktop/mobile), brand, documento modulare + registro + `genera.py`.

**Da fare / decidere:**
- **[PARZIALE]** Componenti a fonte unica: `componenti.py` centralizza già **volto + colori club + logica colore** e i `build_*.py` lo importano (rigenerazione verificata byte-identica). Resta da migrare il **markup del chip** al generatore canonico `badge()` (incrementale, per non regredire le viste approvate).
- Classifica: viste sorelle **Marcatori** / **Andamento** (se servono; marcatori per giocatore reale o squadra fanta).
- Vincolo di ruolo nello scambio Formazione mobile (oggi permissivo).
- Sostituzione segnaposto: volti toy reali, loghi club (IP), dati API-Sports.
- Pre-deploy (fuori dal giro design): `JWT_SECRET` reale (≥32), copy/i18n, fix logo-login, magic-link + Google OAuth, fondamenta brand.

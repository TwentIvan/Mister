# Mister — Specifica (documento modulare)

*Documento vivo, v2 modulare. Da vedere e rivedere.*

Mister è un'app di fantacalcio manageriale (backend Replit/Drizzle/Postgres, frontend React/Vite). Questa specifica è la **fonte di verità del design**, organizzata in moduli indipendenti.

## Come è fatto (e come si refactora veloce)

- **Moduli**: ogni concern è un file in `spec/`. Si modifica un modulo senza toccare gli altri.
- **ID stabili**: token `T-*`, componenti `C-*`, schermate `S-*`, regole `R-*`. I riferimenti sono per ID, non per prosa.
- **Registro**: `registro.json` tiene il grafo delle relazioni (chi usa cosa).
- **Generatore**: `genera.py` **valida** i riferimenti e **genera** la Matrice di propagazione (modulo 09) dal registro, poi **assembla** tutti i moduli in `mister_spec.md` (la copia leggibile). La matrice non si scrive a mano: si rigenera.
- **Token**: `tokens.css` è la fonte unica; `propaga.py` la inietta in tutte le schermate.

Ciclo di refactoring:
1. cambi un **token** → edita `tokens.css` → `python3 propaga.py`.
2. cambi un **componente/regola/architettura** → edita il modulo `spec/` relativo e, se cambiano le relazioni, `registro.json` → `python3 genera.py` (rivalida + rigenera matrice + riassembla).

## Moduli
01 Principi · 02 Token · 03 Brand · 04 Filosofia di layout · 05 Modello a strati · 06 Componenti · 07 Schermate · 08 Regole · 09 Matrice (generata) · 10 Stato & pendenze · 11 Allegati · 12 Brief di integrazione (generato)

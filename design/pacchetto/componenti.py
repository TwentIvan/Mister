#!/usr/bin/env python3
"""
componenti.py — FONTE UNICA dei componenti (le "parole").

Centralizza i mattoni condivisi del badge giocatore e affini:
  - FACE   : volto toy (segnaposto, stessa pipeline runtime)
  - CLUBS  : mappa colori club bicolore (segnaposto IP) — UNIONE di tutte le viste
  - pair / grad_crest / grad_bar : logica colore (split 135deg crest, 90deg barra)
  - badge(): generatore canonico del badge con i suoi tier (riferimento)

Tutti i build_*.py importano da qui. Cambi il volto o un colore club QUI
-> rigeneri le viste -> si propaga ovunque.  (Vedi spec: modulo 06 Componenti.)

NB: i valori colore club coincidono con la mappa documentata in tokens.css.
"""

# --- Volto toy (segnaposto) ---
FACE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#e7dcc4"/><path d="M12 12.6c2.2 0 3.6-1.8 3.6-4S14.2 5 12 5 8.4 6.6 8.4 8.6s1.4 4 3.6 4Zm0 1.3c-3.2 0-6.4 1.7-6.4 4.3V24h12.8v-5.8c0-2.6-3.2-4.3-6.4-4.3Z" fill="#9a9078"/></svg>'

# --- Mappa colori club (bicolore) — UNIONE di tutte le viste, segnaposto IP ---
CLUBS = {
    "Inter":("#0a0f1a","#0a63b0"), "Milan":("#c8102e","#0a0a0a"),
    "Juventus":("#0a0a0a","#ededed"), "Napoli":("#1278c8","#0c2340"),
    "Roma":("#7e1626","#dca93a"), "Lazio":("#5aa6d8","#f2f2f2"),
    "Atalanta":("#1a3a6b","#0c0c0c"), "Lecce":("#e6b800","#b81e2c"),
    "Cagliari":("#9b1b30","#16224a"), "Como":("#1f5fae","#f2f2f2"),
    "Fiorentina":("#5a2d82","#f2f2f2"), "Torino":("#6e1f2b","#3a0f16"),
    "Genoa":("#b81e2c","#0a2342"), "Bologna":("#9b1b30","#16224a"),
}

def pair(n):
    return CLUBS.get(n, ("#6a6a6a", "#9a9a9a"))

# --- Logica colore (le formule del crest/barra, una volta sola) ---
def grad_crest(n):
    a, b = pair(n)
    return "linear-gradient(135deg,%s 0 49%%,%s 51%% 100%%)" % (a, b)

def grad_bar(n):
    a, b = pair(n)
    return "linear-gradient(90deg,%s 0 50%%,%s 50%% 100%%)" % (a, b)

# ============================================================
# Generatore canonico del badge (RIFERIMENTO, tier parametrico).
# Le viste esistenti hanno wrapper propri per ragioni storiche;
# il codice nuovo dovrebbe usare badge() per propagare anche il markup.
# Tier: 'hero' | 'formazione' | 'partita' | 'tabellone' | 'roster'
# ============================================================
def badge(tier, role, name, club, vote=None, captain=False, price=None):
    cap = '<span class="cap">C</span>' if captain else ''
    if tier == "tabellone":   # compatto: niente volto
        pz = '<span class="pz">%s</span>' % price if price is not None else ''
        return ('<div class="tcell %s"><span class="cr" style="background:%s"></span>'
                '<span class="cn">%s</span>%s</div>') % (role, grad_crest(club), name, pz)
    if tier == "roster":      # riga
        return ('<div class="rr %s"><span class="cr" style="background:%s"></span>'
                '<span class="face">%s</span><span class="rn">%s</span></div>') % (
                role, grad_crest(club), FACE, name)
    pill = '<span class="vote">%s</span>' % vote if vote is not None else (
           '<span class="vote">%s</span>' % price if price is not None else '')
    return ('<div class="chip %s"><div class="av"><div class="ph">%s</div></div>'
            '%s%s<span class="bar" style="background:%s"></span><span class="cn">%s</span></div>') % (
            role, FACE, cap, pill, grad_bar(club), name)

# CSS canonico minimo del chip (riferimento; le viste lo dimensionano coi token).
BADGE_CSS = """
.chip{display:flex;flex-direction:column;align-items:center;gap:3px;position:relative}
.chip .av{position:relative;border-radius:50%;background:var(--cream2);overflow:hidden}
.chip.P .av{border-color:var(--ringP)}.chip.D .av{border-color:var(--ringD)}
.chip.C .av{border-color:var(--ringC)}.chip.A .av{border-color:var(--ringA)}
.chip .ph,.chip .ph svg{width:100%;height:100%}
.chip .bar{border-radius:3px;display:block}
.chip .cn{font-family:var(--disp);font-weight:600;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chip .vote{position:absolute;background:var(--green-d);color:var(--cream);font-weight:700;display:flex;align-items:center;justify-content:center}
.chip .cap{position:absolute;background:var(--gold);color:#fff;border-radius:50%;font-weight:700;display:flex;align-items:center;justify-content:center}
""".strip()

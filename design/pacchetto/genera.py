#!/usr/bin/env python3
"""
genera.py — valida il registro, GENERA la Matrice di propagazione (spec/09_matrice.md)
e ASSEMBLA i moduli spec/*.md in mister_spec.md. Poi ri-zippa il pacchetto.

Uso:  python3 genera.py
"""
import json, os, glob, zipfile, sys

PKG = os.path.dirname(os.path.abspath(__file__))
OUT = "/mnt/user-data/outputs"
SPEC = os.path.join(PKG, "spec")
REG = os.path.join(PKG, "registro.json")

def load():
    return json.load(open(REG))

def validate(r):
    errs = []
    tok = {t["id"] for t in r["tokens"]}
    comp = {c["id"] for c in r["componenti"]}
    scr = {s["id"] for s in r["schermate"]}
    for c in r["componenti"]:
        for t in c["usa"]:
            if t not in tok: errs.append("%s usa token inesistente %s" % (c["id"], t))
    for s in r["schermate"]:
        for c in s["usa"]:
            if c not in comp: errs.append("%s usa componente inesistente %s" % (s["id"], c))
    for rule in r["regole"]:
        for x in rule["riguarda"]:
            if x != "tutte" and x not in (comp | scr):
                errs.append("%s riguarda id inesistente %s" % (rule["id"], x))
    return errs

def integrazione(r):
    glob = [x for x in r["regole"] if x["riguarda"] == ["tutte"]]
    L = ["## 12. Brief di integrazione (per l'agente Replit) — generato da `registro.json`",
         "",
         "*Per schermata: componenti · regole da far rispettare lato server · dati · azioni. Generato; non modificare a mano.*",
         "",
         "### Sequenza di cablaggio consigliata",
         "1. **Sblocco** pendenze pre-deploy (login/magic-link + OAuth, `JWT_SECRET`, copy/i18n) — vedi modulo 10.",
         "2. **Quick-win in lettura**: `S-classifica`, poi `S-feed`.",
         "3. **Milestone asta** (real-time, server-authoritative): `S-config-asta` → `S-tabellone` + `S-paletta`.",
         "4. **Il resto**: `S-rosa`, `S-scheda`, `S-formazione-d/m`, `S-partita-d/m`, `S-dettaglio`, `S-mercato`, `S-federazione`.",
         "",
         "### Regole globali (ogni schermata)",
         "- " + " · ".join("%s (%s)" % (g["id"], g["nome"]) for g in glob),
         ""]
    for s in r["schermate"]:
        spec_rules = [x for x in r["regole"] if x["riguarda"] != ["tutte"]
                      and (s["id"] in x["riguarda"] or any(c in x["riguarda"] for c in s["usa"]))]
        L.append("#### %s — %s (%s · `%s`)" % (s["id"], s["nome"], s["piatt"], s["file"]))
        L.append("- **Componenti**: " + ", ".join(s["usa"]))
        L.append("- **Regole server**: " + (", ".join(x["id"] for x in spec_rules) if spec_rules else "solo globali"))
        L.append("- **Dati**: " + ("; ".join(s.get("dati", [])) or "—"))
        L.append("- **Azioni**: " + ("; ".join(s.get("azioni", [])) or "—"))
        L.append("")
    return "\n".join(L) + "\n"

def matrix(r):
    comp_by = {c["id"]: c for c in r["componenti"]}
    scr = r["schermate"]
    allscr_ids = [s["id"] for s in scr]
    L = ["## 9. Matrice di propagazione (generata da `registro.json`)",
         "",
         "*Non modificare a mano: rigenerata da `genera.py`. Per cambiare le relazioni si edita `registro.json`.*",
         "",
         "### 9.1 Token → componenti → schermate",
         "",
         "| Token | Componenti che lo usano | Schermate impattate |",
         "|---|---|---|"]
    for t in r["tokens"]:
        comps = [c["id"] for c in r["componenti"] if t["id"] in c["usa"]]
        if t.get("pervasivo"):
            screens = "**tutte**"
        else:
            sids = sorted({s["id"] for s in scr if any(c in s["usa"] for c in comps)})
            screens = ", ".join(sids) if sids else "—"
        L.append("| `%s` %s | %s | %s |" % (t["id"], t["etichetta"], ", ".join(comps) or "—", screens))
    L += ["", "### 9.2 Componente → schermate", "", "| Componente | Schermate |", "|---|---|"]
    for c in r["componenti"]:
        sids = [s["id"] for s in scr if c["id"] in s["usa"]]
        L.append("| %s (%s) | %s |" % (c["id"], c["nome"], ", ".join(sids) or "—"))
    L += ["", "### 9.3 Regola → ambito", "", "| Regola | Ambito |", "|---|---|"]
    for rule in r["regole"]:
        amb = "**tutte le schermate**" if rule["riguarda"] == ["tutte"] else ", ".join(rule["riguarda"])
        L.append("| %s — %s | %s |" % (rule["id"], rule["nome"], amb))
    return "\n".join(L) + "\n"

def assemble():
    parts = []
    for f in sorted(glob.glob(os.path.join(SPEC, "*.md"))):
        parts.append(open(f).read().rstrip())
    doc = "\n\n---\n\n".join(parts) + "\n"
    open(os.path.join(PKG, "mister_spec.md"), "w").write(doc)
    dst = os.path.join(OUT, "mister_spec.md")
    open(dst, "w").write(doc)
    return len(parts)

def rezip():
    zpath = os.path.join(OUT, "mister_design_pacchetto.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(PKG):
            for fn in files:
                full = os.path.join(root, fn)
                arc = "pacchetto/" + os.path.relpath(full, PKG)
                z.write(full, arc)
    return zpath

def main():
    r = load()
    errs = validate(r)
    if errs:
        print("VALIDAZIONE FALLITA:")
        for e in errs: print("  ✗", e)
        sys.exit(1)
    print("Validazione OK — %d token, %d componenti, %d schermate, %d regole" %
          (len(r["tokens"]), len(r["componenti"]), len(r["schermate"]), len(r["regole"])))
    open(os.path.join(SPEC, "09_matrice.md"), "w").write(matrix(r))
    open(os.path.join(SPEC, "12_integrazione.md"), "w").write(integrazione(r))
    n = assemble()
    z = rezip()
    print("Matrice rigenerata · %d moduli assemblati in mister_spec.md · pacchetto: %s" % (n, z))

if __name__ == "__main__":
    main()

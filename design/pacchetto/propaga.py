#!/usr/bin/env python3
"""
propaga.py — compilatore dei token.

Fonte unica: tokens.css (il suo blocco :root).
Per ogni schermata HTML: sovrascrive i token canonici nel suo :root,
PRESERVANDO eventuali variabili specifiche della schermata.

Uso:
    1. modifica tokens.css
    2. python3 propaga.py
    -> tutte le schermate aggiornate (cartella pacchetto + outputs) e ri-zippate.

Workflow con i build_*.py: prima rigeneri la schermata col suo build, POI lanci
propaga.py. propaga.py è l'autorità finale sui token; il :root dentro i build
non è autorevole.
"""
import re, os, glob, zipfile, sys

PKG = os.path.dirname(os.path.abspath(__file__))            # /home/claude/pacchetto
OUT = "/mnt/user-data/outputs"
TOKENS = os.path.join(PKG, "tokens.css")

def strip_comments(s):
    return re.sub(r"/\*.*?\*/", "", s, flags=re.S)

def parse_root(body):
    """body = contenuto tra :root{ e } -> lista ordinata di (nome, valore)."""
    body = strip_comments(body)
    out = []
    for chunk in body.split(";"):
        chunk = chunk.strip()
        if not chunk or ":" not in chunk or not chunk.startswith("--"):
            continue
        name, val = chunk.split(":", 1)
        out.append((name.strip(), val.strip()))
    return out

def get_canonical():
    css = open(TOKENS).read()
    m = re.search(r":root\s*\{(.*?)\}", css, flags=re.S)
    if not m:
        sys.exit("tokens.css: blocco :root non trovato")
    return parse_root(m.group(1))

def merged_root_string(file_root, canonical):
    """Canonico vince; variabili specifiche del file (non canoniche) preservate."""
    canon_names = {n for n, _ in canonical}
    parts = ["%s:%s" % (n, v) for n, v in canonical]
    extras = [(n, v) for n, v in file_root if n not in canon_names]
    parts += ["%s:%s" % (n, v) for n, v in extras]
    return ":root{" + ";".join(parts) + "}", len(extras)

def process(path, canonical):
    s = open(path).read()
    m = re.search(r":root\s*\{[^}]*\}", s)
    if not m:
        return None  # niente :root (es. tokens.css stesso, o file senza variabili)
    file_root = parse_root(m.group(0)[m.group(0).find("{")+1:m.group(0).rfind("}")])
    new_root, n_extra = merged_root_string(file_root, canonical)
    if new_root == m.group(0):
        return (False, n_extra)
    s2 = s[:m.start()] + new_root + s[m.end():]
    open(path, "w").write(s2)
    return (True, n_extra)

def main():
    canonical = get_canonical()
    print("Token canonici da tokens.css: %d" % len(canonical))
    htmls = sorted(glob.glob(os.path.join(PKG, "*.html")))
    changed = 0
    for h in htmls:
        r = process(h, canonical)
        name = os.path.basename(h)
        if r is None:
            print("  - %-26s  (nessun :root, saltato)" % name); continue
        did, extra = r
        # mantieni in sync anche la copia in outputs
        dst = os.path.join(OUT, name)
        if os.path.exists(dst):
            open(dst, "w").write(open(h).read())
        tag = "AGGIORNATO" if did else "già allineato"
        ex = ("  +%d var locali preservate" % extra) if extra else ""
        print("  - %-26s  %s%s" % (name, tag, ex))
        changed += 1 if did else 0
    # ri-zip (ricorsivo: include spec/ e tutto il pacchetto)
    zpath = os.path.join(OUT, "mister_design_pacchetto.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(PKG):
            for fn in files:
                full = os.path.join(root, fn)
                z.write(full, "pacchetto/" + os.path.relpath(full, PKG))
    print("\n%d schermate modificate. Pacchetto ri-zippato: %s" % (changed, zpath))

if __name__ == "__main__":
    main()

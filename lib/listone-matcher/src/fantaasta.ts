/**
 * Parser del CSV "fantaasta" di leghe.fantacalcio.it: SENZA riga header,
 * campi posizionali. Tracciato decodificato dai file reali (22 colonne):
 *
 *  0: id fonte           6: Qt.I Classic       12-14: (vuote)         18: FM
 *  1: nome               7: Qt.A Mantra        15: url campioncino    19: PGv
 *  2: nome (ripetuto)    8: Qt.I Mantra        16: (n/d)              20: età
 *  3: R (P/D/C/A)        9: squadra            17: MV                 21: (codice)
 *  4: R.MANTRA (POR...) 10: FVM
 *  5: Qt.A Classic      11: FVM Mantra
 *
 * `parseAnyListone` è il dispatcher: prova prima il formato con header
 * (xlsx/csv con intestazioni), poi il posizionale fantaasta.
 */

import type { Cell, ParseOutcome, ParsedListoneRow } from "./parse";
import { parseListoneRows } from "./parse";

const ROLES = new Set(["P", "D", "C", "A"]);

function toNum(c: Cell): number | null {
  if (c === null || c === undefined || c === "") return null;
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  const n = Number(String(c).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const clean = (c: Cell): string => String(c ?? "").trim();

/** Euristica: la riga sembra una riga dati fantaasta (id numerico, ruolo in col 3, 20+ colonne). */
function looksLikeFantaastaRow(r: readonly Cell[]): boolean {
  return (
    r.length >= 12 &&
    toNum(r[0]) !== null &&
    ROLES.has(clean(r[3]).toUpperCase()) &&
    clean(r[1]).length > 0 &&
    clean(r[9]).length > 0
  );
}

/** Parsea la matrice come tracciato fantaasta posizionale. */
export function parseFantaastaRows(cells: readonly Cell[][]): ParseOutcome {
  const rows: ParsedListoneRow[] = [];
  const skipped: ParseOutcome["skipped"] = [];

  for (let i = 0; i < cells.length; i++) {
    const r = cells[i] ?? [];
    if (r.length === 0 || r.every((c) => clean(c) === "")) continue; // vuota

    if (!looksLikeFantaastaRow(r)) {
      skipped.push({ rowIndex: i, reason: "riga non conforme al tracciato fantaasta" });
      continue;
    }

    rows.push({
      sourcePlayerId: toNum(r[0]),
      rawName: clean(r[1]),
      rawTeam: clean(r[9]),
      rawRoleClassic: clean(r[3]).toUpperCase(),
      rawRolesMantra: clean(r[4]) || null,
      qtA: toNum(r[5]),
      qtI: toNum(r[6]),
      fvm: toNum(r[10]),
      fuoriLista: false, // il tracciato fantaasta non porta il flag
      pgv: toNum(r[19]),
      mv: toNum(r[17]),
      fm: toNum(r[18]),
      rawFantaSquadra: null, // né lo stato rosa
      costo: null,
    });
  }

  return { rows, skipped, headerRowIndex: null };
}

/**
 * Dispatcher: prova il formato con header (xlsx / csv con intestazioni);
 * se l'header non c'è, prova il posizionale fantaasta. Sceglie l'esito
 * che produce righe.
 */
export function parseAnyListone(cells: readonly Cell[][]): ParseOutcome & { format: "header" | "fantaasta" | "unknown" } {
  const withHeader = parseListoneRows(cells);
  if (withHeader.headerRowIndex !== null && withHeader.rows.length > 0) {
    return { ...withHeader, format: "header" };
  }
  const fantaasta = parseFantaastaRows(cells);
  if (fantaasta.rows.length > 0) {
    return { ...fantaasta, format: "fantaasta" };
  }
  return { ...withHeader, format: "unknown" };
}

/**
 * Mini-parser CSV: gestisce campi tra virgolette e virgolette raddoppiate.
 * Sufficiente per i tracciati fantacalcio (nessun newline dentro i campi).
 */
export function csvToCells(text: string, separator = ","): Cell[][] {
  const out: Cell[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line === "") continue;
    const row: Cell[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === separator) {
        row.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    row.push(cur);
    out.push(row);
  }
  return out;
}

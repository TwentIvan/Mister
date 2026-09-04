/**
 * Parser delle righe del foglio "quotazioni" (fantacalcio.it e formati affini).
 *
 * Il chiamante estrae dal file xlsx una matrice di celle (string|number|null)
 * — qui NON si tocca il formato binario: la lib resta a zero dipendenze.
 *
 * Il layout tipico del file fantacalcio.it: una riga titolo, poi la riga
 * header (Id | R | RM | Nome | Squadra | Qt.A | Qt.I | ... | FVM | ...),
 * poi le righe dati. Il parser NON assume posizioni fisse: cerca la riga
 * header per contenuto e mappa le colonne per nome, tollerando varianti.
 */

export type Cell = string | number | null | undefined;

export interface ParsedListoneRow {
  sourcePlayerId: number | null;
  rawName: string;
  rawTeam: string;
  rawRoleClassic: string;
  rawRolesMantra: string | null;
  qtA: number | null;
  qtI: number | null;
  fvm: number | null;
}

export interface ParseOutcome {
  rows: ParsedListoneRow[];
  /** Righe scartate con motivo, per il report d'import */
  skipped: Array<{ rowIndex: number; reason: string }>;
  /** Header individuato (per debug/report) */
  headerRowIndex: number | null;
}

const clean = (c: Cell): string => String(c ?? "").trim();
const lower = (c: Cell): string => clean(c).toLowerCase();

function toNum(c: Cell): number | null {
  if (c === null || c === undefined || c === "") return null;
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  const n = Number(String(c).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Individua l'indice di colonna per un campo, provando più intestazioni note. */
function findCol(header: string[], names: string[]): number {
  for (const n of names) {
    const i = header.findIndex((h) => h === n);
    if (i >= 0) return i;
  }
  // fallback: prefisso (copre "qt.a", "qt.a." e simili)
  for (const n of names) {
    const i = header.findIndex((h) => h.startsWith(n));
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Parsea la matrice di celle. Ritorna righe valide + scarti motivati.
 * Requisiti minimi per considerare una riga header: contiene "nome" e "squadra".
 */
export function parseListoneRows(cells: readonly Cell[][]): ParseOutcome {
  // 1) trova la riga header
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(cells.length, 10); i++) {
    const row = (cells[i] ?? []).map(lower);
    if (row.includes("nome") && row.includes("squadra")) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex < 0) {
    return { rows: [], skipped: [{ rowIndex: -1, reason: "header non trovato (attese colonne Nome e Squadra)" }], headerRowIndex: null };
  }

  const header = (cells[headerRowIndex] ?? []).map(lower);
  const col = {
    id:     findCol(header, ["id"]),
    role:   findCol(header, ["r", "ruolo"]),
    roleM:  findCol(header, ["rm", "ruolo mantra"]),
    name:   findCol(header, ["nome"]),
    team:   findCol(header, ["squadra"]),
    qtA:    findCol(header, ["qt.a", "qt a", "qta", "qt. a"]),
    qtI:    findCol(header, ["qt.i", "qt i", "qti", "qt. i"]),
    fvm:    findCol(header, ["fvm"]),
  };

  const rows: ParsedListoneRow[] = [];
  const skipped: ParseOutcome["skipped"] = [];

  for (let i = headerRowIndex + 1; i < cells.length; i++) {
    const r = cells[i] ?? [];
    const rawName = col.name >= 0 ? clean(r[col.name]) : "";
    const rawTeam = col.team >= 0 ? clean(r[col.team]) : "";
    const rawRole = col.role >= 0 ? clean(r[col.role]).toUpperCase() : "";

    if (!rawName && !rawTeam) continue; // riga vuota: skip silenzioso
    if (!rawName) { skipped.push({ rowIndex: i, reason: "nome mancante" }); continue; }
    if (!rawTeam) { skipped.push({ rowIndex: i, reason: "squadra mancante" }); continue; }
    if (!["P", "D", "C", "A"].includes(rawRole)) {
      skipped.push({ rowIndex: i, reason: `ruolo non riconosciuto: "${rawRole}"` });
      continue;
    }

    rows.push({
      sourcePlayerId: col.id >= 0 ? toNum(r[col.id]) : null,
      rawName,
      rawTeam,
      rawRoleClassic: rawRole,
      rawRolesMantra: col.roleM >= 0 && clean(r[col.roleM]) ? clean(r[col.roleM]) : null,
      qtA: col.qtA >= 0 ? toNum(r[col.qtA]) : null,
      qtI: col.qtI >= 0 ? toNum(r[col.qtI]) : null,
      fvm: col.fvm >= 0 ? toNum(r[col.fvm]) : null,
    });
  }

  return { rows, skipped, headerRowIndex };
}

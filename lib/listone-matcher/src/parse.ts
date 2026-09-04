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
  /** "Fuori lista" (leghe.fantacalcio.it): giocatore uscito dalla Serie A */
  fuoriLista: boolean;
  /** Presenze a voto, media voto, fantamedia (se presenti nel file) */
  pgv: number | null;
  mv: number | null;
  fm: number | null;
  /** Stato rosa (leghe.fantacalcio.it): fantasquadra proprietaria e costo pagato */
  rawFantaSquadra: string | null;
  costo: number | null;
}

export interface ParseOutcome {
  rows: ParsedListoneRow[];
  /** Righe scartate con motivo, per il report d'import */
  skipped: Array<{ rowIndex: number; reason: string }>;
  /** Header individuato (per debug/report) */
  headerRowIndex: number | null;
}

const clean = (c: Cell): string => String(c ?? "").trim();

/**
 * Forma canonica di una cella header: minuscole, senza punti/spazi/slash.
 * Copre le varianti reali: "Sq." → "sq", "R.MANTRA" → "rmantra",
 * "Qt.A" → "qta", "FVM/1000" → "fvm1000", "QUOT." → "quot".
 */
const canonHeader = (c: Cell): string =>
  clean(c).toLowerCase().replace(/[.\s/]/g, "");

function toNum(c: Cell): number | null {
  if (c === null || c === undefined || c === "") return null;
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  const n = Number(String(c).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Individua l'indice di colonna per un campo tra le intestazioni canoniche note. */
function findCol(header: string[], names: string[]): number {
  for (const n of names) {
    const i = header.findIndex((h) => h === n);
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Parsea la matrice di celle. Ritorna righe valide + scarti motivati.
 * Riconosce sia il formato "Quotazioni" di fantacalcio.it (Id|R|RM|Nome|
 * Squadra|Qt.A|Qt.I|FVM) sia quello di leghe.fantacalcio.it
 * (#|Nome|Fuori lista|Sq.|Under|R.|R.MANTRA|PGv|MV|FM|FVM/1000|QUOT.|
 * FantaSquadra|Costo). Requisito minimo per la riga header: "nome" +
 * una colonna squadra ("squadra" o "sq").
 */
export function parseListoneRows(cells: readonly Cell[][]): ParseOutcome {
  // 1) trova la riga header
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(cells.length, 10); i++) {
    const row = (cells[i] ?? []).map(canonHeader);
    if (row.includes("nome") && (row.includes("squadra") || row.includes("sq"))) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex < 0) {
    return { rows: [], skipped: [{ rowIndex: -1, reason: "header non trovato (attese colonne Nome e Squadra/Sq.)" }], headerRowIndex: null };
  }

  const header = (cells[headerRowIndex] ?? []).map(canonHeader);
  const col = {
    id:       findCol(header, ["id", "#"]),
    role:     findCol(header, ["r", "ruolo"]),
    roleM:    findCol(header, ["rm", "rmantra", "ruolomantra"]),
    name:     findCol(header, ["nome"]),
    team:     findCol(header, ["squadra", "sq"]),
    qtA:      findCol(header, ["qta", "quot", "quotazione"]),
    qtI:      findCol(header, ["qti"]),
    fvm:      findCol(header, ["fvm", "fvm1000"]),
    fuori:    findCol(header, ["fuorilista"]),
    pgv:      findCol(header, ["pgv"]),
    mv:       findCol(header, ["mv"]),
    fm:       findCol(header, ["fm"]),
    fantaSq:  findCol(header, ["fantasquadra"]),
    costo:    findCol(header, ["costo"]),
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

    const fuoriCell = col.fuori >= 0 ? clean(r[col.fuori]).toLowerCase() : "";

    rows.push({
      sourcePlayerId: col.id >= 0 ? toNum(r[col.id]) : null,
      rawName,
      rawTeam,
      rawRoleClassic: rawRole,
      rawRolesMantra: col.roleM >= 0 && clean(r[col.roleM]) ? clean(r[col.roleM]) : null,
      qtA: col.qtA >= 0 ? toNum(r[col.qtA]) : null,
      qtI: col.qtI >= 0 ? toNum(r[col.qtI]) : null,
      fvm: col.fvm >= 0 ? toNum(r[col.fvm]) : null,
      fuoriLista: fuoriCell !== "" && fuoriCell !== "no" && fuoriCell !== "0" && fuoriCell !== "false",
      pgv: col.pgv >= 0 ? toNum(r[col.pgv]) : null,
      mv: col.mv >= 0 ? toNum(r[col.mv]) : null,
      fm: col.fm >= 0 ? toNum(r[col.fm]) : null,
      rawFantaSquadra: col.fantaSq >= 0 && clean(r[col.fantaSq]) ? clean(r[col.fantaSq]) : null,
      costo: col.costo >= 0 ? toNum(r[col.costo]) : null,
    });
  }

  return { rows, skipped, headerRowIndex };
}

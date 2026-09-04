/**
 * Matching listone ↔ anagrafica players.
 *
 * Pipeline a stadi, dal più affidabile al meno:
 *  1. exact      — nome e squadra identici case-insensitive
 *  2. normalized — identici dopo normalizzazione; le iniziali puntate del
 *                  listone ("Martinez L.") devono essere compatibili con i
 *                  token del nome anagrafico
 *  3. fuzzy      — stessa squadra, ruolo compatibile, similarità ≥ soglia
 *  4. none       — orfano, andrà in riconciliazione manuale (T151)
 *
 * Funzioni PURE: nessun accesso a DB, testabili in isolamento (stile
 * voto-engine). Il chiamante fornisce entries e anagrafica, riceve gli esiti.
 */

import {
  normalize,
  significantTokens,
  initials,
  similarity,
  sameTeam,
} from "./normalize";

// ── Tipi di input/output (strutturali: nessuna dipendenza da @workspace/db) ──

export interface CandidatePlayer {
  id: number;
  name: string;
  fullName: string;
  realTeam: string;
  /** GK | DEF | MID | ATT */
  roleClassic: string;
}

export interface EntryToMatch {
  rawName: string;
  rawTeam: string;
  /** P | D | C | A (formato fantacalcio.it) */
  rawRoleClassic: string;
}

export type MatchMethod = "exact" | "normalized" | "fuzzy" | "none";

export interface MatchResult {
  playerId: number | null;
  method: MatchMethod;
  /** 0..1; null per method=none */
  confidence: number | null;
  /** Candidati alternativi utili alla UI di riconciliazione (max 3) */
  candidates: Array<{ playerId: number; score: number }>;
}

/** Soglia sotto la quale il fuzzy non assegna (resta none, ma propone candidati). */
export const FUZZY_THRESHOLD = 0.82;

/** Mappa ruoli fonte → ruoli anagrafica. */
export function roleFromSource(r: string): string | null {
  switch (r.trim().toUpperCase()) {
    case "P": return "GK";
    case "D": return "DEF";
    case "C": return "MID";
    case "A": return "ATT";
    default:  return null;
  }
}

/**
 * True se il nome del listone è "compatibile per token" con quello anagrafico:
 * ogni token significativo del listone deve comparire ESATTO tra i token di
 * name+fullName, e le iniziali puntate devono trovare un token che inizia con
 * quella lettera. Nessuna tolleranza sui refusi: quelli competono nello
 * stadio fuzzy, dove la soglia e la guardia anti-ambiguità li governano.
 */
function tokensCompatible(entryName: string, p: CandidatePlayer): boolean {
  const pTokens = new Set([
    ...significantTokens(p.name),
    ...significantTokens(p.fullName),
  ]);
  const pTokenArr = [...pTokens];

  for (const t of significantTokens(entryName)) {
    if (!pTokens.has(t)) return false;
  }
  for (const ini of initials(entryName)) {
    const ok = pTokenArr.some((pt) => pt.startsWith(ini));
    if (!ok) return false;
  }
  return true;
}

/** Punteggio fuzzy tra nome listone e giocatore: massimo tra le combinazioni utili. */
function fuzzyScore(entryName: string, p: CandidatePlayer): number {
  const en = normalize(entryName);
  const enTokens = significantTokens(entryName).join(" ");
  const variants = [
    normalize(p.name),
    normalize(p.fullName),
    significantTokens(p.name).join(" "),
    // cognome anagrafico (ultimo token del fullName): copre "Martinez L." → "martinez"
    significantTokens(p.fullName).slice(-1).join(" "),
  ].filter(Boolean);

  let best = 0;
  for (const v of variants) {
    best = Math.max(best, similarity(en, v), enTokens ? similarity(enTokens, v) : 0);
  }
  return best;
}

/**
 * Matcha UNA entry contro l'anagrafica. `players` è l'intera lista candidata
 * (il chiamante può pre-filtrare, ma non è richiesto).
 */
export function matchEntry(
  entry: EntryToMatch,
  players: readonly CandidatePlayer[],
): MatchResult {
  const entryRole = roleFromSource(entry.rawRoleClassic);

  // ── Stadio 1: exact (nome identico case-insensitive + stessa squadra) ──
  const rawLower = entry.rawName.trim().toLowerCase();
  for (const p of players) {
    if (
      (p.name.trim().toLowerCase() === rawLower || p.fullName.trim().toLowerCase() === rawLower) &&
      sameTeam(entry.rawTeam, p.realTeam)
    ) {
      return { playerId: p.id, method: "exact", confidence: 1, candidates: [] };
    }
  }

  // ── Stadio 2: normalized (stessa squadra + token compatibili) ──
  // Raccoglie TUTTI i candidati compatibili: assegna solo se il candidato è
  // unico, o se il ruolo lo rende unico. Con 2+ candidati equivalenti
  // ("Martinez J." può essere Josep O l'iniziale del secondo nome di un
  // omonimo) NON si tira a indovinare: meglio la riconciliazione manuale.
  const stage2 = players.filter(
    (p) => sameTeam(entry.rawTeam, p.realTeam) && tokensCompatible(entry.rawName, p),
  );
  if (stage2.length === 1) {
    return { playerId: stage2[0]!.id, method: "normalized", confidence: 0.97, candidates: [] };
  }
  if (stage2.length > 1 && entryRole) {
    const byRole = stage2.filter((p) => p.roleClassic === entryRole);
    if (byRole.length === 1) {
      return { playerId: byRole[0]!.id, method: "normalized", confidence: 0.95, candidates: [] };
    }
  }
  if (stage2.length > 1) {
    // ambiguo: none, con i candidati in evidenza per la UI
    return {
      playerId: null,
      method: "none",
      confidence: null,
      candidates: stage2.slice(0, 3).map((p) => ({ playerId: p.id, score: 0.9 })),
    };
  }

  // ── Stadio 3: fuzzy (stessa squadra, ruolo compatibile se noto, sim ≥ soglia) ──
  const scored: Array<{ playerId: number; score: number }> = [];
  for (const p of players) {
    if (!sameTeam(entry.rawTeam, p.realTeam)) continue;
    if (entryRole && p.roleClassic !== entryRole) continue;
    const s = fuzzyScore(entry.rawName, p);
    if (s > 0.5) scored.push({ playerId: p.id, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const runnerUp = scored[1];

  if (top && top.score >= FUZZY_THRESHOLD) {
    // Guardia anti-ambiguità: se il secondo è quasi identico al primo,
    // NON assegnare — meglio un dubbio in riconciliazione che un match sbagliato.
    if (!runnerUp || top.score - runnerUp.score >= 0.05) {
      return {
        playerId: top.playerId,
        method: "fuzzy",
        confidence: top.score,
        candidates: scored.slice(0, 3),
      };
    }
  }

  // ── Stadio 4: none — proponi comunque i migliori candidati alla UI ──
  return { playerId: null, method: "none", confidence: null, candidates: scored.slice(0, 3) };
}

export interface BatchReport {
  total: number;
  exact: number;
  normalized: number;
  fuzzy: number;
  none: number;
}

/** Matcha un intero batch e restituisce esiti + report aggregato. */
export function matchBatch(
  entries: readonly EntryToMatch[],
  players: readonly CandidatePlayer[],
): { results: MatchResult[]; report: BatchReport } {
  const results = entries.map((e) => matchEntry(e, players));
  const report: BatchReport = {
    total: results.length,
    exact: results.filter((r) => r.method === "exact").length,
    normalized: results.filter((r) => r.method === "normalized").length,
    fuzzy: results.filter((r) => r.method === "fuzzy").length,
    none: results.filter((r) => r.method === "none").length,
  };
  return { results, report };
}

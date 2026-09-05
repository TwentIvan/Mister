/**
 * Normalizzazione di nomi e squadre per il matching listone ↔ anagrafica.
 *
 * I nomi fantacalcistici sono scritti "all'italiana": cognome secco
 * ("Lautaro" → "Martinez L.", "Thuram" vs "Thuram K."), iniziali puntate,
 * accenti a piacere, apostrofi e trattini variabili. La normalizzazione
 * porta tutto a una forma canonica confrontabile SENZA perdere i token.
 */

/** Lettere speciali NON decomponibili via NFD: vanno piegate a mano. */
const SPECIAL_FOLD: Record<string, string> = {
  "ø": "o", "Ø": "o", "æ": "ae", "Æ": "ae", "œ": "oe", "Œ": "oe",
  "ß": "ss", "ł": "l", "Ł": "l", "đ": "d", "Đ": "d", "ð": "d",
  "þ": "th", "Þ": "th", "ı": "i", "ħ": "h",
};

/** Minuscole, senza accenti né lettere speciali, senza punteggiatura, spazi singoli. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[øØæÆœŒßłŁđĐðþÞıħ]/g, (c) => SPECIAL_FOLD[c] ?? c)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accenti
    .replace(/['’`´\-.]/g, " ") // apostrofi, trattini, punti (iniziali) → spazio
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token normalizzati, senza iniziali singole ("martinez l" → ["martinez"]). */
export function significantTokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 1);
}

/** Iniziali singole presenti nel nome ("martinez l" → ["l"]). */
export function initials(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length === 1);
}

/**
 * Distanza di Levenshtein classica (iterativa, O(len_a × len_b)).
 * Bastano stringhe corte (cognomi), niente ottimizzazioni esotiche.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length]!;
}

/** Similarità 0..1 basata su Levenshtein normalizzata sulla lunghezza max. */
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/**
 * Squadre: alias noti tra le grafie del listone e quelle di API-Football.
 * Le chiavi e i valori sono in forma normalizzata. Estendere qui quando
 * l'import segnala mismatch di squadra sistematici.
 */
const TEAM_ALIASES: Record<string, string> = {
  inter: "inter",
  internazionale: "inter",
  milan: "ac milan",
  "ac milan": "ac milan",
  juventus: "juventus",
  juve: "juventus",
  napoli: "napoli",
  roma: "as roma",
  "as roma": "as roma",
  lazio: "lazio",
  atalanta: "atalanta",
  fiorentina: "fiorentina",
  bologna: "bologna",
  torino: "torino",
  udinese: "udinese",
  genoa: "genoa",
  verona: "hellas verona",
  "hellas verona": "hellas verona",
  cagliari: "cagliari",
  lecce: "lecce",
  parma: "parma",
  como: "como",
  cremonese: "cremonese",
  pisa: "pisa",
  sassuolo: "sassuolo",
};

/** Forma canonica della squadra (passa dagli alias; fallback: normalizzata). */
export function canonicalTeam(s: string): string {
  const n = normalize(s);
  return TEAM_ALIASES[n] ?? n;
}

/** True se le due squadre (in qualunque grafia) sono la stessa. */
export function sameTeam(a: string, b: string): boolean {
  const ca = canonicalTeam(a);
  const cb = canonicalTeam(b);
  if (ca === cb) return true;
  // fallback: una contenuta nell'altra ("milan" ⊂ "ac milan")
  return ca.includes(cb) || cb.includes(ca);
}

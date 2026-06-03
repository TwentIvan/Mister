import { describe, it, expect } from "vitest";
import { parseIntent, fuzzyContainsKeyword, fuzzyMatchTeam, checkVoiceNameConflicts, normalizedDist } from "../useVoiceBidder";
import type { Intent } from "../useVoiceBidder";

// ── Fixture squadre ───────────────────────────────────────────────────────────
const SQUADRE = [
  { id: "t1", name: "Sandro Zippangui",  name_auction: "Sandro"  },
  { id: "t2", name: "FC Beste",          name_auction: "Beste"   },
  { id: "t3", name: "Deca Arsenal",      name_auction: "Deca"    },
  { id: "t4", name: "Simo Dinamo C",     name_auction: "Simo"    },
  { id: "t5", name: "Italo Deportivo",   name_auction: "Italo"   },
  { id: "t6", name: "Ivan Valsugan",     name_auction: "Ivan"    },
  { id: "t7", name: "Luca Billyteam",    name_auction: "Luca"    },
  { id: "t8", name: "Alby Villarreal",   name_auction: "Alby"    },
];

// ── parseIntent: offerte ──────────────────────────────────────────────────────
describe("parseIntent — offerte", () => {
  it("VV1a: 'alby quindici' → offerta Alby 15", () => {
    const r = parseIntent("alby quindici", SQUADRE) as Extract<Intent, { type: "bid" }>;
    expect(r?.type).toBe("bid");
    expect(r?.teamId).toBe("t8");
    expect(r?.amount).toBe(15);
  });

  it("VV1b: 'beste 15' → offerta Beste 15", () => {
    const r = parseIntent("beste 15", SQUADRE) as Extract<Intent, { type: "bid" }>;
    expect(r?.type).toBe("bid");
    expect(r?.teamId).toBe("t2");
    expect(r?.amount).toBe(15);
  });

  it("trascrizione imperfetta: 'albi quindici' → offerta Alby 15 (1 errore)", () => {
    const r = parseIntent("albi quindici", SQUADRE) as Extract<Intent, { type: "bid" }>;
    expect(r?.type).toBe("bid");
    expect(r?.teamId).toBe("t8");
    expect(r?.amount).toBe(15);
  });

  it("trascrizione imperfetta: 'besta 15' → offerta Beste 15", () => {
    const r = parseIntent("besta 15", SQUADRE) as Extract<Intent, { type: "bid" }>;
    expect(r?.type).toBe("bid");
    expect(r?.teamId).toBe("t2");
    expect(r?.amount).toBe(15);
  });

  it("nome completo con squadra reale: 'alby villarreal 20' → offerta Alby 20", () => {
    const r = parseIntent("alby villarreal 20", SQUADRE) as Extract<Intent, { type: "bid" }>;
    expect(r?.type).toBe("bid");
    expect(r?.teamId).toBe("t8");
    expect(r?.amount).toBe(20);
  });
});

// ── parseIntent: comandi ──────────────────────────────────────────────────────
describe("parseIntent — comandi", () => {
  it("VV2a: 'aggiudica' → aggiudica", () => {
    expect(parseIntent("aggiudica", SQUADRE)?.type).toBe("aggiudica");
  });

  it("VV2b: 'a giudica' (bigram Chrome) → aggiudica", () => {
    expect(parseIntent("a giudica", SQUADRE)?.type).toBe("aggiudica");
  });

  it("VV2c: 'giocatore aggiudicato' → aggiudica", () => {
    expect(parseIntent("giocatore aggiudicato", SQUADRE)?.type).toBe("aggiudica");
  });

  it("VV2d: 'aggiudicato' → aggiudica", () => {
    expect(parseIntent("aggiudicato", SQUADRE)?.type).toBe("aggiudica");
  });

  it("'mister salta' → salta", () => {
    expect(parseIntent("mister salta", SQUADRE)?.type).toBe("salta");
  });

  it("'mister pausa' → pausa", () => {
    expect(parseIntent("mister pausa", SQUADRE)?.type).toBe("pausa");
  });

  it("'mister riprendi' → riprendi", () => {
    expect(parseIntent("mister riprendi", SQUADRE)?.type).toBe("riprendi");
  });

  it("typo 'mister salt' → salta (fuzzy)", () => {
    expect(parseIntent("mister salt", SQUADRE)?.type).toBe("salta");
  });
});

// ── parseIntent: garbage ──────────────────────────────────────────────────────
describe("parseIntent — garbage", () => {
  it("stringa vuota → null", () => {
    expect(parseIntent("", SQUADRE)).toBeNull();
  });

  it("parola isolata non riconoscibile → null", () => {
    expect(parseIntent("xyzfoo", SQUADRE)).toBeNull();
  });

  it("numero senza nome squadra → null", () => {
    expect(parseIntent("15", SQUADRE)).toBeNull();
  });

  it("nome squadra senza numero → null", () => {
    expect(parseIntent("alby", SQUADRE)).toBeNull();
  });

  it("nome chiaramente lontano da qualsiasi squadra → null", () => {
    // "zzzzzz 10" — nessuna squadra vicina
    expect(parseIntent("zzzzzz 10", SQUADRE)).toBeNull();
  });
});

// ── fuzzyContainsKeyword ──────────────────────────────────────────────────────
describe("fuzzyContainsKeyword", () => {
  it("token esatto → true", () => {
    expect(fuzzyContainsKeyword("aggiudica", "aggiudica")).toBe(true);
  });

  it("bigram 'a giudica' → 'aggiudica' → true", () => {
    expect(fuzzyContainsKeyword("a giudica", "aggiudica")).toBe(true);
  });

  it("parola diversa → false", () => {
    expect(fuzzyContainsKeyword("ciao mondo", "aggiudica")).toBe(false);
  });
});

// ── checkVoiceNameConflicts ───────────────────────────────────────────────────
describe("checkVoiceNameConflicts", () => {
  it("nomi distinti → nessun conflitto", () => {
    expect(checkVoiceNameConflicts(SQUADRE)).toHaveLength(0);
  });

  it("nomi simili → conflitto segnalato", () => {
    const squadreSimilari = [
      { id: "a", name: "Luca", name_auction: "Luca" },
      { id: "b", name: "Luca2", name_auction: "Luca" },
    ];
    const conflicts = checkVoiceNameConflicts(squadreSimilari);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it("nomi quasi identici ('Ivan' vs 'Ivano') → conflitto", () => {
    const s = [
      { id: "a", name: "Ivan",  name_auction: "Ivan"  },
      { id: "b", name: "Ivano", name_auction: "Ivano" },
    ];
    expect(checkVoiceNameConflicts(s).length).toBeGreaterThan(0);
  });
});

// ── normalizedDist ────────────────────────────────────────────────────────────
describe("normalizedDist", () => {
  it("identici → 0", () => expect(normalizedDist("alby", "alby")).toBe(0));
  it("un errore su 4 char → 0.25", () => expect(normalizedDist("albi", "alby")).toBeCloseTo(0.25));
  it("completamente diversi → alto", () => expect(normalizedDist("alby", "sandro")).toBeGreaterThan(0.5));
});

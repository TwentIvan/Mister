import { describe, it, expect } from "vitest";
import { matchEntry, matchBatch, roleFromSource, FUZZY_THRESHOLD } from "../match";
import { normalize, sameTeam, levenshtein, similarity } from "../normalize";
import { parseListoneRows, type Cell } from "../parse";
import type { CandidatePlayer } from "../match";

// ── Anagrafica finta in stile API-Football ────────────────────────────────────
const PLAYERS: CandidatePlayer[] = [
  { id: 1, name: "Lautaro Martínez", fullName: "Lautaro Javier Martínez", realTeam: "Inter", roleClassic: "ATT" },
  { id: 2, name: "J. Martínez", fullName: "Josep Martínez Riera", realTeam: "Inter", roleClassic: "GK" },
  { id: 3, name: "Theo Hernández", fullName: "Theo Bernard François Hernández", realTeam: "AC Milan", roleClassic: "DEF" },
  { id: 4, name: "M. Thuram", fullName: "Marcus Thuram-Ulien", realTeam: "Inter", roleClassic: "ATT" },
  { id: 5, name: "K. Thuram", fullName: "Khéphren Thuram-Ulien", realTeam: "Juventus", roleClassic: "MID" },
  { id: 6, name: "Rrahmani", fullName: "Amir Rrahmani", realTeam: "Napoli", roleClassic: "DEF" },
  { id: 7, name: "G. Simeone", fullName: "Giovanni Pablo Simeone", realTeam: "Torino", roleClassic: "ATT" },
  { id: 8, name: "N. Pérez", fullName: "Nehuén Pérez", realTeam: "Torino", roleClassic: "DEF" },
];

describe("normalize", () => {
  it("toglie accenti, punti e apostrofi", () => {
    expect(normalize("Théo Hernández")).toBe("theo hernandez");
    expect(normalize("Martinez L.")).toBe("martinez l");
    expect(normalize("N'Dicka")).toBe("n dicka");
  });
  it("levenshtein e similarity di base", () => {
    expect(levenshtein("rrahmani", "rahmani")).toBe(1);
    expect(similarity("rrahmani", "rrahmani")).toBe(1);
  });
});

describe("sameTeam", () => {
  it("alias tra grafie listone e API-Football", () => {
    expect(sameTeam("Milan", "AC Milan")).toBe(true);
    expect(sameTeam("Verona", "Hellas Verona")).toBe(true);
    expect(sameTeam("Inter", "Internazionale")).toBe(true);
    expect(sameTeam("Inter", "AC Milan")).toBe(false);
  });
});

describe("roleFromSource", () => {
  it("mappa P/D/C/A e rifiuta il resto", () => {
    expect(roleFromSource("P")).toBe("GK");
    expect(roleFromSource("a")).toBe("ATT");
    expect(roleFromSource("X")).toBeNull();
  });
});

describe("matchEntry — stadi", () => {
  it("exact: nome identico e squadra alias", () => {
    const r = matchEntry({ rawName: "Rrahmani", rawTeam: "Napoli", rawRoleClassic: "D" }, PLAYERS);
    expect(r.method).toBe("exact");
    expect(r.playerId).toBe(6);
  });

  it("normalized: accenti diversi", () => {
    const r = matchEntry({ rawName: "Theo Hernandez", rawTeam: "Milan", rawRoleClassic: "D" }, PLAYERS);
    expect(r.playerId).toBe(3);
    expect(["exact", "normalized"]).toContain(r.method);
  });

  it("normalized: cognome + iniziale stile listone ('Martinez L.')", () => {
    const r = matchEntry({ rawName: "Martinez L.", rawTeam: "Inter", rawRoleClassic: "A" }, PLAYERS);
    expect(r.playerId).toBe(1);
    expect(r.method).toBe("normalized");
  });

  it("l'iniziale distingue gli omonimi di squadra ('Martinez J.' → il portiere)", () => {
    const r = matchEntry({ rawName: "Martinez J.", rawTeam: "Inter", rawRoleClassic: "P" }, PLAYERS);
    expect(r.playerId).toBe(2);
  });

  it("fuzzy: refuso nel cognome, stessa squadra e ruolo", () => {
    const r = matchEntry({ rawName: "Rahmani", rawTeam: "Napoli", rawRoleClassic: "D" }, PLAYERS);
    expect(r.method).toBe("fuzzy");
    expect(r.playerId).toBe(6);
    expect(r.confidence).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
  });

  it("il ruolo separa i Thuram... di squadre diverse", () => {
    const rJuve = matchEntry({ rawName: "Thuram K.", rawTeam: "Juventus", rawRoleClassic: "C" }, PLAYERS);
    expect(rJuve.playerId).toBe(5);
    const rInter = matchEntry({ rawName: "Thuram", rawTeam: "Inter", rawRoleClassic: "A" }, PLAYERS);
    expect(rInter.playerId).toBe(4);
  });

  it("orfano: giocatore non in anagrafica → none con candidati", () => {
    const r = matchEntry({ rawName: "Nuovo Acquisto", rawTeam: "Torino", rawRoleClassic: "A" }, PLAYERS);
    expect(r.method).toBe("none");
    expect(r.playerId).toBeNull();
  });

  it("squadra sconosciuta → none (mai match cross-squadra)", () => {
    const r = matchEntry({ rawName: "Lautaro Martinez", rawTeam: "Real Madrid", rawRoleClassic: "A" }, PLAYERS);
    expect(r.method).toBe("none");
  });
});

describe("matchBatch — report", () => {
  it("aggrega i conteggi per metodo", () => {
    const { report } = matchBatch(
      [
        { rawName: "Rrahmani", rawTeam: "Napoli", rawRoleClassic: "D" },
        { rawName: "Martinez L.", rawTeam: "Inter", rawRoleClassic: "A" },
        { rawName: "Sconosciuto", rawTeam: "Como", rawRoleClassic: "C" },
      ],
      PLAYERS,
    );
    expect(report.total).toBe(3);
    expect(report.exact).toBe(1);
    expect(report.normalized).toBe(1);
    expect(report.none).toBe(1);
  });
});

describe("parseListoneRows", () => {
  const sheet: Cell[][] = [
    ["Quotazioni Fantacalcio — Stagione 2026/27"],
    ["Id", "R", "RM", "Nome", "Squadra", "Qt.A", "Qt.I", "Diff.", "FVM"],
    [101, "A", "Pc", "Martinez L.", "Inter", 34, 36, -2, 380],
    [102, "P", "Por", "Svilar", "Roma", 18, 17, 1, 120],
    [null, "X", "", "RuoloSbagliato", "Inter", 1, 1, 0, 1],
    ["", "", "", "", "", "", "", "", ""],
    [104, "D", "Dd;E", "", "Milan", 8, 8, 0, 40],
  ];

  it("trova l'header non in prima riga e mappa le colonne per nome", () => {
    const out = parseListoneRows(sheet);
    expect(out.headerRowIndex).toBe(1);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toMatchObject({
      sourcePlayerId: 101,
      rawName: "Martinez L.",
      rawTeam: "Inter",
      rawRoleClassic: "A",
      rawRolesMantra: "Pc",
      qtA: 34,
      qtI: 36,
      fvm: 380,
    });
  });

  it("scarta con motivo: ruolo invalido e nome mancante; salta le righe vuote in silenzio", () => {
    const out = parseListoneRows(sheet);
    expect(out.skipped).toHaveLength(2);
    expect(out.skipped[0]!.reason).toContain("ruolo");
    expect(out.skipped[1]!.reason).toContain("nome");
  });

  it("numeri con virgola decimale italiana", () => {
    const out = parseListoneRows([
      ["Id", "R", "RM", "Nome", "Squadra", "Qt.A", "Qt.I", "FVM"],
      [1, "C", "M", "Test", "Como", "12,5", "10", "55"],
    ]);
    expect(out.rows[0]!.qtA).toBe(12.5);
  });

  it("header assente → outcome vuoto con motivo", () => {
    const out = parseListoneRows([["ciao"], ["mondo"]]);
    expect(out.rows).toHaveLength(0);
    expect(out.headerRowIndex).toBeNull();
  });

  it("formato leghe.fantacalcio.it: header reale con #, Sq., R., R.MANTRA, QUOT., FVM/1000, FantaSquadra, Costo", () => {
    const out = parseListoneRows([
      ["#", "Nome", "Fuori lista", "Sq.", "Under", "R.", "R.MANTRA", "PGv", "MV", "FM", "FVM/1000", "QUOT.", "FantaSquadra", "Costo"],
      [2764, "Martinez L.", null, "Inter", 29, "A", "Pc", 2, 5.75, 5.5, 144, 33, null, null],
      [6875, "Paz N.", null, "Como", 22, "C", "T/A", 2, 5.75, 5.75, 98, 29, "Ardilio's", 45],
    ]);
    expect(out.headerRowIndex).toBe(0);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toMatchObject({
      sourcePlayerId: 2764,
      rawName: "Martinez L.",
      rawTeam: "Inter",
      rawRoleClassic: "A",
      rawRolesMantra: "Pc",
      qtA: 33,
      qtI: null,
      fvm: 144,
      fuoriLista: false,
      mv: 5.75,
      fm: 5.5,
      rawFantaSquadra: null,
      costo: null,
    });
    expect(out.rows[1]).toMatchObject({
      rawFantaSquadra: "Ardilio's",
      costo: 45,
      rawRolesMantra: "T/A",
    });
  });

  it("'Fuori lista' valorizzato → flag true", () => {
    const out = parseListoneRows([
      ["#", "Nome", "Fuori lista", "Sq.", "R.", "QUOT."],
      [1, "Partente", "*", "Roma", "D", 5],
      [2, "Restante", null, "Roma", "D", 5],
    ]);
    expect(out.rows[0]!.fuoriLista).toBe(true);
    expect(out.rows[1]!.fuoriLista).toBe(false);
  });
});

describe("parseFantaastaRows / parseAnyListone", () => {
  it("tracciato fantaasta reale (posizionale, senza header)", async () => {
    const { parseAnyListone, csvToCells } = await import("../fantaasta");
    const csv = [
      "3,Radunovic,Radunovic,P,POR,1,1,1,1,Cagliari,3,3,,,,https://x/3.png,0,0,0,0,30,21",
      "133,Skorupski,Skorupski,P,POR,10,10,10,10,Bologna,33,33,,,,https://x/133.png,0,5.5,4.5,2,35,21",
    ].join("\n");
    const out = parseAnyListone(csvToCells(csv));
    expect(out.format).toBe("fantaasta");
    expect(out.rows).toHaveLength(2);
    expect(out.rows[1]).toMatchObject({
      sourcePlayerId: 133,
      rawName: "Skorupski",
      rawTeam: "Bologna",
      rawRoleClassic: "P",
      rawRolesMantra: "POR",
      qtA: 10,
      qtI: 10,
      fvm: 33,
      mv: 5.5,
      fm: 4.5,
      pgv: 2,
    });
  });

  it("csv CON header → passa dal parser a intestazioni", async () => {
    const { parseAnyListone, csvToCells } = await import("../fantaasta");
    const csv = ["#,Nome,Sq.,R.,QUOT.", "1,Svilar,Roma,P,18"].join("\n");
    const out = parseAnyListone(csvToCells(csv));
    expect(out.format).toBe("header");
    expect(out.rows[0]).toMatchObject({ rawName: "Svilar", qtA: 18 });
  });
});

import { describe, it, expect } from "vitest";
import { parseIntent } from "../useVoiceBidder";

const svincolati = [
  { id: 30546,  name: "A. Cragno",     real_team: "Monza"  },
  { id: 336707, name: "A. Calligaris", real_team: "Inter"  },
  { id: 42712,  name: "A. Borbei",     real_team: "Lecce"  },
];
const squadre: never[] = [];

describe("parseIntent — chiamata", () => {
  it("chiamo cragno monza → chiama A. Cragno", () => {
    const r = parseIntent("chiamo cragno monza", squadre, svincolati);
    expect(r).toMatchObject({ type: "chiama", playerId: 30546 });
  });
  it("chiamo calligaris inter → chiama A. Calligaris", () => {
    const r = parseIntent("chiamo calligaris inter", squadre, svincolati);
    expect(r).toMatchObject({ type: "chiama", playerId: 336707 });
  });
  it("chiamo cragno (senza squadra) → chiama A. Cragno", () => {
    const r = parseIntent("chiamo cragno", squadre, svincolati);
    expect(r).toMatchObject({ type: "chiama", playerId: 30546 });
  });
  it("Chiamo Cragno Monza (capitalized, Chrome output) → chiama", () => {
    const r = parseIntent("Chiamo Cragno Monza", squadre, svincolati);
    expect(r).toMatchObject({ type: "chiama", playerId: 30546 });
  });
  it("svincolati vuota → null", () => {
    expect(parseIntent("chiamo cragno monza", squadre, [])).toBeNull();
    expect(parseIntent("chiamo cragno monza", squadre, undefined)).toBeNull();
  });
  it("svincolati con player non trovato → null", () => {
    expect(parseIntent("chiamo berardi sassuolo", squadre, svincolati)).toBeNull();
  });
});

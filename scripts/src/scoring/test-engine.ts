/**
 * Test unitari per computeFantaTeamScore.
 *
 * Uso: pnpm --filter @workspace/scripts run scoring:test
 */

import assert from "node:assert/strict";
import { computeFantaTeamScore, type SlotPosition } from "@workspace/scoring";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`✗ ${name}`);
    if (e instanceof assert.AssertionError) {
      console.error(`  Atteso: ${e.expected}  Effettivo: ${e.actual}`);
    } else {
      console.error(`  ${e}`);
    }
    failed++;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makePlayer(
  id: number,
  pos: SlotPosition,
  slotIndex: number,
  isStarter: boolean,
  benchOrder?: number,
) {
  return { playerId: id, slotPosition: pos, slotIndex, isStarter, benchOrder: benchOrder ?? null };
}

function votiMap(entries: [number, number | null][]): Map<number, number | null> {
  return new Map(entries);
}

// ── T1: tutti i voti validi, capitano con voto → somma + bonus corretti ────

test("Tutti titolari con voto, capitano valido → totalScore = somma + bonus capitano", () => {
  const players = [
    makePlayer(1, "GK",  1, true),
    makePlayer(2, "DEF", 2, true),
    makePlayer(3, "DEF", 3, true),
    makePlayer(4, "DEF", 4, true),
    makePlayer(5, "DEF", 5, true),
    makePlayer(6, "MID", 6, true),
    makePlayer(7, "MID", 7, true),
    makePlayer(8, "MID", 8, true),
    makePlayer(9, "ATT", 9, true),
    makePlayer(10, "ATT", 10, true),
    makePlayer(11, "ATT", 11, true),
    makePlayer(12, "GK",  12, false, 1),
    makePlayer(13, "DEF", 13, false, 2),
    makePlayer(14, "MID", 14, false, 3),
  ];

  // Tutti 7.0; capitano = 9 (ATT), voto 7.0 → bonus = 7.0 × 0.5 = 3.5
  const allVoti = votiMap(players.map((p) => [p.playerId, 7.0]));
  const roles = new Map(players.map((p) => [p.playerId, p.slotPosition]));

  const result = computeFantaTeamScore({
    lineup: { module: "4-3-3", captainPlayerId: 9, players },
    playerVoti: allVoti,
    playerRoles: roles,
    config: { captainMultiplier: 1.5 },
  });

  assert.equal(result.substitutions.length, 0, "Nessuna sostituzione prevista");
  assert.equal(result.effectiveEleven.length, 11);
  // base = 11 × 7.0 = 77.0, bonus = 7.0 × 0.5 = 3.5 → 80.5
  assert.ok(
    Math.abs(result.captainBonus - 3.5) < 0.001,
    `captainBonus atteso 3.5, ottenuto ${result.captainBonus}`,
  );
  assert.ok(
    Math.abs(result.totalScore - 80.5) < 0.001,
    `totalScore atteso 80.5, ottenuto ${result.totalScore}`,
  );
});

// ── T2: 2 S.V. titolari, panchina con sostituti compatibili ───────────────

test("2 titolari S.V. → 2 sostituzioni applicate, punteggio corretto", () => {
  const players = [
    makePlayer(1, "GK",  1, true),
    makePlayer(2, "DEF", 2, true),   // S.V.
    makePlayer(3, "DEF", 3, true),
    makePlayer(4, "DEF", 4, true),
    makePlayer(5, "DEF", 5, true),
    makePlayer(6, "MID", 6, true),   // S.V.
    makePlayer(7, "MID", 7, true),
    makePlayer(8, "MID", 8, true),
    makePlayer(9, "ATT", 9, true),
    makePlayer(10, "ATT", 10, true),
    makePlayer(11, "ATT", 11, true),
    makePlayer(12, "GK",  12, false, 1),
    makePlayer(13, "DEF", 13, false, 2),  // sub per DEF2
    makePlayer(14, "MID", 14, false, 3),  // sub per MID6
    makePlayer(15, "ATT", 15, false, 4),
  ];

  const voti = votiMap([
    [1, 6.5], [2, null], [3, 7.0], [4, 7.0], [5, 7.0],
    [6, null], [7, 7.0], [8, 7.0], [9, 8.0], [10, 7.0], [11, 7.0],
    [12, 6.0], [13, 6.5], [14, 6.5], [15, 7.0],
  ]);
  const roles = new Map(players.map((p) => [p.playerId, p.slotPosition]));

  const result = computeFantaTeamScore({
    lineup: { module: "4-3-3", captainPlayerId: 9, players },
    playerVoti: voti,
    playerRoles: roles,
    config: { captainMultiplier: 1.5 },
  });

  assert.equal(result.substitutions.length, 2, `Attese 2 sostituzioni, ottenute ${result.substitutions.length}`);
  assert.ok(
    result.substitutions.some((s) => s.out === 2 && s.inId === 13),
    "Sostituzione DEF2 → DEF13 non trovata",
  );
  assert.ok(
    result.substitutions.some((s) => s.out === 6 && s.inId === 14),
    "Sostituzione MID6 → MID14 non trovata",
  );
  // base: GK1=6.5, DEF13=6.5, DEF3=7,DEF4=7,DEF5=7, MID14=6.5, MID7=7,MID8=7, ATT9=8,ATT10=7,ATT11=7
  // = 6.5+6.5+21+6.5+14+22 = 76.5; bonus capitano ATT9 = 8×0.5 = 4 → 80.5
  assert.ok(
    Math.abs(result.totalScore - 80.5) < 0.001,
    `totalScore atteso 80.5, ottenuto ${result.totalScore}`,
  );
});

// ── T3: capitano S.V. → nessun bonus, sostituto entra a ×1 ───────────────

test("Capitano S.V. → nessun bonus capitano, sostituto entra a ×1", () => {
  const players = [
    makePlayer(1, "GK",  1, true),   // capitano, S.V.
    makePlayer(2, "DEF", 2, true),
    makePlayer(3, "DEF", 3, true),
    makePlayer(4, "DEF", 4, true),
    makePlayer(5, "DEF", 5, true),
    makePlayer(6, "MID", 6, true),
    makePlayer(7, "MID", 7, true),
    makePlayer(8, "MID", 8, true),
    makePlayer(9, "ATT", 9, true),
    makePlayer(10, "ATT", 10, true),
    makePlayer(11, "ATT", 11, true),
    makePlayer(12, "GK", 12, false, 1),  // sub GK
  ];

  const voti = votiMap([
    [1, null], [2, 7.0], [3, 7.0], [4, 7.0], [5, 7.0],
    [6, 7.0], [7, 7.0], [8, 7.0], [9, 7.0], [10, 7.0], [11, 7.0],
    [12, 6.0],
  ]);
  const roles = new Map(players.map((p) => [p.playerId, p.slotPosition]));

  const result = computeFantaTeamScore({
    lineup: { module: "4-3-3", captainPlayerId: 1, players },
    playerVoti: voti,
    playerRoles: roles,
    config: { captainMultiplier: 1.5 },
  });

  assert.equal(result.captainBonus, 0, `Bonus capitano atteso 0, ottenuto ${result.captainBonus}`);
  assert.equal(result.substitutions.length, 1, "Attesa 1 sostituzione");
  assert.equal(result.substitutions[0]?.out, 1);
  assert.equal(result.substitutions[0]?.inId, 12);
  // base: 6.0 (sub GK12) + 10×7.0 = 76.0, nessun bonus
  assert.ok(
    Math.abs(result.totalScore - 76.0) < 0.001,
    `totalScore atteso 76.0, ottenuto ${result.totalScore}`,
  );
});

// ── T4: titolare S.V. senza panchinaro compatibile → conta 0 ──────────────

test("Titolare S.V. senza panchinaro compatibile → conta 0", () => {
  const players = [
    makePlayer(1, "GK",  1, true),   // S.V., nessun GK in panchina
    makePlayer(2, "DEF", 2, true),
    makePlayer(3, "DEF", 3, true),
    makePlayer(4, "DEF", 4, true),
    makePlayer(5, "DEF", 5, true),
    makePlayer(6, "MID", 6, true),
    makePlayer(7, "MID", 7, true),
    makePlayer(8, "MID", 8, true),
    makePlayer(9, "ATT", 9, true),
    makePlayer(10, "ATT", 10, true),
    makePlayer(11, "ATT", 11, true),
    makePlayer(12, "DEF", 12, false, 1),  // solo DEF in panchina
  ];

  const voti = votiMap([
    [1, null], [2, 7.0], [3, 7.0], [4, 7.0], [5, 7.0],
    [6, 7.0], [7, 7.0], [8, 7.0], [9, 7.0], [10, 7.0], [11, 7.0],
    [12, 6.5],
  ]);
  const roles = new Map(players.map((p) => [p.playerId, p.slotPosition]));

  const result = computeFantaTeamScore({
    lineup: { module: "4-3-3", captainPlayerId: 2, players },
    playerVoti: voti,
    playerRoles: roles,
    config: { captainMultiplier: 1.5 },
  });

  assert.equal(result.substitutions.length, 0, "Nessuna sostituzione prevista");
  // GK1=0, DEF2-11=10×7.0=70, bonus capitano DEF2=7.0×0.5=3.5 → 73.5
  assert.ok(
    Math.abs(result.totalScore - 73.5) < 0.001,
    `totalScore atteso 73.5, ottenuto ${result.totalScore}`,
  );
});

// ── T5: slot T (trequartista) compatibile con MID in panchina ─────────────

test("Trequartista (T) S.V. → sostituito da MID in panchina (stessa fascia)", () => {
  const players = [
    makePlayer(1, "GK",  1, true),
    makePlayer(2, "DEF", 2, true),
    makePlayer(3, "DEF", 3, true),
    makePlayer(4, "DEF", 4, true),
    makePlayer(5, "DEF", 5, true),
    makePlayer(6, "MID", 6, true),
    makePlayer(7, "MID", 7, true),
    makePlayer(8, "T",   8, true),   // trequartista, S.V.
    makePlayer(9, "ATT", 9, true),
    makePlayer(10, "ATT", 10, true),
    makePlayer(11, "ATT", 11, true),
    makePlayer(12, "GK",  12, false, 1),
    makePlayer(13, "MID", 13, false, 2),  // MID in panchina, compatibile con T
  ];

  const voti = votiMap([
    [1, 6.5], [2, 7.0], [3, 7.0], [4, 7.0], [5, 7.0],
    [6, 7.0], [7, 7.0], [8, null],
    [9, 7.0], [10, 7.0], [11, 7.0],
    [12, 6.0], [13, 6.5],
  ]);
  const roles = new Map(players.map((p) => [p.playerId, p.slotPosition]));

  const result = computeFantaTeamScore({
    lineup: { module: "4-2-1-3", captainPlayerId: null, players },
    playerVoti: voti,
    playerRoles: roles,
    config: { captainMultiplier: 1.5 },
  });

  assert.equal(result.substitutions.length, 1, "Attesa 1 sostituzione");
  assert.ok(
    result.substitutions.some((s) => s.out === 8 && s.inId === 13),
    "Sostituzione T8 → MID13 non trovata",
  );
  assert.equal(result.captainBonus, 0, "Nessun capitano → bonus 0");
  // base: GK1=6.5, DEF2-5=4×7, MID6-7=2×7, T8→MID13=6.5, ATT9-11=3×7
  // = 6.5 + 28 + 14 + 6.5 + 21 = 76.0, no bonus
  assert.ok(
    Math.abs(result.totalScore - 76.0) < 0.001,
    `totalScore atteso 76.0, ottenuto ${result.totalScore}`,
  );
});

// ── Riepilogo ─────────────────────────────────────────────────────────────

console.log(`\n${passed} test superati, ${failed} falliti\n`);
if (failed > 0) process.exit(1);

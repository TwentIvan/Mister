import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { fantaTeams } from "../schema/fanta-teams";
import { contracts } from "../schema/contracts";
import { players } from "../schema/players";
import { leagues } from "../schema/leagues";

// ─── PRNG deterministica ──────────────────────────────────────────────────────
// mulberry32 — ottima distribuzione, semplice, seedabile con intero a 32 bit.

function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (Math.imul(h, 0x01000193) >>> 0);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Dati manager ─────────────────────────────────────────────────────────────

const TEAMS: { id: string; name: string; manager: string }[] = [
  { id: "ft-mvp-1", name: "Mario's Squad",      manager: "Ivan"   },
  { id: "ft-mvp-2", name: "I Magnifici",         manager: "Sara"   },
  { id: "ft-mvp-3", name: "Real Trastevere",     manager: "Marco"  },
  { id: "ft-mvp-4", name: "Pancho Boys",         manager: "Luca"   },
  { id: "ft-mvp-5", name: "Sandhagen FC",        manager: "Giulia" },
  { id: "ft-mvp-6", name: "Tottenham Pelati",    manager: "Matteo" },
  { id: "ft-mvp-7", name: "Atletico Caffeina",   manager: "Anna"   },
  { id: "ft-mvp-8", name: "Bomber Coraggio",     manager: "Davide" },
];

// Per ruolo: quanti titolari per squadra
const ROLE_SLOTS = { GK: 3, DEF: 8, MID: 8, ATT: 6 } as const;
type Role = keyof typeof ROLE_SLOTS;

// ─── Seed principale ──────────────────────────────────────────────────────────

export async function seedTestLeagueMvp(db: NodePgDatabase<Record<string, never>>) {
  console.log("Seed test-league-mvp...");

  // 1. Trova la lega
  const [league] = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.name, "Lega Test MVP"))
    .limit(1);

  if (!league) {
    console.log("test-league-mvp: lega 'Lega Test MVP' non trovata, skip.");
    return;
  }

  const leagueId = league.id;

  // 2. Idempotenza: se ci sono già 8 team, skip
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(fantaTeams)
    .where(eq(fantaTeams.leagueId, leagueId));

  if (count >= 8) {
    console.log(`test-league-mvp: lega già ha ${count} team, skip.`);
    return;
  }

  // 3. Carica giocatori per ruolo, ordinati per id (deterministico)
  const allPlayers = await db
    .select({ id: players.id, role: players.roleClassic })
    .from(players)
    .where(sql`${players.roleClassic} IS NOT NULL`);

  const byRole: Record<Role, number[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  for (const p of allPlayers) {
    const role = p.role as Role;
    if (role in byRole) byRole[role].push(p.id);
  }
  // Ordina per id prima dello shuffle per garantire determinismo indipendente dall'ordine DB
  for (const role of Object.keys(byRole) as Role[]) {
    byRole[role].sort((a, b) => a - b);
  }

  // 4. Shuffle deterministico con seed fisso
  const rng = mulberry32(hashSeed("lega-test-mvp-2024"));
  const shuffled: Record<Role, number[]> = {
    GK:  shuffle(byRole.GK,  rng),
    DEF: shuffle(byRole.DEF, rng),
    MID: shuffle(byRole.MID, rng),
    ATT: shuffle(byRole.ATT, rng),
  };

  // 5. Verifica disponibilità
  const needed = { GK: 3 * 8, DEF: 8 * 8, MID: 8 * 8, ATT: 6 * 8 };
  for (const role of Object.keys(needed) as Role[]) {
    if (shuffled[role].length < needed[role]) {
      throw new Error(`test-league-mvp: giocatori ${role} insufficienti: ${shuffled[role].length} < ${needed[role]}`);
    }
  }

  // 6. Distribuzione: team 0 prende i primi N slot per ogni ruolo, team 1 i secondi, ecc.
  // Roster per team: { gk: [], def: [], mid: [], att: [] }
  const teamRosters: Record<string, { gk: number[]; def: number[]; mid: number[]; att: number[] }> = {};
  for (const t of TEAMS) {
    teamRosters[t.id] = { gk: [], def: [], mid: [], att: [] };
  }

  const roleToRosterKey: Record<Role, "gk" | "def" | "mid" | "att"> = {
    GK: "gk", DEF: "def", MID: "mid", ATT: "att",
  };

  for (const role of Object.keys(ROLE_SLOTS) as Role[]) {
    const slotsPerTeam = ROLE_SLOTS[role];
    const key = roleToRosterKey[role];
    for (let teamIdx = 0; teamIdx < TEAMS.length; teamIdx++) {
      const start = teamIdx * slotsPerTeam;
      const slice = shuffled[role].slice(start, start + slotsPerTeam);
      teamRosters[TEAMS[teamIdx].id][key] = slice;
    }
  }

  // 7. Inserisci fanta_team
  for (const t of TEAMS) {
    const roster = teamRosters[t.id];
    await db.insert(fantaTeams).values({
      id: t.id,
      leagueId,
      managerUserId: `user-${t.manager.toLowerCase()}`,
      name: t.name,
      nameAuction: t.name,
      creditsRemaining: 500,
      roster,
    }).onConflictDoNothing();
  }

  // 8. Inserisci contracts (200 totali)
  const contractRows: {
    id: string;
    leagueId: string;
    fantaTeamId: string;
    playerId: number;
    seasonStart: number;
    durationSeasons: number;
    purchasePrice: number;
    clauseDefault: number;
    clauseInvestment: number;
    state: "active";
    notes: string[];
  }[] = [];

  for (const t of TEAMS) {
    const roster = teamRosters[t.id];
    const allPlayerIds = [...roster.gk, ...roster.def, ...roster.mid, ...roster.att];
    for (const pid of allPlayerIds) {
      contractRows.push({
        id: `ct-mvp-${t.id}-${pid}`,
        leagueId,
        fantaTeamId: t.id,
        playerId: pid,
        seasonStart: 2024,
        durationSeasons: 1,
        purchasePrice: 1,
        clauseDefault: 0,
        clauseInvestment: 0,
        state: "active",
        notes: [],
      });
    }
  }

  // Insert a batch di 50 per evitare query troppo lunghe
  for (let i = 0; i < contractRows.length; i += 50) {
    await db.insert(contracts).values(contractRows.slice(i, i + 50)).onConflictDoNothing();
  }

  console.log(`test-league-mvp: 8 fanta_team + ${contractRows.length} contracts inseriti.`);
}

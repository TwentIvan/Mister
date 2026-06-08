import { Router, type IRouter } from "express";
import { eq, and, inArray, isNotNull, max } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import {
  competitions,
  competitionPhases,
  competitionMatches,
  fantaTeams,
  societa,
  leagues,
  federations,
} from "@workspace/db";
import {
  ListCompetitionsParams,
  ListCompetitionsResponse,
  CreateCompetitionParams,
  CreateCompetitionBody,
  GetCompetitionParams,
  GetCompetitionResponse,
  UpdateCompetitionParams,
  UpdateCompetitionBody,
  UpdateCompetitionResponse,
  DeleteCompetitionParams,
} from "@workspace/api-zod";
import { mapCompetition } from "../lib/mappers";
import { guardLeagueAdmin } from "../lib/auth";
import type { CompetitionConfig, JerseyConfig } from "@workspace/db";
import { resolveMatchResult, DEFAULT_THRESHOLDS } from "../lib/competition-result";

const router: IRouter = Router();

router.get("/leagues/:leagueId/competitions", async (req, res): Promise<void> => {
  const params = ListCompetitionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(competitions)
    .where(eq(competitions.leagueId, params.data.leagueId));
  res.json(ListCompetitionsResponse.parse(rows.map(mapCompetition)));
});

router.post("/leagues/:leagueId/competitions", async (req, res): Promise<void> => {
  const params = CreateCompetitionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!await guardLeagueAdmin(req, res, params.data.leagueId)) return;
  const parsed = CreateCompetitionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const config: CompetitionConfig = {
    participantTeamIds: d.participant_team_ids ?? [],
    tiebreakers: d.tiebreakers ?? [],
    scoring: { win: 3, draw: 1, loss: 0 },
    prizes: {},
    ...(d.settings ?? {}),
  } as CompetitionConfig;
  const [row] = await db
    .insert(competitions)
    .values({
      id: nanoid(),
      leagueId: params.data.leagueId,
      scopeType: "league",
      scopeId: params.data.leagueId,
      name: d.name,
      description: d.description ?? "",
      type: d.type,
      season: d.season,
      startGiornata: d.start_giornata,
      endGiornata: d.end_giornata,
      config,
    })
    .returning();
  res.status(201).json(GetCompetitionResponse.parse(mapCompetition(row)));
});

router.get("/leagues/:leagueId/competitions/:id", async (req, res): Promise<void> => {
  const p = GetCompetitionParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(competitions)
    .where(and(eq(competitions.leagueId, p.data.leagueId), eq(competitions.id, p.data.id)));
  if (!row) {
    res.status(404).json({ error: "Competizione non trovata" });
    return;
  }
  res.json(GetCompetitionResponse.parse(mapCompetition(row)));
});

router.patch("/leagues/:leagueId/competitions/:id", async (req, res): Promise<void> => {
  const p = UpdateCompetitionParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  if (!await guardLeagueAdmin(req, res, p.data.leagueId)) return;
  const parsed = UpdateCompetitionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .update(competitions)
    .set({
      ...(d.name !== undefined && { name: d.name }),
      ...(d.description !== undefined && { description: d.description }),
      ...(d.active !== undefined && { active: d.active }),
      ...(d.completed !== undefined && { completed: d.completed }),
      ...(d.start_giornata !== undefined && { startGiornata: d.start_giornata }),
      ...(d.end_giornata !== undefined && { endGiornata: d.end_giornata }),
      ...(d.season !== undefined && { season: d.season }),
      ...(d.settings !== undefined && { config: d.settings as unknown as CompetitionConfig }),
    })
    .where(and(eq(competitions.leagueId, p.data.leagueId), eq(competitions.id, p.data.id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Competizione non trovata" });
    return;
  }
  res.json(UpdateCompetitionResponse.parse(mapCompetition(row)));
});

router.delete("/leagues/:leagueId/competitions/:id", async (req, res): Promise<void> => {
  const p = DeleteCompetitionParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  if (!await guardLeagueAdmin(req, res, p.data.leagueId)) return;
  const [row] = await db
    .delete(competitions)
    .where(and(eq(competitions.leagueId, p.data.leagueId), eq(competitions.id, p.data.id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Competizione non trovata" });
    return;
  }
  res.sendStatus(204);
});

// ─── GET /competitions/:competitionId/phases ──────────────────────────────────

router.get("/competitions/:competitionId/phases", async (req, res): Promise<void> => {
  const competitionId = req.params["competitionId"];
  if (!competitionId) {
    res.status(400).json({ error: "competitionId richiesto" });
    return;
  }
  const [comp] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);
  if (!comp) {
    res.status(404).json({ error: "Competizione non trovata" });
    return;
  }
  const phases = await db
    .select()
    .from(competitionPhases)
    .where(eq(competitionPhases.competitionId, competitionId))
    .orderBy(competitionPhases.order);
  res.json(
    phases.map((p) => ({
      id: p.id,
      competition_id: p.competitionId,
      order: p.order,
      name: p.name,
      misura: p.misura,
      struttura: p.struttura,
      status: p.status,
      qualification_label: (p.qualification as { label?: string } | null)?.label ?? null,
      params: p.params ?? {},
      start_giornata: p.startGiornata ?? null,
      end_giornata: p.endGiornata ?? null,
    })),
  );
});

// ─── GET /competitions/:competitionId/coppa ───────────────────────────────────

router.get("/competitions/:competitionId/coppa", async (req, res): Promise<void> => {
  const { competitionId } = req.params;
  if (!competitionId) { res.status(400).json({ error: "competitionId richiesto" }); return; }

  // 1. Competition + league
  const [comp] = await db
    .select({ id: competitions.id, name: competitions.name, leagueId: competitions.leagueId, completed: competitions.completed })
    .from(competitions).where(eq(competitions.id, competitionId)).limit(1);
  if (!comp) { res.status(404).json({ error: "Competizione non trovata" }); return; }

  const [league] = await db
    .select({ name: leagues.name })
    .from(leagues).where(eq(leagues.id, comp.leagueId)).limit(1);

  // 2. Phases
  const phases = await db.select().from(competitionPhases)
    .where(eq(competitionPhases.competitionId, competitionId))
    .orderBy(competitionPhases.order);

  const gironiPhase = phases.find((p) => p.struttura === "classifica") ?? null;
  const tabellonePhase = phases.find((p) => p.struttura === "tabellone") ?? null;

  // 3. Teams in this league
  const teamRows = await db
    .select({ id: fantaTeams.id, name: societa.name, jersey: societa.jersey })
    .from(fantaTeams)
    .leftJoin(societa, eq(fantaTeams.societaId, societa.id))
    .where(eq(fantaTeams.leagueId, comp.leagueId));

  const teamMap = new Map(
    teamRows.map((t) => [
      t.id,
      { name: t.name ?? t.id, color: (t.jersey as JerseyConfig | null)?.primaryColor ?? "#1f4733" },
    ])
  );

  // 4. Matches giocati (per standings gironi)
  const playedMatches = await db
    .select({
      homeId: competitionMatches.homeFantaTeamId,
      awayId: competitionMatches.awayFantaTeamId,
      homeScore: competitionMatches.homeScore,
      awayScore: competitionMatches.awayScore,
    })
    .from(competitionMatches)
    .where(and(eq(competitionMatches.competitionId, competitionId), isNotNull(competitionMatches.playedAt)));

  // 5. Build gironi
  let gironiData = null;
  if (gironiPhase) {
    type GironiParams = { n_gironi: number; n_passanti: number; gironi?: Record<string, string[]> };
    const gp = gironiPhase.params as GironiParams;
    const assignment = gp.gironi ?? null;
    const nPassanti = gp.n_passanti ?? 2;

    type StatsRow = { fanta_team_id: string; team_name: string; color_primary: string; points: number; giocate: number; wins: number; draws: number; losses: number; gf: number; gs: number; qualified: boolean };

    const groups = assignment
      ? Object.entries(assignment).map(([gName, teamIds]) => {
          // Standings init
          const stats = new Map<string, StatsRow>(
            teamIds.map((tid) => [tid, { fanta_team_id: tid, team_name: teamMap.get(tid)?.name ?? tid, color_primary: teamMap.get(tid)?.color ?? "#1f4733", points: 0, giocate: 0, wins: 0, draws: 0, losses: 0, gf: 0, gs: 0, qualified: false }])
          );
          const groupSet = new Set(teamIds);
          // Filter matches within this group
          for (const m of playedMatches) {
            if (!groupSet.has(m.homeId) || !groupSet.has(m.awayId)) continue;
            if (m.homeScore === null || m.awayScore === null) continue;
            const hs = Number(m.homeScore); const as_ = Number(m.awayScore);
            const home = stats.get(m.homeId)!; const away = stats.get(m.awayId)!;
            home.giocate++; away.giocate++;
            home.gf += hs; home.gs += as_; away.gf += as_; away.gs += hs;
            if (hs > as_) { home.wins++; home.points += 3; away.losses++; }
            else if (hs < as_) { away.wins++; away.points += 3; home.losses++; }
            else { home.draws++; home.points += 1; away.draws++; away.points += 1; }
          }
          // Sort: points desc, then gf-gs desc, then gf desc
          const sorted = [...stats.values()].sort((a, b) =>
            b.points !== a.points ? b.points - a.points : (b.gf - b.gs) !== (a.gf - a.gs) ? (b.gf - b.gs) - (a.gf - a.gs) : b.gf - a.gf
          );
          const started = sorted.some((r) => r.giocate > 0);
          // Mark qualified (top nPassanti when started, none if not started)
          return {
            name: gName,
            started,
            teams: sorted.map((r, i) => ({ ...r, qualified: started && i < nPassanti, gf: undefined, gs: undefined })),
          };
        })
      : null;

    gironiData = {
      phase_id: gironiPhase.id,
      status: gironiPhase.status,
      n_passanti: nPassanti,
      qualification_label: `passano le prime ${nPassanti} di ogni girone`,
      sorteggio_done: assignment !== null,
      groups,
    };
  }

  // 6. Build tabellone
  let tabelloneData = null;
  if (tabellonePhase && gironiPhase) {
    type GironiParams = { n_gironi: number; n_passanti: number; gironi?: Record<string, string[]> };
    const gp = gironiPhase.params as GironiParams;
    const groupNames = gp.gironi ? Object.keys(gp.gironi) : ["A", "B"];
    const nPassanti = gp.n_passanti ?? 2;
    const totalQ = groupNames.length * nPassanti; // 4

    const makeSlot = (prov: string) => ({ provenienza: prov, fanta_team_id: null, team_name: null, color_primary: null, score: null, winner: null });
    const rounds = [];

    if (totalQ === 4 && groupNames.length === 2) {
      const [gA, gB] = groupNames;
      rounds.push({
        name: "Semifinali",
        matches: [
          { home: makeSlot(`1° Girone ${gA}`), away: makeSlot(`2° Girone ${gB}`), spareggio_note: null },
          { home: makeSlot(`1° Girone ${gB}`), away: makeSlot(`2° Girone ${gA}`), spareggio_note: null },
        ],
      });
      rounds.push({
        name: "Finale",
        matches: [{ home: makeSlot("vincente Semifinale 1"), away: makeSlot("vincente Semifinale 2"), spareggio_note: null }],
      });
    }

    tabelloneData = {
      phase_id: tabellonePhase.id,
      status: tabellonePhase.status,
      rounds,
      champion: null,
    };
  }

  const stato = comp.completed
    ? "conclusa"
    : phases.some((p) => p.status === "in_corso")
      ? "in_corso"
      : "programmata";

  res.json({
    id: comp.id,
    name: comp.name,
    stato,
    league_name: league?.name ?? comp.leagueId,
    n_teams: teamRows.length,
    gironi: gironiData,
    tabellone: tabelloneData,
  });
});

// ─── GET /leagues/:leagueId/hub ───────────────────────────────────────────────

const hubHomeTeam = alias(fantaTeams, "hub_home_team");
const hubAwayTeam = alias(fantaTeams, "hub_away_team");
const hubHomeSoc = alias(societa, "hub_home_soc");
const hubAwaySoc = alias(societa, "hub_away_soc");

router.get("/leagues/:leagueId/hub", async (req, res): Promise<void> => {
  const leagueId = req.params["leagueId"];
  if (!leagueId) {
    res.status(400).json({ error: "leagueId richiesto" });
    return;
  }
  const fantaTeamId =
    typeof req.query["fantaTeamId"] === "string" ? req.query["fantaTeamId"] : null;

  // ── 1. Lega + federazione ──────────────────────────────────────────────────
  const [leagueRow] = await db
    .select({
      id: leagues.id,
      name: leagues.name,
      season: leagues.season,
      federationId: leagues.federationId,
    })
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1);

  if (!leagueRow) {
    res.status(404).json({ error: "Lega non trovata" });
    return;
  }

  const [fedRow] = await db
    .select({ rules: federations.rules })
    .from(federations)
    .where(eq(federations.id, leagueRow.federationId))
    .limit(1);

  const thresholds = (fedRow?.rules as { goalThresholds?: typeof DEFAULT_THRESHOLDS } | null)
    ?.goalThresholds ?? DEFAULT_THRESHOLDS;

  // ── 2. Squadre fanta (per colori e conteggio manager) ─────────────────────
  const teamRows = await db
    .select({
      id: fantaTeams.id,
      jersey: societa.jersey,
      societaName: societa.name,
    })
    .from(fantaTeams)
    .leftJoin(societa, eq(fantaTeams.societaId, societa.id))
    .where(eq(fantaTeams.leagueId, leagueId));

  const teamColorMap = new Map<string, string>();
  for (const t of teamRows) {
    const jersey = t.jersey as JerseyConfig | null;
    teamColorMap.set(t.id, jersey?.primaryColor ?? "#1f4733");
  }
  const teamNameMap = new Map<string, string>();
  for (const t of teamRows) {
    teamNameMap.set(t.id, t.societaName ?? t.id);
  }

  const nManagers = teamRows.length;

  // ── 3. Competizioni + fasi ─────────────────────────────────────────────────
  const compRows = await db
    .select()
    .from(competitions)
    .where(and(eq(competitions.leagueId, leagueId), eq(competitions.active, true)))
    .orderBy(competitions.createdAt);

  const compIds = compRows.map((c) => c.id);
  const allPhases =
    compIds.length > 0
      ? await db
          .select()
          .from(competitionPhases)
          .where(inArray(competitionPhases.competitionId, compIds))
          .orderBy(competitionPhases.order)
      : [];

  // ── 4. Match giocati per calcolare stato + standings extract ──────────────
  const playedMatchRows =
    compIds.length > 0
      ? await db
          .select({
            competitionId: competitionMatches.competitionId,
            giornata: competitionMatches.giornata,
            homeId: hubHomeTeam.id,
            homeName: hubHomeSoc.name,
            homeJersey: hubHomeSoc.jersey,
            awayId: hubAwayTeam.id,
            awayName: hubAwaySoc.name,
            awayJersey: hubAwaySoc.jersey,
            homeScore: competitionMatches.homeScore,
            awayScore: competitionMatches.awayScore,
            playedAt: competitionMatches.playedAt,
          })
          .from(competitionMatches)
          .innerJoin(hubHomeTeam, eq(hubHomeTeam.id, competitionMatches.homeFantaTeamId))
          .innerJoin(hubAwayTeam, eq(hubAwayTeam.id, competitionMatches.awayFantaTeamId))
          .leftJoin(hubHomeSoc, eq(hubHomeTeam.societaId, hubHomeSoc.id))
          .leftJoin(hubAwaySoc, eq(hubAwayTeam.societaId, hubAwaySoc.id))
          .where(inArray(competitionMatches.competitionId, compIds))
      : [];

  // Raggruppa per competition
  const matchesByComp = new Map<
    string,
    typeof playedMatchRows
  >();
  for (const row of playedMatchRows) {
    if (!matchesByComp.has(row.competitionId)) matchesByComp.set(row.competitionId, []);
    matchesByComp.get(row.competitionId)!.push(row);
  }

  // ── 5. Calcola giornata_corrente globale ───────────────────────────────────
  let giornataCorriente = 1;
  for (const rows of matchesByComp.values()) {
    for (const r of rows) {
      if (r.playedAt !== null && r.giornata > giornataCorriente) {
        giornataCorriente = r.giornata;
      }
    }
  }

  // ── 6. Componi risposta ────────────────────────────────────────────────────
  const hubCompetitions = compRows.map((comp) => {
    const phases = allPhases.filter((p) => p.competitionId === comp.id);
    const matches = matchesByComp.get(comp.id) ?? [];

    // Tipo struttura (R-icona-tipo) — dedotto dalle fasi
    const hasTabellone = phases.some((p) => p.struttura === "tabellone");
    const hasCaduta = phases.some((p) => p.struttura === "caduta");
    const tipoStruttura: "tabellone" | "caduta" | "classifica" = hasTabellone
      ? "tabellone"
      : hasCaduta
        ? "caduta"
        : "classifica";

    // Stato — calcolato dai match
    const played = matches.filter((m) => m.playedAt !== null);
    const stato: "programmata" | "in_corso" | "conclusa" = comp.completed
      ? "conclusa"
      : played.length > 0
        ? "in_corso"
        : "programmata";

    // Phase guide
    const phaseItems = phases.map((p) => ({
      id: p.id,
      order: p.order,
      name: p.name,
      misura: p.misura,
      struttura: p.struttura,
      status: p.status,
      qualification_label:
        (p.qualification as { label?: string } | null)?.label ?? null,
      params: (p.params as Record<string, unknown>) ?? {},
    }));

    // Standings extract — solo per competizioni con classifica played
    let standingsExtract = null;
    if (played.length > 0) {
      type TeamEntry = {
        points: number;
        pf: number;
        gf: number;
        gs: number;
      };
      const table = new Map<string, TeamEntry>();
      let giornataMax = 0;

      for (const row of played) {
        if (row.homeScore === null || row.awayScore === null) continue;
        const hs = Math.round(parseFloat(row.homeScore) * 100) / 100;
        const as_ = Math.round(parseFloat(row.awayScore) * 100) / 100;
        if (row.giornata > giornataMax) giornataMax = row.giornata;

        if (!table.has(row.homeId)) table.set(row.homeId, { points: 0, pf: 0, gf: 0, gs: 0 });
        if (!table.has(row.awayId)) table.set(row.awayId, { points: 0, pf: 0, gf: 0, gs: 0 });
        const home = table.get(row.homeId)!;
        const away = table.get(row.awayId)!;

        const result = resolveMatchResult(hs, as_, thresholds);
        home.gf += result.homeGoals;
        home.gs += result.awayGoals;
        home.pf = Math.round((home.pf + hs) * 100) / 100;
        away.gf += result.awayGoals;
        away.gs += result.homeGoals;
        away.pf = Math.round((away.pf + as_) * 100) / 100;

        if (result.outcome === "home") {
          home.points += 3;
        } else if (result.outcome === "away") {
          away.points += 3;
        } else {
          home.points += 1;
          away.points += 1;
        }
      }

      const sorted = [...table.entries()].sort(([, a], [, b]) => {
        if (b.points !== a.points) return b.points - a.points;
        const gdA = a.gf - a.gs;
        const gdB = b.gf - b.gs;
        if (gdB !== gdA) return gdB - gdA;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return b.pf - a.pf;
      });

      const toRow = (id: string, entry: TeamEntry, pos: number) => ({
        pos,
        fanta_team_id: id,
        team_name: teamNameMap.get(id) ?? id,
        color_primary: teamColorMap.get(id) ?? null,
        points: entry.points,
        pf: entry.pf,
      });

      const top1 = sorted[0];
      if (top1) {
        let myRow = null;
        if (fantaTeamId) {
          const myIdx = sorted.findIndex(([id]) => id === fantaTeamId);
          if (myIdx >= 0) {
            myRow = toRow(sorted[myIdx]![0], sorted[myIdx]![1], myIdx + 1);
          }
        }

        // Prossima partita dell'utente (primo match non giocato)
        let nextGiornata: number | null = null;
        let nextOpponent: string | null = null;
        if (fantaTeamId) {
          const upcoming = matches
            .filter(
              (m) =>
                m.playedAt === null &&
                (m.homeId === fantaTeamId || m.awayId === fantaTeamId),
            )
            .sort((a, b) => a.giornata - b.giornata);
          if (upcoming[0]) {
            nextGiornata = upcoming[0].giornata;
            const oppId =
              upcoming[0].homeId === fantaTeamId ? upcoming[0].awayId : upcoming[0].homeId;
            nextOpponent = teamNameMap.get(oppId) ?? oppId;
          }
        }

        standingsExtract = {
          top1: toRow(top1[0], top1[1], 1),
          my_row: myRow,
          giornata_max: giornataMax,
          next_giornata: nextGiornata,
          next_opponent: nextOpponent,
        };
      }
    }

    return {
      id: comp.id,
      name: comp.name,
      tipo_struttura: tipoStruttura,
      stato,
      n_phases: phases.length,
      phases: phaseItems,
      standings_extract: standingsExtract,
    };
  });

  res.json({
    league_id: leagueRow.id,
    league_name: leagueRow.name,
    season: leagueRow.season,
    n_managers: nManagers,
    giornata_corrente: giornataCorriente,
    competitions: hubCompetitions,
  });
});

export default router;

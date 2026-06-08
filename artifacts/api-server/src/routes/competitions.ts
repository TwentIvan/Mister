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

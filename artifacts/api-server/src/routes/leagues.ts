import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import {
  leagues,
  federations,
  competitions,
  marketEvents,
  fantaTeams,
  contracts,
  DEFAULT_LEAGUE_CONFIG,
  defaultFlagValues,
} from "@workspace/db";
import type { LeagueConfig, RosterSnapshot } from "@workspace/db/schema";
import { DEFAULT_RULES } from "@workspace/db/schema";
import {
  ListLeaguesQueryParams,
  ListLeaguesResponse,
  CreateLeagueBody,
  GetLeagueParams,
  GetLeagueResponse,
  UpdateLeagueParams,
  UpdateLeagueBody,
  UpdateLeagueResponse,
  DeleteLeagueParams,
  GetLeagueStatsParams,
  GetLeagueStatsResponse,
} from "@workspace/api-zod";
import { mapLeague, mapFantaTeam } from "../lib/mappers";

const router: IRouter = Router();

router.get("/leagues", async (req, res): Promise<void> => {
  const parsed = ListLeaguesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { admin_user_id } = parsed.data;
  const rows = admin_user_id
    ? await db.select().from(leagues).where(eq(leagues.adminUserId, admin_user_id))
    : await db.select().from(leagues);
  res.json(ListLeaguesResponse.parse(rows.map(mapLeague)));
});

router.post("/leagues", async (req, res): Promise<void> => {
  const parsed = CreateLeagueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;

  const auctionNames = d.fanta_teams.map(t => t.name_auction);
  const uniqueAuctionNames = new Set(auctionNames);
  if (uniqueAuctionNames.size !== auctionNames.length) {
    res.status(409).json({ error: "I nomi all'asta delle squadre devono essere univoci" });
    return;
  }

  const leagueId = `lg-${nanoid(8)}`;

  const leagueConfig: LeagueConfig = {
    ...DEFAULT_LEAGUE_CONFIG,
  };

  try {
    const result = await db.transaction(async (tx) => {
      // Determina federation: adotta quella esistente o ne crea una nuova.
      let fedId: string;
      if (d.federation_id) {
        // Validate federation exists
        const [existing] = await tx
          .select({ id: federations.id })
          .from(federations)
          .where(eq(federations.id, d.federation_id))
          .limit(1);
        if (!existing) {
          throw Object.assign(new Error("Federazione non trovata"), { code: 404 });
        }
        fedId = d.federation_id;
      } else {
        // Auto-crea una Federazione dedicata per questa Lega.
        fedId = `fed-${nanoid(8)}`;
        await tx.insert(federations).values({
          id: fedId,
          name: `Regolamento ${d.name}`,
          description: "Creato automaticamente al setup della lega.",
          templateId: null,
          mode: "classic",
          featureFlags: defaultFlagValues() as Record<string, boolean | number>,
          rules: DEFAULT_RULES,
        });
      }

      const [league] = await tx
        .insert(leagues)
        .values({
          id: leagueId,
          federationId: fedId,
          name: d.name,
          adminUserId: "demo-user",
          season: new Date().getFullYear(),
          maxManagers: d.fanta_teams.length,
          config: leagueConfig,
          timerSeconds: d.timer_seconds,
          budgetInitial: d.budget_initial,
          rosterP: d.roster_p,
          rosterD: d.roster_d,
          rosterC: d.roster_c,
          rosterA: d.roster_a,
          auctionMode: "manageriale",
        })
        .returning();

      const teamRows = await tx
        .insert(fantaTeams)
        .values(
          d.fanta_teams.map(t => ({
            id: `ft-${nanoid(8)}`,
            leagueId: leagueId,
            managerUserId: "demo-user",
            name: t.name,
            nameAuction: t.name_auction,
            logoUrl: t.logo_url ?? null,
            jersey: {
              primaryColor: t.color_primary,
              secondaryColor: t.color_secondary,
              pattern: "solid" as const,
            },
            creditsRemaining: d.budget_initial,
            roster: { gk: [], def: [], mid: [], att: [] } as RosterSnapshot,
          })),
        )
        .returning();

      return { league, fantaTeams: teamRows };
    });

    res.status(201).json({
      league: mapLeague(result.league),
      fanta_teams: result.fantaTeams.map(mapFantaTeam),
    });
  } catch (err) {
    req.log.error({ err }, "Errore creazione lega wizard");
    const code = (err as { code?: number }).code;
    if (code === 404) {
      res.status(404).json({ error: (err as Error).message });
    } else {
      res.status(500).json({ error: "Errore interno durante la creazione della lega" });
    }
  }
});

router.get("/leagues/:id", async (req, res): Promise<void> => {
  const params = GetLeagueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Lega non trovata" });
    return;
  }
  res.json(GetLeagueResponse.parse(mapLeague(row)));
});

router.patch("/leagues/:id", async (req, res): Promise<void> => {
  const params = UpdateLeagueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateLeagueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .update(leagues)
    .set({
      ...(d.name !== undefined && { name: d.name }),
      ...(d.max_managers !== undefined && { maxManagers: d.max_managers }),
      ...(d.visibility !== undefined && { visibility: d.visibility }),
      ...(d.started !== undefined && { started: d.started }),
      ...(d.lineup_visibility !== undefined && { lineupVisibility: d.lineup_visibility }),
      ...(d.roster_visibility !== undefined && { rosterVisibility: d.roster_visibility }),
      ...(d.notify_email !== undefined && { notifyEmail: d.notify_email }),
      ...(d.notify_push !== undefined && { notifyPush: d.notify_push }),
    })
    .where(eq(leagues.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Lega non trovata" });
    return;
  }
  res.json(UpdateLeagueResponse.parse(mapLeague(row)));
});

router.delete("/leagues/:id", async (req, res): Promise<void> => {
  const params = DeleteLeagueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(leagues)
    .where(eq(leagues.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Lega non trovata" });
    return;
  }
  res.sendStatus(204);
});

router.get("/leagues/:id/stats", async (req, res): Promise<void> => {
  const params = GetLeagueStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { id } = params.data;
  const [teams] = await db
    .select({ count: count() })
    .from(fantaTeams)
    .where(eq(fantaTeams.leagueId, id));
  const [comps] = await db
    .select({ count: count() })
    .from(competitions)
    .where(eq(competitions.leagueId, id));
  const [markets] = await db
    .select({ count: count() })
    .from(marketEvents)
    .where(eq(marketEvents.leagueId, id));
  const [conts] = await db
    .select({ count: count() })
    .from(contracts)
    .where(eq(contracts.leagueId, id));
  res.json(
    GetLeagueStatsResponse.parse({
      league_id: id,
      team_count: Number(teams?.count ?? 0),
      competition_count: Number(comps?.count ?? 0),
      active_market_count: Number(markets?.count ?? 0),
      contract_count: Number(conts?.count ?? 0),
    }),
  );
});

export default router;

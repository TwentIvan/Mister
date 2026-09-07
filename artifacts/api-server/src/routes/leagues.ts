import { Router, type IRouter } from "express";
import { eq, count, and, sql, isNull, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import {
  leagues,
  federations,
  competitions,
  marketEvents,
  fantaTeams,
  societa,
  contracts,
  auctions,
  leagueMembers,
  lineups,
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
import { guardLeagueAdmin, guardLeagueMember, requireAuth } from "../lib/auth";

// ──────────────────────────────────────────────────────────────────────────────
// Inline Zod per endpoint Fase 2 (non dipendenti dal codegen generato)
// ──────────────────────────────────────────────────────────────────────────────

const LeagueIdParams = z.object({ id: z.string().min(1) });

const JoinLeagueBodyLocal = z.object({
  invitation_code: z.string().min(1),
});

const SocietaInputLocal = z.object({
  name: z.string().min(1).max(50),
  name_auction: z.string().min(1).max(30),
  color_primary: z.string().optional(),
  color_secondary: z.string().optional(),
  logo_url: z.string().nullable().optional(),
});

const ClaimSlotBodyLocal = z.object({
  slot_id: z.string().min(1),
  societa_id: z.string().optional(),
  societa: SocietaInputLocal.optional(),
});

const router: IRouter = Router();

// ──────────────────────────────────────────────────────────────────────────────
// GET /leagues
// ──────────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────────
// POST /leagues — crea lega con slot vuoti + invitation_code
// ──────────────────────────────────────────────────────────────────────────────

router.post("/leagues", async (req, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return;
  }
  const parsed = CreateLeagueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;

  const leagueId = `lg-${nanoid(8)}`;
  const invitationCode = nanoid(10);
  const leagueConfig: LeagueConfig = { ...DEFAULT_LEAGUE_CONFIG };

  try {
    const result = await db.transaction(async (tx) => {
      let fedId: string;
      if (d.federation_id) {
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
        fedId = `fed-${nanoid(8)}`;
        await tx.insert(federations).values({
          id: fedId,
          name: `Regolamento ${d.name}`,
          description: "Creato automaticamente al setup della lega.",
          templateId: null,
          mode: "classic",
          featureFlags: defaultFlagValues() as Record<string, boolean | number>,
          rules: DEFAULT_RULES,
          ownerUserId: req.user!.sub,
        });
      }

      const creatorId = req.user!.sub;

      const [league] = await tx
        .insert(leagues)
        .values({
          id: leagueId,
          federationId: fedId,
          name: d.name,
          adminUserId: creatorId,
          season: new Date().getFullYear(),
          maxManagers: d.team_count,
          invitationCode,
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

      // Admin in league_members — nessun slot d'ufficio.
      await tx.insert(leagueMembers).values({
        userId: creatorId,
        leagueId: leagueId,
        role: "admin",
      });

      // Crea N slot vuoti (manager_user_id=NULL, societa_id=NULL).
      const slotValues = Array.from({ length: d.team_count }, () => ({
        id: `ft-${nanoid(8)}`,
        leagueId: leagueId,
        managerUserId: null as string | null,
        societaId: null as string | null,
        creditsRemaining: d.budget_initial,
        roster: { gk: [], def: [], mid: [], att: [] } as RosterSnapshot,
      }));

      await tx.insert(fantaTeams).values(slotValues);

      return { league };
    });

    res.status(201).json({ league: mapLeague(result.league) });
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

// ──────────────────────────────────────────────────────────────────────────────
// POST /leagues/:id/join — entra nella lega con invitation_code
// ──────────────────────────────────────────────────────────────────────────────

router.post("/leagues/:id/join", async (req, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return;
  }

  const params = LeagueIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = JoinLeagueBodyLocal.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }

  const leagueId = params.data.id;
  const userId = req.user.sub;

  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1);

  if (!league) {
    res.status(404).json({ error: "Lega non trovata" });
    return;
  }

  // Verifica il codice invito.
  if (league.invitationCode !== body.data.invitation_code) {
    res.status(403).json({ error: "Codice invito non valido" });
    return;
  }

  // Già membro — idempotente.
  const [existingMember] = await db
    .select()
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)))
    .limit(1);

  if (existingMember) {
    const [freeCount] = await db
      .select({ count: count() })
      .from(fantaTeams)
      .where(and(eq(fantaTeams.leagueId, leagueId), isNull(fantaTeams.managerUserId)));
    res.json({
      league: mapLeague(league),
      already_member: true,
      free_slots: Number(freeCount?.count ?? 0),
    });
    return;
  }

  // J5: verifica che ci sia almeno uno slot libero.
  const [freeCheck] = await db
    .select({ count: count() })
    .from(fantaTeams)
    .where(and(eq(fantaTeams.leagueId, leagueId), isNull(fantaTeams.managerUserId)));

  if (Number(freeCheck?.count ?? 0) === 0) {
    res.status(409).json({
      error: "Lega al completo: tutti gli slot sono occupati",
      code: "LEAGUE_FULL",
    });
    return;
  }

  await db.insert(leagueMembers).values({ userId, leagueId, role: "member" });

  const [freeAfter] = await db
    .select({ count: count() })
    .from(fantaTeams)
    .where(and(eq(fantaTeams.leagueId, leagueId), isNull(fantaTeams.managerUserId)));

  res.json({
    league: mapLeague(league),
    already_member: false,
    free_slots: Number(freeAfter?.count ?? 0),
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /leagues/:id/claim — rivendica uno slot (atomico)
// ──────────────────────────────────────────────────────────────────────────────

router.post("/leagues/:id/claim", async (req, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return;
  }

  const params = LeagueIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = ClaimSlotBodyLocal.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }

  if (!body.data.societa_id && !body.data.societa) {
    res.status(400).json({ error: "Fornire societa_id (riusa) oppure societa (crea nuova)" });
    return;
  }

  const leagueId = params.data.id;
  const userId = req.user.sub;

  // Verifica che l'utente sia membro.
  if (!await guardLeagueMember(req, res, leagueId)) return;

  // J4: conflitto — l'utente ha già uno slot in questa lega.
  const [existingSlot] = await db
    .select({ id: fantaTeams.id })
    .from(fantaTeams)
    .where(and(eq(fantaTeams.leagueId, leagueId), eq(fantaTeams.managerUserId, userId)))
    .limit(1);

  if (existingSlot) {
    res.status(409).json({
      error: "Hai già una squadra in questa lega. Non puoi rivendicare un secondo slot.",
      code: "SLOT_CONFLICT",
      existing_slot_id: existingSlot.id,
    });
    return;
  }

  // Verifica che lo slot esista nella lega.
  const [targetSlot] = await db
    .select({ id: fantaTeams.id, managerUserId: fantaTeams.managerUserId })
    .from(fantaTeams)
    .where(and(eq(fantaTeams.id, body.data.slot_id), eq(fantaTeams.leagueId, leagueId)))
    .limit(1);

  if (!targetSlot) {
    res.status(404).json({ error: "Slot non trovato in questa lega" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      let resolvedSocId: string;

      if (body.data.societa_id) {
        const [existingSoc] = await tx
          .select({ id: societa.id, ownerUserId: societa.ownerUserId })
          .from(societa)
          .where(eq(societa.id, body.data.societa_id))
          .limit(1);
        if (!existingSoc) {
          throw Object.assign(new Error("Società non trovata"), { code: 404 });
        }
        if (existingSoc.ownerUserId !== userId) {
          throw Object.assign(new Error("Non sei il proprietario di questa società"), { code: 403 });
        }
        resolvedSocId = body.data.societa_id;
      } else {
        const s = body.data.societa!;
        const socId = `soc-${nanoid(8)}`;
        await tx.insert(societa).values({
          id: socId,
          ownerUserId: userId,
          name: s.name,
          nameAuction: s.name_auction,
          logoUrl: s.logo_url ?? undefined,
          jersey: {
            primaryColor: s.color_primary ?? "#1f4733",
            secondaryColor: s.color_secondary ?? "#efe6d3",
            pattern: "solid" as const,
          },
        });
        resolvedSocId = socId;
      }

      // J6: UPDATE atomico — aggiorna SOLO se lo slot è ancora libero.
      const [updated] = await tx
        .update(fantaTeams)
        .set({ societaId: resolvedSocId, managerUserId: userId })
        .where(
          and(
            eq(fantaTeams.id, body.data.slot_id),
            eq(fantaTeams.leagueId, leagueId),
            isNull(fantaTeams.managerUserId),
          ),
        )
        .returning();

      if (!updated) {
        throw Object.assign(new Error("Slot già preso"), { code: 409 });
      }

      const [soc] = await tx
        .select()
        .from(societa)
        .where(eq(societa.id, resolvedSocId))
        .limit(1);

      return { team: updated, soc: soc ?? null };
    });

    res.status(201).json({ fanta_team: mapFantaTeam(result.team, result.soc) });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 404) {
      res.status(404).json({ error: (err as Error).message });
    } else if (code === 403) {
      res.status(403).json({ error: (err as Error).message });
    } else if (code === 409) {
      res.status(409).json({ error: (err as Error).message, code: "SLOT_TAKEN" });
    } else {
      req.log.error({ err }, "Errore claim slot");
      res.status(500).json({ error: "Errore interno durante il claim dello slot" });
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /leagues/:id/invite — info invito lega (admin only)
// ──────────────────────────────────────────────────────────────────────────────

router.get("/leagues/:id/invite", async (req, res): Promise<void> => {
  const params = LeagueIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const leagueId = params.data.id;

  if (!await guardLeagueAdmin(req, res, leagueId)) return;

  const [league, slots, members] = await Promise.all([
    db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1).then(r => r[0]),
    db.select().from(fantaTeams).where(eq(fantaTeams.leagueId, leagueId)),
    db.select().from(leagueMembers).where(eq(leagueMembers.leagueId, leagueId)),
  ]);

  if (!league) {
    res.status(404).json({ error: "Lega non trovata" });
    return;
  }

  const socIds = slots.map(s => s.societaId).filter((id): id is string => id !== null);
  const socRows = socIds.length > 0
    ? await db.select().from(societa).where(inArray(societa.id, socIds))
    : [];
  const socById = Object.fromEntries(socRows.map(s => [s.id, s]));

  const slotInfo = slots.map(s => ({
    id: s.id,
    manager_user_id: s.managerUserId ?? null,
    societa_id: s.societaId ?? null,
    name: s.societaId ? (socById[s.societaId]?.name ?? null) : null,
    name_auction: s.societaId ? (socById[s.societaId]?.nameAuction ?? null) : null,
    is_claimed: s.managerUserId !== null,
  }));

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
  const inviteLink = league.invitationCode
    ? `https://${domain}/join/${league.id}/${league.invitationCode}`
    : null;

  res.json({
    invitation_code: league.invitationCode ?? null,
    invite_link: inviteLink,
    slots: slotInfo,
    members: members.map(m => ({
      user_id: m.userId,
      role: m.role,
      joined_at: m.joinedAt,
    })),
    free_slots: slotInfo.filter(s => !s.is_claimed).length,
    total_slots: slotInfo.length,
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /leagues/:id
// ──────────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /leagues/:id
// ──────────────────────────────────────────────────────────────────────────────

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

  if (!await guardLeagueAdmin(req, res, params.data.id)) return;

  const d = parsed.data;

  const hasGuardedChange =
    d.timer_seconds !== undefined ||
    d.budget_initial !== undefined ||
    d.roster_p !== undefined ||
    d.roster_d !== undefined ||
    d.roster_c !== undefined ||
    d.roster_a !== undefined ||
    d.auction_mode !== undefined ||
    d.price_source_listone_id !== undefined;

  if (hasGuardedChange) {
    const [runningAuction] = await db
      .select({ id: auctions.id })
      .from(auctions)
      .where(and(eq(auctions.leagueId, params.data.id), eq(auctions.status, "running")))
      .limit(1);
    if (runningAuction) {
      res.status(409).json({
        error:
          "Impossibile modificare composizione rosa, budget o timer mentre un'asta è in corso. Attendi il termine dell'asta.",
        running_auction_id: runningAuction.id,
      });
      return;
    }
  }

  let configExpr: ReturnType<typeof sql> | undefined;
  if (d.price_source_listone_id !== undefined) {
    const patchJson = JSON.stringify({ priceSourceListoneId: d.price_source_listone_id });
    configExpr = sql`COALESCE(${leagues.config}, '{}'::jsonb) || ${patchJson}::jsonb`;
  }
  if (d.post_acquisition_window) {
    const paw = d.post_acquisition_window;
    const pawPatch: Record<string, unknown> = {};
    if (paw.enabled !== undefined) pawPatch.enabled = paw.enabled;
    if (paw.async_hours !== undefined) pawPatch.asyncHours = paw.async_hours;
    if (paw.live_seconds !== undefined) pawPatch.liveSeconds = paw.live_seconds;
    if (paw.default_clause_action !== undefined)
      pawPatch.defaultClauseAction = paw.default_clause_action;
    if (paw.default_contract_years !== undefined)
      pawPatch.defaultContractYears = paw.default_contract_years;
    const pawJson = JSON.stringify({ postAcquisitionWindow: pawPatch });
    const base = configExpr ?? sql`COALESCE(${leagues.config}, '{}'::jsonb)`;
    configExpr = sql`${base} || ${pawJson}::jsonb`;
  }

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
      ...(d.timer_seconds !== undefined && { timerSeconds: d.timer_seconds }),
      ...(d.budget_initial !== undefined && { budgetInitial: d.budget_initial }),
      ...(d.roster_p !== undefined && { rosterP: d.roster_p }),
      ...(d.roster_d !== undefined && { rosterD: d.roster_d }),
      ...(d.roster_c !== undefined && { rosterC: d.roster_c }),
      ...(d.roster_a !== undefined && { rosterA: d.roster_a }),
      ...(d.auction_mode !== undefined && { auctionMode: d.auction_mode }),
      ...(configExpr !== undefined && { config: configExpr }),
    })
    .where(eq(leagues.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Lega non trovata" });
    return;
  }
  res.json(UpdateLeagueResponse.parse(mapLeague(row)));
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /leagues/:id
// ──────────────────────────────────────────────────────────────────────────────

router.delete("/leagues/:id", async (req, res): Promise<void> => {
  const params = DeleteLeagueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!await guardLeagueAdmin(req, res, params.data.id)) return;
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

// ──────────────────────────────────────────────────────────────────────────────
// GET /leagues/:id/stats
// ──────────────────────────────────────────────────────────────────────────────

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

// ── POST /leagues/:id/reset-rosters ──────────────────────────────────────────
// AZIONE DISTRUTTIVA (T163): svuota le rose (contracts), cancella le
// formazioni (lineups → lineup_players in cascade) e ripristina il budget
// iniziale di ogni squadra. Pensata per ripartire puliti prima di un'asta
// vera su una lega usata per i test. Guardie: admin di lega, nessuna asta
// non conclusa. Tutto in UNA transazione: o si azzera tutto, o niente.
router.post("/leagues/:id/reset-rosters", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id ?? "");
  const [league] = await db.select().from(leagues).where(eq(leagues.id, id));
  if (!league) {
    res.status(404).json({ error: "Lega non trovata" });
    return;
  }
  if (!(await guardLeagueAdmin(req, res, id))) return;

  const openAuctions = await db
    .select({ id: auctions.id, status: auctions.status })
    .from(auctions)
    .where(and(eq(auctions.leagueId, id), sql`${auctions.status} NOT IN ('completed', 'cancelled')`));
  if (openAuctions.length > 0) {
    res.status(409).json({
      error: "C'è un'asta non conclusa su questa lega: terminala prima di azzerare le rose",
      auction_id: openAuctions[0]!.id,
    });
    return;
  }

  const budget = league.budgetInitial ?? 500;

  const result = await db.transaction(async (tx) => {
    const teams = await tx
      .select({ id: fantaTeams.id })
      .from(fantaTeams)
      .where(eq(fantaTeams.leagueId, id));
    const teamIds = teams.map((t) => t.id);

    let lineupsDeleted = 0;
    if (teamIds.length > 0) {
      const delLineups = await tx
        .delete(lineups)
        .where(inArray(lineups.fantaTeamId, teamIds))
        .returning({ id: lineups.id });
      lineupsDeleted = delLineups.length;
    }

    const delContracts = await tx
      .delete(contracts)
      .where(eq(contracts.leagueId, id))
      .returning({ id: contracts.id });

    if (teamIds.length > 0) {
      await tx
        .update(fantaTeams)
        .set({ creditsRemaining: budget })
        .where(eq(fantaTeams.leagueId, id));
    }

    return {
      contracts_deleted: delContracts.length,
      lineups_deleted: lineupsDeleted,
      teams_reset: teamIds.length,
      budget_restored: budget,
    };
  });

  req.log.warn({ leagueId: id, ...result, by: req.user?.email }, "RESET rose e budget eseguito");
  res.json(result);
});

// ═══ T171 — INVITI NOMINALI PER SLOT ═════════════════════════════════════════
// Best practice incorporate: token crypto-random monouso (nanoid 24) legato
// allo slot; rigenerazione = revoca del precedente; scadenza 14 giorni; claim
// atomico (WHERE manager_user_id IS NULL) che CONSUMA il token; il claim NON
// tocca nome/società dello slot (lezione del 5/9: rivendicare ≠ ribattezzare);
// audit log con esecutore.

const INVITE_TTL_DAYS = 14;

// POST /leagues/:id/slots/:slotId/invite — genera/rigenera (solo admin)
router.post("/leagues/:id/slots/:slotId/invite", requireAuth, async (req, res): Promise<void> => {
  const leagueId = String(req.params.id ?? "");
  const slotId = String(req.params.slotId ?? "");
  if (!(await guardLeagueAdmin(req, res, leagueId))) return;

  const [slot] = await db
    .select({ id: fantaTeams.id, managerUserId: fantaTeams.managerUserId, societaId: fantaTeams.societaId })
    .from(fantaTeams)
    .where(and(eq(fantaTeams.id, slotId), eq(fantaTeams.leagueId, leagueId)));
  if (!slot) { res.status(404).json({ error: "Slot inesistente in questa lega" }); return; }
  if (slot.managerUserId) { res.status(409).json({ error: "Slot già rivendicato" }); return; }

  const token = nanoid(24);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600 * 1000);
  await db.update(fantaTeams)
    .set({ inviteToken: token, inviteTokenExpiresAt: expiresAt })
    .where(eq(fantaTeams.id, slotId));

  let teamName: string | null = null;
  if (slot.societaId) {
    const [soc] = await db.select({ name: societa.name }).from(societa).where(eq(societa.id, slot.societaId));
    teamName = soc?.name ?? null;
  }
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
  req.log.info({ leagueId, slotId, by: req.user?.email }, "T171: invito nominale generato");
  res.json({
    invite_link: `https://${domain}/js/${token}`,
    token,
    expires_at: expiresAt.toISOString(),
    team_name: teamName,
  });
});

// GET /join-slot/:token — info pubbliche per la landing
router.get("/join-slot/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  const [slot] = await db
    .select({
      id: fantaTeams.id, leagueId: fantaTeams.leagueId,
      managerUserId: fantaTeams.managerUserId, societaId: fantaTeams.societaId,
      exp: fantaTeams.inviteTokenExpiresAt,
    })
    .from(fantaTeams)
    .where(eq(fantaTeams.inviteToken, token));
  if (!slot) { res.status(404).json({ error: "Invito inesistente o revocato" }); return; }

  const [lg] = await db.select({ name: leagues.name }).from(leagues).where(eq(leagues.id, slot.leagueId));
  let teamName: string | null = null;
  if (slot.societaId) {
    const [soc] = await db.select({ name: societa.name }).from(societa).where(eq(societa.id, slot.societaId));
    teamName = soc?.name ?? null;
  }
  res.json({
    league_id: slot.leagueId,
    league_name: lg?.name ?? "",
    team_name: teamName,
    claimed: slot.managerUserId !== null,
    expired: slot.exp !== null && slot.exp < new Date(),
  });
});

// POST /join-slot/:token/claim — rivendica e consuma (autenticato, atomico)
router.post("/join-slot/:token/claim", requireAuth, async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  const userId = req.user!.sub;

  const [slot] = await db
    .select({ id: fantaTeams.id, leagueId: fantaTeams.leagueId, exp: fantaTeams.inviteTokenExpiresAt })
    .from(fantaTeams)
    .where(eq(fantaTeams.inviteToken, token));
  if (!slot) { res.status(404).json({ error: "Invito inesistente o revocato" }); return; }
  if (slot.exp !== null && slot.exp < new Date()) {
    res.status(409).json({ error: "Invito scaduto: chiedi all'admin di rigenerarlo" });
    return;
  }

  // un utente = una squadra per lega
  const [existing] = await db
    .select({ id: fantaTeams.id })
    .from(fantaTeams)
    .where(and(eq(fantaTeams.leagueId, slot.leagueId), eq(fantaTeams.managerUserId, userId)));
  if (existing) {
    res.status(409).json({ error: "Hai già una squadra in questa lega", existing_slot_id: existing.id });
    return;
  }

  // claim atomico: solo se ancora libero; consuma il token. NON tocca società/nome.
  const updated = await db
    .update(fantaTeams)
    .set({ managerUserId: userId, inviteToken: null, inviteTokenExpiresAt: null })
    .where(and(eq(fantaTeams.id, slot.id), isNull(fantaTeams.managerUserId)))
    .returning({ id: fantaTeams.id });
  if (updated.length === 0) {
    res.status(409).json({ error: "Slot già rivendicato da qualcun altro" });
    return;
  }

  // membership di lega (se non già presente)
  await db.execute(sql`
    INSERT INTO league_members (league_id, user_id, role)
    VALUES (${slot.leagueId}, ${userId}, 'member')
    ON CONFLICT DO NOTHING`);

  req.log.info({ leagueId: slot.leagueId, slotId: slot.id, by: req.user?.email }, "T171: slot rivendicato via invito nominale");
  res.json({ league_id: slot.leagueId, fanta_team_id: slot.id });
});

// POST /leagues/:id/slots/:slotId/assign — T171.b: assegnazione diretta per email
router.post("/leagues/:id/slots/:slotId/assign", requireAuth, async (req, res): Promise<void> => {
  const leagueId = String(req.params.id ?? "");
  const slotId = String(req.params.slotId ?? "");
  if (!(await guardLeagueAdmin(req, res, leagueId))) return;

  const email = String((req.body as { email?: string })?.email ?? "").trim().toLowerCase();
  if (!email) { res.status(400).json({ error: "Email mancante" }); return; }

  const [u] = await db.execute(sql`SELECT id, email FROM users WHERE lower(email) = ${email}`).then(r => r.rows) as Array<{ id: string; email: string }>;
  if (!u) { res.status(404).json({ error: `Nessun utente registrato con ${email}: usa l'invito personale` }); return; }

  const [already] = await db
    .select({ id: fantaTeams.id })
    .from(fantaTeams)
    .where(and(eq(fantaTeams.leagueId, leagueId), eq(fantaTeams.managerUserId, u.id)));
  if (already) { res.status(409).json({ error: "Questo utente ha già una squadra nella lega" }); return; }

  const updated = await db
    .update(fantaTeams)
    .set({ managerUserId: u.id, inviteToken: null, inviteTokenExpiresAt: null })
    .where(and(eq(fantaTeams.id, slotId), eq(fantaTeams.leagueId, leagueId), isNull(fantaTeams.managerUserId)))
    .returning({ id: fantaTeams.id });
  if (updated.length === 0) { res.status(409).json({ error: "Slot inesistente o già rivendicato" }); return; }

  await db.execute(sql`
    INSERT INTO league_members (league_id, user_id, role)
    VALUES (${leagueId}, ${u.id}, 'member') ON CONFLICT DO NOTHING`);

  req.log.info({ leagueId, slotId, assignee: u.email, by: req.user?.email }, "T171.b: slot assegnato direttamente");
  res.json({ fanta_team_id: updated[0]!.id, user_email: u.email });
});

export default router;

import type {
  League,
  TemplateProfile,
  Federation,
  Competition,
  MarketEvent,
  FantaTeam,
  Player,
  Contract,
} from "@workspace/db";
import { defaultFlagValues } from "@workspace/db";

export function mapLeague(l: League) {
  return {
    id: l.id,
    name: l.name,
    federation_id: l.federationId ?? null,
    template_id: l.templateId ?? null,
    admin_user_id: l.adminUserId,
    co_admin_user_ids: l.coAdminUserIds,
    max_managers: l.maxManagers,
    season: l.season,
    visibility: l.visibility,
    invitation_code: l.invitationCode ?? null,
    lineup_visibility: l.lineupVisibility,
    roster_visibility: l.rosterVisibility,
    started: l.started,
    notify_email: l.notifyEmail,
    notify_push: l.notifyPush,
    timer_seconds: l.timerSeconds,
    budget_initial: l.budgetInitial ?? null,
    roster_p: l.rosterP ?? null,
    roster_d: l.rosterD ?? null,
    roster_c: l.rosterC ?? null,
    roster_a: l.rosterA ?? null,
    auction_mode: l.auctionMode ?? null,
    snapshot_locked_at: l.snapshotLockedAt?.toISOString() ?? null,
    created_at: l.createdAt,
  };
}

function toSnakeMarket(m: Record<string, unknown>) {
  return {
    name: m["name"] ?? m["name"],
    type: m["type"],
    mode: m["mode"],
    window_hint: m["window_hint"] ?? m["windowHint"],
    description: m["description"],
  };
}

function toSnakeCompetition(c: Record<string, unknown>) {
  return {
    name: c["name"],
    type: c["type"],
    description: c["description"],
  };
}

export function mapTemplate(t: TemplateProfile) {
  const suggestedMarkets = Array.isArray(t.suggestedMarkets)
    ? (t.suggestedMarkets as unknown as Record<string, unknown>[]).map(toSnakeMarket)
    : [];
  const suggestedCompetitions = Array.isArray(t.suggestedCompetitions)
    ? (t.suggestedCompetitions as unknown as Record<string, unknown>[]).map(toSnakeCompetition)
    : [];
  return {
    id: t.id,
    name: t.name,
    tagline: t.tagline,
    description: t.description,
    complexity_level: t.complexityLevel,
    estimated_weekly_minutes: t.estimatedWeeklyMinutes,
    icon: t.icon,
    feature_flags: t.featureFlags,
    suggested_markets: suggestedMarkets,
    suggested_competitions: suggestedCompetitions,
    author_user_id: t.authorUserId ?? null,
    is_system: t.isSystem,
    is_active: t.isActive,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

export function mapFederation(f: Federation) {
  // Merge con i default server-side: garantisce che tutti i flag appaiano
  // nell'API anche se il record DB è stato creato prima di un nuovo flag.
  const mergedFlags = { ...defaultFlagValues(), ...(f.featureFlags ?? {}) };
  return {
    id: f.id,
    name: f.name,
    description: f.description,
    template_id: f.templateId ?? null,
    owner_user_id: f.ownerUserId ?? null,
    mode: f.mode,
    feature_flags: mergedFlags,
    rules: f.rules,
    created_at: f.createdAt,
    updated_at: f.updatedAt,
  };
}

export function mapCompetition(c: Competition) {
  return {
    id: c.id,
    league_id: c.leagueId,
    name: c.name,
    description: c.description,
    type: c.type,
    season: c.season,
    start_giornata: c.startGiornata,
    end_giornata: c.endGiornata,
    config: c.config ?? {},
    active: c.active,
    completed: c.completed,
    starts_at: c.startsAt ?? null,
    ends_at: c.endsAt ?? null,
    created_at: c.createdAt,
  };
}

export function mapMarket(m: MarketEvent) {
  return {
    id: m.id,
    league_id: m.leagueId,
    name: m.name,
    description: m.description,
    type: m.type,
    status: m.status,
    starts_at: m.startsAt,
    ends_at: m.endsAt,
    config: m.config ?? {},
    created_at: m.createdAt,
  };
}

export function mapFantaTeam(t: FantaTeam) {
  return {
    id: t.id,
    league_id: t.leagueId,
    manager_user_id: t.managerUserId,
    name: t.name,
    name_auction: t.nameAuction ?? null,
    logo_url: t.logoUrl ?? null,
    color_primary: t.jersey?.primaryColor ?? null,
    color_secondary: t.jersey?.secondaryColor ?? null,
    credits_remaining: t.creditsRemaining,
    roster: (() => {
      const r = t.roster as unknown;
      if (!r) return [];
      if (Array.isArray(r)) return r as number[];
      const s = r as Record<string, number[]>;
      return [...(s.gk ?? []), ...(s.def ?? []), ...(s.mid ?? []), ...(s.att ?? [])];
    })(),
    created_at: t.createdAt,
  };
}

export function mapPlayer(p: Player) {
  return {
    id: p.id,
    name: p.name,
    full_name: p.fullName,
    real_team: p.realTeam,
    birth_date: p.birthDate ?? null,
    nationality: p.nationality ?? null,
    height_cm: p.heightCm ?? null,
    weight_kg: null,
    foot: p.foot ?? null,
    role_classic: p.roleClassic,
    roles_mantra: p.rolesMantra,
    injured: p.injured,
    photo_url: p.photoUrl ?? null,
  };
}

export function mapContract(c: Contract) {
  return {
    id: c.id,
    league_id: c.leagueId,
    fanta_team_id: c.fantaTeamId,
    player_id: c.playerId,
    season_start: c.seasonStart,
    duration_seasons: c.durationSeasons,
    purchase_price: c.purchasePrice,
    clause_default: c.clauseDefault,
    clause_investment: c.clauseInvestment,
    state: c.state,
    notes: c.notes,
    created_at: c.createdAt,
    closed_at: c.closedAt ?? null,
  };
}

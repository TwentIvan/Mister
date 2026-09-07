/**
 * Sorgente unica della navigazione.
 *
 * Definisce le voci di menu organizzate per "altitudine" (globale, federazione,
 * lega), filtrate per ruolo e per flag, con href costruiti dagli id reali.
 * NIENTE id cablati. Questo modulo non disegna nulla: il guscio (sidebar
 * desktop, bottom-bar mobile) consuma `useNavModel` per renderlo — così una
 * voce si aggiunge in un solo posto e compare ovunque.
 *
 * Voci con route non ancora esistenti (es. Albo d'oro, Notifiche, Profilo,
 * Classifica di lega) NON sono incluse qui: si aggiungono quando avranno una
 * destinazione reale, per non creare link morti.
 */
import {
  type LucideIcon,
  Home,
  FileSpreadsheet,
  Shirt,
  Trophy,
  Users,
  Store,
  Wallet,
  Settings,
  Shield,
} from "lucide-react";
import { useGetLeague, getGetLeagueQueryKey } from "@workspace/api-client-react";
import { useCurrentUser } from "@/contexts/AuthContext";
import { isDevSuperadmin } from "@/lib/dev-superadmin";
import { useEconomyConfig } from "@/lib/economy-api";

export type NavLevel = "global" | "federation" | "league";

export interface NavItem {
  /** id stabile per key/test, non l'href. */
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  level: NavLevel;
}

/** Contesto puro da cui derivare il modello (niente hook qui). */
export interface NavContext {
  userId?: string | null;
  userEmail?: string | null;
  leagueId?: string | null;
  leagueAdminUserId?: string | null;
  leagueName?: string | null;
  realMoneyEnabled?: boolean;
}

export interface NavModel {
  global: NavItem[];
  federation: NavItem[];
  league: NavItem[];
  /** Nome della lega corrente, per l'intestazione contestuale (null se fuori da una lega). */
  leagueName: string | null;
}

/**
 * Costruisce il modello di navigazione dal contesto. Funzione PURA: nessun
 * hook, nessun side-effect — facilmente testabile.
 */
export function buildNavModel(ctx: NavContext): NavModel {
  const isAdmin =
    (!!ctx.userId &&
      !!ctx.leagueAdminUserId &&
      ctx.userId === ctx.leagueAdminUserId) ||
    // ⚠️ TEMPORANEO: bypass dev — vedi lib/dev-superadmin.ts e TECH_DEBT.md
    isDevSuperadmin(ctx.userEmail);
  const lid = ctx.leagueId ?? undefined;

  // ── Globale: la home è il feed ───────────────────────────────────────────
  const global: NavItem[] = [
    { id: "home", label: "Home", icon: Home, href: "/feed", level: "global" },
    { id: "listoni", label: "Listoni", icon: FileSpreadsheet, href: "/listoni", level: "global" },
    { id: "mie-societa", label: "Le mie società", icon: Shirt, href: "/societa", level: "global" },
    {
      id: "leagues",
      label: "Le mie leghe",
      icon: Trophy,
      href: "/leagues",
      level: "global",
    },
    {
      id: "players",
      label: "Giocatori",
      icon: Users,
      href: "/players",
      level: "global",
    },
  ];

  const federation: NavItem[] = [];
  const league: NavItem[] = [];

  if (lid) {
    // ── Federazione: per ora l'identità/regole, attaccata alla lega ─────────
    federation.push({
      id: "fed-rules",
      label: "Federazione",
      icon: Shield,
      href: `/leagues/${lid}/federation`,
      level: "federation",
    });

    // ── Lega (workspace): solo voci con route reali oggi ────────────────────
    league.push({
      id: "lg-overview",
      label: "Panoramica",
      icon: Trophy,
      href: `/leagues/${lid}`,
      level: "league",
    });
    league.push({
      id: "lg-markets",
      label: "Mercato",
      icon: Store,
      href: `/leagues/${lid}/markets`,
      level: "league",
    });
    if (ctx.realMoneyEnabled) {
      league.push({
        id: "lg-cassa",
        label: "Cassa",
        icon: Wallet,
        href: `/leagues/${lid}/cassa`,
        level: "league",
      });
    }
    league.push({
      id: "lg-societa",
      label: "La mia società",
      icon: Shirt,
      href: `/leagues/${lid}/societa`,
      level: "league",
    });
    if (isAdmin) {
      league.push({
        id: "lg-settings",
        label: "Impostazioni",
        icon: Settings,
        href: `/leagues/${lid}/config`,
        level: "league",
      });
    }
  }

  return {
    global,
    federation,
    league,
    leagueName: lid ? (ctx.leagueName ?? null) : null,
  };
}

/**
 * Hook: raccoglie il contesto (utente, lega, config cassa) e restituisce il
 * modello. Gli hook sono sempre chiamati (anche senza leagueId, con query
 * disabilitata) per rispettare le regole degli hook di React.
 */
export function useNavModel(leagueId?: string): NavModel {
  const { user } = useCurrentUser();
  const { data: league } = useGetLeague(leagueId ?? "", {
    query: { enabled: !!leagueId, queryKey: getGetLeagueQueryKey(leagueId ?? "") },
  });
  const { data: econ } = useEconomyConfig(leagueId ?? "");

  return buildNavModel({
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    leagueId: leagueId ?? null,
    leagueAdminUserId: league?.admin_user_id ?? null,
    leagueName: league?.name ?? null,
    realMoneyEnabled: econ?.realMoneyEnabled ?? false,
  });
}

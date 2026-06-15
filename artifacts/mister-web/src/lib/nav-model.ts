/**
 * Sorgente unica della navigazione (Stadio 1).
 *
 * Definisce le voci di menu organizzate per "altitudine" (globale, federazione,
 * lega), filtrate per ruolo e per flag, con href costruiti dagli id reali.
 * NIENTE id cablati. Questo modulo non disegna nulla: gli stadi successivi
 * (sidebar desktop, bottom-bar mobile) consumano `useNavModel` per renderlo —
 * così una voce si aggiunge in un solo posto e compare ovunque.
 *
 * Voci con route non ancora esistenti (es. Albo d'oro, Notifiche, Profilo,
 * Classifica di lega) NON sono incluse qui: si aggiungono quando avranno una
 * destinazione reale, per non creare link morti.
 */
import {
  type LucideIcon,
  Home,
  Trophy,
  Users,
  Store,
  Wallet,
  Settings,
  Shield,
} from "lucide-react";
import { useGetLeague, getGetLeagueQueryKey } from "@workspace/api-client-react";
import { useCurrentUser } from "@/contexts/AuthContext";
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
  leagueId?: string | null;
  leagueAdminUserId?: string | null;
  realMoneyEnabled?: boolean;
}

export interface NavModel {
  global: NavItem[];
  federation: NavItem[];
  league: NavItem[];
}

/**
 * Costruisce il modello di navigazione dal contesto. Funzione PURA: nessun
 * hook, nessun side-effect — facilmente testabile.
 */
export function buildNavModel(ctx: NavContext): NavModel {
  const isAdmin =
    !!ctx.userId &&
    !!ctx.leagueAdminUserId &&
    ctx.userId === ctx.leagueAdminUserId;
  const lid = ctx.leagueId ?? undefined;

  // ── Globale: la home è il feed ───────────────────────────────────────────
  const global: NavItem[] = [
    { id: "home", label: "Home", icon: Home, href: "/feed", level: "global" },
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

  return { global, federation, league };
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
    leagueId: leagueId ?? null,
    leagueAdminUserId: league?.admin_user_id ?? null,
    realMoneyEnabled: econ?.realMoneyEnabled ?? false,
  });
}

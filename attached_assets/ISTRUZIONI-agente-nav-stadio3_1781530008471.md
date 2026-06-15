# Istruzioni per l'agente Replit — Stadio 3: livello-lega contestuale

Quando si è dentro `/leagues/:id/*`, sidebar e bottom-bar mostrano le sezioni di
quella lega (Panoramica, Mercato, Cassa se attiva, Impostazioni se admin) più la
Federazione, con il nome della lega come intestazione. Fuori da una lega resta il
solo livello globale (come adesso). Solo frontend, niente DB. Da verificare col
typecheck. Non committare/pushare.

Due file da sostituire integralmente (sono evoluzioni delle versioni attuali):
`nav-model.ts` guadagna `leagueName`; `app-layout.tsx` ricava il leagueId dalla
rotta e rende i gruppi lega/federazione.

---

## 1) SOSTITUISCI `artifacts/mister-web/src/lib/nav-model.ts`

Contenuto esatto:

```ts
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
    leagueId: leagueId ?? null,
    leagueAdminUserId: league?.admin_user_id ?? null,
    leagueName: league?.name ?? null,
    realMoneyEnabled: econ?.realMoneyEnabled ?? false,
  });
}
```

---

## 2) SOSTITUISCI `artifacts/mister-web/src/components/layout/app-layout.tsx`

Contenuto esatto:

```tsx
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  type LucideIcon,
  ShieldAlert,
  Sliders,
  Moon,
  Sun,
  PlusCircle,
  LogOut,
  Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useCurrentUser } from "@/contexts/AuthContext";
import { useNavModel } from "@/lib/nav-model";

type LinkItem = { href: string; label: string; icon: LucideIcon };

function isActive(location: string, href: string): boolean {
  return location === href || (href !== "/" && location.startsWith(href));
}

/** Ricava l'id della lega corrente dalla rotta (es. /leagues/abc/cassa → abc). */
function currentLeagueId(location: string): string | undefined {
  const m = location.match(/^\/leagues\/([^/]+)/);
  if (!m) return undefined;
  return m[1] === "new" ? undefined : m[1];
}

function SidebarLink({ item, location }: { item: LinkItem; location: string }) {
  return (
    <Link href={item.href}>
      <div
        className={cn(
          "flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors",
          isActive(location, item.href)
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
        data-testid={`nav-${item.label.toLowerCase().replace(/ /g, "-")}`}
      >
        <item.icon className="mr-3 h-5 w-5" />
        {item.label}
      </div>
    </Link>
  );
}

function SidebarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="px-3 mt-8 first:mt-0 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider truncate">
        {label}
      </div>
      {children}
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useCurrentUser();

  // Se siamo dentro una lega, il modello riempie anche le altitudini lega/federazione.
  const leagueId = currentLeagueId(location);
  const nav = useNavModel(leagueId);
  const inLeague = nav.league.length > 0;

  const toolItems: LinkItem[] = [
    { href: "/lega/nuova", label: "Crea lega", icon: PlusCircle },
  ];
  const adminItems: LinkItem[] = [
    { href: "/superadmin/templates", label: "Profili", icon: ShieldAlert },
    { href: "/superadmin/algoritmo-voto", label: "Algoritmo voto", icon: Sliders },
  ];

  // Bottom-bar: dentro una lega mostra Home + sezioni di lega; altrimenti le voci globali.
  const mobileItems = inLeague ? [nav.global[0], ...nav.league].slice(0, 5) : nav.global;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar (desktop) */}
      <aside className="w-64 border-r bg-sidebar flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <img
            src="/brand/wordmark_mister_crema.svg"
            alt="Mister"
            className="h-6 w-auto"
            draggable="false"
          />
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          <SidebarGroup label="Menu">
            {nav.global.map((item) => (
              <SidebarLink key={item.id} item={item} location={location} />
            ))}
          </SidebarGroup>

          {nav.league.length > 0 && (
            <SidebarGroup label={nav.leagueName ?? "Lega"}>
              {nav.league.map((item) => (
                <SidebarLink key={item.id} item={item} location={location} />
              ))}
            </SidebarGroup>
          )}

          {nav.federation.length > 0 && (
            <SidebarGroup label="Federazione">
              {nav.federation.map((item) => (
                <SidebarLink key={item.id} item={item} location={location} />
              ))}
            </SidebarGroup>
          )}

          <SidebarGroup label="Strumenti">
            {toolItems.map((item) => (
              <SidebarLink key={item.href} item={item} location={location} />
            ))}
          </SidebarGroup>

          <SidebarGroup label="Amministrazione">
            {adminItems.map((item) => (
              <SidebarLink key={item.href} item={item} location={location} />
            ))}
          </SidebarGroup>

          <SidebarGroup label="Dev">
            <SidebarLink
              item={{ href: "/dev", label: "Indice schermate", icon: Map }}
              location={location}
            />
          </SidebarGroup>
        </nav>

        <div className="p-4 border-t border-sidebar-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold shrink-0">
              {user ? user.display_name.charAt(0).toUpperCase() : "?"}
            </div>
            <div className="text-sm font-medium text-sidebar-foreground truncate">
              {user ? user.display_name : "Non loggato"}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground/70 hover:text-sidebar-foreground h-7 w-7"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {user && (
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground/70 hover:text-sidebar-foreground h-7 w-7"
                onClick={logout}
                title="Esci"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b bg-card flex items-center justify-between px-6 md:hidden">
          <img
            src="/brand/wordmark_mister.svg"
            alt="Mister"
            className="h-5 w-auto"
            draggable="false"
          />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </header>

        <div className="flex-1 overflow-auto bg-muted/30">
          <div className="mx-auto max-w-6xl p-4 md:p-8 pb-24 md:pb-8">{children}</div>
        </div>

        {/* Bottom nav (mobile) — contestuale: voci globali o sezioni di lega */}
        <nav className="md:hidden border-t bg-card flex items-stretch justify-around h-16 shrink-0">
          {mobileItems.map((item) => (
            <Link key={item.id} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 h-full px-2 text-[11px] font-medium transition-colors text-center",
                  isActive(location, item.href) ? "text-primary" : "text-muted-foreground",
                )}
                data-testid={`mobnav-${item.id}`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </div>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
```

---

## 3) Verifica
- Typecheck/build di `mister-web`: 0 errori.
- Aprendo una pagina di lega (es. `/leagues/<ID>/cassa`) come admin, la sidebar
  desktop mostra, oltre a "Menu", un gruppo col NOME della lega (Panoramica,
  Mercato, Cassa se attiva, Impostazioni) e un gruppo "Federazione". Su mobile la
  bottom-bar mostra Home + le sezioni di lega.
- Fuori da una lega (es. `/leagues`) restano solo le voci globali, come prima.
- NON committare e NON fare push.

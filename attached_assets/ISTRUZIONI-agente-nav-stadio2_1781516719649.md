# Istruzioni per l'agente Replit — Stadio 2: guscio responsive

Fa due cose: (a) un piccolo fix di gating in `nav-model.ts`, (b) riscrive
`AppLayout` perché consumi il modello di navigazione e aggiunga la bottom-bar su
mobile (oggi su telefono c'è solo il logo). Solo frontend, niente DB. Da
verificare col typecheck del progetto. Non committare/pushare.

---

## 1) FIX GATING — `artifacts/mister-web/src/lib/nav-model.ts`

### 1a) Import
Sostituisci:
```ts
import { useGetLeague } from "@workspace/api-client-react";
```
con:
```ts
import { useGetLeague, getGetLeagueQueryKey } from "@workspace/api-client-react";
```

### 1b) Disabilita la query quando non c'è leagueId
Sostituisci:
```ts
  const { data: league } = useGetLeague(leagueId ?? "");
```
con:
```ts
  const { data: league } = useGetLeague(leagueId ?? "", {
    query: { enabled: !!leagueId, queryKey: getGetLeagueQueryKey(leagueId ?? "") },
  });
```
(Evita la richiesta a vuoto per la lega con id "" nel contesto globale. Se il
typecheck dovesse lamentare un campo mancante nelle opzioni, ripristina la riga
singola `useGetLeague(leagueId ?? "")` e segnalalo.)

---

## 2) SOSTITUISCI `artifacts/mister-web/src/components/layout/app-layout.tsx`

Sostituisci l'INTERO contenuto del file con esattamente questo:

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
      <div className="px-3 mt-8 first:mt-0 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
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

  // Contesto globale (nessuna lega): il modello restituisce solo le voci globali.
  const nav = useNavModel();

  const toolItems: LinkItem[] = [
    { href: "/lega/nuova", label: "Crea lega", icon: PlusCircle },
  ];
  const adminItems: LinkItem[] = [
    { href: "/superadmin/templates", label: "Profili", icon: ShieldAlert },
    { href: "/superadmin/algoritmo-voto", label: "Algoritmo voto", icon: Sliders },
  ];

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

        {/* Bottom nav (mobile) — chiude il buco di navigazione su telefono */}
        <nav className="md:hidden border-t bg-card flex items-stretch justify-around h-16 shrink-0">
          {nav.global.map((item) => (
            <Link key={item.id} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 h-full px-3 text-xs font-medium transition-colors",
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
- Su desktop la sidebar mostra Menu (Home, Le mie leghe, Giocatori) + Strumenti
  (Crea lega) + Amministrazione + Dev; sparisce il "Cruscotto" e il link
  "Competizione" cablato.
- Su mobile (larghezza < md) compare una bottom-bar con Home · Le mie leghe ·
  Giocatori: prima non c'era alcun menu, solo il logo.
- NON committare e NON fare push.

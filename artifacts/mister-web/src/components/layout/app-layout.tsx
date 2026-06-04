import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Trophy, 
  Users, 
  LayoutDashboard, 
  ShieldAlert,
  Sliders,
  Moon,
  Sun,
  Shield,
  Flag,
  PlusCircle,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useCurrentUser } from "@/contexts/AuthContext";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useCurrentUser();

  const navItems = [
    { href: "/", label: "Cruscotto", icon: LayoutDashboard },
    { href: "/leagues", label: "Le mie leghe", icon: Trophy },
    { href: "/squadra/formazione", label: "Formazione", icon: Shield },
    { href: "/competizione/comp-mvp-campionato-2024", label: "Competizione", icon: Flag },
    { href: "/lega/nuova", label: "Crea lega", icon: PlusCircle },
    { href: "/players", label: "Giocatori", icon: Users },
  ];

  const adminItems = [
    { href: "/superadmin/templates", label: "Profili", icon: ShieldAlert },
    { href: "/superadmin/algoritmo-voto", label: "Algoritmo voto", icon: Sliders },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
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
          <div className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Menu
          </div>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors",
                  location === item.href || (item.href !== "/" && location.startsWith(item.href))
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </div>
            </Link>
          ))}

          <div className="px-3 mt-8 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Amministrazione
          </div>
          {adminItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors",
                  location === item.href || location.startsWith(item.href)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
                data-testid={`nav-admin-${item.label.toLowerCase()}`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </div>
            </Link>
          ))}
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
        </header>
        <div className="flex-1 overflow-auto bg-muted/30">
          <div className="mx-auto max-w-6xl p-4 md:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
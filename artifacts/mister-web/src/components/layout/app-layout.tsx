import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Trophy, 
  Users, 
  LayoutDashboard, 
  Settings, 
  ShieldAlert,
  Moon,
  Sun
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/leagues", label: "My Leagues", icon: Trophy },
    { href: "/players", label: "Players", icon: Users },
  ];

  const adminItems = [
    { href: "/superadmin/templates", label: "Templates", icon: ShieldAlert },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="font-serif font-bold text-2xl text-sidebar-primary tracking-tight">MISTER</div>
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
            System Admin
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

        <div className="p-4 border-t border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold">
              U
            </div>
            <div className="text-sm font-medium text-sidebar-foreground">Demo User</div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b bg-card flex items-center justify-between px-6 md:hidden">
          <div className="font-serif font-bold text-xl text-primary tracking-tight">MISTER</div>
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
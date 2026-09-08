import { useState } from "react";
import { useLocation } from "wouter";
import { useCurrentUser } from "@/contexts/AuthContext";
import { apiUrl } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "wouter";

export default function RegisterPage() {
  const { register } = useCurrentUser();
  const [, navigate] = useLocation();
  // T171: dopo login/registrazione si torna dove si stava andando (es. invito nominale)
  const nextParam = new URLSearchParams(window.location.search).get("next");
  const nextSafe = nextParam && nextParam.startsWith("/") ? nextParam : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await register(email, password, displayName);
      navigate(nextSafe ?? "/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-serif text-3xl font-bold text-primary tracking-tight">MISTER</h1>
          <p className="text-sm text-muted-foreground mt-1">Fantacalcio manageriale</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="font-serif text-xl">Crea account</CardTitle>
            <CardDescription>
              Un account per email. La verifica email arriverà in una fase successiva.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Nome visualizzato</Label>
                <Input
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Es. Marco Rossi"
                  required
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Email</Label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nome@esempio.it"
                  required
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Password <span className="text-muted-foreground/60">(min 8 caratteri)</span>
                </Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Creazione account..." : "Crea account"}
              </Button>
            </form>
        <div style={{ margin: "14px 0", textAlign: "center" }}>
          <a href={apiUrl("/api/auth/google")}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px",
              border: "1px solid #1f473340", borderRadius: 8, textDecoration: "none",
              color: "var(--ink, #1f2937)", fontFamily: "inherit", fontSize: 14, background: "#fff" }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
            Accedi con Google
          </a>
        </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Hai già un account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}

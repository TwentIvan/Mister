import { useState } from "react";
import { useLocation } from "wouter";
import { useCurrentUser } from "@/contexts/AuthContext";
import { apiUrl } from "@workspace/api-client-react";
import { Link } from "wouter";

export default function LoginPage() {
  const { login } = useCurrentUser();
  const [, navigate] = useLocation();
  // T171: dopo login/registrazione si torna dove si stava andando (es. invito nominale)
  const nextParam = new URLSearchParams(window.location.search).get("next");
  const nextSafe = nextParam && nextParam.startsWith("/") ? nextParam : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await login(email, password);
      navigate(nextSafe ?? "/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--cream)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Wordmark */}
        <div style={{ textAlign: "center" }}>
          <img
            src="/brand/wordmark_mister.svg"
            alt="Mister"
            style={{ height: 48, display: "block", margin: "0 auto" }}
          />
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--muted)", marginTop: 8, marginBottom: 0 }}>
            Fantacalcio manageriale
          </p>
        </div>

        {/* Card login */}
        <div style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "24px 22px",
        }}>
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 18, color: "var(--green)", margin: 0 }}>
              Accedi
            </h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
              Inserisci email e password del tuo account.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 5, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nome@esempio.it"
                required
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "9px 12px", borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "var(--cream)",
                  color: "var(--green-d)",
                  fontFamily: "var(--font-sans)", fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 5, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "9px 12px", borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "var(--cream)",
                  color: "var(--green-d)",
                  fontFamily: "var(--font-sans)", fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: "var(--danger, #bf3b30)", margin: 0, fontFamily: "var(--font-sans)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              style={{
                width: "100%", padding: "10px 0",
                background: isPending ? "var(--green-l)" : "var(--green)",
                color: "var(--cream)", border: "none",
                borderRadius: 9, cursor: isPending ? "not-allowed" : "pointer",
                fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13,
                letterSpacing: "0.03em", transition: "background 0.15s",
              }}
            >
              {isPending ? "Accesso in corso…" : "Accedi"}
            </button>
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
        </div>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", margin: 0 }}>
          Non hai un account?{" "}
          <Link href={nextSafe ? `/register?next=${encodeURIComponent(nextSafe)}` : "/register"} style={{ color: "var(--green)", fontWeight: 600 }}>
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}

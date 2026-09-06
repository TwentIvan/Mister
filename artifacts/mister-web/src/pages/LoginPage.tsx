import { useState } from "react";
import { useLocation } from "wouter";
import { useCurrentUser } from "@/contexts/AuthContext";
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

export default function BrandPage() {
  const palette: { name: string; var: string; hex: string; light?: boolean }[] = [
    { name: "cream",      var: "--cream",      hex: "#efe6d3" },
    { name: "paper",      var: "--paper",      hex: "#f7f1e4" },
    { name: "cream2",     var: "--cream2",     hex: "#e7dcc4" },
    { name: "slot",       var: "--slot",       hex: "#cdbf9d" },
    { name: "green",      var: "--green",      hex: "#1f4733", light: true },
    { name: "green-d",    var: "--green-d",    hex: "#15301f", light: true },
    { name: "green-l",    var: "--green-l",    hex: "#2e6047", light: true },
    { name: "gold",       var: "--gold",       hex: "#c8922b", light: true },
    { name: "gold-l",     var: "--gold-l",     hex: "#e6b84d" },
    { name: "live",       var: "--live",       hex: "#e2554e", light: true },
    { name: "danger",     var: "--danger",     hex: "#bf3b30", light: true },
    { name: "muted",      var: "--muted-brand",hex: "#8a8266", light: true },
    { name: "line",       var: "--line",       hex: "#d8ccae" },
    { name: "line-soft",  var: "--line-soft",  hex: "#e4dcc6" },
  ];

  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        color: "var(--green)",
        padding: "2rem",
        maxWidth: "860px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontFeatureSettings: '"ss01"',
          fontOpticalSizing: "auto",
          letterSpacing: "-0.05em",
          lineHeight: 0.9,
          fontSize: "3.5rem",
          marginBottom: "2.5rem",
          color: "var(--green)",
        }}
      >
        Mister
      </h1>

      {/* ── Marchio ── */}
      <section style={{ marginBottom: "3rem" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontFeatureSettings: '"ss01"',
            fontSize: "0.65rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--muted-brand)",
            marginBottom: "1.25rem",
          }}
        >
          Marchio
        </h2>

        <div style={{ display: "flex", gap: "2.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          {/* Wordmark su carta */}
          <div
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: "4px",
              padding: "1.25rem 2rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <img src="/brand/wordmark_mister.svg" alt="Wordmark Mister" style={{ height: "2rem" }} draggable={false} />
            <span style={{ fontSize: "0.6rem", color: "var(--muted-brand)", letterSpacing: "0.1em" }}>
              wordmark · carta
            </span>
          </div>

          {/* Wordmark su verde */}
          <div
            style={{
              background: "var(--green)",
              borderRadius: "4px",
              padding: "1.25rem 2rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <img
              src="/brand/wordmark_mister.svg"
              alt="Wordmark Mister (chiaro)"
              style={{ height: "2rem", filter: "brightness(0) invert(1) opacity(0.9)" }}
              draggable={false}
            />
            <span style={{ fontSize: "0.6rem", color: "var(--cream2)", letterSpacing: "0.1em" }}>
              wordmark · verde
            </span>
          </div>

          {/* Icona M */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <img src="/brand/icona_M.svg" alt="Icona M" style={{ height: "64px", borderRadius: "14px" }} draggable={false} />
            <span style={{ fontSize: "0.6rem", color: "var(--muted-brand)", letterSpacing: "0.1em" }}>
              icona · app
            </span>
          </div>

          {/* Icona M animata */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <img src="/brand/icona_M_animata.svg" alt="Icona M animata" style={{ height: "64px", borderRadius: "14px" }} draggable={false} />
            <span style={{ fontSize: "0.6rem", color: "var(--muted-brand)", letterSpacing: "0.1em" }}>
              icona · animata (M↔W)
            </span>
          </div>

          {/* Segno M su carta */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <img
              src="/brand/segno_M_carta.svg"
              alt="Segno M carta"
              style={{ height: "64px" }}
              draggable={false}
            />
            <span style={{ fontSize: "0.6rem", color: "var(--muted-brand)", letterSpacing: "0.1em" }}>
              segno · carta
            </span>
          </div>
        </div>
      </section>

      {/* ── Acquaforte (uso raro) ── */}
      <section style={{ marginBottom: "3rem" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontFeatureSettings: '"ss01"',
            fontSize: "0.65rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--muted-brand)",
            marginBottom: "1.25rem",
          }}
        >
          Acquaforte — accento hero (raro)
        </h2>
        <div
          style={{
            background: "var(--green-d)",
            borderRadius: "4px",
            padding: "1.5rem",
            display: "inline-flex",
            gap: "1.5rem",
            alignItems: "center",
          }}
        >
          <img
            src="/brand/mister_volto_inciso.png"
            alt="Mister volto inciso"
            style={{ height: "120px", opacity: 0.92 }}
            draggable={false}
          />
          <p style={{ fontSize: "0.7rem", color: "var(--cream2)", lineHeight: 1.7, maxWidth: "220px" }}>
            Solo in momenti hero: splash, onboarding, stati vuoti significativi.
            <br />
            Non sulle facce dei calciatori. Non come texture d'interfaccia.
          </p>
        </div>
      </section>

      {/* ── Palette ── */}
      <section style={{ marginBottom: "3rem" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontFeatureSettings: '"ss01"',
            fontSize: "0.65rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--muted-brand)",
            marginBottom: "1.25rem",
          }}
        >
          Palette
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: "0.75rem" }}>
          {palette.map((c) => (
            <div key={c.var} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div
                style={{
                  height: "56px",
                  borderRadius: "4px",
                  background: c.hex,
                  border: "1px solid var(--line)",
                }}
              />
              <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--green)", fontWeight: 600 }}>
                {c.name}
              </span>
              <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "var(--muted-brand)" }}>
                {c.hex}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tipografia ── */}
      <section style={{ marginBottom: "3rem" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontFeatureSettings: '"ss01"',
            fontSize: "0.65rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--muted-brand)",
            marginBottom: "1.25rem",
          }}
        >
          Tipografia
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Fraunces */}
          <div
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: "4px",
              padding: "1.5rem 2rem",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontFeatureSettings: '"ss01"',
                fontOpticalSizing: "auto",
                letterSpacing: "-0.05em",
                lineHeight: 0.9,
                fontSize: "3rem",
                color: "var(--green)",
                marginBottom: "0.75rem",
              }}
            >
              Fraunces
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontFeatureSettings: '"ss01"',
                fontOpticalSizing: "auto",
                fontSize: "1.1rem",
                color: "var(--green-l)",
                marginBottom: "1rem",
              }}
            >
              Il fantacalcio manageriale — display, heading, wordmark
            </div>
            <div style={{ display: "flex", gap: "2rem", fontSize: "0.65rem", color: "var(--muted-brand)" }}>
              <span>weight 300 · 400 · 500 · 700 · <strong>800</strong></span>
              <span>opsz 9..144</span>
              <span>ss01 ✓</span>
              <span>optical-sizing auto</span>
            </div>
          </div>

          {/* JetBrains Mono */}
          <div
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: "4px",
              padding: "1.5rem 2rem",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: "2rem",
                color: "var(--green)",
                marginBottom: "0.75rem",
                letterSpacing: "-0.02em",
              }}
            >
              JetBrains Mono
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.9rem",
                color: "var(--green-l)",
                marginBottom: "1rem",
              }}
            >
              487.50 FM · 23/38 · Serie A 2024/25 — dati, etichette, body
            </div>
            <div style={{ display: "flex", gap: "2rem", fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--muted-brand)" }}>
              <span>weight 400 · 500 · 700</span>
              <span>corpo e dati</span>
              <span>niente DM Sans</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Regola colore segno ── */}
      <section>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontFeatureSettings: '"ss01"',
            fontSize: "0.65rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--muted-brand)",
            marginBottom: "1.25rem",
          }}
        >
          Regola colore segno
        </h2>
        <div
          style={{
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono)",
            lineHeight: 1.8,
            color: "var(--green)",
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: "4px",
            padding: "1.25rem 1.5rem",
          }}
        >
          <p>Nodi → sempre oro <code style={{ background: "var(--gold)", color: "#fff", padding: "1px 6px", borderRadius: "2px" }}>#c8922b</code></p>
          <p>Linee su verde → oro chiaro <code style={{ background: "var(--gold-l)", color: "#1f4733", padding: "1px 6px", borderRadius: "2px" }}>#e6b84d</code></p>
          <p>Linee su carta → verde <code style={{ background: "var(--green)", color: "#efe6d3", padding: "1px 6px", borderRadius: "2px" }}>#1f4733</code></p>
          <p style={{ color: "var(--danger)", marginTop: "0.5rem" }}>
            ✗ Mai linee e nodi dello stesso colore · Mai tutto-oro su crema
          </p>
        </div>
      </section>
    </div>
  );
}

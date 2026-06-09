import { Link } from "wouter";

/* DevPage — indice di navigazione per sviluppo/verifica.
   Accessibile a /dev. Grezza per design. Non è nav di prodotto. */

type Item = { path: string; label: string; note?: string };
type Group = { label: string; items: Item[] };

const L = "league-juve";
const CAMP = "comp-mvp-campionato-2024";
const COPPA = "comp-mvp-coppa-2025";
const FT1 = "ft-mvp-1";
const AUC = "auc-EFcnq18v";
const PL = "1863"; // C. Immobile

const GROUPS: Group[] = [
  {
    label: "Auth",
    items: [
      { path: "/login",    label: "/login" },
      { path: "/register", label: "/register" },
    ],
  },
  {
    label: "Hub / Lega (con sidebar)",
    items: [
      { path: "/",                                  label: "/ — Dashboard" },
      { path: "/leagues",                           label: "/leagues — Lista leghe" },
      { path: `/leagues/new`,                       label: "/leagues/new — Setup lega" },
      { path: `/lega/nuova`,                        label: "/lega/nuova — Setup lega (alias)" },
      { path: `/leagues/${L}`,                      label: `/leagues/${L} — Dettaglio lega` },
      { path: `/leagues/${L}/config`,               label: `/leagues/${L}/config — Config lega` },
      { path: `/leagues/${L}/federation`,           label: `/leagues/${L}/federation — Federation rules` },
      { path: `/leagues/${L}/markets`,              label: `/leagues/${L}/markets — Mercati` },
    ],
  },
  {
    label: "Hub lega / Feed (mobile, senza sidebar)",
    items: [
      { path: `/hub/${L}`,       label: `/hub/${L} — Hub lega mobile` },
      { path: `/feed/${L}`,      label: `/feed/${L} — Feed con lega` },
      { path: `/feed`,           label: `/feed — Feed senza lega` },
    ],
  },
  {
    label: "Competizione",
    items: [
      { path: `/leagues/${L}/competitions/${CAMP}`, label: `/leagues/${L}/competitions/${CAMP} — Competition detail (sidebar)` },
      { path: `/competizione/${CAMP}`,              label: `/competizione/${CAMP} — Competizione page` },
      { path: `/partita/1`,                         label: `/partita/1 — Match detail (giornata 1, completata, con voti)` },
    ],
  },
  {
    label: "Classifica (mobile)",
    items: [
      { path: `/classifica/${CAMP}`, label: `/classifica/${CAMP} — Classifica campionato` },
    ],
  },
  {
    label: "Coppa (mobile)",
    items: [
      { path: `/coppa/${COPPA}`, label: `/coppa/${COPPA} — Gironi + tabellone` },
    ],
  },
  {
    label: "Rosa / Scheda (mobile)",
    items: [
      { path: `/rosa/${FT1}`,   label: `/rosa/${FT1} — Rosa squadra` },
      { path: `/scheda/${PL}`,  label: `/scheda/${PL} — Scheda giocatore (Immobile)` },
      { path: `/players`,       label: `/players — Lista giocatori (admin)` },
    ],
  },
  {
    label: "Formazione",
    items: [
      { path: `/squadra/formazione`,                         label: `/squadra/formazione — Wrapper formazione (sidebar)` },
      { path: `/formazione/${CAMP}/${FT1}`,                  label: `/formazione/${CAMP}/${FT1} — Mobile`, note: "mobile" },
      { path: `/formazione-d/${CAMP}/${FT1}`,                label: `/formazione-d/${CAMP}/${FT1} — Desktop`, note: "desktop" },
    ],
  },
  {
    label: "Asta",
    items: [
      { path: `/asta/${AUC}`,  label: `/asta/${AUC} — Asta live (sidebar)` },
      { path: `/m/${AUC}`,     label: `/m/${AUC} — Asta mobile (no sidebar)` },
    ],
  },
  {
    label: "Superadmin",
    items: [
      { path: `/superadmin/templates`,     label: `/superadmin/templates — Template profili` },
      { path: `/superadmin/algoritmo-voto`, label: `/superadmin/algoritmo-voto — Algoritmo voto` },
    ],
  },
  {
    label: "Altro",
    items: [
      { path: `/brand`, label: `/brand — Brand page` },
    ],
  },
];

export default function DevPage() {
  return (
    <div style={{ padding: "24px 32px", fontFamily: "monospace", fontSize: 13, lineHeight: 1.7, maxWidth: 760 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>🛠 Mister — indice schermate dev</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 12 }}>
        Rotte dal router · ID dal seed · lega: <b>{L}</b> · campionato: <b>{CAMP}</b> · coppa: <b>{COPPA}</b>
      </p>
      {GROUPS.map((g) => (
        <section key={g.label} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: 6 }}>
            {g.label}
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {g.items.map((item) => (
              <li key={item.path} style={{ padding: "1px 0" }}>
                <Link href={item.path} style={{ color: "#1a6fd4", textDecoration: "none" }}>
                  {item.label}
                </Link>
                {item.note && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: "#999", background: "#f0f0f0", borderRadius: 3, padding: "1px 5px" }}>
                    {item.note}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

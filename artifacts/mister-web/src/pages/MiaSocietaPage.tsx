/**
 * MiaSocietaPage (T173.c) — /leagues/:id/societa
 * Tab CLUB: maglia grande (12 fantasie, anteprime disegnate, 4 colori da
 * palette digitale 64), stemma in badge separato, dati società e profilo.
 * Tab ROSA: la rosa per reparto (da arricchire).
 */

import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import {
  customFetch,
  useGetLeagueInvite, getGetLeagueInviteQueryKey,
  useGetFantaTeamRosa, getGetFantaTeamRosaQueryKey,
  useUpdateFantaTeam,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Save, Shirt } from "lucide-react";

// ─── Fantasie maglia ──────────────────────────────────────────────────────────
export type JerseyPattern =
  | "solid" | "stripes_vertical" | "pinstripes" | "stripes_horizontal"
  | "chest_band" | "halved" | "quarters" | "sash" | "chevron"
  | "sleeves" | "checkered" | "cross";

export const PATTERNS: Array<{ id: JerseyPattern; label: string }> = [
  { id: "solid", label: "Tinta unita" },
  { id: "stripes_vertical", label: "Palato" },
  { id: "pinstripes", label: "Gessato" },
  { id: "stripes_horizontal", label: "Cerchiato" },
  { id: "chest_band", label: "Blucerchiata" },
  { id: "halved", label: "Metà" },
  { id: "quarters", label: "Quarti" },
  { id: "sash", label: "Banda" },
  { id: "chevron", label: "V sul petto" },
  { id: "sleeves", label: "Maniche" },
  { id: "checkered", label: "Scacchi" },
  { id: "cross", label: "Croce" },
];

const SHIRT = "M30 12 L42 6 Q50 12 58 6 L70 12 L84 24 L74 36 L70 32 L70 90 L30 90 L30 32 L26 36 L16 24 Z";

function Maglia({ c1, c2, c3, c4, pattern, size = 112 }: {
  c1: string; c2: string; c3?: string; c4?: string; pattern: JerseyPattern; size?: number;
}) {
  const t = c3 ?? c2;
  const q = c4 ?? c1;
  const clip = useMemo(() => `jc-${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }} className="drop-shadow">
      <defs><clipPath id={clip}><path d={SHIRT} /></clipPath></defs>
      <path d={SHIRT} fill={c1} />
      <g clipPath={`url(#${clip})`}>
        {pattern === "stripes_vertical" && [30, 42, 54, 66].map((x, i) => (
          <rect key={x} x={x} y={0} width={7} height={100} fill={i % 2 ? t : c2} />
        ))}
        {pattern === "pinstripes" && [30, 37, 44, 51, 58, 65, 72].map((x) => (
          <rect key={x} x={x} y={0} width={2} height={100} fill={c2} />
        ))}
        {pattern === "stripes_horizontal" && [20, 36, 52, 68, 84].map((y, i) => (
          <rect key={y} x={0} y={y} width={100} height={8} fill={i % 2 ? t : c2} />
        ))}
        {pattern === "chest_band" && (<>
          <rect x={0} y={38} width={100} height={5} fill={t} />
          <rect x={0} y={43} width={100} height={7} fill={c2} />
          <rect x={0} y={50} width={100} height={5} fill={q} />
        </>)}
        {pattern === "halved" && <rect x={50} y={0} width={50} height={100} fill={c2} />}
        {pattern === "quarters" && (<>
          <rect x={50} y={0} width={50} height={50} fill={c2} />
          <rect x={0} y={50} width={50} height={50} fill={t} />
          <rect x={50} y={50} width={50} height={50} fill={q} />
        </>)}
        {pattern === "sash" && <path d="M12 0 L34 0 L88 100 L66 100 Z" fill={c2} stroke={t} strokeWidth="2" />}
        {pattern === "chevron" && (<>
          <path d="M20 30 L50 52 L80 30 L80 42 L50 64 L20 42 Z" fill={c2} />
          <path d="M20 26 L50 48 L80 26" fill="none" stroke={t} strokeWidth="3" />
        </>)}
        {pattern === "sleeves" && (<>
          <path d="M30 12 L16 24 L26 36 L30 32 Z" fill={c2} />
          <path d="M70 12 L84 24 L74 36 L70 32 Z" fill={c2} />
          <rect x={28} y={8} width={44} height={0} fill={c2} />
        </>)}
        {pattern === "checkered" && [0,1,2,3,4].flatMap((r) => [0,1,2,3,4].map((c) => (
          (r + c) % 2 === 0 ? <rect key={`${r}-${c}`} x={c*20} y={r*20} width={20} height={20} fill={c2} /> : null
        )))}
        {pattern === "cross" && (<>
          <rect x={44} y={0} width={12} height={100} fill={c2} />
          <rect x={0} y={34} width={100} height={12} fill={c2} />
          <rect x={47} y={0} width={6} height={100} fill={t} />
          <rect x={0} y={37} width={100} height={6} fill={t} />
        </>)}
      </g>
      <path d={SHIRT} fill="none" stroke={t} strokeWidth="2.5" />
      <path d="M42 6 Q50 12 58 6 L56 14 Q50 18 44 14 Z" fill={q} />
    </svg>
  );
}

/** Stemma separato: scudo con le iniziali nei colori sociali (segnaposto T174). */
function Stemma({ c1, c2, c4, initials, size = 72 }: { c1: string; c2: string; c4?: string; initials: string; size?: number }) {
  const q = c4 ?? c1;
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }} className="drop-shadow">
      <path d="M50 4 L88 16 L88 52 Q88 80 50 96 Q12 80 12 52 L12 16 Z" fill={c2} stroke={q} strokeWidth="4" />
      <path d="M50 12 L80 21 L80 51 Q80 73 50 87 Q20 73 20 51 L20 21 Z" fill={c1} />
      <text x="50" y="60" textAnchor="middle" fontSize="30" fontWeight="bold" fontFamily="serif" fill={c2}>{initials}</text>
    </svg>
  );
}

// ─── Palette digitale 64 ──────────────────────────────────────────────────────
function hslHex(h: number, s: number, l: number): string {
  const a = (s * Math.min(l, 1 - l)) / 100 * 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - (a / 100) * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
const PALETTE: string[] = (() => {
  const out: string[] = [];
  const hues = [0, 18, 36, 52, 90, 140, 165, 190, 210, 230, 262, 290, 320, 345];
  for (const h of hues) for (const l of [28, 42, 56, 72]) out.push(hslHex(h, 78, l));
  out.push("#000000", "#3a3a3a", "#6b6b6b", "#9c9c9c", "#c9c9c9", "#efe6d3", "#f7f3ea", "#ffffff");
  return out; // 14×4 + 8 = 64
})();

const ROLE_ORDER = ["P", "D", "C", "A"] as const;
const ROLE_LABEL: Record<string, string> = { P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti" };
const COLOR_KEYS = ["color_primary", "color_secondary", "color_tertiary", "color_quaternary"] as const;

export default function MiaSocietaPage() {
  const [, params] = useRoute("/leagues/:id/societa");
  const leagueId = params?.id ?? "";
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: inviteInfo, isLoading: slotsLoading } = useGetLeagueInvite(leagueId, {
    query: { enabled: !!leagueId, queryKey: getGetLeagueInviteQueryKey(leagueId) },
  });
  const mySlot = (inviteInfo?.slots ?? []).find((s) => s.manager_user_id === user?.id) ?? null;

  const { data: rosa, isLoading: rosaLoading } = useGetFantaTeamRosa(mySlot?.id ?? "", {
    query: { enabled: !!mySlot?.id, queryKey: getGetFantaTeamRosaQueryKey(mySlot?.id ?? "") },
  });

  const update = useUpdateFantaTeam();
  const [form, setForm] = useState({
    name: "", name_auction: "", coach_name: "",
    color_primary: "#1f4733", color_secondary: "#efe6d3",
    color_tertiary: "#efe6d3", color_quaternary: "#1f4733",
    jersey_pattern: "solid" as JerseyPattern,
  });
  const [activeColor, setActiveColor] = useState<(typeof COLOR_KEYS)[number]>("color_primary");
  const [profilo, setProfilo] = useState({ first_name: "", last_name: "" });

  useEffect(() => {
    if (rosa) {
      const j = rosa.jersey as { primaryColor?: string; secondaryColor?: string; tertiaryColor?: string; quaternaryColor?: string; pattern?: JerseyPattern } | null;
      setForm((f) => ({
        ...f,
        name: rosa.teamName ?? "",
        name_auction: mySlot?.name_auction ?? rosa.teamName ?? "",
        color_primary: j?.primaryColor ?? "#1f4733",
        color_secondary: j?.secondaryColor ?? "#efe6d3",
        color_tertiary: j?.tertiaryColor ?? j?.secondaryColor ?? "#efe6d3",
        color_quaternary: j?.quaternaryColor ?? j?.primaryColor ?? "#1f4733",
        jersey_pattern: j?.pattern ?? "solid",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosa?.fantaTeamId]);

  const saveProfilo = () => {
    if (!profilo.first_name && !profilo.last_name) return;
    void customFetch("/api/auth/me", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: profilo.first_name || null, last_name: profilo.last_name || null }),
    }).then(() => toast({ title: "Profilo aggiornato" }))
      .catch(() => toast({ title: "Profilo non aggiornato", variant: "destructive" }));
  };

  const save = () => {
    if (!mySlot?.id) return;
    update.mutate(
      { leagueId, id: mySlot.id, data: {
        name: form.name || undefined,
        name_auction: form.name_auction || undefined,
        coach_name: form.coach_name || null,
        color_primary: form.color_primary,
        color_secondary: form.color_secondary,
        color_tertiary: form.color_tertiary,
        color_quaternary: form.color_quaternary,
        jersey_pattern: form.jersey_pattern,
      } },
      {
        onSuccess: () => {
          toast({ title: "Società aggiornata", description: "I nuovi colori sventolano già" });
          void queryClient.invalidateQueries({ queryKey: getGetFantaTeamRosaQueryKey(mySlot.id) });
          void queryClient.invalidateQueries({ queryKey: getGetLeagueInviteQueryKey(leagueId) });
        },
        onError: (e: unknown) => {
          const err = e as { data?: { error?: string } };
          toast({ title: "Salvataggio fallito", description: err?.data?.error ?? "Errore", variant: "destructive" });
        },
      },
    );
  };

  if (slotsLoading) return <div className="mx-auto max-w-4xl p-4"><Skeleton className="h-40 w-full" /></div>;
  if (!mySlot) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          Non hai ancora una squadra in questa lega: chiedi all'admin il tuo invito personale.
        </CardContent></Card>
      </div>
    );
  }

  const initials = (form.name || rosa?.teamName || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      {/* ── Intestazione: maglia grande + stemma in badge separato ── */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-6 p-6"
          style={{ background: `linear-gradient(120deg, ${form.color_primary}20, ${form.color_secondary}40)` }}>
          <Maglia c1={form.color_primary} c2={form.color_secondary} c3={form.color_tertiary}
            c4={form.color_quaternary} pattern={form.jersey_pattern} size={148} />
          <Stemma c1={form.color_primary} c2={form.color_secondary} c4={form.color_quaternary} initials={initials} />
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-4xl font-bold truncate">{form.name || rosa?.teamName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {rosa?.leagueName} · <span className="font-mono font-bold text-foreground">{rosa?.creditsRemaining ?? "—"} FM</span> residui
            </p>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="club">
        <TabsList>
          <TabsTrigger value="club">Club</TabsTrigger>
          <TabsTrigger value="rosa">Rosa</TabsTrigger>
        </TabsList>

        {/* ══ TAB CLUB ══ */}
        <TabsContent value="club" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Shirt className="h-4 w-4" />Maglia</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* fantasie con anteprima disegnata */}
              <div>
                <Label className="text-xs text-muted-foreground">Fantasia</Label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-1">
                  {PATTERNS.map((pt) => (
                    <button key={pt.id} type="button"
                      onClick={() => setForm((f) => ({ ...f, jersey_pattern: pt.id }))}
                      className={`flex flex-col items-center gap-0.5 rounded-lg border p-1.5 transition-colors ${form.jersey_pattern === pt.id ? "border-[#1f4733] bg-[#1f4733]/10" : "border-border hover:border-[#1f4733]/40"}`}>
                      <Maglia c1={form.color_primary} c2={form.color_secondary} c3={form.color_tertiary}
                        c4={form.color_quaternary} pattern={pt.id} size={44} />
                      <span className="text-[9px] font-mono text-muted-foreground leading-tight text-center">{pt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 slot colore + palette 64 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label className="text-xs text-muted-foreground">Colori</Label>
                  {COLOR_KEYS.map((k, i) => (
                    <button key={k} type="button" onClick={() => setActiveColor(k)}
                      title={`${i + 1}º colore`}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${activeColor === k ? "border-[#1f4733] scale-110 shadow" : "border-border"}`}
                      style={{ background: form[k] }} />
                  ))}
                  <span className="text-[10px] font-mono text-muted-foreground ml-1">
                    stai modificando il {COLOR_KEYS.indexOf(activeColor) + 1}º
                  </span>
                </div>
                <div className="grid grid-cols-16 gap-1" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
                  {PALETTE.map((hex) => (
                    <button key={hex} type="button" onClick={() => setForm((f) => ({ ...f, [activeColor]: hex }))}
                      className={`aspect-square rounded-sm border transition-transform hover:scale-110 ${form[activeColor] === hex ? "ring-2 ring-[#1f4733] ring-offset-1" : "border-black/10"}`}
                      style={{ background: hex }} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Dati società</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome società</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Voce asta</Label>
                  <Input value={form.name_auction} onChange={(e) => setForm((f) => ({ ...f, name_auction: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Allenatore</Label>
                  <Input placeholder="Mister…" value={form.coach_name} onChange={(e) => setForm((f) => ({ ...f, coach_name: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-dashed">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome (manager)</Label>
                  <Input value={profilo.first_name} onChange={(e) => setProfilo((p) => ({ ...p, first_name: e.target.value }))} onBlur={saveProfilo} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cognome</Label>
                  <Input value={profilo.last_name} onChange={(e) => setProfilo((p) => ({ ...p, last_name: e.target.value }))} onBlur={saveProfilo} />
                </div>
              </div>
              <Button onClick={save} disabled={update.isPending} className="gap-2 bg-[#1f4733] text-[#efe6d3] hover:bg-[#1f4733]/90">
                <Save className="h-4 w-4" />
                {update.isPending ? "Salvataggio…" : "Salva società"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ TAB ROSA ══ */}
        <TabsContent value="rosa">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">La rosa</CardTitle></CardHeader>
            <CardContent>
              {rosaLoading ? <Skeleton className="h-40 w-full" /> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {ROLE_ORDER.map((role) => {
                    const players = (rosa?.players ?? []).filter((p) => p.roleClassic === role);
                    return (
                      <div key={role}>
                        <p className="text-xs font-mono font-bold text-muted-foreground uppercase mb-1">
                          {ROLE_LABEL[role]} <span className="opacity-60">{players.length}</span>
                        </p>
                        <div className="space-y-0.5">
                          {players.map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-sm border-b border-dashed border-border/40 py-0.5">
                              <span className="truncate">{p.name}</span>
                              <span className="font-mono text-xs text-muted-foreground shrink-0 ml-2">{p.purchasePriceFm ?? "—"} FM</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

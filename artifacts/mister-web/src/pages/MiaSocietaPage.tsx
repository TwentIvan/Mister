/**
 * MiaSocietaPage (T173) — la casa del manager: /leagues/:id/societa
 *
 * Il premio post-asta: maglia coi propri colori, nome e voce d'asta
 * personalizzabili, allenatore, rosa conquistata per reparto e budget.
 * I campi cosmetici sono editabili dal PROPRIETARIO (crediti e rosa
 * restano dell'admin, enforcement lato server).
 */

import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Save, Shirt } from "lucide-react";

const ROLE_ORDER = ["P", "D", "C", "A"] as const;
const ROLE_LABEL: Record<string, string> = { P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti" };

export type JerseyPattern = "solid" | "stripes_vertical" | "stripes_horizontal" | "halved" | "checkered" | "sash" | "quarters";
export const PATTERNS: Array<{ id: JerseyPattern; label: string }> = [
  { id: "solid", label: "Tinta unita" },
  { id: "stripes_vertical", label: "Palato" },
  { id: "stripes_horizontal", label: "Cerchiato" },
  { id: "halved", label: "Metà" },
  { id: "quarters", label: "Quarti" },
  { id: "sash", label: "Banda" },
  { id: "checkered", label: "Scacchi" },
];

const SHIRT = "M30 12 L42 6 Q50 12 58 6 L70 12 L84 24 L74 36 L70 32 L70 90 L30 90 L30 32 L26 36 L16 24 Z";

function Maglia({ c1, c2, c3, c4, pattern, initials }: {
  c1: string; c2: string; c3?: string; c4?: string; pattern: JerseyPattern; initials?: string;
}) {
  const t = c3 ?? c2; // terzo colore: fallback al secondario
  const q = c4 ?? c1;
  const clip = "jclip";
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 drop-shadow">
      <defs><clipPath id={clip}><path d={SHIRT} /></clipPath></defs>
      <path d={SHIRT} fill={c1} />
      <g clipPath={`url(#${clip})`}>
        {pattern === "stripes_vertical" && [34, 46, 58, 70].map((x, i) => (
          <rect key={x} x={x} y={0} width={6} height={100} fill={i % 2 ? t : c2} />
        ))}
        {pattern === "stripes_horizontal" && [22, 40, 58, 76].map((y, i) => (
          <rect key={y} x={0} y={y} width={100} height={8} fill={i % 2 ? t : c2} />
        ))}
        {pattern === "halved" && <rect x={50} y={0} width={50} height={100} fill={c2} />}
        {pattern === "quarters" && (<>
          <rect x={50} y={0} width={50} height={50} fill={c2} />
          <rect x={0} y={50} width={50} height={50} fill={t} />
          <rect x={50} y={50} width={50} height={50} fill={q} />
        </>)}
        {pattern === "sash" && <path d="M10 0 L34 0 L90 100 L66 100 Z" fill={c2} stroke={t} strokeWidth="2" />}
        {pattern === "checkered" && [0,1,2,3,4].flatMap((r) => [0,1,2,3,4].map((c) => (
          (r + c) % 2 === 0 ? <rect key={`${r}-${c}`} x={c*20} y={r*20} width={20} height={20} fill={c2} /> : null
        )))}
      </g>
      <path d={SHIRT} fill="none" stroke={t} strokeWidth="3" />
      <path d="M42 6 Q50 12 58 6 L56 14 Q50 18 44 14 Z" fill={q} />
      {initials && (<>
        <path d="M50 40 L62 45 L62 58 Q62 68 50 74 Q38 68 38 58 L38 45 Z" fill={c2} stroke={q} strokeWidth="1.5" />
        <text x="50" y="60" textAnchor="middle" fontSize="11" fontWeight="bold" fontFamily="serif" fill={c1}>{initials}</text>
      </>)}
    </svg>
  );
}

export default function MiaSocietaPage() {
  const [, params] = useRoute("/leagues/:id/societa");
  const leagueId = params?.id ?? "";
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // trova la MIA squadra dagli slot della lega
  const { data: inviteInfo, isLoading: slotsLoading } = useGetLeagueInvite(leagueId, {
    query: { enabled: !!leagueId, queryKey: getGetLeagueInviteQueryKey(leagueId) },
  });
  const mySlot = (inviteInfo?.slots ?? []).find((s) => s.manager_user_id === user?.id) ?? null;

  const { data: rosa, isLoading: rosaLoading } = useGetFantaTeamRosa(mySlot?.id ?? "", {
    query: { enabled: !!mySlot?.id, queryKey: getGetFantaTeamRosaQueryKey(mySlot?.id ?? "") },
  });

  const update = useUpdateFantaTeam();
  const [form, setForm] = useState({ name: "", name_auction: "", coach_name: "", color_primary: "#1f4733", color_secondary: "#efe6d3", color_tertiary: "#efe6d3", color_quaternary: "#1f4733", jersey_pattern: "solid" as JerseyPattern });
  const [profilo, setProfilo] = useState({ first_name: "", last_name: "" });
  useEffect(() => {
    if (rosa) {
      setForm({
        name: rosa.teamName ?? "",
        name_auction: mySlot?.name_auction ?? rosa.teamName ?? "",
        coach_name: "",
        color_primary: rosa.jersey?.primaryColor ?? "#1f4733",
        color_secondary: rosa.jersey?.secondaryColor ?? "#efe6d3",
        color_tertiary: (rosa.jersey as { tertiaryColor?: string } | null)?.tertiaryColor ?? rosa.jersey?.secondaryColor ?? "#efe6d3",
        color_quaternary: (rosa.jersey as { quaternaryColor?: string } | null)?.quaternaryColor ?? rosa.jersey?.primaryColor ?? "#1f4733",
        jersey_pattern: ((rosa.jersey as { pattern?: JerseyPattern } | null)?.pattern ?? "solid"),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosa?.fantaTeamId]);

  const saveProfilo = () => {
    if (!profilo.first_name && !profilo.last_name) return;
    void customFetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: profilo.first_name || null, last_name: profilo.last_name || null }) })
      .then(() => toast({ title: "Profilo aggiornato" }))
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

  if (slotsLoading) return <div className="mx-auto max-w-3xl p-4"><Skeleton className="h-40 w-full" /></div>;
  if (!mySlot) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          Non hai ancora una squadra in questa lega: chiedi all'admin il tuo invito personale.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      {/* ── Intestazione con maglia ── */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 p-5" style={{ background: `linear-gradient(120deg, ${form.color_primary}22, ${form.color_secondary}44)` }}>
          <Maglia c1={form.color_primary} c2={form.color_secondary} c3={form.color_tertiary} c4={form.color_quaternary}
            pattern={form.jersey_pattern}
            initials={(form.name || rosa?.teamName || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()} />
          <div className="min-w-0">
            <h1 className="font-serif text-3xl font-bold truncate">{form.name || rosa?.teamName}</h1>
            <p className="text-sm text-muted-foreground">
              {rosa?.leagueName} · <span className="font-mono font-bold text-foreground">{rosa?.creditsRemaining ?? "—"} FM</span> residui
            </p>
          </div>
        </div>
      </Card>

      {/* ── Personalizzazione ── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Shirt className="h-4 w-4" />La tua società</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nome società</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Voce asta (come ti chiama il banditore)</Label>
              <Input value={form.name_auction} onChange={(e) => setForm((f) => ({ ...f, name_auction: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Allenatore</Label>
              <Input placeholder="Mister…" value={form.coach_name} onChange={(e) => setForm((f) => ({ ...f, coach_name: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Fantasia maglia</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PATTERNS.map((pt) => (
                  <button key={pt.id} type="button"
                    onClick={() => setForm((f) => ({ ...f, jersey_pattern: pt.id }))}
                    className={`px-2.5 py-1 rounded-md border text-xs font-mono transition-colors ${form.jersey_pattern === pt.id ? "bg-[#1f4733] text-[#efe6d3] border-[#1f4733]" : "border-border hover:border-[#1f4733]/50"}`}>
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 grid grid-cols-4 gap-2">
              {([["color_primary","1º"],["color_secondary","2º"],["color_tertiary","3º"],["color_quaternary","4º"]] as const).map(([k, lbl]) => (
                <div key={k}>
                  <Label className="text-xs text-muted-foreground">{lbl} colore</Label>
                  <Input type="color" className="h-9 p-1 cursor-pointer" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-dashed">
            <div>
              <Label className="text-xs text-muted-foreground">Nome (manager)</Label>
              <Input value={profilo.first_name} onChange={(e) => setProfilo((p) => ({ ...p, first_name: e.target.value }))} onBlur={saveProfilo} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cognome</Label>
              <Input value={profilo.last_name} onChange={(e) => setProfilo((p) => ({ ...p, last_name: e.target.value }))} onBlur={saveProfilo} />
            </div>
          </div>
          <Button onClick={save} disabled={update.isPending} className="w-full sm:w-auto gap-2 bg-[#1f4733] text-[#efe6d3] hover:bg-[#1f4733]/90">
            <Save className="h-4 w-4" />
            {update.isPending ? "Salvataggio…" : "Salva società"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Rosa ── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">La rosa</CardTitle></CardHeader>
        <CardContent>
          {rosaLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
    </div>
  );
}

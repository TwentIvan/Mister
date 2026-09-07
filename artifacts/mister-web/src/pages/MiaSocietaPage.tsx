/**
 * MiaSocietaPage (T173.d) — /leagues/:id/societa
 * Testata con maglia e stemma CLICCABILI (→ editor dedicati), dati società
 * in alto, tab Club/Rosa. Il verticale non paga più: rosa a 4 colonne.
 */

import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
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
import { Save, Pencil } from "lucide-react";
import { Maglia, Stemma, type JerseyPattern } from "@/components/societa/jersey";

const ROLE_ORDER = ["P", "D", "C", "A"] as const;
const ROLE_LABEL: Record<string, string> = { P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti" };
const ROLE_COLOR: Record<string, string> = { P: "#d97706", D: "#16a34a", C: "#2563eb", A: "#dc2626" };
const fmtN = (v: number | null | undefined, dec = 2) => (v == null ? "—" : Number(v).toFixed(dec).replace(/\.00$/, ""));

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
  const [form, setForm] = useState({ name: "", name_auction: "", coach_name: "" });
  const [roleFilter, setRoleFilter] = useState<"ALL" | "P" | "D" | "C" | "A">("ALL");
  const [profilo, setProfilo] = useState({ first_name: "", last_name: "" });

  useEffect(() => {
    if (rosa) {
      setForm((f) => ({ ...f, name: rosa.teamName ?? "", name_auction: mySlot?.name_auction ?? rosa.teamName ?? "" }));
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
      } },
      {
        onSuccess: () => {
          toast({ title: "Società aggiornata" });
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

  const j = rosa?.jersey as { primaryColor?: string; secondaryColor?: string; tertiaryColor?: string; quaternaryColor?: string; pattern?: JerseyPattern } | null;
  const c1 = j?.primaryColor ?? "#1f4733";
  const c2 = j?.secondaryColor ?? "#efe6d3";
  const initials = (form.name || rosa?.teamName || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const logoUrl = (mySlot as { logo_url?: string | null } | null)?.logo_url ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      {/* ── Testata: maglia e stemma CLICCABILI → editor ── */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-6 p-6"
          style={{ background: `linear-gradient(120deg, ${c1}20, ${c2}40)` }}>
          <Link href={`/leagues/${leagueId}/societa/maglia`} title="Modifica la maglia">
            <span className="relative group cursor-pointer inline-block">
              <Maglia c1={c1} c2={c2} c3={j?.tertiaryColor} c4={j?.quaternaryColor} pattern={j?.pattern ?? "solid"}
                shape={j as { collar?: "round" | "v"; polo?: boolean; closure?: "none" | "buttons" | "laces" } | undefined} size={148} />
              <span className="absolute -bottom-1 -right-1 rounded-full bg-[#1f4733] text-[#efe6d3] p-1.5 opacity-80 group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></span>
            </span>
          </Link>
          <Link href={`/leagues/${leagueId}/societa/stemma`} title="Modifica lo stemma">
            <span className="relative group cursor-pointer inline-block">
              <Stemma c1={c1} c2={c2} c4={j?.quaternaryColor} initials={initials} logoUrl={logoUrl} size={84} />
              <span className="absolute -bottom-1 -right-1 rounded-full bg-[#1f4733] text-[#efe6d3] p-1.5 opacity-80 group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></span>
            </span>
          </Link>
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

        <TabsContent value="club">
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

        <TabsContent value="rosa">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">La rosa</CardTitle>
                <div className="flex gap-1.5">
                  {(["ALL", ...ROLE_ORDER] as const).map((r) => (
                    <button key={r} type="button" onClick={() => setRoleFilter(r)}
                      className={`px-2.5 py-1 rounded-full border text-xs font-mono font-bold transition-colors ${roleFilter === r ? "bg-[#1f4733] text-[#efe6d3] border-[#1f4733]" : "border-border hover:border-[#1f4733]/40"}`}
                      style={roleFilter !== r && r !== "ALL" ? { color: ROLE_COLOR[r] } : undefined}>
                      {r === "ALL" ? "Tutti" : r}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rosaLoading ? <Skeleton className="h-40 w-full" /> : (
                <div className="overflow-x-auto -mx-2 px-2">
                  {/* intestazione colonne (desktop) */}
                  <div className="hidden lg:grid items-center gap-2 px-2 py-1 text-[10px] font-mono uppercase text-muted-foreground"
                    style={{ gridTemplateColumns: "minmax(180px,2fr) 44px repeat(8, minmax(52px,1fr))" }}>
                    <span>Giocatore</span><span className="text-center">Sq.</span>
                    <span className="text-right">PGv</span><span className="text-right">MV</span>
                    <span className="text-right">FM</span><span className="text-right">Val.</span>
                    <span className="text-right">Val. iniz.</span><span className="text-right">Cartellino</span>
                    <span className="text-right">Anni</span><span className="text-right">Costo/anno</span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {(rosa?.players ?? [])
                      .filter((p) => roleFilter === "ALL" || p.roleClassic === roleFilter)
                      .map((p) => {
                        const pp = p as typeof p & { logoUrl?: string | null; photoCartoonUrl?: string | null; pgv?: number | null; mv?: number | null; fm?: number | null; qtA?: number | null; qtI?: number | null; durationSeasons?: number | null };
                        const face = pp.photoCartoonUrl ?? p.photoUrl ?? null;
                        const anni = pp.durationSeasons ?? 1;
                        const cart = p.purchasePriceFm ?? p.quotazione ?? null;
                        return (
                          <div key={p.id} className="grid items-center gap-2 px-2 py-1.5 text-sm"
                            style={{ gridTemplateColumns: "minmax(180px,2fr) 44px repeat(8, minmax(52px,1fr))" }}>
                            {/* giocatore: foto + ruolo + nome (stile chip formazione) */}
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="relative shrink-0">
                                <span className="block w-8 h-8 rounded-full overflow-hidden bg-[#1f4733]/10 border border-border">
                                  {face
                                    ? <img src={face} alt="" className="w-full h-full object-cover object-top" />
                                    : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-[#1f4733]/60">{p.name[0]}</span>}
                                </span>
                                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold font-mono text-white flex items-center justify-center border border-white"
                                  style={{ background: ROLE_COLOR[p.roleClassic] }}>{p.roleClassic}</span>
                              </span>
                              <span className="truncate font-medium">{p.name}</span>
                            </span>
                            {/* squadra reale: solo logo */}
                            <span className="flex justify-center">
                              {pp.logoUrl
                                ? <img src={pp.logoUrl} alt={p.realTeam} title={p.realTeam} className="w-6 h-6 object-contain" />
                                : <span className="text-[10px] font-mono text-muted-foreground">{p.realTeam.slice(0, 3).toUpperCase()}</span>}
                            </span>
                            <span className="text-right font-mono text-xs">{fmtN(pp.pgv, 0)}</span>
                            <span className="text-right font-mono text-xs">{fmtN(pp.mv)}</span>
                            <span className="text-right font-mono text-xs font-bold">{fmtN(pp.fm)}</span>
                            <span className="text-right font-mono text-xs">{fmtN(pp.qtA, 0)}</span>
                            <span className="text-right font-mono text-xs text-muted-foreground">{fmtN(pp.qtI, 0)}</span>
                            <span className="text-right font-mono text-xs font-bold">{cart != null ? `${cart} FM` : "—"}</span>
                            <span className="text-right font-mono text-xs">{anni}</span>
                            <span className="text-right font-mono text-xs">{cart != null ? `${Math.round(cart / anni)} FM` : "—"}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

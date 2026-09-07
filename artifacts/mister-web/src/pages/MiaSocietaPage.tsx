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
              <Maglia c1={c1} c2={c2} c3={j?.tertiaryColor} c4={j?.quaternaryColor} pattern={j?.pattern ?? "solid"} size={148} />
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

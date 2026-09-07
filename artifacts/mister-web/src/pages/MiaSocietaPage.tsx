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

function Maglia({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow">
      <path d="M30 12 L42 6 Q50 12 58 6 L70 12 L84 24 L74 36 L70 32 L70 90 L30 90 L30 32 L26 36 L16 24 Z"
        fill={primary} stroke={secondary} strokeWidth="3" />
      <path d="M42 6 Q50 12 58 6 L56 14 Q50 18 44 14 Z" fill={secondary} />
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
  const [form, setForm] = useState({ name: "", name_auction: "", coach_name: "", color_primary: "#1f4733", color_secondary: "#efe6d3" });
  useEffect(() => {
    if (rosa) {
      setForm({
        name: rosa.teamName ?? "",
        name_auction: mySlot?.name_auction ?? rosa.teamName ?? "",
        coach_name: "",
        color_primary: rosa.jersey?.primaryColor ?? "#1f4733",
        color_secondary: rosa.jersey?.secondaryColor ?? "#efe6d3",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosa?.fantaTeamId]);

  const save = () => {
    if (!mySlot?.id) return;
    update.mutate(
      { leagueId, id: mySlot.id, data: {
        name: form.name || undefined,
        name_auction: form.name_auction || undefined,
        coach_name: form.coach_name || null,
        color_primary: form.color_primary,
        color_secondary: form.color_secondary,
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
          <Maglia primary={form.color_primary} secondary={form.color_secondary} />
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
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Colore maglia</Label>
                <Input type="color" className="h-9 p-1 cursor-pointer" value={form.color_primary} onChange={(e) => setForm((f) => ({ ...f, color_primary: e.target.value }))} />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Secondario</Label>
                <Input type="color" className="h-9 p-1 cursor-pointer" value={form.color_secondary} onChange={(e) => setForm((f) => ({ ...f, color_secondary: e.target.value }))} />
              </div>
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

/** MagliaEditPage (T173.d) — /leagues/:id/societa/maglia: editor maglia dedicato. */
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  useGetLeagueInvite, getGetLeagueInviteQueryKey,
  useGetFantaTeamRosa, getGetFantaTeamRosaQueryKey,
  useUpdateFantaTeam,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save } from "lucide-react";
import { Maglia, PATTERNS, PALETTE, COLOR_KEYS, type ColorKey, type JerseyPattern } from "@/components/societa/jersey";

export default function MagliaEditPage() {
  const [, params] = useRoute("/leagues/:id/societa/maglia");
  const leagueId = params?.id ?? "";
  const [, navigate] = useLocation();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: inviteInfo } = useGetLeagueInvite(leagueId, {
    query: { enabled: !!leagueId, queryKey: getGetLeagueInviteQueryKey(leagueId) },
  });
  const mySlot = (inviteInfo?.slots ?? []).find((s) => s.manager_user_id === user?.id) ?? null;
  const { data: rosa } = useGetFantaTeamRosa(mySlot?.id ?? "", {
    query: { enabled: !!mySlot?.id, queryKey: getGetFantaTeamRosaQueryKey(mySlot?.id ?? "") },
  });

  const update = useUpdateFantaTeam();
  const [c, setC] = useState({ color_primary: "#1f4733", color_secondary: "#efe6d3", color_tertiary: "#efe6d3", color_quaternary: "#1f4733" });
  const [pattern, setPattern] = useState<JerseyPattern>("solid");
  const [active, setActive] = useState<ColorKey>("color_primary");

  useEffect(() => {
    const j = rosa?.jersey as { primaryColor?: string; secondaryColor?: string; tertiaryColor?: string; quaternaryColor?: string; pattern?: JerseyPattern } | null;
    if (j) {
      setC({
        color_primary: j.primaryColor ?? "#1f4733",
        color_secondary: j.secondaryColor ?? "#efe6d3",
        color_tertiary: j.tertiaryColor ?? j.secondaryColor ?? "#efe6d3",
        color_quaternary: j.quaternaryColor ?? j.primaryColor ?? "#1f4733",
      });
      setPattern(j.pattern ?? "solid");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosa?.fantaTeamId]);

  const save = () => {
    if (!mySlot?.id) return;
    update.mutate(
      { leagueId, id: mySlot.id, data: { ...c, jersey_pattern: pattern } },
      {
        onSuccess: () => {
          toast({ title: "Maglia salvata" });
          void queryClient.invalidateQueries({ queryKey: getGetFantaTeamRosaQueryKey(mySlot.id) });
          navigate(`/leagues/${leagueId}/societa`);
        },
        onError: () => toast({ title: "Salvataggio fallito", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate(`/leagues/${leagueId}/societa`)}>
        <ArrowLeft className="h-4 w-4" /> La mia società
      </Button>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="flex justify-center">
            <Maglia c1={c.color_primary} c2={c.color_secondary} c3={c.color_tertiary} c4={c.color_quaternary} pattern={pattern} size={190} />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Fantasia</Label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-1">
              {PATTERNS.map((pt) => (
                <button key={pt.id} type="button" onClick={() => setPattern(pt.id)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border p-1.5 transition-colors ${pattern === pt.id ? "border-[#1f4733] bg-[#1f4733]/10" : "border-border hover:border-[#1f4733]/40"}`}>
                  <Maglia c1={c.color_primary} c2={c.color_secondary} c3={c.color_tertiary} c4={c.color_quaternary} pattern={pt.id} size={44} />
                  <span className="text-[9px] font-mono text-muted-foreground leading-tight text-center">{pt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label className="text-xs text-muted-foreground">Colori</Label>
              {COLOR_KEYS.map((k, i) => (
                <button key={k} type="button" onClick={() => setActive(k)} title={`${i + 1}º colore`}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${active === k ? "border-[#1f4733] scale-110 shadow" : "border-border"}`}
                  style={{ background: c[k] }} />
              ))}
              <span className="text-[10px] font-mono text-muted-foreground ml-1">stai modificando il {COLOR_KEYS.indexOf(active) + 1}º</span>
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
              {PALETTE.map((hex) => (
                <button key={hex} type="button" onClick={() => setC((f) => ({ ...f, [active]: hex }))}
                  className={`aspect-square rounded-sm border transition-transform hover:scale-110 ${c[active] === hex ? "ring-2 ring-[#1f4733] ring-offset-1" : "border-black/10"}`}
                  style={{ background: hex }} />
              ))}
            </div>
          </div>

          <Button onClick={save} disabled={update.isPending} className="gap-2 bg-[#1f4733] text-[#efe6d3] hover:bg-[#1f4733]/90">
            <Save className="h-4 w-4" /> {update.isPending ? "Salvataggio…" : "Salva maglia"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

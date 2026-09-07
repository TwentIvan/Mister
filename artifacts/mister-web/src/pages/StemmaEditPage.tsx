/** StemmaEditPage (T173.d) — /leagues/:id/societa/stemma: editor stemma (URL logo; AI in T174). */
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import { Stemma, type JerseyPattern } from "@/components/societa/jersey";

export default function StemmaEditPage() {
  const [, params] = useRoute("/leagues/:id/societa/stemma");
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
  const [logoUrl, setLogoUrl] = useState("");
  useEffect(() => { setLogoUrl((mySlot as { logo_url?: string | null } | null)?.logo_url ?? ""); }, [mySlot?.id]);

  const j = rosa?.jersey as { primaryColor?: string; secondaryColor?: string; quaternaryColor?: string; pattern?: JerseyPattern } | null;
  const initials = (rosa?.teamName ?? "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const save = () => {
    if (!mySlot?.id) return;
    update.mutate(
      { leagueId, id: mySlot.id, data: { logo_url: logoUrl.trim() || null } },
      {
        onSuccess: () => {
          toast({ title: "Stemma salvato" });
          void queryClient.invalidateQueries({ queryKey: getGetFantaTeamRosaQueryKey(mySlot.id) });
          void queryClient.invalidateQueries({ queryKey: getGetLeagueInviteQueryKey(leagueId) });
          navigate(`/leagues/${leagueId}/societa`);
        },
        onError: () => toast({ title: "Salvataggio fallito", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate(`/leagues/${leagueId}/societa`)}>
        <ArrowLeft className="h-4 w-4" /> La mia società
      </Button>

      <Card>
        <CardContent className="pt-6 space-y-5 text-center">
          <div className="flex justify-center">
            <Stemma c1={j?.primaryColor ?? "#1f4733"} c2={j?.secondaryColor ?? "#efe6d3"}
              c4={j?.quaternaryColor} initials={initials} logoUrl={logoUrl.trim() || null} size={160} />
          </div>
          <div className="text-left">
            <Label className="text-xs text-muted-foreground">URL logo (immagine quadrata, png/svg)</Label>
            <Input placeholder="https://…" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Vuoto = stemma con le iniziali nei colori sociali.
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-[#1f4733]/30 bg-[#1f4733]/5 p-3 text-left">
            <p className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Stemma generato dall'AI</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              In arrivo (T174): descrivi il tuo club e l'AI proporrà 2-3 stemmi tra cui scegliere.
            </p>
          </div>
          <Button onClick={save} disabled={update.isPending} className="gap-2 bg-[#1f4733] text-[#efe6d3] hover:bg-[#1f4733]/90">
            <Save className="h-4 w-4" /> {update.isPending ? "Salvataggio…" : "Salva stemma"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

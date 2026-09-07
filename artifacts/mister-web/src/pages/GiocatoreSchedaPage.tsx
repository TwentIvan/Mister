/** GiocatoreSchedaPage (T175, segnaposto) — /giocatori/:id */
import { useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function GiocatoreSchedaPage() {
  const [, params] = useRoute("/giocatori/:id");
  const [, navigate] = useLocation();
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => history.back()}>
        <ArrowLeft className="h-4 w-4" /> Indietro
      </Button>
      <Card><CardContent className="pt-6 text-center space-y-2">
        <p className="font-serif text-2xl font-bold">Scheda giocatore</p>
        <p className="text-sm text-muted-foreground">
          In costruzione (T175): qui arriveranno anagrafica completa, storico voti
          giornata per giornata, contratto e clausola. ID: <span className="font-mono">{params?.id}</span>
        </p>
      </CardContent></Card>
    </div>
  );
}

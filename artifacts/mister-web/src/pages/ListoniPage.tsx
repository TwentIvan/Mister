/**
 * Listoni — import quotazioni da leghe.fantacalcio.it / fantacalcio.it.
 *
 * Upload dell'xlsx (drag & drop o picker), stagione+etichetta, import via
 * POST /listoni/import e report di matching a caldo. Sotto, l'archivio dei
 * batch importati con i conteggi e — espandendo — gli orfani (match_method
 * = none), anteprima della riconciliazione che arriva con T151.
 *
 * NOTA: l'hook generato useImportListone NON si può usare per l'upload:
 * orval serializza il Blob con JSON.stringify (limite noto con
 * application/octet-stream). Qui si usa customFetch direttamente.
 */

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  useListListoni,
  getListListoniQueryKey,
  useListListoneEntries,
} from "@workspace/api-client-react";
import type { ListoneImportResult, ListoneSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Upload, ChevronDown, ChevronUp, CircleAlert } from "lucide-react";

// ─── Report badges ───────────────────────────────────────────────────────────

function ReportBadges({ report }: { report: ListoneSummary["report"] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">{report.total} totali</Badge>
      <Badge className="bg-emerald-700 hover:bg-emerald-700">{report.exact} exact</Badge>
      <Badge className="bg-emerald-600 hover:bg-emerald-600">{report.normalized} normalized</Badge>
      <Badge className="bg-amber-600 hover:bg-amber-600">{report.fuzzy} fuzzy</Badge>
      <Badge variant={report.none > 0 ? "destructive" : "secondary"}>{report.none} orfani</Badge>
    </div>
  );
}

// ─── Orfani di un batch (anteprima riconciliazione T151) ─────────────────────

function OrphanList({ listoneId }: { listoneId: number }) {
  const { data, isLoading } = useListListoneEntries(listoneId, { method: "none", limit: 100 });
  if (isLoading) return <Skeleton className="h-16 w-full" />;
  const items = data?.items ?? [];
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessun orfano: tutte le righe sono state matchate.</p>;
  }
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">
        {data?.total} righe senza match (prime {items.length}) — la risoluzione manuale arriva con la riconciliazione (T151)
      </p>
      <div className="max-h-64 overflow-y-auto rounded border">
        <table className="w-full text-sm">
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="px-2 py-1 font-medium">{e.raw_name}</td>
                <td className="px-2 py-1 text-muted-foreground">{e.raw_team}</td>
                <td className="px-2 py-1">{e.raw_role_classic}</td>
                <td className="px-2 py-1 text-right tabular-nums">{e.qt_a ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Riga batch archivio ─────────────────────────────────────────────────────

function ListoneRow({ batch }: { batch: ListoneSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold">{batch.label}</p>
            <p className="text-xs text-muted-foreground">
              {batch.season} · {batch.source} · {new Date(batch.created_at).toLocaleString("it-IT")}
              {batch.file_name ? ` · ${batch.file_name}` : ""}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Orfani
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ReportBadges report={batch.report} />
        {open && <OrphanList listoneId={batch.id} />}
      </CardContent>
    </Card>
  );
}

// ─── Pagina ──────────────────────────────────────────────────────────────────

export default function ListoniPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: listoniData, isLoading: listoniLoading } = useListListoni();

  const [file, setFile] = useState<File | null>(null);
  const [season, setSeason] = useState("2026-27");
  const [label, setLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<ListoneImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pickFile = (f: File | null) => {
    setFile(f);
    if (f && !label) {
      // etichetta di default dal nome file, senza estensione
      setLabel(f.name.replace(/\.(xlsx|xls|csv)$/i, "").slice(0, 80));
    }
  };

  const doImport = async () => {
    if (!file || !season.trim() || !label.trim()) return;
    setImporting(true);
    setLastResult(null);
    try {
      const qs = new URLSearchParams({ season: season.trim(), label: label.trim(), fileName: file.name });
      const result = await customFetch<ListoneImportResult>(`/api/listoni/import?${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      setLastResult(result);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      void queryClient.invalidateQueries({ queryKey: getListListoniQueryKey() });
      toast({ title: "Listone importato", description: `${result.report.total} righe, ${result.report.none} orfani` });
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Import fallito. Controlla il file.";
      toast({ title: "Errore import", description: msg, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div>
        <h1 className="font-serif text-2xl font-bold">Listoni</h1>
        <p className="text-sm text-muted-foreground">
          Importa le quotazioni esportate da leghe.fantacalcio.it (lista calciatori xlsx o csv fantaasta) o da fantacalcio.it (quotazioni).
        </p>
      </div>

      {/* ── Upload ── */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0] ?? null;
              if (f) pickFile(f);
            }}
          >
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            {file ? (
              <p className="font-medium">{file.name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Trascina qui il file (xlsx o csv), o clicca per sceglierlo
              </p>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Stagione</label>
              <Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026-27" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Etichetta</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Quotazioni 4 agosto" />
            </div>
          </div>

          <Button onClick={() => void doImport()} disabled={!file || !season.trim() || !label.trim() || importing} className="w-full">
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Import in corso…" : "Importa e matcha"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Report ultimo import ── */}
      {lastResult && (
        <Card>
          <CardHeader className="pb-2">
            <p className="font-semibold">Report import #{lastResult.listone_id}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReportBadges report={lastResult.report} />
            {lastResult.skipped.length > 0 && (
              <div className="rounded border border-amber-600/40 bg-amber-600/10 p-2 text-sm">
                <p className="mb-1 flex items-center gap-1 font-medium">
                  <CircleAlert className="h-4 w-4" /> {lastResult.skipped.length} righe scartate
                </p>
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {lastResult.skipped.slice(0, 10).map((s, i) => (
                    <li key={i}>riga {s.rowIndex + 1}: {s.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Archivio ── */}
      <div className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">Importati</h2>
        {listoniLoading && <Skeleton className="h-24 w-full" />}
        {!listoniLoading && (listoniData?.items?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">Nessun listone importato finora.</p>
        )}
        {(listoniData?.items ?? []).map((b) => (
          <ListoneRow key={b.id} batch={b} />
        ))}
      </div>
    </div>
  );
}

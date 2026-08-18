import { useEffect, useState } from "react";
import { Bug, ChevronDown, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchCandidateDocuments, type IsolatedDocument } from "@/lib/docintel/isolation";
import type { ExtractionDebugPayload } from "@/lib/intake/extractionDebug";
import { cn } from "@/lib/utils";

function asPayload(raw: unknown): ExtractionDebugPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<ExtractionDebugPayload>;
  if (!p.uploadedFile || !p.mapping) return null;
  return p as ExtractionDebugPayload;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h4>
      <div className="rounded-md border border-border/60 bg-muted/20 p-2 text-[11px]">{children}</div>
    </section>
  );
}

function DocDebug({ doc }: { doc: IsolatedDocument }) {
  const [open, setOpen] = useState(true);
  const payload = asPayload(doc.extraction_debug);
  return (
    <div className="border-b border-border/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted/40"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <span className="truncate">{doc.file_name}</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
          {doc.document_type}
        </span>
      </button>
      {open && (
        <div className="space-y-3 px-3 pb-3">
          {!payload && (
            <p className="text-[11px] text-muted-foreground">
              No extraction debug payload on this document yet. Re-run intake OCR to populate
              Part 9 fields.
            </p>
          )}
          {payload && (
            <>
              <Block title="Uploaded file">
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono">
                  <dt className="text-muted-foreground">name</dt>
                  <dd className="truncate">{payload.uploadedFile.fileName}</dd>
                  <dt className="text-muted-foreground">path</dt>
                  <dd className="truncate">{payload.uploadedFile.storagePath}</dd>
                  <dt className="text-muted-foreground">mime</dt>
                  <dd>{payload.uploadedFile.mimeType ?? "—"}</dd>
                  <dt className="text-muted-foreground">bytes</dt>
                  <dd>{payload.uploadedFile.sizeBytes ?? "—"}</dd>
                </dl>
              </Block>
              <Block title="OCR output">
                <div className="mb-1 text-[10px] text-muted-foreground">
                  {payload.ocrOutput.provider ?? "—"} · pages {payload.ocrOutput.pageCount ?? "—"} ·
                  conf {payload.ocrOutput.confidence ?? "—"}
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px]">
                  {payload.ocrOutput.text || "—"}
                </pre>
              </Block>
              <Block title="Classification with evidence">
                <div>
                  <span className="font-medium">{payload.classification.type}</span>{" "}
                  <span className="text-muted-foreground">
                    ({Math.round((payload.classification.confidence ?? 0) * 100)}%)
                  </span>
                </div>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {(payload.classification.evidence ?? []).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </Block>
              <Block title="Raw model JSON">
                <pre className="max-h-40 overflow-auto font-mono text-[10px]">
                  {JSON.stringify(payload.rawModelJson, null, 2).slice(0, 8000)}
                </pre>
              </Block>
              <Block title="Mapping table">
                <table className="w-full text-left font-mono text-[10px]">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="py-0.5 pr-2">extracted</th>
                      <th className="py-0.5 pr-2">resolved key</th>
                      <th className="py-0.5">outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.mapping.map((row, i) => {
                      const unresolved = !row.resolved || row.outcome !== "mapped" && row.outcome !== "mrz";
                      return (
                        <tr
                          key={i}
                          className={cn(unresolved && "bg-amber-50 text-amber-950")}
                        >
                          <td className="py-0.5 pr-2 align-top">{row.extracted}</td>
                          <td className="py-0.5 pr-2 align-top">{row.resolved ?? "—"}</td>
                          <td className="py-0.5 align-top">{row.outcome}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Block>
              <Block title="Normalisation before / after">
                <table className="w-full text-left font-mono text-[10px]">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="py-0.5 pr-2">before</th>
                      <th className="py-0.5 pr-2">after</th>
                      <th className="py-0.5">flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.normalisation.map((n, i) => (
                      <tr key={i}>
                        <td className="py-0.5 pr-2 align-top">{n.before}</td>
                        <td className="py-0.5 pr-2 align-top">{n.after}</td>
                        <td className="py-0.5 align-top">{(n.flags ?? []).join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Block>
              <Block title="Merge decision">
                <ul className="space-y-1">
                  {payload.mergeDecision.map((m) => (
                    <li key={m.key}>
                      <span className="font-mono">{m.key}</span> → {m.winner}{" "}
                      <span className="text-muted-foreground">
                        ({m.source} · {m.status}
                        {m.competing.length ? ` · vs ${m.competing.map((c) => c.value).join(" | ")}` : ""})
                      </span>
                    </li>
                  ))}
                </ul>
              </Block>
              <Block title="DB write result">
                <span className={payload.dbWrite.ok ? "text-emerald-700" : "text-rose-700"}>
                  {payload.dbWrite.ok ? "ok" : "failed"}
                </span>{" "}
                · {payload.dbWrite.fieldsWritten} rows · {payload.dbWrite.at}
                {payload.dbWrite.error ? ` · ${payload.dbWrite.error}` : ""}
              </Block>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ExtractionDebugDrawer({
  candidateId,
  onClose,
}: {
  candidateId: string;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<IsolatedDocument[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchCandidateDocuments(candidateId);
        if (!cancelled) setDocs(rows);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  return (
    <div className="absolute right-0 top-0 bottom-0 z-30 flex w-[420px] flex-col border-l border-border/60 bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Bug className="size-3" /> Extraction debug
          </div>
          <div className="text-[11px] text-muted-foreground">Part 9 · staff only</div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close extraction debug">
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {err && <p className="p-3 text-xs text-rose-700">{err}</p>}
        {!err && docs.length === 0 && (
          <p className="p-3 text-xs text-muted-foreground">No documents on this candidate.</p>
        )}
        {docs.map((d) => (
          <DocDebug key={d.id} doc={d} />
        ))}
      </div>
    </div>
  );
}

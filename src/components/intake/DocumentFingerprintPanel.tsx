// ─────────────────────────────────────────────────────────────
// Sprint 5 — Document Fingerprint Panel (staff-only)
// Shows the full provenance of every document attached to ONE
// candidate: hash, uploader, OCR pipeline state, model versions,
// extracted-field count, confidence summary, current document
// state. Never shows any document that doesn't belong to this
// candidate — all reads go through the isolation layer.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { ShieldCheck, FileText, AlertTriangle, Clock, CheckCircle2, Copy } from 'lucide-react';
import { fetchCandidateDocuments, fetchExtractionsForCandidate, type IsolatedDocument, type IsolatedExtraction } from '@/lib/docintel/isolation';
import { cn } from '@/lib/utils';

function statusPill(status: string) {
  switch (status) {
    case 'complete':
      return { label: 'OCR complete', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: <CheckCircle2 className="size-3" /> };
    case 'processing':
      return { label: 'Processing', tone: 'bg-blue-50 text-blue-700 ring-blue-200', icon: <Clock className="size-3" /> };
    case 'failed':
      return { label: 'OCR failed', tone: 'bg-rose-50 text-rose-700 ring-rose-200', icon: <AlertTriangle className="size-3" /> };
    case 'pending':
    default:
      return { label: 'Pending', tone: 'bg-slate-50 text-slate-600 ring-slate-200', icon: <Clock className="size-3" /> };
  }
}

function statePill(state: string) {
  switch (state) {
    case 'visa_ready': return 'bg-emerald-100 text-emerald-800 ring-emerald-300';
    case 'verified':   return 'bg-blue-100 text-blue-800 ring-blue-300';
    case 'ai_processed': return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
    case 'draft':
    default: return 'bg-zinc-50 text-zinc-600 ring-zinc-200';
  }
}

function shortHash(h: string | null | undefined) {
  if (!h) return '—';
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

export function DocumentFingerprintPanel({ candidateId }: { candidateId: string }) {
  const [docs, setDocs] = useState<IsolatedDocument[]>([]);
  const [extractions, setExtractions] = useState<IsolatedExtraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchCandidateDocuments(candidateId), fetchExtractionsForCandidate(candidateId)])
      .then(([d, e]) => {
        if (!alive) return;
        setDocs(d);
        setExtractions(e);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [candidateId]);

  const byDoc = new Map<string, IsolatedExtraction[]>();
  for (const e of extractions) {
    const arr = byDoc.get(e.document_id) ?? [];
    arr.push(e);
    byDoc.set(e.document_id, arr);
  }

  if (loading) {
    return <div className="p-4 text-xs text-muted-foreground">Loading document fingerprints…</div>;
  }
  if (error) {
    return <div className="p-4 text-xs text-rose-600">Failed to load: {error}</div>;
  }
  if (docs.length === 0) {
    return <div className="p-4 text-xs text-muted-foreground">No documents uploaded for this candidate yet.</div>;
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <ShieldCheck className="size-3" /> Document Fingerprints — staff only
      </div>
      {docs.map((d) => {
        const fields = byDoc.get(d.id) ?? [];
        const avgConf = fields.length
          ? fields.reduce((s, f) => s + (f.confidence ?? 0), 0) / fields.length
          : null;
        const lowConf = fields.filter((f) => (f.confidence ?? 1) < 0.65).length;
        const pill = statusPill(d.ocr_status);
        return (
          <div key={d.id} className="rounded-lg border border-border/60 bg-background p-3 text-[11px]">
            <div className="flex items-start gap-2">
              <FileText className="size-3.5 shrink-0 text-muted-foreground mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[12px]">{d.file_name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-muted-foreground">
                  <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 ring-1', pill.tone)}>
                    {pill.icon}{pill.label}
                  </span>
                  <span className={cn('rounded px-1.5 py-0.5 ring-1 uppercase tracking-wider', statePill(d.document_state))}>
                    {d.document_state.replace('_', ' ')}
                  </span>
                  <span>{d.document_type}</span>
                </div>
              </div>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
              <dt>SHA-256</dt>
              <dd className="flex items-center gap-1 font-mono tabular-nums text-foreground" title={d.sha256 ?? undefined}>
                {shortHash(d.sha256)}
                {d.sha256 && (
                  <button
                    onClick={() => navigator.clipboard.writeText(d.sha256!)}
                    className="rounded p-0.5 hover:bg-muted"
                    aria-label="Copy hash"
                  >
                    <Copy className="size-3" />
                  </button>
                )}
              </dd>
              <dt>Uploaded</dt>
              <dd className="text-foreground">{new Date(d.created_at).toLocaleString()}</dd>
              <dt>Uploaded by</dt>
              <dd className="text-foreground truncate">{d.uploaded_by_name ?? d.uploaded_by ?? '—'}</dd>
              <dt>OCR provider</dt>
              <dd className="text-foreground">{d.ocr_provider ?? '—'} {d.ocr_version ? `(${d.ocr_version})` : ''}</dd>
              <dt>AI model</dt>
              <dd className="text-foreground">{d.ai_model_version ?? '—'}</dd>
              <dt>Pages</dt>
              <dd className="text-foreground">{d.page_count ?? '—'}</dd>
              <dt>Fields extracted</dt>
              <dd className="text-foreground">{fields.length}</dd>
              <dt>Avg confidence</dt>
              <dd className="text-foreground">{avgConf == null ? '—' : `${Math.round(avgConf * 100)}%`}</dd>
              <dt>Low-confidence</dt>
              <dd className={cn('text-foreground', lowConf > 0 && 'text-amber-700 font-medium')}>{lowConf}</dd>
              <dt>Last verification</dt>
              <dd className="text-foreground">
                {d.verified_at ? `${new Date(d.verified_at).toLocaleString()} · ${d.verified_by ?? '—'}` : '—'}
              </dd>
              <dt>Upload id</dt>
              <dd className="font-mono text-foreground truncate" title={d.upload_id}>{d.upload_id.slice(0, 8)}…</dd>
            </dl>
            {d.ocr_error && (
              <div className="mt-2 rounded bg-rose-50 px-2 py-1 text-rose-700 ring-1 ring-rose-200">
                OCR error: {d.ocr_error}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

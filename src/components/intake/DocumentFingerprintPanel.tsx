// ─────────────────────────────────────────────────────────────
// Sprint 5 — Document Fingerprint Panel (staff-only audit view)
//
// Full provenance of every document attached to ONE candidate:
// identity, storage, uploader, OCR pipeline, model versions,
// extraction stats, confidence, lifecycle state, processing time
// and errors. All reads go through the isolation layer, so this
// panel can NEVER show a document from a different candidate.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import {
  ShieldCheck, FileText, AlertTriangle, Clock, CheckCircle2, Copy,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  fetchCandidateDocuments, fetchExtractionsForCandidate,
  type IsolatedDocument, type IsolatedExtraction,
} from '@/lib/docintel/isolation';
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
    case 'visa_ready':   return 'bg-emerald-100 text-emerald-800 ring-emerald-300';
    case 'verified':     return 'bg-blue-100 text-blue-800 ring-blue-300';
    case 'ai_processed': return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
    case 'draft':
    default:             return 'bg-zinc-50 text-zinc-600 ring-zinc-200';
  }
}

function shortHash(h: string | null | undefined) {
  if (!h) return '—';
  return `${h.slice(0, 10)}…${h.slice(-8)}`;
}

function shortId(id: string | null | undefined) {
  if (!id) return '—';
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function processingDuration(created: string, processed: string | null) {
  if (!processed) return '—';
  const ms = new Date(processed).getTime() - new Date(created).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

function CopyButton({ value }: { value: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(value)}
      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label="Copy value"
    >
      <Copy className="size-3" />
    </button>
  );
}

interface DocumentFingerprintPanelProps {
  candidateId: string;
  /** When rendered inside a container that already frames it, hide the internal header. */
  hideHeader?: boolean;
}

export function DocumentFingerprintPanel({ candidateId, hideHeader }: DocumentFingerprintPanelProps) {
  const [docs, setDocs] = useState<IsolatedDocument[]>([]);
  const [extractions, setExtractions] = useState<IsolatedExtraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  return (
    <div className="space-y-3 p-3">
      {!hideHeader && (
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="size-3" /> Document Fingerprints — staff only
        </div>
      )}

      {loading && <div className="text-xs text-muted-foreground">Loading document fingerprints…</div>}
      {error && <div className="text-xs text-rose-600">Failed to load: {error}</div>}
      {!loading && !error && docs.length === 0 && (
        <div className="text-xs text-muted-foreground">No documents uploaded for this candidate yet.</div>
      )}

      {docs.map((d) => {
        const fields = byDoc.get(d.id) ?? [];
        const avgConf = fields.length
          ? fields.reduce((s, f) => s + (f.confidence ?? 0), 0) / fields.length
          : null;
        const lowConf = fields.filter((f) => (f.confidence ?? 1) < 0.65).length;
        const pill = statusPill(d.ocr_status);
        const isOpen = expanded[d.id] ?? true;
        const extractionVersions = Array.from(
          new Set(fields.map((f) => f.ai_model_version).filter(Boolean)),
        ).join(', ') || d.ai_model_version || '—';

        return (
          <div key={d.id} className="rounded-lg border border-border/60 bg-background text-[11px]">
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [d.id]: !isOpen }))}
              className="flex w-full items-start gap-2 p-3 text-left hover:bg-muted/40"
            >
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
              {isOpen ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
            </button>

            {isOpen && (
              <div className="border-t border-border/60 px-3 pb-3 pt-2">
                <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-muted-foreground">
                  <dt>Document ID</dt>
                  <dd className="flex items-center gap-1 font-mono text-foreground" title={d.id}>
                    {shortId(d.id)} <CopyButton value={d.id} />
                  </dd>

                  <dt>Candidate ID</dt>
                  <dd className="flex items-center gap-1 font-mono text-foreground" title={d.candidate_id}>
                    {shortId(d.candidate_id)} <CopyButton value={d.candidate_id} />
                  </dd>

                  <dt>SHA-256</dt>
                  <dd className="flex items-center gap-1 font-mono tabular-nums text-foreground" title={d.sha256 ?? undefined}>
                    {shortHash(d.sha256)} {d.sha256 && <CopyButton value={d.sha256} />}
                  </dd>

                  <dt>Original filename</dt>
                  <dd className="truncate text-foreground" title={d.file_name}>{d.file_name}</dd>

                  <dt>Standardized filename</dt>
                  <dd className="truncate font-mono text-foreground" title={d.standardized_filename ?? undefined}>
                    {d.standardized_filename ?? '—'}
                  </dd>

                  <dt>Storage path</dt>
                  <dd className="flex items-center gap-1 truncate font-mono text-foreground" title={d.storage_path}>
                    <span className="truncate">{d.storage_path}</span>
                    <CopyButton value={d.storage_path} />
                  </dd>

                  <dt>Uploaded</dt>
                  <dd className="text-foreground">{new Date(d.created_at).toLocaleString()}</dd>

                  <dt>Uploaded by</dt>
                  <dd className="truncate text-foreground">{d.uploaded_by_name ?? d.uploaded_by ?? '—'}</dd>

                  <dt>OCR provider</dt>
                  <dd className="text-foreground">
                    {d.ocr_provider ?? '—'} {d.ocr_version ? `(${d.ocr_version})` : ''}
                  </dd>

                  <dt>OCR status</dt>
                  <dd className="text-foreground">{d.ocr_status}</dd>

                  <dt>OCR processing time</dt>
                  <dd className="tabular-nums text-foreground">
                    {processingDuration(d.created_at, d.processed_at)}
                  </dd>

                  <dt>AI model version</dt>
                  <dd className="text-foreground">{d.ai_model_version ?? '—'}</dd>

                  <dt>AI extraction version</dt>
                  <dd className="text-foreground">{extractionVersions}</dd>

                  <dt>Pages</dt>
                  <dd className="text-foreground">{d.page_count ?? '—'}</dd>

                  <dt>Fields extracted</dt>
                  <dd className="text-foreground">{fields.length}</dd>

                  <dt>Overall confidence</dt>
                  <dd className="text-foreground">{avgConf == null ? '—' : `${Math.round(avgConf * 100)}%`}</dd>

                  <dt>Low-confidence fields</dt>
                  <dd className={cn('text-foreground', lowConf > 0 && 'font-medium text-amber-700')}>{lowConf}</dd>

                  <dt>Last manual review</dt>
                  <dd className="text-foreground">
                    {d.verified_at ? `${new Date(d.verified_at).toLocaleString()} · ${d.verified_by ?? '—'}` : '—'}
                  </dd>

                  <dt>Upload batch id</dt>
                  <dd className="flex items-center gap-1 font-mono text-foreground" title={d.upload_id}>
                    {shortId(d.upload_id)} <CopyButton value={d.upload_id} />
                  </dd>

                  <dt>Lifecycle state</dt>
                  <dd>
                    <span className={cn('rounded px-1.5 py-0.5 ring-1 uppercase tracking-wider', statePill(d.document_state))}>
                      {d.document_state.replace('_', ' ')}
                    </span>
                  </dd>
                </dl>

                {d.ocr_error && (
                  <div className="mt-2 rounded bg-rose-50 px-2 py-1 text-rose-700 ring-1 ring-rose-200">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest">
                      <AlertTriangle className="size-3" /> Processing error
                    </div>
                    <div className="mt-0.5">{d.ocr_error}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

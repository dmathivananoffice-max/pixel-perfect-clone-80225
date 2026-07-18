import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles, ScanText, FileSearch, Users, ShieldCheck, CheckCircle2,
  UploadCloud, FileArchive, Loader2,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const STEPS = [
  { icon: UploadCloud,  label: 'Uploading to secure storage',      short: 'Upload' },
  { icon: FileArchive,  label: 'Extracting archives & folders',    short: 'Extract' },
  { icon: FileSearch,   label: 'Classifying document types',       short: 'Classify' },
  { icon: ScanText,     label: 'Running OCR on every page',        short: 'OCR' },
  { icon: Sparkles,     label: 'AI extraction of structured fields', short: 'AI Extract' },
  { icon: Users,        label: 'Building candidate drafts',        short: 'Drafts' },
];

export function ProcessingStep({
  fileCount, run, onDone, onError,
}: {
  fileCount: number;
  /** Async work (uploads + DB inserts). Progress bar caps at 90% until this resolves. */
  run?: () => Promise<void>;
  onDone: () => void;
  onError?: (err: string) => void;
}) {
  const [pct, setPct] = useState(0);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const doneRef = useRef(false);
  const finishedRef = useRef(false);
  const startedRef = useRef(false);
  const startedAt = useRef(Date.now());

  // Kick off the real work once
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!run) { doneRef.current = true; return; }
    let cancelled = false;
    run()
      .then(() => { if (!cancelled) doneRef.current = true; })
      .catch((err) => {
        if (cancelled) return;
        doneRef.current = true;
        onError?.(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, []);

  // Progress ticker
  useEffect(() => {
    const t = setInterval(() => {
      setPct((p) => {
        const cap = doneRef.current ? 100 : 90;
        return Math.min(cap, p + 3 + Math.random() * 5);
      });
      setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
    }, 220);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const s = Math.min(STEPS.length - 1, Math.floor((pct / 100) * STEPS.length));
    setStep(s);
    if (pct >= 100 && !finishedRef.current) {
      finishedRef.current = true;
      const t = setTimeout(onDone, 600);
      return () => clearTimeout(t);
    }
  }, [pct, onDone]);

  const currentLabel = useMemo(
    () => (pct >= 100 ? 'Finalising drafts' : STEPS[step]?.short ?? 'Processing'),
    [pct, step],
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-14">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
            <Sparkles className="size-7 animate-pulse" />
          </div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Step 4 of 6 · Command Center</p>
          <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Processing your batch
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {fileCount} file{fileCount === 1 ? '' : 's'} · every stage is visible below
          </p>
        </div>

        {/* Master progress */}
        <div className="mt-10 rounded-2xl border border-border/60 bg-background p-6">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Loader2 className={cn('size-4 text-primary', pct < 100 && 'animate-spin')} />
              {currentLabel}
            </div>
            <div className="flex items-center gap-4 text-[11px] tabular-nums text-muted-foreground">
              <span>Elapsed {elapsed}s</span>
              <span className="font-medium text-foreground">{Math.round(pct)}%</span>
            </div>
          </div>
          <Progress value={pct} className="mt-3 h-2" />
        </div>

        {/* Pipeline stages */}
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {STEPS.map((s, i) => {
            const done = i < step || pct >= 100;
            const active = i === step && pct < 100;
            const Icon = s.icon;
            // Per-stage progress: derive from overall pct
            const stageStart = (i / STEPS.length) * 100;
            const stageEnd = ((i + 1) / STEPS.length) * 100;
            const stagePct = pct <= stageStart ? 0
              : pct >= stageEnd ? 100
              : ((pct - stageStart) / (stageEnd - stageStart)) * 100;
            return (
              <div
                key={s.label}
                className={cn(
                  'rounded-xl border p-4 transition',
                  done   ? 'border-emerald-200 bg-emerald-50/40' :
                  active ? 'border-primary/40 bg-primary/5 shadow-sm' :
                           'border-border/60 bg-background',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                    done ? 'bg-emerald-500 text-white' :
                    active ? 'bg-primary text-primary-foreground' :
                             'bg-muted text-muted-foreground',
                  )}>
                    {done
                      ? <CheckCircle2 className="size-4" />
                      : <Icon className={cn('size-4', active && 'animate-pulse')} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn(
                        'truncate text-sm font-medium',
                        done ? 'text-emerald-900' :
                        active ? 'text-foreground' : 'text-muted-foreground',
                      )}>
                        {s.label}
                      </p>
                      <span className={cn(
                        'shrink-0 text-[10px] font-medium uppercase tracking-widest tabular-nums',
                        done ? 'text-emerald-700' :
                        active ? 'text-primary' : 'text-muted-foreground/70',
                      )}>
                        {done ? 'Done' : active ? `${Math.round(stagePct)}%` : 'Queued'}
                      </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full transition-all',
                          done ? 'bg-emerald-500' : active ? 'bg-primary' : 'bg-transparent',
                        )}
                        style={{ width: `${done ? 100 : active ? stagePct : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-600" />
          Documents are being uploaded to secure storage and linked to candidate records.
        </div>
      </div>
    </div>
  );
}

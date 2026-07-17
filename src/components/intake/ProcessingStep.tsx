import { useEffect, useRef, useState } from 'react';
import { Sparkles, ScanText, FileSearch, Users, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const STEPS = [
  { icon: ScanText,   label: 'OCR every page' },
  { icon: FileSearch, label: 'Classify documents' },
  { icon: Users,      label: 'Group by candidate' },
  { icon: Sparkles,   label: 'Extract structured fields' },
  { icon: ShieldCheck,label: 'Detect duplicates & missing' },
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
  const doneRef = useRef(false);
  const finishedRef = useRef(false);

  // Kick off the real work once
  useEffect(() => {
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
  }, [run, onError]);

  useEffect(() => {
    const t = setInterval(() => {
      setPct((p) => {
        const cap = doneRef.current ? 100 : 90;
        const next = Math.min(cap, p + 4 + Math.random() * 6);
        return next;
      });
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

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
        <div className="text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
            <Sparkles className="size-7 animate-pulse" />
          </div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Step 4 of 6</p>
          <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            AI is reading your documents
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {fileCount} file{fileCount === 1 ? '' : 's'} · uploading & extracting in parallel
          </p>
        </div>

        <div className="mt-10">
          <Progress value={pct} className="h-2" />
          <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted-foreground">
            <span>{Math.round(pct)}%</span>
            <span>{pct >= 100 ? 'Finalising…' : 'Processing…'}</span>
          </div>
        </div>

        <ul className="mt-10 space-y-3">
          {STEPS.map((s, i) => {
            const done = i < step || pct >= 100;
            const active = i === step && pct < 100;
            const Icon = s.icon;
            return (
              <li
                key={s.label}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3 transition',
                  done  ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900' :
                  active ? 'border-primary/40 bg-primary/5 text-foreground' :
                           'border-border/60 bg-background text-muted-foreground',
                )}
              >
                <div className={cn(
                  'flex size-8 items-center justify-center rounded-lg',
                  done ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted',
                )}>
                  {done ? <CheckCircle2 className="size-4" /> : <Icon className={cn('size-4', active && 'animate-pulse')} />}
                </div>
                <span className="text-sm font-medium">{s.label}</span>
                {active && (
                  <span className="ml-auto text-[11px] font-medium uppercase tracking-widest text-primary">
                    Running
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Documents are being uploaded to secure storage and linked to candidate records.
        </p>
      </div>
    </div>
  );
}

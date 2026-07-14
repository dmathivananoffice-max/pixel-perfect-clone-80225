import { User, Users2, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { IntakeMode } from '@/lib/intake/batch';

export function IntakeTypeStep({
  mode, setMode, onContinue,
}: {
  mode: IntakeMode | null;
  setMode: (m: IntakeMode) => void;
  onContinue: () => void;
}) {
  const options: { id: IntakeMode; icon: typeof User; title: string; sub: string; blurb: string }[] = [
    {
      id: 'single',
      icon: User,
      title: 'Single candidate',
      sub: 'One person · guided workflow',
      blurb: 'Upload one candidate\u2019s documents and walk through AI-assisted verification section by section.',
    },
    {
      id: 'bulk',
      icon: Users2,
      title: 'Multiple candidates',
      sub: 'Batch upload · AI mission control',
      blurb: 'Drop ZIPs, folders, or dozens of files. AI extracts every candidate; you verify from a single dashboard.',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-16">
        <div className="mb-10 text-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
            <Sparkles className="size-3" /> Candidate intake · Step 1 of 6
          </p>
          <h2 className="font-display mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Who are you bringing in today?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Every candidate follows the same intake pipeline. Choose how many.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {options.map((o) => {
            const Icon = o.icon;
            const selected = mode === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setMode(o.id)}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border bg-background p-6 text-left transition',
                  selected
                    ? 'border-primary shadow-lg ring-2 ring-primary/25 -translate-y-0.5'
                    : 'border-border/60 hover:border-border hover:-translate-y-0.5 hover:shadow-md',
                )}
              >
                <div className={cn(
                  'mb-4 inline-flex size-11 items-center justify-center rounded-xl transition',
                  selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                )}>
                  <Icon className="size-5" />
                </div>
                <h3 className="font-display text-xl font-semibold tracking-tight">{o.title}</h3>
                <p className="mt-0.5 text-xs uppercase tracking-widest text-muted-foreground">{o.sub}</p>
                <p className="mt-3 text-sm text-muted-foreground">{o.blurb}</p>
                {selected && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-10 flex items-center justify-center">
          <Button size="lg" onClick={onContinue} disabled={!mode} className="gap-2">
            Continue <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

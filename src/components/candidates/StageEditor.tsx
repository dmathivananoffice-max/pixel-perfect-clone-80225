import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAGES, nextStages, stageMeta, TONE_CLASSES } from '@/lib/workflow';
import type { CandidateStatus } from '@/types';

interface Props {
  status: CandidateStatus;
  onChange: (next: CandidateStatus, note?: string) => void;
  disabled?: boolean;
}

export function StageEditor({ status, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<CandidateStatus | null>(null);
  const [note, setNote] = useState('');
  const meta = stageMeta(status);
  const options = nextStages(status);
  const allOptions = options.length ? options : STAGES.filter((s) => s.id !== status);

  const commit = (target: CandidateStatus) => {
    onChange(target, note.trim() || undefined);
    setOpen(false);
    setSelection(null);
    setNote('');
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelection(null); setNote(''); } }}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors hover:ring-2',
            TONE_CLASSES[meta.tone],
            disabled && 'opacity-60 pointer-events-none',
          )}
        >
          <span className="size-1.5 rounded-full bg-current opacity-70" />
          {meta.label}
          <ChevronDown className="size-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {!selection ? (
          <div className="p-1">
            <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Move to
            </p>
            {allOptions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelection(s.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <span className={cn('inline-flex size-2 rounded-full', TONE_CLASSES[s.tone].split(' ')[0])} />
                <span className="flex-1 text-left">{s.label}</span>
                {s.id === status && <Check className="size-3.5 text-muted-foreground" />}
              </button>
            ))}
            {options.length === 0 && (
              <p className="px-2 py-1 text-[11px] italic text-muted-foreground">
                Manual override — this stage is terminal.
              </p>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-2.5">
            <div>
              <p className="text-xs text-muted-foreground">Moving to</p>
              <p className="text-sm font-medium">{stageMeta(selection).label}</p>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                Note (optional, {120 - note.length} left)
              </label>
              <Textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 120))}
                placeholder="e.g. Excellent pronunciation"
                className="mt-1 h-16 resize-none text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setSelection(null)}>
                Back
              </Button>
              <Button size="sm" onClick={() => commit(selection)}>
                Confirm
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

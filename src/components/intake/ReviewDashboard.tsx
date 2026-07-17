import { useMemo, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, FileText, FolderTree, GitMerge, X, Search, ArrowRight,
  Sparkles, CheckCircle2, ChevronDown, ChevronRight, Users2, FileX2, Eye, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { BatchCandidate, BatchStatus, IntakeBatch, FieldFocus } from '@/lib/intake/batch';
import { statusMeta } from '@/lib/intake/batch';

type CardId = 'ready' | 'duplicate' | 'missing_docs' | 'manual_review' | 'low_confidence' | 'approved';
type SortId = 'priority' | 'name' | 'country' | 'confidence';

export function ReviewDashboard({
  batch, approvedIds, resumableIds, onBack, onVerify, onApproveInline,
}: {
  batch: IntakeBatch;
  approvedIds: Set<string>;
  /** Candidates with a saved partial-verification snapshot — show "Resume". */
  resumableIds?: Set<string>;
  onBack: () => void;
  /** Open Candidate Verification Studio. Optional focus tells it where to land. */
  onVerify: (candidateId: string, focus?: FieldFocus) => void;
  onApproveInline?: (candidateId: string) => void;
}) {
  const candidates = useMemo(
    () => batch.candidates.map((c) => (approvedIds.has(c.id) ? { ...c, status: 'approved' as BatchStatus } : c)),
    [batch, approvedIds],
  );

  const counts = useMemo(() => {
    const c = { ready: 0, duplicate: 0, missing_docs: 0, manual_review: 0, low_confidence: 0, approved: 0 } as Record<CardId, number>;
    candidates.forEach((x) => { c[x.status as CardId] += 1; });
    return c;
  }, [candidates]);

  const total = candidates.length;
  const extractionAvg = Math.round(
    (candidates.reduce((s, c) => s + c.extractionConfidence, 0) / Math.max(1, total)) * 1000,
  ) / 10;

  const [activeCard, setActiveCard] = useState<CardId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortId>('priority');
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set([candidates[0]?.id ?? '']));

  const filtered = useMemo(() => {
    let list = candidates;
    if (activeCard !== 'all') list = list.filter((c) => c.status === activeCard);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
      );
    }
    const priority: Record<BatchStatus, number> = {
      manual_review: 0, duplicate: 1, missing_docs: 2, low_confidence: 3, ready: 4, approved: 5,
    };
    list = [...list].sort((a, b) => {
      if (sort === 'name')    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      if (sort === 'country') return a.country.localeCompare(b.country);
      if (sort === 'confidence') return b.extractionConfidence - a.extractionConfidence;
      return priority[a.status] - priority[b.status];
    });
    return list;
  }, [candidates, activeCard, query, sort]);

  const cards: { id: CardId; label: string; hint: string; tone: string; icon: typeof ShieldCheck }[] = [
    { id: 'ready',          label: 'Ready for verification', hint: 'Extraction complete',         tone: 'text-emerald-700',  icon: ShieldCheck },
    { id: 'duplicate',      label: 'Possible duplicates',    hint: 'Requires human decision',     tone: 'text-amber-700',    icon: GitMerge },
    { id: 'missing_docs',   label: 'Missing documents',      hint: 'One or more docs not found',  tone: 'text-rose-700',     icon: FileX2 },
    { id: 'manual_review',  label: 'Manual review',          hint: 'AI could not extract a field',tone: 'text-violet-700',   icon: Eye },
    { id: 'low_confidence', label: 'Low AI confidence',      hint: 'Recheck key fields',          tone: 'text-orange-700',   icon: AlertTriangle },
    { id: 'approved',       label: 'Verification complete',  hint: 'Approved into production',    tone: 'text-emerald-800',  icon: CheckCircle2 },
  ];

  const duplicates = candidates.filter((c) => c.status === 'duplicate');
  const missing    = candidates.filter((c) => c.status === 'missing_docs');
  const manual     = candidates.filter((c) => c.status === 'manual_review');

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
              <Sparkles className="size-3" /> Step 5 of 6 · AI Mission Control
            </p>
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {batch.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Product · <span className="font-medium text-foreground">{batch.productLabel}</span></span>
              <span aria-hidden>·</span>
              <span>{total} candidate{total === 1 ? '' : 's'} uploaded</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Sparkles className="size-3 text-primary" /> {extractionAvg}% extraction success
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <X className="size-4" /> Close batch
          </Button>
        </div>

        {/* Status cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatusCard
            selected={activeCard === 'all'}
            onClick={() => setActiveCard('all')}
            label="All candidates"
            hint="Full batch overview"
            value={total}
            tone="text-slate-700"
            icon={Users2}
          />
          {cards.map((c) => (
            <StatusCard
              key={c.id}
              selected={activeCard === c.id}
              onClick={() => setActiveCard(c.id)}
              label={c.label}
              hint={c.hint}
              value={counts[c.id]}
              tone={c.tone}
              icon={c.icon}
            />
          ))}
        </div>

        {/* Resolution centres */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <DuplicateCentre duplicates={duplicates} candidates={candidates} onVerify={onVerify} />
          <IssueCentre
            title="Missing documents"
            icon={FileX2}
            tone="rose"
            empty="No missing documents in this batch."
            items={missing.map((c) => {
              const miss = c.documents.filter((d) => !d.present);
              return {
                id: c.id,
                name: `${c.firstName} ${c.lastName}`,
                sub: `${miss.length} document${miss.length === 1 ? '' : 's'} missing · ${miss.map((m) => m.label).join(', ')}`,
                action: 'Open folder',
                focus: { section: 'documents', fieldKey: miss[0]?.key ?? '' } as FieldFocus,
              };
            })}
            onOpen={onVerify}
          />
        </div>

        <div className="mt-6">
          <IssueCentre
            title="Manual review queue"
            icon={Eye}
            tone="violet"
            empty="No manual review items."
            items={manual.map((c) => ({
              id: c.id,
              name: `${c.firstName} ${c.lastName}`,
              sub: c.focus?.reason ?? 'Field requires attention',
              action: 'Open review',
              focus: c.focus,
            }))}
            onOpen={onVerify}
          />
        </div>

        {/* Folder tree + Queue */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">

          {/* Folder tree */}
          <div className="rounded-xl border border-border/60 bg-background">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <FolderTree className="size-4 text-muted-foreground" />
              <div className="text-sm font-medium">Upload folder</div>
              <div className="ml-auto text-[11px] text-muted-foreground">{batch.name}</div>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2 text-sm">
              {candidates.slice(0, 30).map((c) => {
                const open = openFolders.has(c.id);
                return (
                  <div key={c.id} className="rounded-md">
                    <button
                      onClick={() => {
                        setOpenFolders((prev) => {
                          const next = new Set(prev);
                          next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                          return next;
                        });
                      }}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-muted/60"
                    >
                      {open ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
                      <FolderTree className="size-3.5 text-muted-foreground" />
                      <span className="truncate font-medium">{c.firstName} {c.lastName}</span>
                      <span className={cn('ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1', statusMeta(c.status).tone)}>
                        {statusMeta(c.status).label}
                      </span>
                    </button>
                    {open && (
                      <ul className="ml-6 border-l border-border/60 pl-2">
                        {c.documents.map((d) => (
                          <li key={d.key}>
                            <button
                              onClick={() => onVerify(c.id, { section: 'documents', fieldKey: d.key })}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] hover:bg-muted/60',
                                !d.present && 'text-rose-700',
                              )}
                            >
                              {d.present
                                ? <CheckCircle2 className="size-3 text-emerald-600" />
                                : <AlertTriangle className="size-3 text-rose-500" />}
                              <FileText className="size-3 text-muted-foreground" />
                              <span className="truncate">{d.label}</span>
                              {d.present && d.confidence != null && (
                                <span className="ml-auto tabular-nums text-[10px] text-muted-foreground">
                                  {Math.round(d.confidence * 100)}%
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Queue */}
          <div className="rounded-xl border border-border/60 bg-background">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
              <div className="text-sm font-medium">Candidate verification queue</div>
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, country…"
                    className="h-8 w-52 pl-7 text-xs"
                  />
                </div>
                <Select value={sort} onValueChange={(v) => setSort(v as SortId)}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <Filter className="mr-1 size-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="country">Country</SelectItem>
                    <SelectItem value="confidence">Confidence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ul className="max-h-[520px] divide-y divide-border/40 overflow-y-auto">
              {filtered.length === 0 && (
                <li className="p-6 text-center text-sm text-muted-foreground">No candidates match this filter.</li>
              )}
              {filtered.map((c) => {
                const meta = statusMeta(c.status);
                const done = c.status === 'approved';
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/40"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-foreground">
                      {c.firstName[0]}{c.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{c.firstName} {c.lastName}</span>
                        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1', meta.tone)}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{c.country}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate">{c.email}</span>
                      </div>
                    </div>
                    <div className="hidden w-24 shrink-0 sm:block">
                      <Progress value={c.extractionConfidence * 100} className="h-1" />
                      <div className="mt-0.5 text-right text-[10px] tabular-nums text-muted-foreground">
                        {Math.round(c.extractionConfidence * 100)}%
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={done ? 'ghost' : 'outline'}
                      onClick={() => onVerify(c.id, c.focus)}
                      className="gap-1.5"
                      disabled={done}
                    >
                      {done ? <><CheckCircle2 className="size-3.5 text-emerald-600" /> Approved</> : <>Verify <ArrowRight className="size-3.5" /></>}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  label, hint, value, tone, icon: Icon, selected, onClick,
}: {
  label: string; hint: string; value: number; tone: string;
  icon: typeof ShieldCheck; selected?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex items-center gap-4 rounded-xl border bg-background p-4 text-left transition',
        selected
          ? 'border-primary shadow-sm ring-2 ring-primary/25'
          : 'border-border/60 hover:border-border hover:shadow-sm',
      )}
    >
      <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted', tone)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="truncate text-sm font-medium">{label}</div>
          <div className={cn('font-display text-2xl font-semibold tabular-nums', tone)}>{value}</div>
        </div>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </button>
  );
}

function DuplicateCentre({
  duplicates, candidates, onVerify,
}: {
  duplicates: BatchCandidate[];
  candidates: BatchCandidate[];
  onVerify: (id: string, focus?: FieldFocus) => void;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40">
      <div className="flex items-center gap-2 border-b border-amber-200/70 px-4 py-3">
        <GitMerge className="size-4 text-amber-700" />
        <div className="text-sm font-medium text-amber-900">Duplicate resolution centre</div>
        <div className="ml-auto text-[11px] text-amber-800">
          {duplicates.length} pair{duplicates.length === 1 ? '' : 's'}
        </div>
      </div>
      <div className="max-h-[420px] divide-y divide-amber-200/60 overflow-y-auto">
        {duplicates.length === 0 && (
          <div className="p-6 text-center text-sm text-amber-900/80">No duplicates detected. Nice batch.</div>
        )}
        {duplicates.map((c) => {
          const other = candidates.find((x) => x.id === c.duplicateOf);
          if (!other) return null;
          const sim = Math.round((c.similarity ?? 0) * 100);
          const rows: [string, string, string][] = [
            ['Name',    `${c.firstName} ${c.lastName}`, `${other.firstName} ${other.lastName}`],
            ['Country', c.country, other.country],
            ['Email',   c.email,   other.email],
          ];
          return (
            <div key={c.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-widest text-amber-900">Possible duplicate</span>
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1',
                  sim >= 95 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-100 text-amber-900 ring-amber-200',
                )}>
                  Similarity {sim}%
                </span>
              </div>
              <div className="grid grid-cols-[minmax(0,80px)_1fr_1fr] gap-x-3 gap-y-1 rounded-lg bg-background/60 p-3 text-xs">
                <div />
                <div className="font-medium">Candidate A</div>
                <div className="font-medium">Candidate B</div>
                {rows.map(([label, a, b]) => (
                  <div key={label} className="contents">
                    <div className="text-muted-foreground">{label}</div>
                    <div className={cn('truncate', a === b && 'text-rose-700 font-medium')}>{a}</div>
                    <div className={cn('truncate', a === b && 'text-rose-700 font-medium')}>{b}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <GitMerge className="size-3.5" /> Merge records
                </Button>
                <Button size="sm" variant="outline">Update existing</Button>
                <Button size="sm" variant="outline">Keep separate</Button>
                <Button size="sm" variant="ghost" onClick={() => onVerify(c.id)} className="ml-auto gap-1.5">
                  Review <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IssueCentre({
  title, icon: Icon, tone, empty, items, onOpen,
}: {
  title: string;
  icon: typeof AlertTriangle;
  tone: 'rose' | 'violet';
  empty: string;
  items: { id: string; name: string; sub: string; action: string; focus?: FieldFocus }[];
  onOpen: (id: string, focus?: FieldFocus) => void;
}) {
  const toneClass = tone === 'rose'
    ? 'border-rose-200 bg-rose-50/40'
    : 'border-violet-200 bg-violet-50/40';
  const headTone = tone === 'rose' ? 'text-rose-700' : 'text-violet-700';
  const headBorder = tone === 'rose' ? 'border-rose-200/70' : 'border-violet-200/70';

  return (
    <div className={cn('rounded-xl border', toneClass)}>
      <div className={cn('flex items-center gap-2 border-b px-4 py-3', headBorder)}>
        <Icon className={cn('size-4', headTone)} />
        <div className={cn('text-sm font-medium', headTone)}>{title}</div>
        <div className="ml-auto text-[11px] text-muted-foreground">
          {items.length} item{items.length === 1 ? '' : 's'}
        </div>
      </div>
      <ul className="max-h-[260px] divide-y divide-border/40 overflow-y-auto">
        {items.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{empty}</li>}
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 px-4 py-3 hover:bg-background/60">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{it.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{it.sub}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => onOpen(it.id, it.focus)} className="gap-1.5">
              {it.action} <ArrowRight className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

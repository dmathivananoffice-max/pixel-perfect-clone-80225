import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

import { mockCandidates } from '@/lib/mockData';
import { PRODUCTS, type ProductId } from '@/config/products';
import { useProductStore } from '@/store/productStore';
import { getCountry, COUNTRY_GROUPS } from '@/lib/countries';
import {
  stageMeta,
  deriveLanguageLevel, deriveSpeakingScore, deriveTrainingScore, deriveInterviewScore,
  deriveLastActivity, placementReadiness, READINESS_CLASSES,
} from '@/lib/workflow';
import type { Candidate, CandidateStatus } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Kbd } from '@/components/candidates/Kbd';
import { ProductSelector } from '@/components/dashboard/ProductSelector';
import { FiltersPanel, type FiltersState } from '@/components/candidates/FiltersPanel';
import { StageEditor } from '@/components/candidates/StageEditor';
import { BulkActionsBar } from '@/components/candidates/BulkActionsBar';

import { CommandPalette } from '@/components/candidates/CommandPalette';
import { CandidateDrawer } from '@/components/candidates/CandidateDrawer';

import {
  Plus, Search, SlidersHorizontal, Download, Upload, Command as CommandIcon,
  MoreHorizontal, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const emptyFilters: FiltersState = {
  products: [],
  stages: [],
  countries: [],
  countryGroups: [],
  langLevels: [],
  agencies: [],
};

// Map candidate to product id (rough heuristic on program_name).
function inferProduct(c: Candidate): ProductId {
  const p = (c.program_name || '').toLowerCase();
  if (p.includes('ausbildung')) return 'ausbildung';
  if (p.includes('nurs') || p.includes('pflege')) return 'nurses';
  if (p.includes('mba')) return 'mba';
  if (p.includes('master')) return 'pre_masters';
  if (p.includes('bachelor')) return 'pre_bachelor';
  return 'nurses';
}

export default function CandidateList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const globalProduct = useProductStore((s) => s.selectedProductId);

  // URL-synced state
  const q = searchParams.get('q') ?? '';
  const openId = searchParams.get('open');
  const productFilter = (searchParams.get('product') as ProductId | null) ?? globalProduct;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value == null || value === '') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  // Local UI state
  const [filters, setFilters] = useState<FiltersState>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const goAdd = () => navigate('/candidates/new');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [rowOverrides, setRowOverrides] = useState<Record<string, CandidateStatus>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  // Filtered dataset
  const candidates = useMemo(() => {
    let data = mockCandidates.map((c) => ({
      ...c,
      status: rowOverrides[c.candidate_id] ?? c.status,
    }));

    const useProduct: ProductId = productFilter ?? 'all';
    if (useProduct !== 'all') data = data.filter((c) => inferProduct(c) === useProduct);
    if (filters.products.length) {
      data = data.filter((c) => filters.products.includes(inferProduct(c)));
    }
    if (filters.stages.length) data = data.filter((c) => filters.stages.includes(c.status));
    if (filters.countries.length) data = data.filter((c) => filters.countries.includes(c.country));
    if (filters.countryGroups.length) {
      const set = new Set<string>();
      filters.countryGroups.forEach((g) => COUNTRY_GROUPS[g]?.forEach((c) => set.add(c)));
      data = data.filter((c) => set.has(c.country));
    }
    if (filters.langLevels.length) {
      data = data.filter((c) => filters.langLevels.includes(deriveLanguageLevel(c.candidate_id)));
    }
    if (filters.agencies.length) {
      data = data.filter((c) => c.source_agency_id && filters.agencies.includes(c.source_agency_id));
    }
    if (filters.scoreMin != null) data = data.filter((c) => (c.total_score ?? 0) >= filters.scoreMin!);
    if (filters.scoreMax != null) data = data.filter((c) => (c.total_score ?? 0) <= filters.scoreMax!);
    if (filters.placementReady) data = data.filter((c) => c.gate_status === 'eligible');
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      data = data.filter((c) =>
        `${c.first_name} ${c.last_name} ${c.email} ${c.country} ${c.program_name}`.toLowerCase().includes(needle),
      );
    }

    return data;
  }, [productFilter, filters, q, rowOverrides]);

  const allSelected = candidates.length > 0 && candidates.every((c) => selection.has(c.candidate_id));
  const someSelected = candidates.some((c) => selection.has(c.candidate_id)) && !allSelected;
  const toggleAll = () => {
    const next = new Set(selection);
    if (allSelected) candidates.forEach((c) => next.delete(c.candidate_id));
    else candidates.forEach((c) => next.add(c.candidate_id));
    setSelection(next);
  };
  const toggleRow = (id: string) => {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelection(next);
  };

  // Stage change with undo
  const handleStageChange = (candidate: Candidate, next: CandidateStatus, note?: string) => {
    const prev = candidate.status;
    setRowOverrides((s) => ({ ...s, [candidate.candidate_id]: next }));
    toast.success(
      `${candidate.first_name} ${candidate.last_name} → ${stageMeta(next).label}`,
      {
        description: note ? `Note: ${note}` : undefined,
        action: {
          label: 'Undo',
          onClick: () => setRowOverrides((s) => ({ ...s, [candidate.candidate_id]: prev })),
        },
        duration: 5000,
      },
    );
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setPaletteOpen((v) => !v); return;
      }
      if (inField) return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key.toLowerCase() === 'a') { e.preventDefault(); goAdd(); return; }
      if (e.key.toLowerCase() === 'f') { e.preventDefault(); setFiltersOpen(true); return; }
      if (e.key === 'Escape') {
        if (openId) setParam('open', null);
        setSelection(new Set());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const activeFilterCount =
    filters.products.length + filters.stages.length + filters.countries.length +
    filters.countryGroups.length + filters.langLevels.length + filters.agencies.length +
    (filters.scoreMin != null ? 1 : 0) + (filters.scoreMax != null ? 1 : 0) +
    (filters.placementReady ? 1 : 0);

  const exportCSV = () => toast.success('Export queued', { description: `${candidates.length} rows` });
  const importCSV = () => toast('Import wizard — coming soon');

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative">
        {/* ── Sticky header ─────────────────────────────────── */}
        <div className="sticky top-16 z-20 -mx-4 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">Candidate Intelligence</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                <span className="tabular-nums">{candidates.length}</span> of{' '}
                <span className="tabular-nums">{mockCandidates.length}</span> candidates
                {productFilter && productFilter !== 'all' && (
                  <> · {PRODUCTS.find((p) => p.id === productFilter)?.label}</>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ProductSelector />
              <Button variant="outline" size="sm" onClick={() => setPaletteOpen(true)} className="gap-2">
                <CommandIcon className="size-3.5" />
                <span className="hidden sm:inline">Quick</span>
                <Kbd>⌘K</Kbd>
              </Button>
              <Button size="sm" className="gap-1.5 shadow-sm" onClick={goAdd}>
                <Plus className="size-4" /> Add candidate
                <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground/80">A</Kbd>
              </Button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={q}
                onChange={(e) => setParam('q', e.target.value)}
                placeholder="Search name, email, country, program…"
                className="h-9 pl-9 pr-16"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                <Kbd>/</Kbd>
              </span>
            </div>

            <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)} className="gap-1.5">
              <SlidersHorizontal className="size-4" /> Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setFilters(emptyFilters)}>
                <X className="size-3.5" /> Clear
              </Button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={importCSV} className="gap-1.5">
                <Upload className="size-4" /> Import
              </Button>
              <Button variant="ghost" size="sm" onClick={exportCSV} className="gap-1.5">
                <Download className="size-4" /> Export
              </Button>
            </div>
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────────── */}
        <div className="mt-4 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-sm">
              <thead className="bg-muted/40">
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Th className="w-10 text-center">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </Th>
                  <Th className="w-12 text-center">Rank</Th>
                  <Th>Candidate</Th>
                  <Th>Product</Th>
                  <Th>Country</Th>
                  <Th>Current Stage</Th>
                  <Th className="text-right">AI Score</Th>
                  <Th className="text-center">Lang</Th>
                  <Th className="text-right">Speaking</Th>
                  <Th className="text-right">Training</Th>
                  <Th className="text-right">Interview</Th>
                  <Th>Placement Readiness</Th>
                  <Th>Recruiter</Th>
                  <Th>Last activity</Th>
                  <Th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 && (
                  <tr>
                    <td colSpan={15} className="py-16 text-center text-sm text-muted-foreground">
                      No candidates match your filters.
                    </td>
                  </tr>
                )}
                {candidates.map((c) => {
                  const country = getCountry(c.country);
                  
                  const product = PRODUCTS.find((p) => p.id === inferProduct(c))!;
                  const lang = deriveLanguageLevel(c.candidate_id);
                  const speaking = deriveSpeakingScore(c.candidate_id);
                  const training = deriveTrainingScore(c.candidate_id);
                  const interview = deriveInterviewScore(c.candidate_id);
                  const lastAct = deriveLastActivity(c.candidate_id);
                  const isSelected = selection.has(c.candidate_id);
                  const isOpen = openId === c.candidate_id;

                  return (
                    <tr
                      key={c.candidate_id}
                      onClick={() => setParam('open', c.candidate_id)}
                      className={cn(
                        'group cursor-pointer border-t border-border/60 transition-colors',
                        isSelected && 'bg-primary/[0.04]',
                        isOpen && 'bg-accent/40',
                        'hover:bg-accent/40',
                      )}
                    >
                      <Td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(c.candidate_id)}
                          aria-label={`Select ${c.first_name}`}
                        />
                      </Td>
                      <Td className="text-center text-xs tabular-nums text-muted-foreground">
                        {c.rank ?? '—'}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-500 text-[11px] font-medium text-white">
                              {c.first_name[0]}{c.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate font-medium leading-tight">
                                {c.first_name} {c.last_name}
                              </p>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-base leading-none">{country.flag}</span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p className="text-xs">Nationality · {country.name}</p>
                                  <p className="text-xs">Current · {country.name}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium', product.accent)}>
                          <span>{product.emoji}</span>{product.short}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base leading-none">{country.flag}</span>
                          <span className="text-xs text-foreground/80">{country.name}</span>
                        </div>
                      </Td>
                      <Td onClick={(e) => e.stopPropagation()}>
                        <StageEditor
                          status={c.status}
                          onChange={(next, note) => handleStageChange(c, next, note)}
                        />
                      </Td>
                      <Td className="text-right">
                        {c.total_score != null ? (
                          <div className="flex items-center justify-end gap-2">
                            <div className="hidden w-16 md:block">
                              <Progress value={c.total_score} className="h-1.5" />
                            </div>
                            <span className="w-9 text-right tabular-nums font-medium">{c.total_score.toFixed(0)}</span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </Td>
                      <Td className="text-center">
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                          {lang}
                        </span>
                      </Td>
                      <Td className="text-right tabular-nums">
                        <ScoreCell value={speaking} />
                      </Td>
                      <Td className="text-right tabular-nums">
                        <ScoreCell value={training} />
                      </Td>
                      <Td className="text-right tabular-nums">
                        <ScoreCell value={interview} />
                      </Td>
                      <Td>
                        {(() => {
                          const r = placementReadiness(c.status, c.gate_status);
                          return (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap',
                                READINESS_CLASSES[r.tone],
                              )}
                            >
                              <span aria-hidden className="text-[10px] leading-none">{r.dot}</span>
                              {r.label}
                            </span>
                          );
                        })()}
                      </Td>
                      <Td className="text-xs text-muted-foreground">{c.assigned_recruiter_name ?? '—'}</Td>
                      <Td className="text-xs text-muted-foreground">
                        {formatDistanceToNow(lastAct, { addSuffix: true })}
                      </Td>
                      <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 opacity-0 group-hover:opacity-100"
                          onClick={() => navigate(`/candidates/${c.candidate_id}`)}
                          aria-label="Open full profile"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
            <span>Showing {candidates.length} candidates</span>
            <span className="flex items-center gap-1">
              <Kbd>↑↓</Kbd> navigate · <Kbd>Enter</Kbd> open · <Kbd>A</Kbd> add · <Kbd>/</Kbd> search
            </span>
          </div>
        </div>

        <FiltersPanel
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          value={filters}
          onChange={setFilters}
          onClear={() => setFilters(emptyFilters)}
        />
        <BulkActionsBar
          count={selection.size}
          onClear={() => setSelection(new Set())}
          onAction={() => setSelection(new Set())}
        />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onAddCandidate={goAdd} />
        <CandidateDrawer candidateId={openId} onClose={() => setParam('open', null)} />
      </div>
    </TooltipProvider>
  );
}

function Th({
  children, className,
}: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'h-9 whitespace-nowrap border-b border-border/60 px-3 text-left font-medium',
        className,
      )}
    >
      {children}
    </th>
  );
}
function Td({
  children, className, onClick,
}: {
  children?: React.ReactNode; className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <td
      onClick={onClick}
      className={cn(
        'h-14 whitespace-nowrap px-3 align-middle',
        className,
      )}
    >
      {children}
    </td>
  );
}

function ScoreCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const tone =
    value >= 80 ? 'text-emerald-700' : value >= 60 ? 'text-slate-700' : 'text-amber-700';
  return <span className={cn('font-medium', tone)}>{value.toFixed(0)}</span>;
}

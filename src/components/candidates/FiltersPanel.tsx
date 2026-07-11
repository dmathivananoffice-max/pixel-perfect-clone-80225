import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { STAGES, LANG_LEVELS } from '@/lib/workflow';
import { allCountries, COUNTRY_GROUPS } from '@/lib/countries';
import { PRODUCTS } from '@/config/products';
import { mockAgencies } from '@/lib/mockData';

export interface FiltersState {
  products: string[];
  stages: string[];
  countries: string[];
  countryGroups: string[];
  langLevels: string[];
  agencies: string[];
  scoreMin?: number;
  scoreMax?: number;
  placementReady?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: FiltersState;
  onChange: (next: FiltersState) => void;
  onClear: () => void;
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function FiltersPanel({ open, onOpenChange, value, onChange, onClear }: Props) {
  const activeCount =
    value.products.length + value.stages.length + value.countries.length +
    value.countryGroups.length + value.langLevels.length + value.agencies.length +
    (value.scoreMin != null ? 1 : 0) + (value.scoreMax != null ? 1 : 0) +
    (value.placementReady ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            Filters
            {activeCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {activeCount} active
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-6 px-4 pb-6">
          <Section title="Product">
            <div className="grid grid-cols-1 gap-1.5">
              {PRODUCTS.filter((p) => p.id !== 'all').map((p) => (
                <CheckRow
                  key={p.id}
                  label={`${p.emoji} ${p.label}`}
                  checked={value.products.includes(p.id)}
                  onToggle={() => onChange({ ...value, products: toggle(value.products, p.id) })}
                />
              ))}
            </div>
          </Section>

          <Section title="Workflow stage">
            <div className="grid grid-cols-2 gap-1.5">
              {STAGES.map((s) => (
                <CheckRow
                  key={s.id}
                  label={s.label}
                  checked={value.stages.includes(s.id)}
                  onToggle={() => onChange({ ...value, stages: toggle(value.stages, s.id) })}
                />
              ))}
            </div>
          </Section>

          <Section title="Country groups">
            <div className="grid grid-cols-2 gap-1.5">
              {Object.keys(COUNTRY_GROUPS).map((g) => (
                <CheckRow
                  key={g}
                  label={g}
                  checked={value.countryGroups.includes(g)}
                  onToggle={() => onChange({ ...value, countryGroups: toggle(value.countryGroups, g) })}
                />
              ))}
            </div>
          </Section>

          <Section title="Countries">
            <div className="max-h-52 overflow-y-auto rounded-md border p-2 grid grid-cols-2 gap-1">
              {allCountries().map((c) => (
                <CheckRow
                  key={c.code}
                  label={`${c.flag} ${c.name}`}
                  checked={value.countries.includes(c.name)}
                  onToggle={() => onChange({ ...value, countries: toggle(value.countries, c.name) })}
                />
              ))}
            </div>
          </Section>

          <Section title="Language level">
            <div className="flex flex-wrap gap-1.5">
              {LANG_LEVELS.map((l) => {
                const active = value.langLevels.includes(l);
                return (
                  <button
                    key={l}
                    onClick={() => onChange({ ...value, langLevels: toggle(value.langLevels, l) })}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                      active
                        ? 'bg-primary text-primary-foreground ring-primary'
                        : 'bg-background text-foreground ring-border hover:bg-accent'
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Agency">
            <div className="grid grid-cols-1 gap-1.5">
              {mockAgencies.map((a) => (
                <CheckRow
                  key={a.id}
                  label={a.agency_name}
                  checked={value.agencies.includes(a.id)}
                  onToggle={() => onChange({ ...value, agencies: toggle(value.agencies, a.id) })}
                />
              ))}
            </div>
          </Section>

          <Section title="AI score">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Min</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={value.scoreMin ?? ''}
                  onChange={(e) =>
                    onChange({ ...value, scoreMin: e.target.value === '' ? undefined : Number(e.target.value) })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Max</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={value.scoreMax ?? ''}
                  onChange={(e) =>
                    onChange({ ...value, scoreMax: e.target.value === '' ? undefined : Number(e.target.value) })
                  }
                  placeholder="100"
                />
              </div>
            </div>
          </Section>

          <Section title="Readiness">
            <CheckRow
              label="Placement ready only"
              checked={!!value.placementReady}
              onToggle={() => onChange({ ...value, placementReady: !value.placementReady })}
            />
          </Section>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <Button variant="ghost" size="sm" onClick={onClear}>Clear all</Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function CheckRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <span className="truncate">{label}</span>
    </label>
  );
}

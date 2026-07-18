import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import { useAllCandidates } from '@/hooks/useAllCandidates';
import { PRODUCTS } from '@/config/products';
import { useProductStore } from '@/store/productStore';
import { getCountry } from '@/lib/countries';
import { Home, Users, ClipboardCheck, Briefcase, BarChart3, UserPlus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAddCandidate: () => void;
}

export function CommandPalette({ open, onOpenChange, onAddCandidate }: Props) {
  const navigate = useNavigate();
  const setProduct = useProductStore((s) => s.setProduct);
  const [q, setQ] = useState('');
  const { candidates } = useAllCandidates();

  useEffect(() => { if (!open) setQ(''); }, [open]);

  const run = (fn: () => void) => { onOpenChange(false); setTimeout(fn, 0); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search candidates, jump to page, run action…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(onAddCandidate)}>
            <UserPlus className="size-4" /> Add candidate
            <span className="ml-auto text-[10px] text-muted-foreground">A</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => run(() => navigate('/dashboard'))}><Home className="size-4"/> Dashboard</CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/candidates'))}><Users className="size-4"/> Candidates</CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/sti'))}><ClipboardCheck className="size-4"/> Assessments</CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/recruiter'))}><Briefcase className="size-4"/> Recruiter hub</CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/reports'))}><BarChart3 className="size-4"/> Reports</CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Switch product">
          {PRODUCTS.map((p) => (
            <CommandItem key={p.id} onSelect={() => run(() => setProduct(p.id))}>
              <span>{p.emoji}</span> {p.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Candidates">
          {candidates.length === 0 && (
            <CommandItem disabled>No candidates uploaded yet.</CommandItem>
          )}
          {candidates.slice(0, 40).map((c) => {
            const flag = getCountry(c.country).flag;
            return (
              <CommandItem
                key={c.candidate_id}
                value={`${c.first_name} ${c.last_name} ${c.email} ${c.country}`}
                onSelect={() => run(() => navigate(`/candidates?open=${c.candidate_id}`))}
              >
                <span className="text-base leading-none">{flag}</span>
                <span>{c.first_name} {c.last_name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{c.program_name}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

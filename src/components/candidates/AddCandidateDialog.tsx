import { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRODUCTS } from '@/config/products';
import { allCountries } from '@/lib/countries';
import { mockCandidates } from '@/lib/mockData';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AddCandidateDialog({ open, onOpenChange }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [product, setProduct] = useState('nurses');

  const duplicate = useMemo(() => {
    const e = email.trim().toLowerCase();
    const p = phone.replace(/\D/g, '');
    if (!e && !p) return null;
    return mockCandidates.find(
      (c) =>
        (e && c.email.toLowerCase() === e) ||
        (p && c.phone.replace(/\D/g, '') === p),
    );
  }, [email, phone]);

  const reset = () => {
    setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setCountry(''); setProduct('nurses');
  };
  const submit = () => {
    if (!firstName || !lastName || !email) {
      toast.error('First name, last name and email are required');
      return;
    }
    toast.success('Candidate added', { description: `${firstName} ${lastName} · ${country || 'unknown'}` });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add candidate</DialogTitle>
          <DialogDescription>Quick create — full profile can be completed later.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <Label className="text-xs">First name</Label>
            <Input autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Last name</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {allCountries().map((c) => (
                  <SelectItem key={c.code} value={c.name}>{c.flag} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Product</Label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCTS.filter((p) => p.id !== 'all').map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.emoji} {p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {duplicate && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Possible duplicate found</p>
              <p>{duplicate.first_name} {duplicate.last_name} — {duplicate.email}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Add candidate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

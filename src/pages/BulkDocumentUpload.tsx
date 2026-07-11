import { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, FileArchive, FileText, Loader2, CheckCircle2, AlertTriangle,
  X, UserCheck, Sparkles, Trash2, RefreshCw, UserPlus,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { mockCandidates } from '@/lib/mockData';
import { cn } from '@/lib/utils';

type DocType =
  | 'passport' | 'visa' | 'police_clearance' | 'qualification'
  | 'photo' | 'contract' | 'insurance' | 'mietvertrag' | 'vollmacht' | 'other';

type RowStatus = 'queued' | 'processing' | 'matched' | 'unmatched' | 'error';

interface FileRow {
  id: string;
  fileName: string;
  size: number;
  fromZip?: string;
  status: RowStatus;
  progress: number;
  docType: DocType;
  confidence: number;
  candidateId?: string;
  candidateName?: string;
  suggestedName?: string;
  error?: string;
}

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: 'passport', label: 'Reisepass' },
  { value: 'visa', label: 'Visa' },
  { value: 'police_clearance', label: 'Police Clearance' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'photo', label: 'Photo' },
  { value: 'contract', label: 'Contract' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'mietvertrag', label: 'Mietvertrag' },
  { value: 'vollmacht', label: 'Vollmacht' },
  { value: 'other', label: 'Other' },
];

const DOC_KEYWORDS: Record<DocType, string[]> = {
  passport: ['reisepass', 'passport'],
  visa: ['visa', 'visum'],
  police_clearance: ['police', 'clearance', 'fuhrung'],
  qualification: ['qualif', 'diploma', 'certificate', 'zeugnis'],
  photo: ['photo', 'foto', 'bild'],
  contract: ['contract', 'vertrag', 'arbeitsvertrag'],
  insurance: ['insurance', 'versicherung'],
  mietvertrag: ['mietvertrag', 'lease'],
  vollmacht: ['vollmacht', 'poa'],
  other: [],
};

const SIGNATURE_DOCS: DocType[] = ['contract', 'insurance', 'mietvertrag', 'vollmacht'];

function detectDocType(name: string): { type: DocType; confidence: number } {
  const lower = name.toLowerCase();
  for (const [type, keys] of Object.entries(DOC_KEYWORDS) as [DocType, string[]][]) {
    if (keys.some((k) => lower.includes(k))) return { type, confidence: 0.88 + Math.random() * 0.1 };
  }
  return { type: 'other', confidence: 0.4 + Math.random() * 0.2 };
}

type LiteCandidate = { candidate_id: string; first_name: string; last_name: string; country?: string; program_name?: string };

function matchCandidate(fileName: string, list: LiteCandidate[]) {
  // Match on first name (uppercase before space) — pattern DEEBAN Reisepass.pdf
  const first = fileName.split(/[\s_.-]/)[0]?.toUpperCase();
  if (!first) return undefined;
  return list.find((c) => c.first_name.toUpperCase() === first);
}


function suggestedFilename(row: FileRow): string {
  const cand = row.candidateName?.split(' ')[0]?.toUpperCase() ?? 'UNMATCHED';
  const label = DOC_TYPES.find((d) => d.value === row.docType)?.label ?? 'Document';
  const ext = row.fileName.split('.').pop() ?? 'pdf';
  if (SIGNATURE_DOCS.includes(row.docType)) {
    return `${cand} ${label}_oU.${ext}`;
  }
  return `${cand} ${label}.${ext}`;
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BulkDocumentUpload() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<FileRow[]>([]);
  const [defaultCandidate, setDefaultCandidate] = useState<string>('');
  const [search, setSearch] = useState('');
  const [extraCandidates, setExtraCandidates] = useState<LiteCandidate[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddRowId, setQuickAddRowId] = useState<string | null>(null);
  const [qFirst, setQFirst] = useState('');
  const [qLast, setQLast] = useState('');
  const [qCountry, setQCountry] = useState('');
  const [qProgram, setQProgram] = useState('');

  const allCandidates = useMemo<LiteCandidate[]>(
    () => [...extraCandidates, ...mockCandidates],
    [extraCandidates]
  );

  const processFiles = useCallback((files: File[], fromZip?: string) => {
    const newRows: FileRow[] = files.map((f) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { type, confidence } = detectDocType(f.name);
      const match = matchCandidate(f.name, allCandidates);

      const row: FileRow = {
        id,
        fileName: f.name,
        size: f.size,
        fromZip,
        status: 'processing',
        progress: 0,
        docType: type,
        confidence,
        candidateId: match?.candidate_id,
        candidateName: match ? `${match.first_name} ${match.last_name}` : undefined,
      };
      row.suggestedName = suggestedFilename(row);
      return row;
    });
    setRows((prev) => [...newRows, ...prev]);

    // simulate OCR progress per row
    newRows.forEach((r) => {
      const step = () => {
        setRows((prev) => prev.map((row) => {
          if (row.id !== r.id) return row;
          const next = Math.min(100, row.progress + 20 + Math.random() * 20);
          const done = next >= 100;
          return {
            ...row,
            progress: next,
            status: done ? (row.candidateId ? 'matched' : 'unmatched') : 'processing',
          };
        }));
      };
      const interval = setInterval(() => {
        step();
      }, 250);
      setTimeout(() => clearInterval(interval), 1700);
    });
  }, []);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length === 0) return;
    const zips = accepted.filter((f) => f.name.toLowerCase().endsWith('.zip'));
    const rest = accepted.filter((f) => !f.name.toLowerCase().endsWith('.zip'));

    if (rest.length) processFiles(rest);

    // Simulate ZIP expansion — pretend each zip contains 4 mock docs
    zips.forEach((z) => {
      const stem = z.name.replace(/\.zip$/i, '');
      const first = stem.split(/[\s_-]/)[0]?.toUpperCase() ?? 'CANDIDATE';
      const fake = [
        new File([''], `${first} Reisepass.pdf`, { type: 'application/pdf' }),
        new File([''], `${first} Visa.pdf`, { type: 'application/pdf' }),
        new File([''], `${first} Zeugnis.pdf`, { type: 'application/pdf' }),
        new File([''], `${first} Photo.jpg`, { type: 'image/jpeg' }),
      ];
      processFiles(fake, z.name);
      toast.success(`Extracted ${fake.length} files from ${z.name}`);
    });
  }, [processFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
  });

  const stats = useMemo(() => ({
    total: rows.length,
    matched: rows.filter((r) => r.status === 'matched').length,
    unmatched: rows.filter((r) => r.status === 'unmatched').length,
    processing: rows.filter((r) => r.status === 'processing').length,
  }), [rows]);

  const updateRow = (id: string, patch: Partial<FileRow>) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const merged = { ...r, ...patch };
      merged.suggestedName = suggestedFilename(merged);
      return merged;
    }));
  };

  const assignCandidate = (id: string, candidateId: string) => {
    const cand = allCandidates.find((c) => c.candidate_id === candidateId);
    if (!cand) return;
    updateRow(id, {
      candidateId,
      candidateName: `${cand.first_name} ${cand.last_name}`,
      status: 'matched',
    });
  };

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.fileName.toLowerCase().includes(q) ||
      r.candidateName?.toLowerCase().includes(q) ||
      r.docType.toLowerCase().includes(q)
    );
  });

  const applyDefault = () => {
    if (!defaultCandidate) return;
    const cand = allCandidates.find((c) => c.candidate_id === defaultCandidate);
    if (!cand) return;
    setRows((prev) => prev.map((r) =>
      r.status === 'unmatched' ? {
        ...r,
        candidateId: cand.candidate_id,
        candidateName: `${cand.first_name} ${cand.last_name}`,
        status: 'matched',
        suggestedName: suggestedFilename({
          ...r,
          candidateName: `${cand.first_name} ${cand.last_name}`,
        }),
      } : r
    ));
    toast.success('Assigned unmatched files');
  };

  const commitAll = () => {
    const ready = rows.filter((r) => r.status === 'matched').length;
    if (ready === 0) {
      toast.error('No matched documents to save');
      return;
    }
    toast.success(`Saved ${ready} documents to candidate records`);
    setRows((prev) => prev.filter((r) => r.status !== 'matched'));
  };

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/candidates')} className="gap-1.5">
              <ArrowLeft className="size-4" /> Candidates
            </Button>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Bulk Document Upload</h1>
              <p className="text-xs text-muted-foreground">
                Drag a ZIP or many files — auto-detect type, auto-match candidate, review, save.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1"><Sparkles className="size-3" /> AI OCR</Badge>
            <Button size="sm" variant="outline" onClick={() => { setQuickAddRowId(null); setQFirst(''); setQLast(''); setQCountry(''); setQProgram(''); setQuickAddOpen(true); }} className="gap-1.5">
              <UserPlus className="size-4" /> Quick add candidate
            </Button>
            <Button size="sm" onClick={commitAll} className="gap-1.5">
              <CheckCircle2 className="size-4" /> Save {stats.matched} ready
            </Button>
          </div>

        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Dropzone */}
        <Card>
          <CardContent className="p-4">
            <div
              {...getRootProps()}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors cursor-pointer',
                isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/40'
              )}
            >
              <input {...getInputProps()} />
              <FileArchive className="mb-3 size-10 text-primary/70" />
              <p className="text-base font-medium">
                {isDragActive ? 'Drop files to begin' : 'Drop a ZIP or multiple documents here'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                ZIP · PDF · PNG · JPG — filename pattern <span className="font-mono">FIRSTNAME Documenttype.pdf</span> auto-matches candidates.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        {rows.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total" value={stats.total} icon={<FileText className="size-4" />} />
            <StatTile label="Matched" value={stats.matched} tone="success" icon={<CheckCircle2 className="size-4" />} />
            <StatTile label="Needs review" value={stats.unmatched} tone="warn" icon={<AlertTriangle className="size-4" />} />
            <StatTile label="Processing" value={stats.processing} tone="info" icon={<Loader2 className="size-4 animate-spin" />} />
          </div>
        )}

        {/* Review Table */}
        {rows.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">Review queue</CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search filename, candidate, type…"
                  className="h-8 w-64"
                />
                <Select value={defaultCandidate} onValueChange={setDefaultCandidate}>
                  <SelectTrigger className="h-8 w-56">
                    <SelectValue placeholder="Bulk-assign unmatched…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCandidates.slice(0, 40).map((c) => (
                      <SelectItem key={c.candidate_id} value={c.candidate_id}>
                        {c.first_name} {c.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={applyDefault} disabled={!defaultCandidate} className="gap-1.5">
                  <UserCheck className="size-3.5" /> Apply
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRows([])} className="gap-1.5 text-muted-foreground">
                  <RefreshCw className="size-3.5" /> Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">File</th>
                      <th className="px-4 py-2 text-left font-medium">Detected type</th>
                      <th className="px-4 py-2 text-left font-medium">Candidate</th>
                      <th className="px-4 py-2 text-left font-medium">Saved as</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2 align-top">
                          <div className="flex items-start gap-2">
                            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <div className="truncate font-medium">{r.fileName}</div>
                              <div className="text-xs text-muted-foreground">
                                {humanSize(r.size)}
                                {r.fromZip && <> · from <span className="font-mono">{r.fromZip}</span></>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 align-top">
                          <div className="flex flex-col gap-1">
                            <Select value={r.docType} onValueChange={(v) => updateRow(r.id, { docType: v as DocType })}>
                              <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {DOC_TYPES.map((d) => (
                                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className={cn(
                              'text-[10px] font-medium',
                              r.confidence >= 0.85 ? 'text-emerald-600'
                                : r.confidence >= 0.6 ? 'text-amber-600' : 'text-red-600'
                            )}>
                              AI {(r.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 align-top">
                          <div className="flex items-center gap-1">
                            <Select
                              value={r.candidateId ?? ''}
                              onValueChange={(v) => assignCandidate(r.id, v)}
                            >
                              <SelectTrigger className="h-7 w-44 text-xs">
                                <SelectValue placeholder="Assign…" />
                              </SelectTrigger>
                              <SelectContent>
                                {allCandidates.slice(0, 60).map((c) => (
                                  <SelectItem key={c.candidate_id} value={c.candidate_id}>
                                    {c.first_name} {c.last_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Quick add new candidate"
                              onClick={() => {
                                const guess = r.fileName.split(/[\s_.-]/)[0] ?? '';
                                setQuickAddRowId(r.id);
                                setQFirst(guess ? guess.charAt(0).toUpperCase() + guess.slice(1).toLowerCase() : '');
                                setQLast(''); setQCountry(''); setQProgram('');
                                setQuickAddOpen(true);
                              }}
                              className="size-7 text-primary"
                            >
                              <UserPlus className="size-3.5" />
                            </Button>
                          </div>
                        </td>

                        <td className="px-4 py-2 align-top">
                          <span className="font-mono text-xs">{r.suggestedName}</span>
                        </td>
                        <td className="px-4 py-2 align-top">
                          {r.status === 'processing' && (
                            <div className="w-28">
                              <Progress value={r.progress} className="h-1.5" />
                              <span className="text-[10px] text-muted-foreground">OCR {Math.round(r.progress)}%</span>
                            </div>
                          )}
                          {r.status === 'matched' && (
                            <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              <CheckCircle2 className="size-3" /> Ready
                            </Badge>
                          )}
                          {r.status === 'unmatched' && (
                            <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
                              <AlertTriangle className="size-3" /> Assign candidate
                            </Badge>
                          )}
                          {r.status === 'error' && (
                            <Badge variant="destructive" className="gap-1"><X className="size-3" /> Error</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 align-top text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                            className="size-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Add Candidate Dialog */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4" /> Quick add candidate
            </DialogTitle>
            <DialogDescription>
              Creates a lightweight candidate record you can attach files to right now. Full profile & documents can be completed later in the intake studio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="qf">First name *</Label>
                <Input id="qf" value={qFirst} onChange={(e) => setQFirst(e.target.value)} placeholder="Deeban" autoFocus />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ql">Last name *</Label>
                <Input id="ql" value={qLast} onChange={(e) => setQLast(e.target.value)} placeholder="Kumar" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="qc">Country</Label>
                <Input id="qc" value={qCountry} onChange={(e) => setQCountry(e.target.value)} placeholder="India" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="qp">Program</Label>
                <Input id="qp" value={qProgram} onChange={(e) => setQProgram(e.target.value)} placeholder="Pflegefachkraft" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Filename pattern <span className="font-mono">{(qFirst || 'FIRSTNAME').toUpperCase()} Documenttype.pdf</span> will now auto-match this candidate.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQuickAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!qFirst.trim() || !qLast.trim()) {
                  toast.error('First and last name required');
                  return;
                }
                const newCand: LiteCandidate = {
                  candidate_id: `cand-new-${Date.now()}`,
                  first_name: qFirst.trim(),
                  last_name: qLast.trim(),
                  country: qCountry.trim() || undefined,
                  program_name: qProgram.trim() || undefined,
                };
                setExtraCandidates((prev) => [newCand, ...prev]);
                // Auto-assign to originating row if any, and re-match any unmatched rows by first name
                const upperFirst = newCand.first_name.toUpperCase();
                setRows((prev) => prev.map((row) => {
                  const shouldAttach =
                    row.id === quickAddRowId ||
                    (row.status === 'unmatched' && row.fileName.split(/[\s_.-]/)[0]?.toUpperCase() === upperFirst);
                  if (!shouldAttach) return row;
                  const merged = {
                    ...row,
                    candidateId: newCand.candidate_id,
                    candidateName: `${newCand.first_name} ${newCand.last_name}`,
                    status: 'matched' as RowStatus,
                  };
                  merged.suggestedName = suggestedFilename(merged);
                  return merged;
                }));
                toast.success(`Added ${newCand.first_name} ${newCand.last_name}`);
                setQuickAddOpen(false);
              }}
            >
              Add candidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function StatTile({
  label, value, tone = 'default', icon,
}: { label: string; value: number; tone?: 'default' | 'success' | 'warn' | 'info'; icon: React.ReactNode }) {
  const toneCls = {
    default: 'bg-card',
    success: 'bg-emerald-50 border-emerald-200',
    warn: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
  }[tone];
  return (
    <div className={cn('rounded-lg border p-3', toneCls)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

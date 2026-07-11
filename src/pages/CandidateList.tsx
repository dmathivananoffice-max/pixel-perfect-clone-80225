import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCandidates } from '@/hooks/useCandidates';
import { mockPrograms, mockAgencies } from '@/lib/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { ScoreBar } from '@/components/ScoreBar';
import {
  Search, Filter, Download, ChevronLeft, ChevronRight, Eye, Edit,
} from 'lucide-react';
import toast from 'react-hot-toast';

const PAGE_SIZE = 10;

export default function CandidateList() {
  const navigate = useNavigate();
  const { candidates, filters, updateFilters, totalCount } = useCandidates();
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const paginated = candidates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusOptions = ['waiting', 'shortlisted', 'rejected', 'interview1', 'interview2', 'contract', 'visa', 'placed', 'withdrawn'];

  const exportCSV = () => {
    toast.success('Export started - CSV will download shortly');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Candidates</h1>
          <p className="text-sm text-muted-foreground">{totalCount} total candidates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" /> Filters
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={filters.status || ''} onValueChange={(v) => updateFilters({ status: v || undefined })}>
                  <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Program</Label>
                <Select value={filters.program || ''} onValueChange={(v) => updateFilters({ program: v || undefined })}>
                  <SelectTrigger><SelectValue placeholder="All programs" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {mockPrograms.map((p) => <SelectItem key={p.id} value={p.id}>{p.program_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Source</Label>
                <Select value={filters.source || ''} onValueChange={(v) => updateFilters({ source: v || undefined })}>
                  <SelectTrigger><SelectValue placeholder="All sources" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="direct">Direct</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Agency</Label>
                <Select value={filters.agency || ''} onValueChange={(v) => updateFilters({ agency: v || undefined })}>
                  <SelectTrigger><SelectValue placeholder="All agencies" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {mockAgencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.agency_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Min Score</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.scoreMin || ''}
                  onChange={(e) => updateFilters({ scoreMin: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div>
                <Label className="text-xs">Max Score</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={filters.scoreMax || ''}
                  onChange={(e) => updateFilters({ scoreMax: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={() => updateFilters({ status: undefined, program: undefined, source: undefined, agency: undefined, scoreMin: undefined, scoreMax: undefined })}>
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          className="pl-9"
          value={filters.search || ''}
          onChange={(e) => updateFilters({ search: e.target.value })}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Gate</TableHead>
                  <TableHead>Recruiter</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((c) => (
                  <TableRow key={c.candidate_id} className="cursor-pointer" onClick={() => navigate(`/candidates/${c.candidate_id}`)}>
                    <TableCell className="font-medium">{c.rank || '-'}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{c.first_name} {c.last_name}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{c.program_name}</TableCell>
                    <TableCell className="capitalize">{c.source_type}</TableCell>
                    <TableCell><StatusBadge status={c.status} type="candidate" /></TableCell>
                    <TableCell>
                      {c.total_score ? (
                        <div className="w-24">
                          <ScoreBar score={c.total_score} showLabel={false} size="sm" />
                          <span className="text-xs text-muted-foreground">{c.total_score.toFixed(1)}</span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell><StatusBadge status={c.gate_status} type="gate" /></TableCell>
                    <TableCell className="text-sm">{c.assigned_recruiter_name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/candidates/${c.candidate_id}`); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); toast.success('Edit modal - coming soon'); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = i + 1;
                return (
                  <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" className="h-8 w-8" onClick={() => setPage(p)}>
                    {p}
                  </Button>
                );
              })}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

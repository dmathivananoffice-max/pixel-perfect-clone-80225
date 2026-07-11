import { useState } from 'react';
import { mockPrograms, mockScoringModels } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

export default function ScoringConfig() {
  const [selectedProgram, setSelectedProgram] = useState(mockPrograms[0].id);
  const [criteria, setCriteria] = useState(mockScoringModels);
  const [showDelete, setShowDelete] = useState<string | null>(null);

  const filteredCriteria = criteria.filter((c) => c.program_id === selectedProgram);
  const totalWeight = filteredCriteria.reduce((sum, c) => sum + c.weightage, 0);

  const addCriterion = () => {
    const newCriterion = {
      id: `new-${Date.now()}`,
      program_id: selectedProgram,
      criteria_name: 'New Criterion',
      weightage: 0.1,
      is_gating: false,
      minimum_threshold: undefined,
      max_score: 100,
    };
    setCriteria([...criteria, newCriterion]);
  };

  const updateCriterion = (id: string, updates: Partial<typeof criteria[0]>) => {
    setCriteria(criteria.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const deleteCriterion = (id: string) => {
    setCriteria(criteria.filter((c) => c.id !== id));
    setShowDelete(null);
    toast.success('Criterion deleted');
  };

  const saveChanges = () => {
    toast.success('Scoring configuration saved');
  };

  const pieData = filteredCriteria.map((c) => ({
    name: c.criteria_name,
    value: Math.round(c.weightage * 100),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scoring Configuration</h1>
          <p className="text-sm text-muted-foreground">Configure criteria, weights, and gating per program</p>
        </div>
        <Button onClick={saveChanges}>
          <Save className="w-4 h-4 mr-2" /> Save Changes
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <Label className="mb-2 block">Program</Label>
          <Select value={selectedProgram} onValueChange={setSelectedProgram}>
            <SelectTrigger className="w-full md:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mockPrograms.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.program_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Criteria ({filteredCriteria.length})</h3>
            <Button size="sm" variant="outline" onClick={addCriterion}>
              <Plus className="w-4 h-4 mr-2" /> Add Criterion
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Weight (%)</TableHead>
                      <TableHead>Gating</TableHead>
                      <TableHead>Threshold</TableHead>
                      <TableHead>Max Score</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCriteria.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Input
                            value={c.criteria_name}
                            onChange={(e) => updateCriterion(c.id, { criteria_name: e.target.value })}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={c.weightage}
                            onChange={(e) => updateCriterion(c.id, { weightage: Number(e.target.value) })}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={c.is_gating}
                            onCheckedChange={(v) => updateCriterion(c.id, { is_gating: v === true })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={c.minimum_threshold || ''}
                            onChange={(e) => updateCriterion(c.id, { minimum_threshold: e.target.value ? Number(e.target.value) : undefined })}
                            className="h-8 w-20"
                            placeholder="None"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={c.max_score || 100}
                            onChange={(e) => updateCriterion(c.id, { max_score: Number(e.target.value) })}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowDelete(c.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className={`text-sm font-medium ${Math.abs(totalWeight - 1) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
            Total Weight: {(totalWeight * 100).toFixed(0)}% {Math.abs(totalWeight - 1) < 0.01 ? '(Balanced)' : '(Should be 100%)'}
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Weight Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" nameKey="name" label>
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-2">
              {pieData.map((d, idx) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span>{d.name}: {d.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!showDelete}
        onOpenChange={() => setShowDelete(null)}
        title="Delete Criterion"
        description="Are you sure you want to delete this criterion? This action cannot be undone."
        onConfirm={() => showDelete && deleteCriterion(showDelete)}
        variant="destructive"
      />
    </div>
  );
}

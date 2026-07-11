import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { mockCandidates, mockSTISpeaking, mockSTITraining, mockSTIInterview1, mockSTIInterview2, mockEmployers } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Textarea component available
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScoreBar } from '@/components/ScoreBar';
import { Search, Save, Send, Mic, BookOpen, Users, Building } from 'lucide-react';
import toast from 'react-hot-toast';

function SliderField({ label, value, onChange, max = 100 }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm font-medium">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <ScoreBar score={value} maxScore={max} size="sm" showLabel={false} />
    </div>
  );
}

export default function STIAssessment() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(candidateId || '');

  const candidates = mockCandidates.filter(
    (c) =>
      c.status === 'shortlisted' || c.status === 'interview1' || c.status === 'interview2' || c.status === 'waiting'
  );

  const filteredCandidates = searchQuery
    ? candidates.filter(
        (c) =>
          c.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.last_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : candidates;

  const currentCandidate = mockCandidates.find((c) => c.candidate_id === selectedCandidate);

  // Speaking form state
  const existingSpeaking = mockSTISpeaking.find((s) => s.candidate_id === selectedCandidate);
  const [speaking, setSpeaking] = useState({
    pronunciation: existingSpeaking?.pronunciation || 70,
    fluency: existingSpeaking?.fluency || 70,
    confidence: existingSpeaking?.confidence || 70,
    vocabulary: existingSpeaking?.vocabulary || 70,
    grammar: existingSpeaking?.grammar || 70,
    notes: existingSpeaking?.trainer_notes || '',
  });

  // Training form state
  const existingTraining = mockSTITraining.find((t) => t.candidate_id === selectedCandidate);
  const [training, setTraining] = useState<{
    attendance: number; assignments: number; behaviour: number; participation: number;
    german_improvement: number; recommendation: string; notes: string;
  }>({
    attendance: existingTraining?.attendance || 80,
    assignments: existingTraining?.assignments || 75,
    behaviour: existingTraining?.behaviour || 80,
    participation: existingTraining?.participation || 75,
    german_improvement: existingTraining?.german_improvement || 70,
    recommendation: existingTraining?.recommendation || 'proceed',
    notes: existingTraining?.trainer_notes || '',
  });

  // Interview 1 form state
  const existingInt1 = mockSTIInterview1.find((i) => i.candidate_id === selectedCandidate);
  const [interview1, setInterview1] = useState<{
    panel_members: string; date: string; rating: number; notes: string; decision: string;
  }>({
    panel_members: existingInt1?.panel_members?.join(', ') || '',
    date: existingInt1?.date ? new Date(existingInt1.date).toISOString().split('T')[0] : '',
    rating: existingInt1?.rating || 75,
    notes: existingInt1?.notes || '',
    decision: existingInt1?.decision || 'proceed',
  });

  // Interview 2 form state
  const existingInt2 = mockSTIInterview2.find((i) => i.candidate_id === selectedCandidate);
  const [interview2, setInterview2] = useState<{
    employer_id: string; project_manager: string; date: string; rating: number; notes: string; decision: string;
  }>({
    employer_id: existingInt2?.employer_id || '',
    project_manager: existingInt2?.project_manager_name || '',
    date: existingInt2?.date ? new Date(existingInt2.date).toISOString().split('T')[0] : '',
    rating: existingInt2?.rating || 75,
    notes: existingInt2?.notes || '',
    decision: existingInt2?.decision || 'selected',
  });

  const handleSave = (section: string) => {
    toast.success(`${section} assessment saved`);
  };

  const handleSubmit = (section: string) => {
    toast.success(`${section} assessment submitted`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">STI Assessment</h1>
        <p className="text-sm text-muted-foreground">Speaking, Training, and Interview evaluations</p>
      </div>

      {/* Candidate Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search candidates..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {filteredCandidates.slice(0, 8).map((c) => (
              <Button
                key={c.candidate_id}
                variant={selectedCandidate === c.candidate_id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCandidate(c.candidate_id)}
              >
                {c.first_name} {c.last_name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {currentCandidate && (
        <div className="flex items-center gap-2">
          <span className="font-semibold">Selected:</span>
          <span>{currentCandidate.first_name} {currentCandidate.last_name}</span>
          <span className="text-sm text-muted-foreground">({currentCandidate.program_name})</span>
        </div>
      )}

      {selectedCandidate && (
        <Tabs defaultValue="speaking">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="speaking"><Mic className="w-4 h-4 mr-2" /> Speaking</TabsTrigger>
            <TabsTrigger value="training"><BookOpen className="w-4 h-4 mr-2" /> Training</TabsTrigger>
            <TabsTrigger value="interview1"><Users className="w-4 h-4 mr-2" /> Interview 1</TabsTrigger>
            <TabsTrigger value="interview2"><Building className="w-4 h-4 mr-2" /> Interview 2</TabsTrigger>
          </TabsList>

          <TabsContent value="speaking" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Speaking Assessment</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SliderField label="Pronunciation" value={speaking.pronunciation} onChange={(v) => setSpeaking({ ...speaking, pronunciation: v })} />
                  <SliderField label="Fluency" value={speaking.fluency} onChange={(v) => setSpeaking({ ...speaking, fluency: v })} />
                  <SliderField label="Confidence" value={speaking.confidence} onChange={(v) => setSpeaking({ ...speaking, confidence: v })} />
                  <SliderField label="Vocabulary" value={speaking.vocabulary} onChange={(v) => setSpeaking({ ...speaking, vocabulary: v })} />
                  <SliderField label="Grammar" value={speaking.grammar} onChange={(v) => setSpeaking({ ...speaking, grammar: v })} />
                </div>
                <div>
                  <Label>Overall Score</Label>
                  <div className="text-2xl font-bold mt-1">
                    {((speaking.pronunciation + speaking.fluency + speaking.confidence + speaking.vocabulary + speaking.grammar) / 5).toFixed(1)}
                  </div>
                </div>
                <div>
                  <Label>Trainer Notes</Label>
                  <Textarea
                    value={speaking.notes}
                    onChange={(e) => setSpeaking({ ...speaking, notes: e.target.value })}
                    placeholder="Enter assessment notes..."
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleSave('Speaking')}><Save className="w-4 h-4 mr-2" /> Save Draft</Button>
                  <Button onClick={() => handleSubmit('Speaking')}><Send className="w-4 h-4 mr-2" /> Submit</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="training" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Training Assessment</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SliderField label="Attendance (%)" value={training.attendance} onChange={(v) => setTraining({ ...training, attendance: v })} max={100} />
                  <SliderField label="Assignments" value={training.assignments} onChange={(v) => setTraining({ ...training, assignments: v })} />
                  <SliderField label="Behaviour" value={training.behaviour} onChange={(v) => setTraining({ ...training, behaviour: v })} />
                  <SliderField label="Participation" value={training.participation} onChange={(v) => setTraining({ ...training, participation: v })} />
                  <SliderField label="German Improvement" value={training.german_improvement} onChange={(v) => setTraining({ ...training, german_improvement: v })} />
                </div>
                <div>
                  <Label>Recommendation</Label>
                  <Select value={training.recommendation} onValueChange={(v) => setTraining({ ...training, recommendation: v })}>
                    <SelectTrigger className="w-full md:w-60 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proceed">Proceed</SelectItem>
                      <SelectItem value="caution">Caution</SelectItem>
                      <SelectItem value="not_recommended">Not Recommended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trainer Notes</Label>
                  <Textarea
                    value={training.notes}
                    onChange={(e) => setTraining({ ...training, notes: e.target.value })}
                    placeholder="Enter training notes..."
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleSave('Training')}><Save className="w-4 h-4 mr-2" /> Save Draft</Button>
                  <Button onClick={() => handleSubmit('Training')}><Send className="w-4 h-4 mr-2" /> Submit</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interview1" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Interview 1</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Panel Members (comma-separated)</Label>
                    <Input value={interview1.panel_members} onChange={(e) => setInterview1({ ...interview1, panel_members: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={interview1.date} onChange={(e) => setInterview1({ ...interview1, date: e.target.value })} className="mt-1" />
                  </div>
                </div>
                <SliderField label="Rating" value={interview1.rating} onChange={(v) => setInterview1({ ...interview1, rating: v })} />
                <div>
                  <Label>Notes</Label>
                  <Textarea value={interview1.notes} onChange={(e) => setInterview1({ ...interview1, notes: e.target.value })} placeholder="Interview notes..." className="mt-1" />
                </div>
                <div>
                  <Label>Decision</Label>
                  <Select value={interview1.decision} onValueChange={(v) => setInterview1({ ...interview1, decision: v })}>
                    <SelectTrigger className="w-full md:w-60 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proceed">Proceed</SelectItem>
                      <SelectItem value="hold">Hold</SelectItem>
                      <SelectItem value="reject">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleSave('Interview 1')}><Save className="w-4 h-4 mr-2" /> Save</Button>
                  <Button onClick={() => handleSubmit('Interview 1')}><Send className="w-4 h-4 mr-2" /> Submit</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interview2" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Interview 2 (Employer)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Employer</Label>
                    <Select value={interview2.employer_id} onValueChange={(v) => setInterview2({ ...interview2, employer_id: v })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select employer" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockEmployers.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Project Manager</Label>
                    <Input value={interview2.project_manager} onChange={(e) => setInterview2({ ...interview2, project_manager: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={interview2.date} onChange={(e) => setInterview2({ ...interview2, date: e.target.value })} className="mt-1" />
                  </div>
                </div>
                <SliderField label="Rating" value={interview2.rating} onChange={(v) => setInterview2({ ...interview2, rating: v })} />
                <div>
                  <Label>Notes</Label>
                  <Textarea value={interview2.notes} onChange={(e) => setInterview2({ ...interview2, notes: e.target.value })} placeholder="Interview notes..." className="mt-1" />
                </div>
                <div>
                  <Label>Decision</Label>
                  <Select value={interview2.decision} onValueChange={(v) => setInterview2({ ...interview2, decision: v })}>
                    <SelectTrigger className="w-full md:w-60 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="selected">Selected</SelectItem>
                      <SelectItem value="hold">Hold</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleSave('Interview 2')}><Save className="w-4 h-4 mr-2" /> Save</Button>
                  <Button onClick={() => handleSubmit('Interview 2')}><Send className="w-4 h-4 mr-2" /> Submit</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// Textarea component
function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

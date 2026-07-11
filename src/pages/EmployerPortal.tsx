import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { mockCandidates, mockSTIInterview2, mockSTIInterview1, mockSTISpeaking, mockSTITraining } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { ScoreBar } from '@/components/ScoreBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Building2, Users, ThumbsUp, ThumbsDown, Pause } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EmployerPortal() {
  const { user } = useAuth();
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  // Employer sees candidates in interview2 or placed that have this employer
  const employerInterview2s = mockSTIInterview2.filter((i) => i.employer_name?.toLowerCase().includes(user?.name?.toLowerCase() || ''));
  const shortlistedIds = employerInterview2s.map((i) => i.candidate_id);
  const shortlisted = mockCandidates.filter((c) => shortlistedIds.includes(c.candidate_id) || c.status === 'interview2' || c.status === 'placed');

  const selected = shortlisted.find((c) => c.candidate_id === selectedCandidate);
  const speaking = mockSTISpeaking.find((s) => s.candidate_id === selectedCandidate);
  const training = mockSTITraining.find((t) => t.candidate_id === selectedCandidate);
  const interview1 = mockSTIInterview1.find((i) => i.candidate_id === selectedCandidate);
  const interview2 = mockSTIInterview2.find((i) => i.candidate_id === selectedCandidate);

  const [feedback, setFeedback] = useState({ rating: 75, notes: '', decision: 'selected' });

  const submitFeedback = () => {
    toast.success('Interview feedback submitted');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employer Portal</h1>
          <p className="text-sm text-muted-foreground">Review shortlisted candidates and provide interview feedback</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidate List */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" /> Shortlisted Candidates ({shortlisted.length})
          </h3>
          {shortlisted.map((c) => (
            <Card
              key={c.candidate_id}
              className={`cursor-pointer transition-colors ${selectedCandidate === c.candidate_id ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'}`}
              onClick={() => setSelectedCandidate(c.candidate_id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-muted-foreground">{c.program_name} &middot; {c.country}</p>
                  </div>
                  <StatusBadge status={c.status} type="candidate" />
                </div>
                {c.total_score && (
                  <div className="mt-2">
                    <ScoreBar score={c.total_score} size="sm" showLabel={false} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Candidate Detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{selected.first_name} {selected.last_name}</CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-green-600" onClick={() => toast.success('Candidate selected')}>
                        <ThumbsUp className="w-4 h-4 mr-1" /> Select
                      </Button>
                      <Button size="sm" variant="outline" className="text-yellow-600" onClick={() => toast.success('Candidate put on hold')}>
                        <Pause className="w-4 h-4 mr-1" /> Hold
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => toast.success('Candidate rejected')}>
                        <ThumbsDown className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="profile">
                    <TabsList>
                      <TabsTrigger value="profile">Profile</TabsTrigger>
                      <TabsTrigger value="sti">STI Results</TabsTrigger>
                      <TabsTrigger value="feedback">Feedback</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="space-y-3 mt-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-muted-foreground">Email:</span> {selected.email}</div>
                        <div><span className="text-muted-foreground">Phone:</span> {selected.phone}</div>
                        <div><span className="text-muted-foreground">Qualification:</span> {selected.highest_qualification}</div>
                        <div><span className="text-muted-foreground">Score:</span> {selected.total_score?.toFixed(1)}</div>
                      </div>
                    </TabsContent>

                    <TabsContent value="sti" className="space-y-4 mt-4">
                      {speaking && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Speaking: {speaking.overall_score}/100</h4>
                          <div className="grid grid-cols-5 gap-2 text-xs">
                            {(['pronunciation', 'fluency', 'confidence', 'vocabulary', 'grammar'] as const).map((k) => (
                              <div key={k} className="text-center">
                                <div className="capitalize text-muted-foreground">{k}</div>
                                <div className="font-bold">{speaking[k]}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {training && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Training: {training.recommendation}</h4>
                          <div className="grid grid-cols-5 gap-2 text-xs">
                            {(['attendance', 'assignments', 'behaviour', 'participation', 'german_improvement'] as const).map((k) => (
                              <div key={k} className="text-center">
                                <div className="capitalize text-muted-foreground">{k.replace('_', ' ')}</div>
                                <div className="font-bold">{training[k] ?? 'N/A'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {interview1 && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Interview 1: {interview1.rating}/100 ({interview1.decision})</h4>
                          {interview1.notes && <p className="text-xs text-muted-foreground">{interview1.notes}</p>}
                        </div>
                      )}
                      {interview2 && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Interview 2: {interview2.rating}/100 ({interview2.decision})</h4>
                          {interview2.notes && <p className="text-xs text-muted-foreground">{interview2.notes}</p>}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="feedback" className="space-y-4 mt-4">
                      <div>
                        <label className="text-sm font-medium">Rating</label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={feedback.rating}
                          onChange={(e) => setFeedback({ ...feedback, rating: Number(e.target.value) })}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary mt-2"
                        />
                        <div className="text-sm font-medium mt-1">{feedback.rating}/100</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Decision</label>
                        <Select value={feedback.decision} onValueChange={(v) => setFeedback({ ...feedback, decision: v })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="selected">Selected</SelectItem>
                            <SelectItem value="hold">Hold</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Notes</label>
                        <textarea value={feedback.notes} onChange={(e) => setFeedback({ ...feedback, notes: e.target.value })} placeholder="Enter your feedback..." className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                      </div>
                      <Button onClick={submitFeedback}>Submit Feedback</Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="flex items-center justify-center h-96">
              <div className="text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a candidate to view details and provide feedback</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}



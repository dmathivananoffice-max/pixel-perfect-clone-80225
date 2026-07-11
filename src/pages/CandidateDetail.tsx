import { useParams } from 'react-router-dom';
import { useCandidates } from '@/hooks/useCandidates';
import { mockSTISpeaking, mockSTITraining, mockSTIInterview1, mockSTIInterview2, mockContracts, mockVisaStatuses, mockScoringModels } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import { ScoreBar } from '@/components/ScoreBar';
// Layout component
import { FileText, Upload, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const { getCandidate, getCandidateDocuments, getCandidateAuditEvents, getCandidateScores } = useCandidates();

  const candidate = getCandidate(id || '');
  const documents = getCandidateDocuments(id || '');
  const audits = getCandidateAuditEvents(id || '');
  const scores = getCandidateScores(id || '');

  const speaking = mockSTISpeaking.find((s) => s.candidate_id === id);
  const training = mockSTITraining.find((t) => t.candidate_id === id);
  const interview1 = mockSTIInterview1.find((i) => i.candidate_id === id);
  const interview2 = mockSTIInterview2.find((i) => i.candidate_id === id);
  const contract = mockContracts.find((c) => c.candidate_id === id);
  const visa = mockVisaStatuses.find((v) => v.candidate_id === id);

  if (!candidate) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Candidate not found</p>
      </div>
    );
  }

  const scoreBreakdown = (scores.length > 0 ? scores.map(s => ({...s, weightage: 0.2, is_gating: false, minimum_threshold: undefined as number | undefined})) : mockScoringModels
    .filter((sm) => sm.program_id === candidate.program_id)
    .map((sm) => ({
      ...sm,
      criteria_name: sm.criteria_name,
      weightage: sm.weightage,
      raw_score: candidate.total_score ? candidate.total_score * sm.weightage : 0,
      is_gating: sm.is_gating,
      minimum_threshold: sm.minimum_threshold,
    }))) as Array<{
      criteria_name: string;
      weightage: number;
      raw_score: number;
      is_gating: boolean;
      minimum_threshold?: number;
      weighted_score?: number;
      normalized_score?: number;
    }>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{candidate.first_name} {candidate.last_name}</h1>
            <StatusBadge status={candidate.status} type="candidate" />
            <StatusBadge status={candidate.gate_status} type="gate" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">ID: {candidate.candidate_id} &middot; Rank: {candidate.rank || 'N/A'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success('Edit candidate - coming soon')}>
            Edit
          </Button>
          <Button size="sm" onClick={() => toast.success('Status update modal - coming soon')}>
            Update Status
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Score</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{candidate.total_score?.toFixed(1) || 'N/A'}</div>
            {candidate.total_score && <ScoreBar score={candidate.total_score} size="sm" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Program</CardTitle></CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{candidate.program_name}</div>
            <p className="text-xs text-muted- capitalize">{candidate.source_type} {candidate.source_agency_name && `\u00B7 ${candidate.source_agency_name}`}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Recruiter</CardTitle></CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{candidate.assigned_recruiter_name}</div>
            <p className="text-xs text-muted-foreground">{candidate.country}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="sti">STI History</TabsTrigger>
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="visa">Visa</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div><LabelSmall>Email</LabelSmall><Value>{candidate.email}</Value></div>
                <div><LabelSmall>Phone</LabelSmall><Value>{candidate.phone}</Value></div>
                <div><LabelSmall>Date of Birth</LabelSmall><Value>{candidate.dob || 'N/A'}</Value></div>
                <div><LabelSmall>Gender</LabelSmall><Value className="capitalize">{candidate.gender || 'N/A'}</Value></div>
              </div>
              <div className="space-y-3">
                <div><LabelSmall>Country</LabelSmall><Value>{candidate.country}</Value></div>
                <div><LabelSmall>Highest Qualification</LabelSmall><Value>{candidate.highest_qualification || 'N/A'}</Value></div>
                <div><LabelSmall>Source</LabelSmall><Value className="capitalize">{candidate.source_type}</Value></div>
                <div><LabelSmall>Created</LabelSmall><Value>{new Date(candidate.created_at).toLocaleDateString()}</Value></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Documents</h3>
            <Button size="sm" onClick={() => toast.success('Upload modal - coming soon')}>
              <Upload className="w-4 h-4 mr-2" /> Upload
            </Button>
          </div>
          {documents.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No documents uploaded yet</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-medium capitalize">{doc.document_type.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          OCR: {doc.ocr_complete ? `${(doc.ocr_confidence || 0) * 100}%` : 'Pending'}
                          {doc.verified && ' \u00B7 Verified'}
                          {doc.expiry_date && ` \u00B7 Expires: ${new Date(doc.expiry_date).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.verified ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Clock className="w-4 h-4 text-yellow-500" />}
                      <Button variant="ghost" size="sm" onClick={() => toast.success('View document - coming soon')}>View</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sti" className="space-y-4">
          {speaking && (
            <Card>
              <CardHeader><CardTitle>Speaking Assessment</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-5 gap-4">
                  {(['pronunciation', 'fluency', 'confidence', 'vocabulary', 'grammar'] as const).map((k) => (
                    <div key={k}>
                      <LabelSmall className="capitalize">{k}</LabelSmall>
                      <div className="text-lg font-semibold">{speaking[k]}</div>
                      <ScoreBar score={speaking[k]} size="sm" showLabel={false} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Overall: <strong>{speaking.overall_score}</strong></span>
                  <span>|</span>
                  <span>Trainer: {speaking.trainer_name}</span>
                  <span>|</span>
                  <span>{speaking.assessed_at && new Date(speaking.assessed_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          )}
          {training && (
            <Card>
              <CardHeader><CardTitle>Training Assessment</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-5 gap-4">
                  {(['attendance', 'assignments', 'behaviour', 'participation', 'german_improvement'] as const).map((k) => (
                    <div key={k}>
                      <LabelSmall className="capitalize">{k.replace('_', ' ')}</LabelSmall>
                      <div className="text-lg font-semibold">{training[k] ?? 'N/A'}</div>
                      {training[k] !== undefined && <ScoreBar score={training[k]!} size="sm" showLabel={false} />}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span>Recommendation: <StatusBadge status={training.recommendation || 'N/A'} /></span>
                  <span className="text-muted-foreground">| Trainer: {training.trainer_name}</span>
                </div>
              </CardContent>
            </Card>
          )}
          {interview1 && (
            <Card>
              <CardHeader><CardTitle>Interview 1</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><LabelSmall>Rating</LabelSmall><Value>{interview1.rating}/100</Value></div>
                  <div><LabelSmall>Decision</LabelSmall><StatusBadge status={interview1.decision || 'N/A'} /></div>
                  <div><LabelSmall>Panel</LabelSmall><Value>{interview1.panel_members.join(', ')}</Value></div>
                  <div><LabelSmall>Date</LabelSmall><Value>{interview1.date ? new Date(interview1.date).toLocaleDateString() : 'N/A'}</Value></div>
                </div>
                {interview1.notes && <p className="mt-3 text-sm text-muted-foreground bg-muted p-3 rounded-md">{interview1.notes}</p>}
              </CardContent>
            </Card>
          )}
          {interview2 && (
            <Card>
              <CardHeader><CardTitle>Interview 2</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><LabelSmall>Rating</LabelSmall><Value>{interview2.rating}/100</Value></div>
                  <div><LabelSmall>Decision</LabelSmall><StatusBadge status={interview2.decision || 'N/A'} /></div>
                  <div><LabelSmall>Employer</LabelSmall><Value>{interview2.employer_name}</Value></div>
                  <div><LabelSmall>Date</LabelSmall><Value>{interview2.date ? new Date(interview2.date).toLocaleDateString() : 'N/A'}</Value></div>
                </div>
                {interview2.notes && <p className="mt-3 text-sm text-muted-foreground bg-muted p-3 rounded-md">{interview2.notes}</p>}
              </CardContent>
            </Card>
          )}
          {!speaking && !training && !interview1 && !interview2 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No STI assessments recorded yet</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="scores" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Score Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {scoreBreakdown.map((s, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.criteria_name}</span>
                      {s.is_gating && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">GATING</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">Weight: {(s.weightage * 100).toFixed(0)}%</span>
                      <span className="font-semibold w-12 text-right">{typeof s.raw_score === 'number' ? s.raw_score.toFixed(1) : s.raw_score}</span>
                    </div>
                  </div>
                  <ScoreBar score={typeof s.raw_score === 'number' ? s.raw_score : 0} size="sm" showLabel={false} />
                  {s.is_gating && s.minimum_threshold && (
                    <p className="text-xs text-muted-foreground">Threshold: {s.minimum_threshold}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          {contract ? (
            <Card>
              <CardHeader><CardTitle>Contract Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><LabelSmall>Type</LabelSmall><Value className="capitalize">{contract.type.replace('_', ' ')}</Value></div>
                  <div><LabelSmall>Status</LabelSmall><StatusBadge status={contract.status} type="contract" /></div>
                  <div><LabelSmall>Signed</LabelSmall><Value>{contract.signed_at ? new Date(contract.signed_at).toLocaleDateString() : 'Not signed'}</Value></div>
                  <div><LabelSmall>Created</LabelSmall><Value>{new Date(contract.created_at).toLocaleDateString()}</Value></div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => toast.success('Download PDF - coming soon')}>Download PDF</Button>
                  {contract.status === 'sent' && (
                    <Button size="sm" onClick={() => toast.success('Navigate to signing page')}>Sign Contract</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No contract generated yet</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="visa" className="space-y-4">
          {visa ? (
            <Card>
              <CardHeader><CardTitle>Visa Status</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <StatusBadge status={visa.status} type="visa" />
                  <span className="text-sm text-muted-foreground">Updated: {new Date(visa.updated_at).toLocaleDateString()}</span>
                </div>

                {/* Visa Stepper */}
                <div className="flex items-center justify-between mt-6">
                  {(['not_started', 'documents_submitted', 'appointment_booked', 'approved', 'rejected'] as const).map((step, idx, arr) => {
                    const stepOrder = ['not_started', 'documents_submitted', 'appointment_booked', 'approved'];
                    const currentOrder = stepOrder.indexOf(visa.status);
                    const stepIdx = stepOrder.indexOf(step);
                    let state: 'pending' | 'active' | 'completed' | 'rejected' = 'pending';
                    if (step === 'rejected') state = visa.status === 'rejected' ? 'rejected' : 'pending';
                    else if (stepIdx < currentOrder) state = 'completed';
                    else if (stepIdx === currentOrder) state = 'active';

                    return (
                      <div key={step} className="flex items-center flex-1">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            state === 'completed' ? 'bg-green-500 text-white' :
                            state === 'active' ? 'bg-blue-500 text-white' :
                            state === 'rejected' ? 'bg-red-500 text-white' :
                            'bg-gray-200 text-gray-500'
                          }`}>
                            {state === 'completed' ? <CheckCircle className="w-4 h-4" /> :
                             state === 'rejected' ? <AlertCircle className="w-4 h-4" /> :
                             idx + 1}
                          </div>
                          <span className="text-[10px] mt-1 text-center capitalize w-16 leading-tight">{step.replace('_', ' ')}</span>
                        </div>
                        {idx < arr.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 ${state === 'completed' ? 'bg-green-500' : 'bg-gray-200'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {visa.notes && <p className="text-sm bg-muted p-3 rounded-md">{visa.notes}</p>}
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No visa process started</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-2">
          {audits.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No activity recorded</CardContent></Card>
          ) : (
            audits.map((audit) => (
              <Card key={audit.id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">{audit.event_type.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground">
                      by {audit.actor_name || 'System'} &middot; {new Date(audit.created_at).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LabelSmall({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs text-muted-foreground ${className}`}>{children}</p>;
}

function Value({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm font-medium ${className}`}>{children}</p>;
}

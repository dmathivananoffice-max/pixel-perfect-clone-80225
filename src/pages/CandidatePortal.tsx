import { useState } from 'react';

import { mockCandidates, mockDocuments, mockContracts, mockVisaStatuses, mockNotifications } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, CheckCircle, Bell, User, FileCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CandidatePortal() {
  // For demo, we show the first candidate's data as "my" data
  const myCandidate = mockCandidates[0];
  const myDocuments = mockDocuments.filter((d) => d.candidate_id === myCandidate.candidate_id);
  const myContract = mockContracts.find((c) => c.candidate_id === myCandidate.candidate_id);
  const _myVisa = mockVisaStatuses.find((v) => v.candidate_id === myCandidate.candidate_id);
  void _myVisa;
  const myNotifications = mockNotifications.slice(0, 4);

  const statusSteps = [
    { label: 'Applied', status: 'completed' },
    { label: 'Shortlisted', status: myCandidate.status === 'waiting' ? 'pending' : 'completed' },
    { label: 'Assessment', status: ['interview1', 'interview2', 'contract', 'visa', 'placed'].includes(myCandidate.status) ? 'completed' : myCandidate.status === 'shortlisted' ? 'active' : 'pending' },
    { label: 'Interview', status: ['interview2', 'contract', 'visa', 'placed'].includes(myCandidate.status) ? 'completed' : myCandidate.status === 'interview1' ? 'active' : 'pending' },
    { label: 'Contract', status: ['contract', 'visa', 'placed'].includes(myCandidate.status) ? 'completed' : 'pending' },
    { label: 'Visa', status: ['visa', 'placed'].includes(myCandidate.status) ? 'completed' : 'pending' },
    { label: 'Placed', status: myCandidate.status === 'placed' ? 'completed' : 'pending' },
  ];

  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);

  const handleSign = () => {
    if (!agreed) {
      toast.error('Please agree to the terms first');
      return;
    }
    setSigned(true);
    toast.success('Contract signed successfully!');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Portal</h1>
        <p className="text-sm text-muted-foreground">Welcome, {myCandidate.first_name} {myCandidate.last_name}</p>
      </div>

      {/* Status Tracker */}
      <Card>
        <CardHeader><CardTitle className="text-base">My Application Status</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            {statusSteps.map((step, idx) => (
              <div key={step.label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.status === 'completed' ? 'bg-green-500 text-white' :
                    step.status === 'active' ? 'bg-blue-500 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {step.status === 'completed' ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className="text-[9px] mt-1 text-center w-12 leading-tight hidden sm:block">{step.label}</span>
                </div>
                {idx < statusSteps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-0.5 ${step.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <StatusBadge status={myCandidate.status} type="candidate" />
            <StatusBadge status={myCandidate.gate_status} type="gate" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile"><User className="w-4 h-4 mr-2" /> Profile</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="w-4 h-4 mr-2" /> Documents</TabsTrigger>
          <TabsTrigger value="contract"><FileCheck className="w-4 h-4 mr-2" /> Contract</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-2" /> Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="Full Name" value={`${myCandidate.first_name} ${myCandidate.last_name}`} />
              <InfoField label="Email" value={myCandidate.email} />
              <InfoField label="Phone" value={myCandidate.phone} />
              <InfoField label="Date of Birth" value={myCandidate.dob || 'N/A'} />
              <InfoField label="Country" value={myCandidate.country} />
              <InfoField label="Gender" value={myCandidate.gender || 'N/A'} />
              <InfoField label="Qualification" value={myCandidate.highest_qualification || 'N/A'} />
              <InfoField label="Program" value={myCandidate.program_name || 'N/A'} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">My Documents</h3>
            <Button size="sm" onClick={() => toast.success('Upload modal - coming soon')}>
              <Upload className="w-4 h-4 mr-2" /> Upload
            </Button>
          </div>
          {myDocuments.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="font-medium capitalize">{doc.document_type.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.verified ? 'Verified' : 'Pending verification'}
                      {doc.expiry_date && ` \u00B7 Expires: ${new Date(doc.expiry_date).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                {doc.verified ? <CheckCircle className="w-5 h-5 text-green-500" /> : <div className="text-xs text-yellow-600">Pending</div>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="contract" className="space-y-4">
          {myContract ? (
            <Card>
              <CardHeader>
                <CardTitle>{myContract.type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-md">
                  <h4 className="font-medium mb-2">Contract Preview</h4>
                  <p className="text-sm text-muted-foreground">
                    This is a placeholder for the contract PDF viewer. The actual contract document
                    would be displayed here with all terms and conditions.
                  </p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p><strong>Candidate:</strong> {myCandidate.first_name} {myCandidate.last_name}</p>
                    <p><strong>Type:</strong> {myContract.type.replace('_', ' ')}</p>
                    <p><strong>Status:</strong> <StatusBadge status={myContract.status} type="contract" /></p>
                    <p><strong>Created:</strong> {new Date(myContract.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {myContract.status === 'sent' && !signed && (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="agree"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="agree" className="text-sm">
                        I have read and agree to the terms and conditions
                      </label>
                    </div>
                    <div className="border border-dashed border-gray-300 rounded-md p-4 text-center">
                      <p className="text-sm text-muted-foreground">Digital Signature Area</p>
                      <p className="text-xs text-muted-foreground mt-1">Type your name to sign: <strong>{myCandidate.first_name} {myCandidate.last_name}</strong></p>
                    </div>
                    <Button onClick={handleSign} className="w-full">Sign Contract</Button>
                  </>
                )}

                {signed && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-4 text-center">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="font-medium text-green-800">Contract Signed Successfully</p>
                    <p className="text-sm text-green-600">Signed on {new Date().toLocaleDateString()}</p>
                  </div>
                )}

                {myContract.status === 'signed' && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-4 text-center">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="font-medium text-green-800">Contract Already Signed</p>
                    <p className="text-sm text-green-600">Signed on {myContract.signed_at ? new Date(myContract.signed_at).toLocaleDateString() : 'N/A'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No contract available yet</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-2">
          {myNotifications.map((notif) => (
            <Card key={notif.id} className={notif.read ? 'opacity-60' : ''}>
              <CardContent className="p-4 flex items-start gap-3">
                <Bell className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-sm">{notif.title}</p>
                  <p className="text-xs text-muted-foreground">{notif.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(notif.created_at).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

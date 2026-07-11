import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { mockCandidates, mockContracts } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileText, CheckCircle, Pen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ContractSigning() {
  const { id } = useParams<{ id: string }>();
  const contract = mockContracts.find((c) => c.id === id);
  const candidate = mockCandidates.find((c) => c.candidate_id === contract?.candidate_id);

  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signature, setSignature] = useState('');

  const handleSign = () => {
    if (!agreed) {
      toast.error('Please read and agree to the terms');
      return;
    }
    if (!signature.trim()) {
      toast.error('Please type your name as a signature');
      return;
    }
    setSigned(true);
    toast.success('Contract signed successfully!');
  };

  if (!contract || !candidate) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Contract not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Contract Signing</h1>
        <p className="text-sm text-muted-foreground mt-1">{contract.type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</p>
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>Employment Agreement</CardTitle>
          <StatusBadge status={contract.status} type="contract" />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Contract Preview */}
          <div className="bg-muted/50 rounded-lg p-6 space-y-4 border">
            <div className="text-center border-b pb-4">
              <h3 className="font-bold text-lg">WORKFORCE EUROPE</h3>
              <p className="text-sm text-muted-foreground">Recruitment Intelligence Platform</p>
            </div>

            <div className="space-y-3 text-sm">
              <p><strong>Candidate:</strong> {candidate.first_name} {candidate.last_name}</p>
              <p><strong>Email:</strong> {candidate.email}</p>
              <p><strong>Program:</strong> {candidate.program_name}</p>
              <p><strong>Contract Type:</strong> {contract.type.replace('_', ' ').toUpperCase()}</p>
              <p><strong>Date:</strong> {new Date(contract.created_at).toLocaleDateString()}</p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Terms and Conditions</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This agreement outlines the terms of employment between the candidate and the employer
                through Workforce Europe. By signing this contract, you agree to abide by all terms
                including work duration, compensation, accommodation arrangements, and training requirements.
                All parties acknowledge that Workforce Europe acts solely as a recruitment facilitator
                and is not the direct employer.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                The candidate agrees to complete all required training programs, maintain valid
                work authorization documents, and adhere to the employer's code of conduct.
                Either party may terminate this agreement with 30 days written notice.
              </p>
            </div>
          </div>

          {!signed && contract.status === 'sent' && (
            <>
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <Checkbox
                  id="agree"
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(v === true)}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="agree" className="font-medium cursor-pointer">
                    I have read and agree to the terms and conditions
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    By checking this box, you confirm that you have read, understood, and agree to be bound by
                    all terms and conditions outlined in this contract.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Digital Signature</Label>
                <p className="text-xs text-muted-foreground">
                  Type your full name below as your digital signature
                </p>
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder={`${candidate.first_name} ${candidate.last_name}`}
                  className="w-full h-16 text-2xl font-serif border-2 border-dashed border-gray-300 rounded-lg text-center focus:border-primary focus:outline-none italic"
                />
              </div>

              <Button onClick={handleSign} className="w-full" size="lg">
                <Pen className="w-4 h-4 mr-2" /> Sign Contract
              </Button>
            </>
          )}

          {signed && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <h3 className="text-lg font-bold text-green-800">Contract Signed Successfully!</h3>
              <p className="text-sm text-green-600">
                Signed by <strong>{signature}</strong> on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
              </p>
              <p className="text-xs text-green-500">
                A copy has been sent to your email.
              </p>
            </div>
          )}

          {contract.status === 'signed' && !signed && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <h3 className="text-lg font-bold text-green-800">Contract Already Signed</h3>
              <p className="text-sm text-green-600">
                This contract was signed on {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

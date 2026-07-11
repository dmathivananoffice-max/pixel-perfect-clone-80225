import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { mockExtractionFields, mockCandidates } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

type FieldStatus = 'pending' | 'confirmed' | 'edited';

interface ExtractField {
  field_name: string;
  ai_suggested_value: string;
  human_confirmed_value?: string;
  confidence: number;
  status: FieldStatus;
}

export default function DocumentImport() {
  const [uploaded, setUploaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [fields, setFields] = useState<ExtractField[]>(mockExtractionFields.map((f) => ({ ...f })));
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploaded(true);
      setProcessing(true);
      setProgress(0);

      // Simulate processing
      let p = 0;
      const interval = setInterval(() => {
        p += 10;
        setProgress(p);
        if (p >= 100) {
          clearInterval(interval);
          setProcessing(false);
          toast.success('Document processed - AI extraction complete');
        }
      }, 200);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxFiles: 1,
  });

  const confirmField = (index: number) => {
    const newFields = [...fields];
    newFields[index] = {
      ...newFields[index],
      status: 'confirmed' as FieldStatus,
      human_confirmed_value: newFields[index].ai_suggested_value,
    };
    setFields(newFields);
  };

  const editField = (index: number, value: string) => {
    const newFields = [...fields];
    newFields[index] = {
      ...newFields[index],
      status: 'edited' as FieldStatus,
      human_confirmed_value: value,
    };
    setFields(newFields);
  };

  const bulkConfirm = () => {
    setFields(fields.map((f) => ({
      ...f,
      status: 'confirmed' as FieldStatus,
      human_confirmed_value: f.human_confirmed_value || f.ai_suggested_value,
    })));
    toast.success('All fields confirmed');
  };

  const saveExtractions = () => {
    toast.success('Extractions saved to candidate record');
  };

  const confirmedCount = fields.filter((f) => f.status === 'confirmed' || f.status === 'edited').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Document Import & AI OCR Review</h1>
        <p className="text-sm text-muted-foreground">Upload documents and review AI-extracted fields</p>
      </div>

      {/* Upload Zone */}
      {!uploaded && (
        <Card>
          <CardContent className="p-8">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">
                {isDragActive ? 'Drop the file here' : 'Drag & drop a document here'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse (PDF, PNG, JPG)
              </p>
            </div>

            <div className="mt-4">
              <Label>Assign to Candidate</Label>
              <Select value={selectedCandidate} onValueChange={setSelectedCandidate}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select candidate" />
                </SelectTrigger>
                <SelectContent>
                  {mockCandidates.slice(0, 10).map((c) => (
                    <SelectItem key={c.candidate_id} value={c.candidate_id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing */}
      {uploaded && processing && (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <h3 className="text-lg font-medium">Processing Document...</h3>
            <p className="text-sm text-muted-foreground">Running OCR and AI extraction</p>
            <div className="max-w-md mx-auto">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground mt-2">{progress}%</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Interface */}
      {uploaded && !processing && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <span className="font-medium">Document uploaded successfully</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{confirmedCount}/{fields.length} fields confirmed</span>
              <Button variant="outline" size="sm" onClick={bulkConfirm}>Confirm All</Button>
              <Button size="sm" onClick={saveExtractions}><Save className="w-4 h-4 mr-2" /> Save</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Original Document Placeholder */}
            <Card>
              <CardHeader><CardTitle className="text-base">Original Document</CardTitle></CardHeader>
              <CardContent>
                <div className="aspect-[3/4] bg-gray-100 rounded-lg flex items-center justify-center border">
                  <div className="text-center text-muted-foreground">
                    <FileText className="w-16 h-16 mx-auto mb-3 opacity-50" />
                    <p>Original PDF/Image</p>
                    <p className="text-xs mt-1">Passport scan</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Extracted Fields */}
            <Card>
              <CardHeader><CardTitle className="text-base">AI Extraction Results</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {fields.map((field, idx) => (
                  <div
                    key={field.field_name}
                    className={`p-3 rounded-lg border ${
                      field.status === 'confirmed' ? 'border-green-200 bg-green-50/50' :
                      field.status === 'edited' ? 'border-blue-200 bg-blue-50/50' :
                      'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs font-medium capitalize">{field.field_name.replace('_', ' ')}</Label>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          field.confidence >= 0.9 ? 'bg-green-100 text-green-700' :
                          field.confidence >= 0.7 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {(field.confidence * 100).toFixed(0)}%
                        </span>
                        {field.status === 'confirmed' && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                      </div>
                    </div>
                    <Input
                      value={field.human_confirmed_value || field.ai_suggested_value}
                      onChange={(e) => editField(idx, e.target.value)}
                      className="h-8 text-sm"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        AI: {field.ai_suggested_value}
                      </span>
                      {field.status !== 'confirmed' && (
                        <button onClick={() => confirmField(idx)} className="text-xs text-primary hover:underline">
                          Confirm
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useRef, useState } from 'react';
import {
  UploadCloud, FolderTree, FileText, Trash2, ArrowLeft, ArrowRight, FileArchive, Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { IntakeMode } from '@/lib/intake/batch';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  kind: 'pdf' | 'image' | 'doc' | 'zip' | 'other';
  path?: string; // preserved webkitRelativePath for folder uploads
}

function kindOf(name: string): UploadedFile['kind'] {
  const n = name.toLowerCase();
  if (n.endsWith('.zip')) return 'zip';
  if (n.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|webp|heic|tiff?)$/.test(n)) return 'image';
  if (/\.(docx?|txt|rtf)$/.test(n)) return 'doc';
  return 'other';
}

function humanSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadStep({
  mode, productLabel, onBack, onContinue,
}: {
  mode: IntakeMode;
  productLabel: string;
  onBack: () => void;
  onContinue: (files: UploadedFile[]) => void;
}) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setFiles((prev) => [
      ...prev,
      ...arr.map((f, i) => ({
        id: `f-${Date.now()}-${i}-${f.name}`,
        name: f.name,
        size: f.size,
        kind: kindOf(f.name),
        // webkitRelativePath is set when using directory uploads
        path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || undefined,
      })),
    ]);
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const groups = groupByFolder(files);

  const singleMode = mode === 'single';
  const min = singleMode ? 1 : 2;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
            <Sparkles className="size-3" /> Step 3 of 6 · {productLabel}
          </p>
          <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight">
            {singleMode ? 'Upload the candidate\u2019s documents' : 'Upload the batch'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {singleMode
              ? 'Drag every document you have. AI will OCR, classify and pre-fill the entire form.'
              : 'Drop a ZIP, an entire folder, or a mix. AI groups documents by candidate before you review a single form.'}
          </p>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={cn(
            'relative rounded-2xl border-2 border-dashed p-10 text-center transition',
            drag ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/20 hover:bg-muted/30',
          )}
        >
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
            <UploadCloud className="size-6 text-primary" />
          </div>
          <h3 className="font-display mt-4 text-xl font-semibold">Drop files, folders, or ZIPs here</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            PDF · DOCX · Images · ZIP · Nested folders
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
              <FileText className="size-4" /> Choose files
            </Button>
            <Button variant="outline" size="sm" onClick={() => folderRef.current?.click()} className="gap-1.5">
              <FolderTree className="size-4" /> Choose folder
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.zip,image/*"
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <input
              ref={folderRef}
              type="file"
              multiple
              className="hidden"
              /* @ts-expect-error non-standard */
              webkitdirectory=""
              directory=""
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>
        </div>

        {/* File preview */}
        {files.length > 0 && (
          <div className="mt-8 rounded-xl border border-border/60 bg-background">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="text-sm">
                <span className="font-medium">{files.length}</span>{' '}
                <span className="text-muted-foreground">
                  file{files.length === 1 ? '' : 's'} · {humanSize(totalSize)}
                </span>
              </div>
              <button
                onClick={() => setFiles([])}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Clear all
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {groups.map((g) => (
                <div key={g.folder} className="mb-2">
                  {g.folder !== '__root__' && (
                    <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                      <FolderTree className="size-3" /> {g.folder}
                    </div>
                  )}
                  <ul className="divide-y divide-border/40">
                    {g.files.map((f) => (
                      <li key={f.id} className="flex items-center gap-3 px-2 py-1.5 text-sm">
                        <KindIcon kind={f.kind} />
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <span className="tabular-nums text-[11px] text-muted-foreground">
                          {humanSize(f.size)}
                        </span>
                        <button
                          onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                          aria-label={`Remove ${f.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button
            size="lg"
            onClick={() => onContinue(files)}
            disabled={files.length < min}
            className="gap-2"
          >
            Run AI extraction <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function KindIcon({ kind }: { kind: UploadedFile['kind'] }) {
  if (kind === 'zip')   return <FileArchive className="size-4 text-amber-600" />;
  if (kind === 'image') return <ImageIcon className="size-4 text-violet-600" />;
  return <FileText className="size-4 text-muted-foreground" />;
}

function groupByFolder(files: UploadedFile[]): { folder: string; files: UploadedFile[] }[] {
  const map = new Map<string, UploadedFile[]>();
  for (const f of files) {
    const folder = f.path ? f.path.split('/').slice(0, -1).join('/') || '__root__' : '__root__';
    const arr = map.get(folder) ?? [];
    arr.push(f);
    map.set(folder, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, files]) => ({ folder, files }));
}

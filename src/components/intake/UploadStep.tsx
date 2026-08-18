import { useCallback, useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  FolderTree,
  FileText,
  Trash2,
  ArrowLeft,
  ArrowRight,
  FileArchive,
  Image as ImageIcon,
  Sparkles,
  Users,
  ShieldCheck,
  AlertTriangle,
  Clock,
  HelpCircle,
  Copy,
  XCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { IntakeMode } from "@/lib/intake/batch";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  kind: "pdf" | "image" | "doc" | "zip" | "other";
  path?: string; // preserved webkitRelativePath for folder uploads
  file: File; // real File handle for upload
}

// ─────────────────────────────────────────────────────────────
// Filename → document type heuristics (matches DOC_SET tokens)
// ─────────────────────────────────────────────────────────────
const DOC_PATTERNS: { type: string; label: string; test: RegExp }[] = [
  { type: "passport", label: "Passport", test: /(passport|reisepass)/i },
  { type: "photo", label: "Photo", test: /(photo|lichtbild|picture|foto)/i },
  { type: "degree", label: "Degree", test: /(degree|bachelor|master|zeugnis|diploma|transcript)/i },
  { type: "sprach", label: "Language cert", test: /(sprach|goethe|telc|b1|b2|c1|language)/i },
  { type: "cv", label: "CV / Résumé", test: /(cv|resume|lebenslauf)/i },
  { type: "police", label: "Police clearance", test: /(police|clearance|fuehrungszeugnis|pcc)/i },
  { type: "medical", label: "Medical fitness", test: /(medical|health|gesundheit|fitness)/i },
  { type: "driving", label: "Driving licence", test: /(driving|licence|license|fuehrerschein)/i },
];

function classifyDoc(name: string): { type: string; label: string } {
  for (const p of DOC_PATTERNS) if (p.test.test(name)) return { type: p.type, label: p.label };
  return { type: "unknown", label: "Unknown" };
}

function kindOf(name: string): UploadedFile["kind"] {
  const n = name.toLowerCase();
  if (n.endsWith(".zip")) return "zip";
  if (n.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|webp|heic|tiff?)$/.test(n)) return "image";
  if (/\.(docx?|txt|rtf)$/.test(n)) return "doc";
  return "other";
}

function isSupported(name: string): boolean {
  return /\.(pdf|docx?|png|jpe?g|webp|heic|tiff?|zip|txt|rtf)$/i.test(name);
}

function humanSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function humanTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

// ─────────────────────────────────────────────────────────────
// Batch analysis — grouping, counts, confidence, estimates
// ─────────────────────────────────────────────────────────────
interface CandidateGroup {
  key: string; // folder path or synthetic id
  displayName: string;
  files: UploadedFile[];
  docTypes: Map<string, number>;
  confidence: number; // 0..1
  reason: string;
}

interface BatchAnalysis {
  totalFiles: number;
  totalSize: number;
  supported: number;
  unsupported: UploadedFile[];
  unknown: UploadedFile[];
  duplicates: UploadedFile[];
  docTypeCounts: Map<string, { label: string; count: number }>;
  groups: CandidateGroup[];
  estimateSeconds: number;
  errors: string[];
}

function analyzeBatch(files: UploadedFile[]): BatchAnalysis {
  const docTypeCounts = new Map<string, { label: string; count: number }>();
  const unsupported: UploadedFile[] = [];
  const unknown: UploadedFile[] = [];
  const duplicates: UploadedFile[] = [];
  const seen = new Map<string, UploadedFile>();

  // Grouping key: first path segment (folder) or filename stem prefix
  const groupsMap = new Map<string, UploadedFile[]>();

  for (const f of files) {
    if (!isSupported(f.name)) unsupported.push(f);

    const dupKey = `${f.name.toLowerCase()}::${f.size}`;
    if (seen.has(dupKey)) duplicates.push(f);
    else seen.set(dupKey, f);

    const cls = classifyDoc(f.name);
    if (cls.type === "unknown" && isSupported(f.name)) unknown.push(f);
    const entry = docTypeCounts.get(cls.type) ?? { label: cls.label, count: 0 };
    entry.count += 1;
    docTypeCounts.set(cls.type, entry);

    // Group key: top-level folder if provided; else prefix before separator
    let key = "";
    if (f.path) {
      key = f.path.split("/")[0] || "__root__";
    } else {
      const stem = f.name.replace(/\.[^.]+$/, "");
      const m = stem.match(/^([a-zA-Z]+[-_ ]?[a-zA-Z]+)/);
      key = m ? m[1].toLowerCase() : "__root__";
    }
    const arr = groupsMap.get(key) ?? [];
    arr.push(f);
    groupsMap.set(key, arr);
  }

  const groups: CandidateGroup[] = Array.from(groupsMap.entries())
    .map(([key, gFiles]) => {
      const types = new Map<string, number>();
      for (const f of gFiles) {
        const c = classifyDoc(f.name);
        types.set(c.label, (types.get(c.label) ?? 0) + 1);
      }
      // Confidence: folder-based groups start high; heuristic groups lower.
      // Boost with variety of doc types recognized; penalize if all unknown.
      const recognized = Array.from(types.keys()).filter((k) => k !== "Unknown").length;
      let confidence = key === "__root__" ? 0.4 : 0.75;
      confidence += Math.min(0.2, recognized * 0.04);
      if (recognized === 0) confidence -= 0.35;
      confidence = Math.max(0.15, Math.min(0.98, confidence));

      const reason =
        key === "__root__"
          ? "No folder structure — grouped by filename stem"
          : `Folder "${key}" · ${recognized} recognized document type${recognized === 1 ? "" : "s"}`;

      const displayName =
        key === "__root__"
          ? "Ungrouped files"
          : key.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      return { key, displayName, files: gFiles, docTypes: types, confidence, reason };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const zipCount = files.filter((f) => f.kind === "zip").length;
  // Estimate: 3s per document + 8s per zip + 1s per MB (network)
  const estimateSeconds = files.length * 3 + zipCount * 8 + (totalSize / (1024 * 1024)) * 1;

  const errors: string[] = [];
  if (files.length === 0) errors.push("No files added yet.");
  if (unsupported.length > 0)
    errors.push(
      `${unsupported.length} unsupported file${unsupported.length === 1 ? "" : "s"} will be skipped.`,
    );

  return {
    totalFiles: files.length,
    totalSize,
    supported: files.length - unsupported.length,
    unsupported,
    unknown,
    duplicates,
    docTypeCounts,
    groups,
    estimateSeconds,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function UploadStep({
  mode,
  productLabel,
  onBack,
  onContinue,
}: {
  mode: IntakeMode;
  productLabel: string;
  onBack: () => void;
  onContinue: (files: UploadedFile[]) => void;
}) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [drag, setDrag] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
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
        path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || undefined,
        file: f,
      })),
    ]);
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  const analysis = useMemo(() => analyzeBatch(files), [files]);
  const singleMode = mode === "single";
  const min = singleMode ? 1 : 2;
  const lowConfidenceGroups = analysis.groups.filter((g) => g.confidence < 0.6).length;
  const canProcess = files.length >= min && analysis.supported > 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
              <Sparkles className="size-3" /> Step 3 of 6 · {productLabel}
            </p>
            <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight">
              {singleMode ? "Upload the candidate\u2019s documents" : "Upload Command Center"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {singleMode
                ? "Drag every document you have. AI will OCR, classify and pre-fill the entire form."
                : "Drop a ZIP, an entire folder, or a mix. Everything is validated, grouped by candidate, and previewed before a single document is processed."}
            </p>
          </div>
          {files.length > 0 && (
            <button
              onClick={() => setFiles([])}
              className="shrink-0 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Clear batch
            </button>
          )}
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={cn(
            "relative rounded-2xl border-2 border-dashed p-10 text-center transition",
            drag ? "border-primary bg-primary/5" : "border-border/60 bg-muted/20 hover:bg-muted/30",
          )}
        >
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
            <UploadCloud className="size-6 text-primary" />
          </div>
          <h3 className="font-display mt-4 text-xl font-semibold">
            Drop files, folders, or ZIPs here
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            PDF · DOCX · Images · ZIP · Nested folders
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              className="gap-1.5"
            >
              <FileText className="size-4" /> Choose files
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => folderRef.current?.click()}
              className="gap-1.5"
            >
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

        {/* Batch analysis (bulk only, once files exist) */}
        {!singleMode && files.length > 0 && (
          <div className="mt-8 space-y-6">
            {/* Summary tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Tile icon={Users} label="Candidates" value={analysis.groups.length} tone="primary" />
              <Tile icon={FileText} label="Documents" value={analysis.totalFiles} />
              <Tile
                icon={HelpCircle}
                label="Unknown"
                value={analysis.unknown.length}
                tone={analysis.unknown.length ? "warn" : undefined}
              />
              <Tile
                icon={Copy}
                label="Duplicates"
                value={analysis.duplicates.length}
                tone={analysis.duplicates.length ? "warn" : undefined}
              />
              <Tile
                icon={XCircle}
                label="Unsupported"
                value={analysis.unsupported.length}
                tone={analysis.unsupported.length ? "danger" : undefined}
              />
              <Tile icon={Clock} label="Est. time" value={humanTime(analysis.estimateSeconds)} />
            </div>

            {/* Doc type breakdown */}
            <div className="rounded-xl border border-border/60 bg-background p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Document type breakdown</h3>
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {analysis.docTypeCounts.size} types detected
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from(analysis.docTypeCounts.entries()).map(([type, v]) => (
                  <span
                    key={type}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ring-1",
                      type === "unknown"
                        ? "bg-amber-50 text-amber-800 ring-amber-200"
                        : "bg-muted/50 text-foreground ring-border/60",
                    )}
                  >
                    <span className="font-medium">{v.label}</span>
                    <span className="tabular-nums text-muted-foreground">{v.count}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Validation errors */}
            {(analysis.errors.length > 0 || lowConfidenceGroups > 0) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                  <div className="flex-1 text-sm text-amber-900">
                    <p className="font-medium">Review before processing</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                      {analysis.errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                      {lowConfidenceGroups > 0 && (
                        <li>
                          {lowConfidenceGroups} candidate grouping
                          {lowConfidenceGroups === 1 ? "" : "s"} flagged low-confidence — verify
                          below.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Candidate grouping preview */}
            <div className="rounded-xl border border-border/60 bg-background">
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Candidate grouping preview</h3>
                </div>
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {analysis.groups.length} candidate{analysis.groups.length === 1 ? "" : "s"}{" "}
                  detected
                </span>
              </div>
              <ul className="divide-y divide-border/50">
                {analysis.groups.map((g) => {
                  const expanded = expandedGroup === g.key;
                  const low = g.confidence < 0.6;
                  return (
                    <li key={g.key}>
                      <button
                        onClick={() => setExpandedGroup(expanded ? null : g.key)}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-muted/30"
                      >
                        {expanded ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{g.displayName}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                              {g.files.length} doc{g.files.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {g.reason}
                          </p>
                        </div>
                        <ConfidencePill confidence={g.confidence} low={low} />
                      </button>
                      {expanded && (
                        <div className="border-t border-border/40 bg-muted/20 px-5 py-3">
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {Array.from(g.docTypes.entries()).map(([label, count]) => (
                              <span
                                key={label}
                                className="rounded-full bg-background px-2 py-0.5 text-[11px] ring-1 ring-border/60"
                              >
                                {label} ·{" "}
                                <span className="tabular-nums text-muted-foreground">{count}</span>
                              </span>
                            ))}
                          </div>
                          <ul className="divide-y divide-border/40">
                            {g.files.map((f) => (
                              <li key={f.id} className="flex items-center gap-3 py-1.5 text-sm">
                                <KindIcon kind={f.kind} />
                                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                                <span className="tabular-nums text-[11px] text-muted-foreground">
                                  {humanSize(f.size)}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFiles((prev) => prev.filter((x) => x.id !== f.id));
                                  }}
                                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                                  aria-label={`Remove ${f.name}`}
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Single-mode legacy list */}
        {singleMode && files.length > 0 && (
          <div className="mt-8 rounded-xl border border-border/60 bg-background">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="text-sm">
                <span className="font-medium">{files.length}</span>{" "}
                <span className="text-muted-foreground">
                  file{files.length === 1 ? "" : "s"} · {humanSize(analysis.totalSize)}
                </span>
              </div>
              <button
                onClick={() => setFiles([])}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Clear all
              </button>
            </div>
            <ul className="max-h-80 divide-y divide-border/40 overflow-y-auto p-2">
              {files.map((f) => (
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
        )}

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="size-4" /> Back
          </Button>
          <div className="flex items-center gap-4">
            {!singleMode && files.length > 0 && (
              <div className="hidden text-right text-xs text-muted-foreground sm:block">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  {analysis.supported} of {analysis.totalFiles} files will be processed
                </div>
                <div className="mt-0.5">Estimated {humanTime(analysis.estimateSeconds)}</div>
              </div>
            )}
            <Button
              size="lg"
              onClick={() => onContinue(files)}
              disabled={!canProcess}
              className="gap-2"
            >
              {singleMode ? "Build Candidate Draft" : "Process Batch"}{" "}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bits
// ─────────────────────────────────────────────────────────────
function Tile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone?: "primary" | "warn" | "danger";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary/5 ring-primary/20 text-primary"
      : tone === "warn"
        ? "bg-amber-50 ring-amber-200 text-amber-800"
        : tone === "danger"
          ? "bg-rose-50 ring-rose-200 text-rose-800"
          : "bg-background ring-border/60 text-foreground";
  return (
    <div className={cn("rounded-xl px-4 py-3 ring-1", toneClass)}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest opacity-70">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ConfidencePill({ confidence, low }: { confidence: number; low: boolean }) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="hidden w-24 sm:block">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full transition-all",
              low ? "bg-amber-500" : pct >= 85 ? "bg-emerald-500" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ring-1",
          low
            ? "bg-amber-50 text-amber-800 ring-amber-200"
            : pct >= 85
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
              : "bg-muted text-foreground ring-border/60",
        )}
      >
        {low ? <AlertTriangle className="size-3" /> : <CheckCircle2 className="size-3" />}
        {pct}%
      </span>
    </div>
  );
}

function KindIcon({ kind }: { kind: UploadedFile["kind"] }) {
  if (kind === "zip") return <FileArchive className="size-4 text-amber-600" />;
  if (kind === "image") return <ImageIcon className="size-4 text-violet-600" />;
  return <FileText className="size-4 text-muted-foreground" />;
}

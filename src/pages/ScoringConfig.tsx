import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Scale,
  Save,
  AlertTriangle,
  Info,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSelectionEngine, useEngineKpis, type ProgramKey } from "@/store/selectionEngineStore";

const CHART_COLORS = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"];

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

export default function ScoringConfig() {
  const configs = useSelectionEngine((s) => s.configs);
  const setGate = useSelectionEngine((s) => s.setGate);
  const setWeight = useSelectionEngine((s) => s.setWeight);
  const resetProgram = useSelectionEngine((s) => s.resetProgram);

  const [active, setActive] = useState<ProgramKey>("professional_nurses");
  const cfg = configs[active];
  const kpis = useEngineKpis(active);

  const totalWeight = useMemo(
    () => cfg.criteria.reduce((sum, c) => sum + c.weight, 0),
    [cfg.criteria],
  );
  const balanced = totalWeight === 100;

  const gatesEnforced = cfg.gates.filter((g) => g.enabled).length;
  const gatesTotal = cfg.gates.length;

  const updateGate = (id: string, enabled: boolean) => setGate(active, id, enabled);
  const updateWeight = (id: string, weight: number) => setWeight(active, id, weight);

  const handleReset = () => {
    resetProgram(active);
    toast.success(`${cfg.label} restored to defaults`);
  };

  const save = () => {
    if (!balanced) {
      toast.error("Weights must total 100% before saving", {
        description: `Current total is ${totalWeight}%`,
      });
      return;
    }
    toast.success("Selection engine saved", {
      description: `${cfg.label} · ${gatesEnforced}/${gatesTotal} gates enforced · ${kpis.eligible}/${kpis.total} eligible candidates`,
    });
  };

  const pieData = cfg.criteria.map((c) => ({ name: c.label, value: c.weight }));

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Selection Engine</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Two-layer model. Candidates must clear{" "}
            <span className="font-medium text-foreground">every mandatory eligibility gate</span>{" "}
            before the scoring engine runs — no score is calculated for ineligible candidates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="size-4" /> Reset to defaults
          </Button>
          <Button size="sm" onClick={save} className="gap-1.5">
            <Save className="size-4" /> Save changes
          </Button>
        </div>
      </div>

      {/* Program tabs */}
      <Tabs value={active} onValueChange={(v) => setActive(v as ProgramKey)}>
        <TabsList className="grid w-full max-w-xl grid-cols-2">
          <TabsTrigger value="professional_nurses" className="gap-1.5">
            👩‍⚕️ Professional Nurses
          </TabsTrigger>
          <TabsTrigger value="ausbildung" className="gap-1.5">
            🎓 Ausbildung Nursing
          </TabsTrigger>
        </TabsList>

        {(["professional_nurses", "ausbildung"] as ProgramKey[]).map((key) => (
          <TabsContent key={key} value={key} className="mt-6 space-y-6">
            {/* Layer 1 — Eligibility Gates */}
            <Card className="border-emerald-200/70">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-emerald-300 bg-emerald-50 text-emerald-800"
                      >
                        Layer 1
                      </Badge>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <ShieldCheck className="size-5 text-emerald-600" /> Mandatory Eligibility
                        Gates
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Pass / Fail. Candidates who fail any enforced gate are marked{" "}
                      <span className="font-medium text-foreground">
                        Not Eligible for Shortlisting
                      </span>{" "}
                      and do not enter the scoring engine.
                    </CardDescription>
                  </div>
                  <div className="shrink-0 rounded-lg border border-border/70 px-3 py-2 text-right">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Enforced
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {configs[key].gates.filter((g) => g.enabled).length}
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        / {configs[key].gates.length}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 md:grid-cols-2">
                  {configs[key].gates.map((g) => (
                    <li
                      key={g.id}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-md border px-3 py-2.5 transition-colors",
                        g.enabled
                          ? "border-emerald-200 bg-emerald-50/60"
                          : "border-border bg-muted/30",
                      )}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        {g.enabled ? (
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "text-sm font-medium leading-tight",
                              !g.enabled && "text-muted-foreground line-through",
                            )}
                          >
                            {g.label}
                          </p>
                          {g.hint && (
                            <p className="mt-0.5 text-[11px] text-emerald-800/80">{g.hint}</p>
                          )}
                          {g.locked && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Policy-locked — required by Workforce Europe standards
                            </p>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={g.enabled}
                        disabled={g.locked}
                        onCheckedChange={(v) => {
                          setActive(key);
                          updateGate(g.id, v);
                        }}
                      />
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    <span className="font-medium">B2 German is mandatory</span> for both
                    Professional Nurses and Ausbildung Nursing. This gate is locked at the platform
                    level and cannot be disabled per program.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Layer 2 — Scoring criteria */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-800">
                        Layer 2
                      </Badge>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Scale className="size-5 text-sky-600" /> Academic &amp; Profile
                        Shortlisting Score
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Runs only for candidates who cleared Layer 1. Determines who receives a
                      Speaking Assessment invitation.
                    </CardDescription>
                  </div>
                  <div className="shrink-0 rounded-lg border border-border/70 px-3 py-2 text-right">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Total weight
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold tabular-nums",
                        balanced ? "text-emerald-700" : "text-red-600",
                      )}
                    >
                      {configs[key].criteria.reduce((s, c) => s + c.weight, 0)}%
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 lg:grid-cols-5">
                  {/* Sliders */}
                  <div className="space-y-4 lg:col-span-3">
                    {configs[key].criteria.map((c, idx) => (
                      <div key={c.id} className="rounded-lg border border-border/70 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                              aria-hidden
                            />
                            <Label className="truncate text-sm font-medium">{c.label}</Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={c.weight}
                              onChange={(e) => {
                                setActive(key);
                                updateWeight(c.id, Number(e.target.value) || 0);
                              }}
                              className="h-8 w-16 text-right tabular-nums"
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        </div>
                        <Slider
                          value={[c.weight]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={([v]) => {
                            setActive(key);
                            updateWeight(c.id, v);
                          }}
                        />
                      </div>
                    ))}

                    {!balanced && active === key && (
                      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <p>
                          Weights must total <span className="font-semibold">100%</span>. Currently{" "}
                          {totalWeight}%.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Distribution chart */}
                  <div className="lg:col-span-2">
                    <div className="rounded-lg border border-border/70 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium">Weight distribution</p>
                        <span className="text-[11px] text-muted-foreground">Live preview</span>
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={configs[key].criteria.map((c) => ({
                              name: c.label,
                              value: c.weight,
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                            nameKey="name"
                          >
                            {configs[key].criteria.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => `${v}%`} />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            wrapperStyle={{ fontSize: 11, lineHeight: "14px" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pipeline diagram */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="size-4 text-muted-foreground" /> Selection pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-wrap items-center gap-1.5 text-xs">
                  {[
                    "Mandatory Gates",
                    "Shortlisting Score",
                    "Speaking Assessment",
                    "Training",
                    "STI Assessment",
                    "Employer Interview",
                    "Final Recommendation",
                  ].map((step, i, arr) => (
                    <li key={step} className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 font-medium ring-1 ring-inset",
                          i <= 1
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                            : "bg-background text-foreground/80 ring-border",
                        )}
                      >
                        {i + 1}. {step}
                      </span>
                      {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                    </li>
                  ))}
                </ol>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">
                  Only candidates who pass Layer 1 gates enter Layer 2. Only high-ranking candidates
                  from Layer 2 receive Speaking Assessment invitations — significantly reducing
                  recruiter workload while keeping quality high.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

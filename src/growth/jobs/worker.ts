/**
 * pg-boss worker entry for Growth OS jobs.
 *   DATABASE_URL=postgres://... bun src/growth/jobs/worker.ts
 */
import { loadBands, loadWeights } from "../scoring/loadConfig";
import { ScoringService } from "../scoring/service";
import type { ScoreRecord, ScoringStore } from "../scoring/service";
import type { ComputedScore, OverrideReasonCode } from "../scoring/types";
import bandsJson from "../scoring/config/scoring-bands.v1.json";
import weightsJson from "../scoring/config/scoring-weights.v1.json";
import { CapacityService } from "../capacity/service";
import { createMemoryCapacityStore } from "../capacity/memoryStore";
import {
  createPgBoss,
  pgBossQueue,
  registerCapacityWorkers,
  registerScoringWorkers,
} from "./pgBossQueue";

/** Placeholder store — replace with Supabase adapter in deploy wiring. */
function memoryStore(): ScoringStore {
  const scores = new Map<string, ScoreRecord[]>();
  return {
    async getLatestScore(lead_id) {
      const list = scores.get(lead_id) ?? [];
      return list[list.length - 1] ?? null;
    },
    async insertScore(lead_id, score) {
      const row: ScoreRecord = { ...score, id: crypto.randomUUID(), lead_id };
      const list = scores.get(lead_id) ?? [];
      list.push(row);
      scores.set(lead_id, list);
      return row;
    },
    async insertOverride() {},
    async insertOverrideScore(lead_id, base, to_band, reason_code) {
      const score: ComputedScore = {
        ...base,
        band: to_band,
        explanation: {
          ...base.explanation,
          band: to_band,
          inputs: {
            ...base.explanation.inputs,
            signals: {
              ...base.explanation.inputs.signals,
              // mark override in explanation for audit readability
            },
          },
        },
      };
      // attach reason on explanation via cast-friendly field
      (score.explanation as { override?: { reason_code: OverrideReasonCode } }).override =
        { reason_code };
      return this.insertScore(lead_id, score);
    },
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const boss = await createPgBoss(url);
  const queue = pgBossQueue(boss);
  const service = new ScoringService(
    loadWeights(weightsJson),
    loadBands(bandsJson),
    memoryStore(),
    queue,
  );

  await registerScoringWorkers(boss, {
    onRecompute: async (payload) => {
      if (!payload.answers || !payload.branch) {
        console.warn("recompute skipped — missing answers/branch", payload.lead_id);
        return;
      }
      const saved = await service.recompute(
        payload.lead_id,
        {
          branch: payload.branch,
          answers: payload.answers,
          signals: { diagnostic_completed: payload.trigger === "diagnostic_completion" },
        },
        payload.trigger,
      );
      console.log("scored", payload.lead_id, saved.band, saved.composite);
    },
    onCounsellorTask: async (payload) => {
      console.log("counsellor_task", payload);
    },
    onCopilotBriefing: async (payload) => {
      console.log("copilot_briefing", payload);
    },
    onDqMessage: async (payload) => {
      console.log("dq_message asset_ref only", payload);
    },
  });

  // M9: wire Supabase CapacityStore in deploy; memory placeholder for local worker boot.
  const capacity = new CapacityService(createMemoryCapacityStore());
  await registerCapacityWorkers(boss, async (payload) => {
    const states = await capacity.runHourlyGovernor();
    console.log(
      "capacity_governor",
      payload.trigger,
      states.map((s) => `${s.pathway}:${s.fill_ratio}:wl=${s.waitlist_mode}`),
    );
  });

  console.log("Growth worker started (scoring + capacity governor)");
}


main().catch((err) => {
  console.error(err);
  process.exit(1);
});

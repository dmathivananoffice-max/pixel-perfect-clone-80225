import PgBoss from "pg-boss";
import type { JobEnqueue, JobQueue } from "../scoring/queue";
import {
  SCORE_JOBS,
  type RecomputeJobPayload,
} from "../scoring/jobs";

export type RecomputeHandler = (payload: RecomputeJobPayload) => Promise<void>;

export async function createPgBoss(connectionString: string): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString,
    schema: "pgboss",
    archiveCompletedAfterSeconds: 60 * 60 * 24 * 7,
  });
  await boss.start();
  return boss;
}

export function pgBossQueue(boss: PgBoss): JobQueue {
  return {
    async send(job: JobEnqueue) {
      const id = await boss.send(job.name, job.payload as object, {
        singletonKey: job.options?.singletonKey,
      });
      return id;
    },
  };
}

/** Register M3 scoring job consumers. */
export async function registerScoringWorkers(
  boss: PgBoss,
  handlers: {
    onRecompute: RecomputeHandler;
    onCounsellorTask?: (payload: unknown) => Promise<void>;
    onCopilotBriefing?: (payload: unknown) => Promise<void>;
    onDqMessage?: (payload: unknown) => Promise<void>;
  },
): Promise<void> {
  await boss.createQueue(SCORE_JOBS.RECOMPUTE);
  await boss.createQueue(SCORE_JOBS.COUNSELLOR_TASK);
  await boss.createQueue(SCORE_JOBS.COPILOT_BRIEFING);
  await boss.createQueue(SCORE_JOBS.DQ_MESSAGE);

  await boss.work<RecomputeJobPayload>(SCORE_JOBS.RECOMPUTE, async ([job]) => {
    await handlers.onRecompute(job.data);
  });

  await boss.work(SCORE_JOBS.COUNSELLOR_TASK, async ([job]) => {
    await handlers.onCounsellorTask?.(job.data);
  });

  await boss.work(SCORE_JOBS.COPILOT_BRIEFING, async ([job]) => {
    await handlers.onCopilotBriefing?.(job.data);
  });

  await boss.work(SCORE_JOBS.DQ_MESSAGE, async ([job]) => {
    await handlers.onDqMessage?.(job.data);
  });
}

/** Helper for trigger sites (diag complete, contact, message, booking). */
export async function enqueueScoreRecompute(
  queue: JobQueue,
  payload: RecomputeJobPayload,
): Promise<void> {
  await queue.send({
    name: SCORE_JOBS.RECOMPUTE,
    payload,
    options: {
      singletonKey: `recompute:${payload.lead_id}:${payload.trigger}`,
    },
  });
}

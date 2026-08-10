import PgBoss from "pg-boss";
import type { JobEnqueue, JobQueue } from "../scoring/queue";
import {
  SCORE_JOBS,
  type RecomputeJobPayload,
} from "../scoring/jobs";
import {
  CAPACITY_JOBS,
  type CapacityGovernorJobPayload,
} from "../capacity/jobs";
import {
  ANALYTICS_JOBS,
  type AnalyticsRollupJobPayload,
} from "../analytics/jobs";
import {
  ADS_JOBS,
  type AdsReadSyncJobPayload,
} from "../ads/jobs";

export type RecomputeHandler = (payload: RecomputeJobPayload) => Promise<void>;
export type CapacityGovernorHandler = (
  payload: CapacityGovernorJobPayload,
) => Promise<void>;
export type AnalyticsRollupHandler = (
  payload: AnalyticsRollupJobPayload,
) => Promise<void>;
export type AdsReadSyncHandler = (
  payload: AdsReadSyncJobPayload,
) => Promise<void>;

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

/** Register M9 capacity governor — hourly schedule. */
export async function registerCapacityWorkers(
  boss: PgBoss,
  onHourly: CapacityGovernorHandler,
): Promise<void> {
  await boss.createQueue(CAPACITY_JOBS.HOURLY);
  await boss.work<CapacityGovernorJobPayload>(
    CAPACITY_JOBS.HOURLY,
    async ([job]) => {
      await onHourly(job.data);
    },
  );
  // cron: top of every hour
  await boss.schedule(CAPACITY_JOBS.HOURLY, "0 * * * *", {
    trigger: "schedule",
    requested_at: new Date().toISOString(),
  } satisfies CapacityGovernorJobPayload);
}

/** Register M8 analytics hourly rollup (FR-DB-05). */
export async function registerAnalyticsWorkers(
  boss: PgBoss,
  onHourly: AnalyticsRollupHandler,
): Promise<void> {
  await boss.createQueue(ANALYTICS_JOBS.HOURLY_ROLLUP);
  await boss.work<AnalyticsRollupJobPayload>(
    ANALYTICS_JOBS.HOURLY_ROLLUP,
    async ([job]) => {
      await onHourly(job.data);
    },
  );
  await boss.schedule(ANALYTICS_JOBS.HOURLY_ROLLUP, "5 * * * *", {
    trigger: "schedule",
    days: 14,
    requested_at: new Date().toISOString(),
  } satisfies AnalyticsRollupJobPayload);
}

/** Register M13 ads READ sync — hourly. No write/mutation workers. */
export async function registerAdsReadWorkers(
  boss: PgBoss,
  onHourly: AdsReadSyncHandler,
): Promise<void> {
  await boss.createQueue(ADS_JOBS.HOURLY_SYNC);
  await boss.work<AdsReadSyncJobPayload>(ADS_JOBS.HOURLY_SYNC, async ([job]) => {
    await onHourly(job.data);
  });
  await boss.schedule(ADS_JOBS.HOURLY_SYNC, "10 * * * *", {
    trigger: "schedule",
    requested_at: new Date().toISOString(),
  } satisfies AdsReadSyncJobPayload);
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

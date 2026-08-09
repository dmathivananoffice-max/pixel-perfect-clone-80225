/**
 * Minimal queue port so tests and pg-boss worker share the same contract.
 */
export type JobEnqueue = {
  name: string;
  payload: unknown;
  options?: { singletonKey?: string };
};

export interface JobQueue {
  send(job: JobEnqueue): Promise<string | null>;
}

/** In-memory queue for unit tests. */
export class MemoryJobQueue implements JobQueue {
  jobs: JobEnqueue[] = [];
  async send(job: JobEnqueue): Promise<string | null> {
    this.jobs.push(job);
    return `mem_${this.jobs.length}`;
  }
}

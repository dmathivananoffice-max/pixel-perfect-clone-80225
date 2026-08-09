import type {
  GovernorConfig,
  IntakeRecord,
  PathwayCapacityState,
  UrgencyCopyTemplate,
} from "./types";

export type CapacityStore = {
  listIntakes(): Promise<IntakeRecord[]>;
  upsertIntake(
    input: Omit<IntakeRecord, "id" | "created_at" | "updated_at" | "synced_at"> & {
      id?: string;
      synced_at?: string | null;
    },
  ): Promise<IntakeRecord>;
  getIntake(id: string): Promise<IntakeRecord | null>;
  listPathwayStates(): Promise<PathwayCapacityState[]>;
  getPathwayState(pathway: string): Promise<PathwayCapacityState | null>;
  savePathwayStates(states: PathwayCapacityState[]): Promise<void>;
  getConfig(): Promise<GovernorConfig>;
  saveUrgencyTemplate(
    input: Omit<UrgencyCopyTemplate, "id" | "updated_at"> & { id?: string },
  ): Promise<UrgencyCopyTemplate>;
};

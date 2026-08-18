import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CHANNEL = "intake-migration";
const EVENT = "migration_pending";
const FLUSH_MS = 10 * 60_000;

export interface MigrationFlushState {
  active: boolean;
  readOnly: boolean;
  resumeAt: Date | null;
  remainingMs: number;
}

function remaining(resumeAt: Date | null): number {
  if (!resumeAt) return 0;
  return Math.max(0, resumeAt.getTime() - Date.now());
}

/**
 * Listens for `migration_pending` realtime broadcasts (and the
 * system_notices backing row) so every open verification session can
 * autosave, count down 10 minutes, then go read-only.
 */
export function useMigrationFlush(opts: {
  enabled: boolean;
  onSave: () => Promise<void> | void;
}): MigrationFlushState {
  const { enabled, onSave } = opts;
  const [resumeAt, setResumeAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const savedRef = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const activate = useCallback((iso: string) => {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return;
    setResumeAt(at);
    if (!savedRef.current) {
      savedRef.current = true;
      void Promise.resolve(onSaveRef.current()).catch((err) => {
        console.warn("[intake] migration flush save failed", err);
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("system_notices")
        .select("payload, expires_at, created_at")
        .eq("kind", "migration_pending")
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const row = data?.[0];
      if (!row) return;
      const payload = (row.payload ?? {}) as { resumeAt?: string };
      const resume = payload.resumeAt ?? row.expires_at;
      if (resume && new Date(resume).getTime() > Date.now() - 60_000) {
        activate(resume);
      }
    })();

    const channel = supabase
      .channel(CHANNEL)
      .on("broadcast", { event: EVENT }, (msg) => {
        const resume = (msg.payload as { resumeAt?: string } | undefined)?.resumeAt;
        if (resume) activate(resume);
      })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [enabled, activate]);

  useEffect(() => {
    if (!resumeAt) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [resumeAt]);

  const remainingMs = remaining(resumeAt);
  void tick;
  return {
    active: !!resumeAt,
    readOnly: !!resumeAt && remainingMs <= 0,
    resumeAt,
    remainingMs,
  };
}

export async function broadcastMigrationPending(opts?: {
  actorName?: string;
  durationMs?: number;
}): Promise<{ resumeAt: string }> {
  const durationMs = opts?.durationMs ?? FLUSH_MS;
  const resumeAt = new Date(Date.now() + durationMs).toISOString();
  await supabase.from("system_notices").insert({
    kind: "migration_pending",
    payload: { resumeAt },
    expires_at: resumeAt,
    created_by_name: opts?.actorName ?? "Admin",
  });
  const channel = supabase.channel(CHANNEL);
  await channel.subscribe();
  await channel.send({
    type: "broadcast",
    event: EVENT,
    payload: { resumeAt },
  });
  void supabase.removeChannel(channel);
  return { resumeAt };
}

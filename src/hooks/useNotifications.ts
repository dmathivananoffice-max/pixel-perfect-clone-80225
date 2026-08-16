import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { NotificationItem } from "@/types";

interface AuditRow {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor_name: string | null;
  new_value: unknown;
  created_at: string;
}

const READ_KEY = "wf:notifications-read";

function loadReadIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(ids).slice(-200)));
  } catch {
    /* non-fatal */
  }
}

const TYPE_MAP: Record<string, NotificationItem["type"]> = {
  candidate_status_changed: "candidate_update",
  candidate_created: "candidate_update",
  candidate_updated: "candidate_update",
  document_uploaded: "candidate_update",
  extraction_approved: "candidate_update",
  extraction_rejected: "candidate_update",
  interview_scheduled: "interview_scheduled",
  contract_sent: "contract_ready",
  contract_signed: "contract_ready",
  visa_update: "visa_update",
  candidate_placed: "placed",
};

function typeFor(eventType: string): NotificationItem["type"] {
  return TYPE_MAP[eventType] ?? "system";
}

function titleFor(eventType: string): string {
  return eventType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function messageFor(row: AuditRow): string {
  const nv = row.new_value as { status?: string; file_name?: string; email?: string } | null;
  const actor = row.actor_name ?? "System";
  if (nv?.file_name) return `${actor} uploaded ${nv.file_name}`;
  if (nv?.status) return `${actor} → ${nv.status}`;
  if (nv?.email) return `${actor} · ${nv.email}`;
  return `${actor} · ${row.entity_type}`;
}

/**
 * Real notifications, derived from the audit_events stream — every intake,
 * upload, verification and status change already writes there. Read state
 * is tracked locally per browser.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("audit_events")
        .select("id, entity_type, entity_id, event_type, actor_name, new_value, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled || !data) return;
      setNotifications(
        (data as AuditRow[]).map((row) => ({
          id: row.id,
          title: titleFor(row.event_type),
          message: messageFor(row),
          type: typeFor(row.event_type),
          read: loadReadIds().has(row.id),
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          created_at: row.created_at,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markAsRead = (id: string) => {
    const next = new Set(readIds).add(id);
    setReadIds(next);
    saveReadIds(next);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllAsRead = () => {
    const next = new Set(readIds);
    notifications.forEach((n) => next.add(n.id));
    setReadIds(next);
    saveReadIds(next);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}

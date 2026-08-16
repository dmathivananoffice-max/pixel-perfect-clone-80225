import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EntityCounts {
  employers: number;
  agencies: number;
  contracts: number;
  loading: boolean;
  error: string | null;
}

/**
 * Real record counts for executive KPI widgets.
 * Head-only count queries — no rows are transferred.
 */
export function useEntityCounts(): EntityCounts {
  const [state, setState] = useState<EntityCounts>({
    employers: 0,
    agencies: 0,
    contracts: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [eRes, aRes, cRes] = await Promise.all([
        supabase.from("employers").select("id", { count: "exact", head: true }),
        supabase.from("agencies").select("id", { count: "exact", head: true }),
        supabase.from("contracts").select("id", { count: "exact", head: true }),
      ]);
      if (cancelled) return;
      const err = eRes.error ?? aRes.error ?? cRes.error;
      setState({
        employers: eRes.count ?? 0,
        agencies: aRes.count ?? 0,
        contracts: cRes.count ?? 0,
        loading: false,
        error: err?.message ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

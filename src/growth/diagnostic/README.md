# M1 — Pathway Diagnostic

Source of truth for requirements: [SRD.md](../../../SRD.md) §5 (FR-D-01…11).

## Layout

| Path | Role |
|---|---|
| `engine.ts` / `loadRules.ts` | Deterministic eligibility engine (Part A) |
| `rules/*.json` | Versioned rules JSON (seeded into `growth.config`) |
| `branches/*.json` | Tap-select question configs (Part B) |
| `catalog.ts` | In-app branch/rules catalogue |
| `../../components/diagnostic/*` | Plain React + CSS UI (Part C) |
| `../../../supabase/functions/diagnostic-session` | Session + funnel events (Part D) |

## Verify

```bash
bun test tests/growth/m1-*.test.ts
bun scripts/seed_diagnostic_config.ts
bun scripts/simulate_diag_funnel_events.ts
# UI: http://localhost:5173/diagnostic?b=nursing-ausbildung
```

Route JS chunk (build): `diagnostic-*.js` ≈ **8 KB gzip** (budget 150 KB).

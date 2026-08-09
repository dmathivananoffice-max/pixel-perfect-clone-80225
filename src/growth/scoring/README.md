# M3 — Lead scoring

SRD FR-S-01 … FR-S-06.

| Piece | Path |
|---|---|
| Engine | `engine.ts`, `subScores.ts` |
| AI delta (±15, DQ-safe) | `applyAiDelta.ts` |
| Override validation | `override.ts` |
| Service + transitions | `service.ts`, `jobs.ts` |
| STARTING config | `config/scoring-weights.v1.json`, `config/scoring-bands.v1.json` |
| pg-boss worker | `../jobs/worker.ts` |

```bash
bun test tests/growth/m3-scoring-*.test.ts
bun scripts/seed_scoring_config.ts
bun scripts/verify_m3_strong_weak.ts
```

/** Addendum B § M6 — eight named parity checks. */
export const M6_CHECK_IDS = [
  "m6_1_schema_version_populated",
  "m6_2_existing_cohort_v1",
  "m6_3_new_row_default_v2",
  "m6_4_legacy_required_set_frozen",
  "m6_5_readiness_pct_unchanged",
  "m6_6_snapshot_coverage",
  "m6_7_human_values_intact",
  "m6_8_identity_fields_stable",
] as const;

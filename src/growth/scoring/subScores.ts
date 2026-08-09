import type { ScoreSignals, SubScoreBreakdown } from "./types";

export function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreFit(
  branch: string,
  answers: Record<string, string>,
): SubScoreBreakdown {
  const rules: string[] = [];
  let value = 40;
  const q = answers.qualification;

  if (branch === "nursing-professional") {
    if (q === "bsc_nursing" || q === "msc_nursing") {
      value = 92;
      rules.push("fit.prof_degree");
    } else if (q === "gnm") {
      value = 70;
      rules.push("fit.prof_gnm");
    } else if (q === "ani") {
      value = 55;
      rules.push("fit.prof_ani");
    } else {
      value = 15;
      rules.push("fit.prof_unqualified");
    }
    if (answers.registration_status === "active") {
      value += 5;
      rules.push("fit.registration_active");
    }
  } else {
    if (q === "class_12" || q === "diploma") {
      value = 85;
      rules.push("fit.aus_class12");
    } else if (q === "degree_other") {
      value = 70;
      rules.push("fit.aus_other_degree");
    } else {
      value = 20;
      rules.push("fit.aus_class10");
    }
    if (answers.science_background === "yes") {
      value += 8;
      rules.push("fit.science_yes");
    } else if (answers.science_background === "no") {
      value -= 15;
      rules.push("fit.science_no");
    }
    if (answers.age_band === "17_21" || answers.age_band === "22_25") {
      value += 5;
      rules.push("fit.age_typical");
    } else if (answers.age_band === "30_plus") {
      value -= 25;
      rules.push("fit.age_30_plus");
    }
  }
  return { value: clamp100(value), rules_fired: rules };
}

export function scoreIntent(answers: Record<string, string>): SubScoreBreakdown {
  const rules: string[] = [];
  let value = 50;
  const t = answers.timeline_preference;
  if (t === "within_12_months") {
    value = 90;
    rules.push("intent.timeline_12m");
  } else if (t === "12_24_months") {
    value = 70;
    rules.push("intent.timeline_24m");
  } else if (t === "unsure") {
    value = 35;
    rules.push("intent.timeline_unsure");
  }
  if (answers.parent_support === "yes") {
    value += 5;
    rules.push("intent.parent_yes");
  } else if (answers.parent_support === "no") {
    value -= 20;
    rules.push("intent.parent_no");
  }
  return { value: clamp100(value), rules_fired: rules };
}

export function scoreCapability(
  answers: Record<string, string>,
): SubScoreBreakdown {
  const rules: string[] = [];
  let value = 40;
  const germanMap: Record<string, number> = {
    B2: 95,
    B1: 85,
    A2: 60,
    A1: 35,
    A0: 15,
  };
  const g = answers.german_level;
  if (g && germanMap[g] != null) {
    value = germanMap[g];
    rules.push(`capability.german_${g}`);
  }
  const exp = answers.experience_years;
  if (exp === "5_plus" || exp === "3_5") {
    value += 8;
    rules.push("capability.exp_strong");
  } else if (exp === "0_1") {
    value -= 10;
    rules.push("capability.exp_low");
  }
  return { value: clamp100(value), rules_fired: rules };
}

export function scoreTiming(answers: Record<string, string>): SubScoreBreakdown {
  const rules: string[] = [];
  let value = 50;
  const f = answers.financial_readiness;
  if (f === "funded") {
    value = 90;
    rules.push("timing.funded");
  } else if (f === "partial") {
    value = 60;
    rules.push("timing.partial");
  } else if (f === "not_ready") {
    value = 20;
    rules.push("timing.not_ready");
  }
  if (answers.timeline_preference === "within_12_months" && f === "funded") {
    value += 5;
    rules.push("timing.aligned");
  }
  return { value: clamp100(value), rules_fired: rules };
}

export function scoreEngagement(signals: ScoreSignals): SubScoreBreakdown {
  const rules: string[] = [];
  let value = 20;
  if (signals.diagnostic_completed) {
    value += 35;
    rules.push("engagement.diag_complete");
  }
  if (signals.contact_captured) {
    value += 25;
    rules.push("engagement.contact");
  }
  const msgs = signals.message_count ?? 0;
  if (msgs > 0) {
    value += Math.min(20, msgs * 5);
    rules.push("engagement.messages");
  }
  if (signals.booking) {
    value += 20;
    rules.push("engagement.booking");
  }
  return { value: clamp100(value), rules_fired: rules };
}

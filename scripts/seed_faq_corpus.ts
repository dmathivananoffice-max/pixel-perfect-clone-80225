/**
 * Seed launch FAQ corpus structure (FAQ_ANSWER assets).
 * Inserts as DRAFT so they must pass compliance before WhatsApp retrieval.
 *
 * bun scripts/seed_faq_corpus.ts
 */
import { spawnSync } from "node:child_process";

const faqs = [
  {
    title: "FAQ — Visa approval is never guaranteed",
    patterns: ["will i get a visa", "visa guaranteed", "visa approval chance"],
    answer:
      "No one can guarantee a visa outcome. We help you prepare a complete file and explain typical steps, but the decision rests with the authorities.",
  },
  {
    title: "FAQ — Recognition process overview",
    patterns: ["what is recognition", "anerkennung", "how recognition works"],
    answer:
      "Recognition (Anerkennung) is assessed case-by-case. Requirements depend on your qualification and pathway; outcomes are not guaranteed.",
  },
  {
    title: "FAQ — Realistic timelines",
    patterns: ["how long does it take", "timeline", "when can i move"],
    answer:
      "Timelines vary by pathway, language level, and document readiness. We share realistic ranges, not promises of a fixed start date.",
  },
  {
    title: "FAQ — Costs and funding",
    patterns: ["how much does it cost", "fees", "blocked account"],
    answer:
      "Costs usually include language training, document attestation, and living funds (for example a blocked account where required). We outline categories; exact amounts depend on your plan.",
  },
];

function lit(v: string) {
  return `'${v.replace(/'/g, "''")}'`;
}

function arr(patterns: string[]) {
  return `ARRAY[${patterns.map((p) => lit(p)).join(", ")}]::text[]`;
}

for (const faq of faqs) {
  const body = {
    question_patterns: faq.patterns,
    answer_text: faq.answer,
  };
  const sql = `
    INSERT INTO growth.asset (
      type, title, version, status, claim_bearing, body_ref, body,
      question_patterns, answer_text, claim_checklist
    ) VALUES (
      'FAQ_ANSWER',
      ${lit(faq.title)},
      1,
      'DRAFT',
      true,
      'asset:faq_answer',
      ${lit(JSON.stringify(body))}::jsonb,
      ${arr(faq.patterns)},
      ${lit(faq.answer)},
      '{}'::jsonb
    );
  `;
  const r = spawnSync(
    "sudo",
    ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", "growth_phase1_verify", "-c", sql],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
  console.log("seeded FAQ DRAFT:", faq.title);
}

console.log("OK: FAQ corpus structure seeded (DRAFT — approve via /compliance before send)");

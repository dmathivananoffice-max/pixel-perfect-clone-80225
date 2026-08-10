import type { AssetRecord } from "@/growth/assets/types";

function summarize(asset: AssetRecord | null | undefined): string {
  if (!asset) return "(no prior version)";
  const faq =
    asset.type === "FAQ_ANSWER"
      ? `\npatterns: ${(asset.question_patterns ?? []).join(" | ")}\nanswer: ${asset.answer_text ?? ""}`
      : "";
  return `v${asset.version} ${asset.title}\nstatus=${asset.status}\n${JSON.stringify(asset.body, null, 2)}${faq}`;
}

type Props = { current: AssetRecord; prior: AssetRecord | null };

export function AssetDiff({ current, prior }: Props) {
  return (
    <div>
      <h3>Diff vs prior version</h3>
      <div className="comp__diff">
        <div>--- prior ---</div>
        <div>{summarize(prior)}</div>
        <div>{"\n"}+++ current +++</div>
        <div>{summarize(current)}</div>
      </div>
    </div>
  );
}

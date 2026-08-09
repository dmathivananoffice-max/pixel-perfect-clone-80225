import { CLAIM_KEYS, type ClaimChecklist, type ClaimKey, type ClaimMark } from "@/growth/assets/types";
import { emptyClaimChecklist } from "@/growth/assets/claims";

type Props = {
  value?: Partial<ClaimChecklist>;
  onChange: (next: ClaimChecklist) => void;
};

export function ClaimChecklistEditor({ value, onChange }: Props) {
  const checklist: ClaimChecklist = {
    ...emptyClaimChecklist(),
    ...(value as ClaimChecklist),
  };

  function setMark(key: ClaimKey, mark: ClaimMark) {
    onChange({ ...checklist, [key]: mark });
  }

  return (
    <div className="comp__claim">
      {CLAIM_KEYS.map((key) => {
        const mark = checklist[key];
        return (
          <div className="comp__claim-row" key={key}>
            <strong>{key}</strong>
            <div>
              <select
                value={mark.status}
                onChange={(e) =>
                  setMark(key, {
                    status: e.target.value as ClaimMark["status"],
                    note: mark.note,
                  })
                }
              >
                <option value="absent">absent</option>
                <option value="present_justified">present + justified</option>
              </select>
              {mark.status === "present_justified" ? (
                <div className="comp__field" style={{ marginTop: "0.35rem" }}>
                  <textarea
                    placeholder="Justification required"
                    value={mark.note ?? ""}
                    onChange={(e) =>
                      setMark(key, {
                        status: "present_justified",
                        note: e.target.value,
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

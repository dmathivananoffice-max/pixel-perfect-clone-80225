export type {
  CaptureLeadRequest,
  CaptureLeadResult,
  ClickIds,
  ConsentInput,
  EraseLeadRequest,
  EraseLeadResult,
  LeadRow,
  StoredConsent,
  UtmObject,
} from "./types.ts";

export { normalizePhoneE164 } from "./phone.ts";
export { validateConsent } from "./consent.ts";
export { captureLead } from "./capture.ts";
export { eraseLead } from "./erase.ts";

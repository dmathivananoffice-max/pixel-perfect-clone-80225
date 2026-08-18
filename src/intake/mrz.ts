// ─────────────────────────────────────────────────────────────
// TD3 machine-readable-zone parser. Checksum-verified, therefore the
// highest-confidence source of identity data on a passport.
// ─────────────────────────────────────────────────────────────

export interface MrzField {
  value: string;
  confidence: number;
  flags: string[];
}

export interface MrzResult {
  present: boolean;
  line1: string;
  line2: string;
  checksumValid: boolean;
  fields: Partial<Record<
    | "personal.first_name"
    | "personal.last_name"
    | "personal.dob"
    | "personal.gender"
    | "personal.nationality"
    | "passport.passport_no"
    | "passport.expiry_date",
    MrzField
  >>;
}

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function mrzCharValue(c: string): number {
  if (c === "<") return 0;
  const i = CHARSET.indexOf(c.toUpperCase());
  return i < 0 ? 0 : i;
}

export function mrzCheckDigit(input: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i++) sum += mrzCharValue(input[i]) * weights[i % 3];
  return sum % 10;
}

/** YYMMDD → ISO. `future` biases the century for expiry dates. */
export function mrzDateToIso(yymmdd: string, future: boolean): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  const currentYY = new Date().getFullYear() % 100;
  let year: number;
  if (future) year = yy < currentYY - 5 ? 2100 + yy : 2000 + yy;
  else year = yy > currentYY + 5 ? 1900 + yy : 2000 + yy;
  return `${year}-${mm}-${dd}`;
}

function titleCaseMrzName(raw: string): string {
  return raw
    .replace(/</g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Find and parse a TD3 MRZ anywhere in an OCR text blob. */
export function parseMrz(ocrText: string): MrzResult | null {
  const lines = ocrText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, "").toUpperCase())
    .filter((l) => l.length >= 40 && /^[A-Z0-9<]+$/.test(l));

  for (let i = 0; i < lines.length - 1; i++) {
    const l1 = lines[i].padEnd(44, "<").slice(0, 44);
    const l2 = lines[i + 1].padEnd(44, "<").slice(0, 44);
    if (!/^P[A-Z<]/.test(l1)) continue;
    return parseTd3(l1, l2);
  }
  return null;
}

export function parseTd3(line1: string, line2: string): MrzResult {
  const fields: MrzResult["fields"] = {};
  const flags: string[] = [];

  // Names
  const namePart = line1.slice(5);
  const [surnameRaw, givenRaw = ""] = namePart.split("<<");
  const surname = titleCaseMrzName(surnameRaw ?? "");
  const given = titleCaseMrzName(givenRaw);

  const docNo = line2.slice(0, 9);
  const docCheck = Number(line2[9]);
  const nationality = line2.slice(10, 13);
  const dobRaw = line2.slice(13, 19);
  const dobCheck = Number(line2[19]);
  const sex = line2[20];
  const expRaw = line2.slice(21, 27);
  const expCheck = Number(line2[27]);

  const docOk = mrzCheckDigit(docNo) === docCheck;
  const dobOk = mrzCheckDigit(dobRaw) === dobCheck;
  const expOk = mrzCheckDigit(expRaw) === expCheck;
  const allOk = docOk && dobOk && expOk;
  if (!docOk) flags.push("mrz_checksum_failed:passport_no");
  if (!dobOk) flags.push("mrz_checksum_failed:dob");
  if (!expOk) flags.push("mrz_checksum_failed:expiry_date");

  const conf = (ok: boolean) => (ok ? 0.99 : 0.5);
  const flagsFor = (ok: boolean) => (ok ? [] : ["mrz_checksum_failed"]);

  if (surname) fields["personal.last_name"] = { value: surname, confidence: 0.99, flags: [] };
  if (given) fields["personal.first_name"] = { value: given, confidence: 0.99, flags: [] };
  if (/^[A-Z<]{3}$/.test(nationality) && nationality !== "<<<")
    fields["personal.nationality"] = { value: nationality.replace(/</g, ""), confidence: 0.95, flags: [] };
  const dobIso = mrzDateToIso(dobRaw, false);
  if (dobIso)
    fields["personal.dob"] = { value: dobIso, confidence: conf(dobOk), flags: flagsFor(dobOk) };
  if (sex === "M" || sex === "F" || sex === "X" || sex === "<")
    fields["personal.gender"] = { value: sex, confidence: 0.97, flags: [] };
  const docClean = docNo.replace(/</g, "");
  if (docClean)
    fields["passport.passport_no"] = { value: docClean, confidence: conf(docOk), flags: flagsFor(docOk) };
  const expIso = mrzDateToIso(expRaw, true);
  if (expIso)
    fields["passport.expiry_date"] = { value: expIso, confidence: conf(expOk), flags: flagsFor(expOk) };

  return { present: true, line1, line2, checksumValid: allOk, fields };
}

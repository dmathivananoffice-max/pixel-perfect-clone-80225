// ─────────────────────────────────────────────────────────────
// Normalisers. Each returns { value, confidenceDelta, flags } and
// NEVER discards the original — callers keep it in raw_value (R3).
// ─────────────────────────────────────────────────────────────
import { allCountries } from "@/lib/countries";
import type { NormaliserName } from "./fieldDictionary";

export interface NormaliseResult {
  value: string;
  confidenceDelta: number;
  flags: string[];
  note?: string;
}

const ok = (value: string, flags: string[] = [], confidenceDelta = 0, note?: string): NormaliseResult => ({
  value,
  confidenceDelta,
  flags,
  note,
});

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  mär: "03", mrz: "03", mai: "05", okt: "10", dez: "12",
};

function pad(n: string | number): string {
  return String(n).padStart(2, "0");
}

function fullYear(y: string): string {
  if (y.length === 4) return y;
  const yy = Number(y);
  const cur = new Date().getFullYear() % 100;
  return String(yy > cur + 5 ? 1900 + yy : 2000 + yy);
}

export function normaliseDate(raw: string): NormaliseResult {
  const s = raw.trim();
  if (!s) return ok("");

  // ISO
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return ok(`${m[1]}-${pad(m[2])}-${pad(m[3])}`);

  // Textual month: 12 MAR 1998 / 12-MAR-98 / 12. März 1998
  m = s.match(/^(\d{1,2})[\s.\-]*([A-Za-zÄÖÜäöü]{3,})[\s.\-]*(\d{2,4})$/);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon) return ok(`${fullYear(m[3])}-${mon}-${pad(m[1])}`);
  }

  // Numeric d/m/y or m/d/y
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = fullYear(m[3]);
    if (a > 12 && b <= 12) return ok(`${y}-${pad(b)}-${pad(a)}`);
    if (b > 12 && a <= 12) return ok(`${y}-${pad(a)}-${pad(b)}`);
    if (a <= 12 && b <= 12) {
      // Ambiguous — keep the value, hand the decision to the human.
      return ok(
        `${y}-${pad(b)}-${pad(a)}`,
        ["ambiguous_date"],
        -0.3,
        `Could be ${y}-${pad(b)}-${pad(a)} (DD/MM) or ${y}-${pad(a)}-${pad(b)} (MM/DD)`,
      );
    }
  }

  // MRZ YYMMDD
  m = s.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (m) return ok(`${fullYear(m[1])}-${m[2]}-${m[3]}`);

  return ok(s, ["unparsed_date"], -0.3);
}

const HONORIFICS = /^(mr|mrs|ms|miss|dr|prof|sri|smt|shri|herr|frau)\.?\s+/i;
const LOWER_PARTICLES = new Set(["van", "der", "den", "de", "di", "da", "bin", "binti", "al"]);

export function normaliseName(raw: string): NormaliseResult {
  let s = raw.trim().replace(/\s+/g, " ");
  while (HONORIFICS.test(s)) s = s.replace(HONORIFICS, "");
  if (!s) return ok("");
  const isAllCaps = s === s.toUpperCase();
  if (!isAllCaps) return ok(s);
  const cased = s
    .split(" ")
    .map((word) => {
      const lw = word.toLowerCase();
      if (LOWER_PARTICLES.has(lw)) return lw;
      return lw
        .replace(/^(mc|o')(.)/, (_all, p, c) => p.replace(/^./, (x: string) => x.toUpperCase()) + c.toUpperCase())
        .replace(/^([a-zà-ÿ])/, (c) => c.toUpperCase())
        .replace(/-([a-zà-ÿ])/g, (_all, c) => "-" + c.toUpperCase());
    })
    .join(" ");
  return ok(cased);
}

export function normaliseGender(raw: string): NormaliseResult {
  const v = raw.trim().toUpperCase();
  if (!v) return ok("");
  if (v === "M" || v === "MALE" || v === "MANN" || v === "MÄNNLICH") return ok("Male");
  if (v === "F" || v === "FEMALE" || v === "W" || v === "WEIBLICH") return ok("Female");
  if (v === "X" || v === "<" || v === "O" || v === "OTHER" || v === "DIVERS") return ok("Other");
  return ok(raw.trim(), ["unknown_gender"], -0.2);
}

const ISO3: Record<string, string> = {
  IND: "India", NPL: "Nepal", LKA: "Sri Lanka", PHL: "Philippines", BGD: "Bangladesh",
  BRA: "Brazil", EGY: "Egypt", CHN: "China", POL: "Poland", MAR: "Morocco",
  VNM: "Vietnam", IRL: "Ireland", DEU: "Germany", GER: "Germany", ARE: "United Arab Emirates",
  PAK: "Pakistan", USA: "United States", GBR: "United Kingdom", TUR: "Turkey", KEN: "Kenya",
  NGA: "Nigeria", GHA: "Ghana", IDN: "Indonesia", THA: "Thailand", MEX: "Mexico",
};

const DEMONYM: Record<string, string> = {
  India: "Indian", Nepal: "Nepali", "Sri Lanka": "Sri Lankan", Philippines: "Filipino",
  Bangladesh: "Bangladeshi", Brazil: "Brazilian", Egypt: "Egyptian", China: "Chinese",
  Poland: "Polish", Morocco: "Moroccan", Vietnam: "Vietnamese", Ireland: "Irish",
  Germany: "German", "United Arab Emirates": "Emirati", Pakistan: "Pakistani",
  "United States": "American", "United Kingdom": "British", Turkey: "Turkish",
  Kenya: "Kenyan", Nigeria: "Nigerian", Ghana: "Ghanaian", Indonesia: "Indonesian",
  Thailand: "Thai", Mexico: "Mexican",
};

/** Resolve alpha-2 / alpha-3 / name / demonym to a canonical country name. */
export function resolveCountryName(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const upper = s.toUpperCase();
  if (ISO3[upper]) return ISO3[upper];
  const list = allCountries();
  const byCode = list.find((c) => c.code === upper);
  if (byCode) return byCode.name;
  const byName = list.find((c) => c.name.toLowerCase() === s.toLowerCase());
  if (byName) return byName.name;
  const byDemonym = Object.entries(DEMONYM).find(([, d]) => d.toLowerCase() === s.toLowerCase());
  if (byDemonym) return byDemonym[0];
  return null;
}

export function normaliseCountry(raw: string, asDemonym = false): NormaliseResult {
  const name = resolveCountryName(raw);
  if (!name) return ok(raw.trim(), ["unknown_country"], -0.2);
  if (asDemonym) return ok(DEMONYM[name] ?? name);
  return ok(name);
}

export function normaliseCefr(raw: string): NormaliseResult {
  const all = Array.from(raw.toUpperCase().matchAll(/\b([ABC][12])(?:\.\d)?\b/g)).map((m) => m[1]);
  if (all.length === 0) return ok(raw.trim(), ["no_cefr_level"], -0.3);
  const order = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const highest = all.sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
  const flags = new Set(all).size > 1 ? ["multiple_levels_found"] : [];
  const sub = /\b[ABC][12]\.\d\b/.test(raw.toUpperCase()) ? "sublevel_rounded" : null;
  return ok(highest, sub ? [...flags, sub] : flags);
}

export function normaliseProvider(raw: string): NormaliseResult {
  const s = raw.toLowerCase();
  if (s.includes("goethe")) return ok("Goethe");
  if (s.includes("telc")) return ok("TELC");
  if (s.includes("ösd") || s.includes("oesd") || /\bosd\b/.test(s)) return ok("ÖSD");
  if (s.includes("testdaf")) return ok("TestDaF");
  if (!raw.trim()) return ok("");
  return ok("Other", ["provider_unmatched"], 0, `Raw provider: ${raw.trim()}`);
}

export function normalisePassportNo(raw: string, mrzValue?: string): NormaliseResult {
  const clean = raw.replace(/\s+/g, "").toUpperCase();
  if (mrzValue && mrzValue !== clean) {
    return ok(mrzValue, ["passport_no_mrz_override"], 0, `Bio page read: ${clean}`);
  }
  return ok(clean);
}

export function normalisePhone(raw: string): NormaliseResult {
  const plus = raw.trim().startsWith("+");
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return ok("", ["unparsed_phone"], -0.2);
  return ok((plus ? "+" : "") + digits, plus ? [] : ["no_country_code"]);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(raw: string): NormaliseResult {
  const v = raw.trim().toLowerCase();
  if (v.endsWith("@intake.local")) return ok("", ["placeholder_email_rejected"], -1);
  if (!EMAIL_RE.test(v)) return ok(v, ["invalid_email"], -0.3);
  return ok(v);
}

export function normaliseYear(raw: string): NormaliseResult {
  const max = new Date().getFullYear() + 6;
  const years = Array.from(raw.matchAll(/\b(19[5-9]\d|20\d\d)\b/g)).map((m) => Number(m[1]));
  const valid = years.filter((y) => y >= 1950 && y <= max);
  if (valid.length === 0) return ok(raw.trim(), ["no_year_found"], -0.3);
  return ok(String(Math.max(...valid)));
}

export function normaliseYesNo(raw: string): NormaliseResult {
  const v = raw.trim().toLowerCase();
  if (!v) return ok("");
  if (/(^|\b)(yes|fit|medically fit|true|y)\b/.test(v)) return ok("Yes");
  if (/(^|\b)(no|unfit|false|n)\b/.test(v)) return ok("No");
  return ok(raw.trim(), ["unparsed_yes_no"], -0.2);
}

export function applyNormaliser(
  name: NormaliserName,
  raw: string,
  ctx?: { fieldKey?: string; mrzPassportNo?: string },
): NormaliseResult {
  switch (name) {
    case "date": return normaliseDate(raw);
    case "name": return normaliseName(raw);
    case "gender": return normaliseGender(raw);
    case "country": return normaliseCountry(raw, ctx?.fieldKey === "personal.nationality");
    case "cefr": return normaliseCefr(raw);
    case "provider": return normaliseProvider(raw);
    case "passport_no": return normalisePassportNo(raw, ctx?.mrzPassportNo);
    case "phone": return normalisePhone(raw);
    case "email": return normaliseEmail(raw);
    case "year": return normaliseYear(raw);
    case "yes_no": return normaliseYesNo(raw);
    case "text":
    default:
      return ok(raw.trim().replace(/\s+/g, " "));
  }
}

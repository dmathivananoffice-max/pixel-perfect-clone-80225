import { describe, expect, it } from "vitest";
import { mapDocument, resolveKey } from "../mapper";
import { mergeCandidateFields, readiness, validateMerged } from "../merge";
import { mrzCheckDigit, parseTd3 } from "../mrz";
import { normaliseCefr, normaliseDate, normaliseGender, normaliseName, normaliseProvider } from "../normalisers";
import { classifyDocument, canonicalDocType } from "../documentTypes";
import { FIELD_DICTIONARY } from "../fieldDictionary";

describe("alias resolution", () => {
  it("maps camelCase and snake_case to the same canonical key", () => {
    expect(resolveKey("givenNames", "passport").key).toBe("personal.first_name");
    expect(resolveKey("given_names", "passport").key).toBe("personal.first_name");
    expect(resolveKey("Date Of Birth", "passport").key).toBe("personal.dob");
    expect(resolveKey("surname", "passport").key).toBe("personal.last_name");
  });

  it("refuses to let a degree certificate write passport fields", () => {
    expect(resolveKey("passport_number", "degree").key).toBeNull();
  });

  it("disambiguates internship vs social by document type", () => {
    expect(resolveKey("org", "internship_cert").key).toBe("internship.org");
    expect(resolveKey("org", "social_cert").key).toBe("social.org");
  });

  it("routes country by document type", () => {
    expect(resolveKey("country", "driving_licence").key).toBe("driving.country");
    expect(resolveKey("country", "cv").key).toBe("contact.country");
  });
});

describe("normalisers", () => {
  it("parses many date formats", () => {
    expect(normaliseDate("12 MAR 1998").value).toBe("1998-03-12");
    expect(normaliseDate("25/12/1998").value).toBe("1998-12-25");
    expect(normaliseDate("1998-03-12").value).toBe("1998-03-12");
  });
  it("flags ambiguous dates instead of guessing", () => {
    const r = normaliseDate("03/04/1998");
    expect(r.flags).toContain("ambiguous_date");
    expect(r.value).toBeTruthy();
  });
  it("title-cases MRZ-style names", () => {
    expect(normaliseName("REDDY").value).toBe("Reddy");
    expect(normaliseName("Dr. Anna Marie").value).toBe("Anna Marie");
  });
  it("maps gender codes", () => {
    expect(normaliseGender("F").value).toBe("Female");
    expect(normaliseGender("").value).toBe("");
  });
  it("takes the highest CEFR level and flags it", () => {
    const r = normaliseCefr("Ergebnis B1 und B2");
    expect(r.value).toBe("B2");
    expect(r.flags).toContain("multiple_levels_found");
  });
  it("normalises providers", () => {
    expect(normaliseProvider("Goethe-Institut").value).toBe("Goethe");
    expect(normaliseProvider("telc GmbH").value).toBe("TELC");
  });
});

function td3(): { l1: string; l2: string } {
  const l1 = "P<INDREDDY<<ANNA<MARIE".padEnd(44, "<");
  const doc = "Z12345678";
  const dob = "980312";
  const exp = "300312";
  const l2 =
    doc +
    mrzCheckDigit(doc) +
    "IND" +
    dob +
    mrzCheckDigit(dob) +
    "F" +
    exp +
    mrzCheckDigit(exp);
  return { l1, l2: l2.padEnd(44, "<") };
}

describe("MRZ", () => {
  it("parses a valid TD3 zone with 0.99 confidence", () => {
    const { l1, l2 } = td3();
    const r = parseTd3(l1, l2);
    expect(r.checksumValid).toBe(true);
    expect(r.fields["personal.last_name"]?.value).toBe("Reddy");
    expect(r.fields["personal.first_name"]?.value).toBe("Anna Marie");
    expect(r.fields["personal.dob"]?.value).toBe("1998-03-12");
    expect(r.fields["passport.passport_no"]?.confidence).toBe(0.99);
  });

  it("flags a broken checksum instead of dropping the value", () => {
    const { l1, l2 } = td3();
    const broken = l2.slice(0, 9) + "0" + l2.slice(10);
    const r = parseTd3(l1, broken);
    expect(r.checksumValid).toBe(false);
    expect(r.fields["passport.passport_no"]?.value).toBeTruthy();
  });
});

describe("mapDocument", () => {
  const ocrText = (() => {
    const { l1, l2 } = td3();
    return `REPUBLIC OF INDIA\nPASSPORT\n${l1}\n${l2}`;
  })();

  it("fills all seven identity fields from a passport", () => {
    const res = mapDocument({
      documentId: "d1",
      docType: "passport",
      ocrText,
      fields: [
        { name: "surname", value: "REDDY", confidence: 0.94 },
        { name: "given_names", value: "ANNA MARIE", confidence: 0.93 },
        { name: "date_of_expiry", value: "12/03/2030", confidence: 0.9 },
      ],
    });
    const keys = new Set(res.mapped.map((m) => m.key));
    for (const k of [
      "personal.first_name",
      "personal.last_name",
      "personal.dob",
      "personal.gender",
      "personal.nationality",
      "passport.passport_no",
      "passport.expiry_date",
    ]) {
      expect(keys.has(k)).toBe(true);
    }
    expect(res.mrzPresent).toBe(true);
  });

  it("never discards an unmappable value", () => {
    const res = mapDocument({
      documentId: "d1",
      docType: "passport",
      fields: [{ name: "father_name", value: "RAMESH", confidence: 0.8 }],
    });
    expect(res.mapped).toHaveLength(0);
    expect(res.unmapped[0]).toMatchObject({ name: "father_name", value: "RAMESH" });
  });
});

describe("merge", () => {
  const base = {
    section: "personal",
    fieldKey: "last_name",
    key: "personal.last_name",
    rawValue: "x",
    flags: [] as string[],
    status: "ai_high" as const,
    source: "model" as const,
  };

  it("passport beats CV and records the conflict", () => {
    const merged = mergeCandidateFields([
      { ...base, value: "Reddy", confidence: 0.95, documentId: "p", docType: "passport" },
      { ...base, value: "Reddi", confidence: 0.92, documentId: "c", docType: "cv" },
    ]);
    expect(merged[0].value).toBe("Reddy");
    expect(merged[0].status).toBe("conflict");
    expect(merged[0].competing[0].value).toBe("Reddi");
  });

  it("a human edit is never overwritten by re-extraction", () => {
    const merged = mergeCandidateFields(
      [{ ...base, value: "Reddy", confidence: 0.99, documentId: "p", docType: "passport" }],
      [{ key: "personal.last_name", value: "Reddi-Kumar", status: "human_edited" }],
    );
    expect(merged[0].value).toBe("Reddi-Kumar");
    expect(merged[0].status).toBe("human_edited");
  });

  it("readiness and validation share one field set", () => {
    const merged = mergeCandidateFields([
      { ...base, value: "Reddy", confidence: 0.95, documentId: "p", docType: "passport" },
    ]);
    const r = readiness(merged);
    expect(r.requiredSatisfied).toBe(1);
    expect(r.missingRequired.length).toBeGreaterThan(0);
    expect(validateMerged(merged)).toBeInstanceOf(Array);
  });
});

describe("document registry", () => {
  it("classifies a German passport filename", () => {
    expect(classifyDocument({ fileName: "ANNA Reisepass.pdf" }).type).toBe("passport");
  });
  it("maps PCR to police, never to a new type", () => {
    expect(canonicalDocType("pcr")).toBe("police");
  });
  it("every dictionary field lists at least one source document", () => {
    for (const d of FIELD_DICTIONARY) expect(d.sourceDocs.length).toBeGreaterThan(0);
  });
});

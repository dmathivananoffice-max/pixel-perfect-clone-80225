import glossaryJson from "./config/glossary.v1.json";

export type GlossaryEntry = { label: string; plain: string };

const defs = glossaryJson.definitions as Record<string, GlossaryEntry>;

export function getGlossary(key: string): GlossaryEntry {
  return (
    defs[key] ?? {
      label: key,
      plain: "No definition yet — ask an admin to add this to the glossary.",
    }
  );
}

export function allGlossaryKeys(): string[] {
  return Object.keys(defs);
}

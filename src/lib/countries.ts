// Country name → ISO-2 code + flag emoji. Extend as new candidate countries appear.
export interface CountryInfo {
  code: string;
  flag: string;
  name: string;
}

const COUNTRIES: Record<string, CountryInfo> = {
  India: { code: "IN", flag: "🇮🇳", name: "India" },
  Nepal: { code: "NP", flag: "🇳🇵", name: "Nepal" },
  "Sri Lanka": { code: "LK", flag: "🇱🇰", name: "Sri Lanka" },
  Philippines: { code: "PH", flag: "🇵🇭", name: "Philippines" },
  Bangladesh: { code: "BD", flag: "🇧🇩", name: "Bangladesh" },
  Brazil: { code: "BR", flag: "🇧🇷", name: "Brazil" },
  Egypt: { code: "EG", flag: "🇪🇬", name: "Egypt" },
  China: { code: "CN", flag: "🇨🇳", name: "China" },
  Poland: { code: "PL", flag: "🇵🇱", name: "Poland" },
  Morocco: { code: "MA", flag: "🇲🇦", name: "Morocco" },
  Vietnam: { code: "VN", flag: "🇻🇳", name: "Vietnam" },
  Ireland: { code: "IE", flag: "🇮🇪", name: "Ireland" },
  Iran: { code: "IR", flag: "🇮🇷", name: "Iran" },
  Mexico: { code: "MX", flag: "🇲🇽", name: "Mexico" },
  Ghana: { code: "GH", flag: "🇬🇭", name: "Ghana" },
  Germany: { code: "DE", flag: "🇩🇪", name: "Germany" },
  Pakistan: { code: "PK", flag: "🇵🇰", name: "Pakistan" },
  Kenya: { code: "KE", flag: "🇰🇪", name: "Kenya" },
  Nigeria: { code: "NG", flag: "🇳🇬", name: "Nigeria" },
  Indonesia: { code: "ID", flag: "🇮🇩", name: "Indonesia" },
  Turkey: { code: "TR", flag: "🇹🇷", name: "Turkey" },
};

export const COUNTRY_GROUPS: Record<string, string[]> = {
  "South Asia": ["India", "Nepal", "Sri Lanka", "Bangladesh", "Pakistan"],
  "Southeast Asia": ["Philippines", "Vietnam", "Indonesia"],
  "East Asia": ["China"],
  "Middle East": ["Iran", "Turkey"],
  Africa: ["Egypt", "Morocco", "Ghana", "Kenya", "Nigeria"],
  Europe: ["Poland", "Ireland", "Germany"],
  Americas: ["Mexico", "Brazil"],
};

export function getCountry(name?: string): CountryInfo {
  if (!name) return { code: "", flag: "🌐", name: "Unknown" };
  return COUNTRIES[name] ?? { code: "", flag: "🌐", name };
}

export function allCountries(): CountryInfo[] {
  return Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));
}

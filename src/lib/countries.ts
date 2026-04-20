export const COUNTRIES = [
  "CZ", "SK", "HU", "DE", "AT", "NL", "RO", "SI", "IT", "GR", "ES",
] as const;

export type Country = typeof COUNTRIES[number];

export const COUNTRY_FLAGS: Record<string, string> = {
  CZ: "🇨🇿", SK: "🇸🇰", HU: "🇭🇺", DE: "🇩🇪", AT: "🇦🇹",
  NL: "🇳🇱", RO: "🇷🇴", SI: "🇸🇮", IT: "🇮🇹", GR: "🇬🇷", ES: "🇪🇸",
};

export const COUNTRY_NAMES: Record<string, string> = {
  CZ: "Česko", SK: "Slovensko", HU: "Magyarország", DE: "Deutschland",
  AT: "Österreich", NL: "Nederland", RO: "România", SI: "Slovenija",
  IT: "Italia", GR: "Ελλάδα", ES: "España",
};

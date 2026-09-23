// Coarse buckets shared by AIS vessel types ("Cargo", "Tug", …) and the
// schedule's VESSEL_TYPE ("CONTAINER SHIP (FULLY CELLULAR)", …), used for
// colour-coding and the traffic breakdown.
export const CATEGORIES = {
  container: "Container",
  tanker: "Tanker",
  cargo: "Cargo / bulk",
  roro: "Ro-Ro",
  passenger: "Passenger / cruise",
  service: "Tug / pilot / service",
  fishing: "Fishing",
  leisure: "Leisure",
  other: "Other",
};

export function vesselCategory(type) {
  const t = (type ?? "").toLowerCase();
  if (t.includes("tanker")) return "tanker";
  if (t.includes("container")) return "container";
  if (t.includes("ro-ro") || t.includes("roro")) return "roro";
  if (t.includes("cruise") || t.includes("passenger") || t.includes("high speed")) return "passenger";
  if (t.includes("bulk") || t.includes("cargo")) return "cargo";
  if (/tug|pilot|tender|dredg|search|rescue|law|port|work|supply|towing/.test(t)) return "service";
  if (t.includes("fishing")) return "fishing";
  if (/pleasure|sailing|yacht/.test(t)) return "leisure";
  return "other";
}

export const normalizeName = (name) => (name ?? "").trim().toUpperCase().replace(/\s+/g, " ");

// AIS timestamps may arrive as epoch ms, epoch seconds or date strings.
export function normalizeTimestamp(value) {
  if (value == null) return null;
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export const isUnderway = (vessel) => (vessel.speed ?? 0) >= 1;

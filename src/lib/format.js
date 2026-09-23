export function formatNumber(value, digits = 0, unit = "") {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(digits)}${unit}`;
}

export function formatTime(epochMs) {
  if (!epochMs) return "—";
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatDayTime(epochMs) {
  if (!epochMs) return "—";
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAge(epochMs, now = Date.now()) {
  if (!epochMs) return "unknown";
  const minutes = Math.round((now - epochMs) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

const KEEP_UPPER = new Set(["LOA", "LNG", "LPG", "AIS", "DWQ"]);

// Title-cases the schedule's ALL-CAPS text while leaving codes and
// acronyms (CCT, PS, 130M, LOA…) intact.
export function titleCase(text) {
  if (!text) return "";
  return text.replace(/[A-Za-z0-9]+/g, (word) => {
    const upper = word.toUpperCase();
    if (KEEP_UPPER.has(upper) || /\d/.test(word) || !/[aeiouy]/i.test(word)) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export function compassPoint(degrees) {
  if (degrees == null) return "—";
  return COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

// Great-circle distance in metres.
export function haversineMetres(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

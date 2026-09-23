// WMO weather codes used by Open-Meteo: https://open-meteo.com/en/docs
const LABELS = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm, hail",
  99: "Thunderstorm, hail",
};

const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
const SNOW_CODES = [71, 73, 75, 77, 85, 86];

export function describeWeatherCode(code) {
  return LABELS[code] ?? "Unknown";
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

// Open-Meteo conditions -> SceneView environment.weather autocast object.
export function toSceneWeather({ weatherCode, cloudCover, precipitation }) {
  const cloud = clamp01((cloudCover ?? 0) / 100);
  const precip = clamp01((precipitation ?? 0) / 4);
  if (weatherCode === 45 || weatherCode === 48) return { type: "foggy", fogStrength: 0.6 };
  if (SNOW_CODES.includes(weatherCode)) {
    return { type: "snowy", cloudCover: cloud, precipitation: precip, snowCover: "enabled" };
  }
  if (RAIN_CODES.includes(weatherCode)) return { type: "rainy", cloudCover: cloud, precipitation: precip };
  if (weatherCode === 0) return { type: "sunny", cloudCover: cloud };
  return { type: "cloudy", cloudCover: cloud };
}

// Approximate high/low water from an hourly sea-level series by finding
// local extrema. Hourly resolution, so times are only accurate to ~30 min.
export function findTideTurns(series) {
  const turns = [];
  for (let i = 1; i < series.length - 1; i++) {
    const prev = series[i - 1].level;
    const cur = series[i].level;
    const next = series[i + 1].level;
    if (cur == null || prev == null || next == null) continue;
    if (cur > prev && cur >= next) turns.push({ ...series[i], kind: "HW" });
    else if (cur < prev && cur <= next) turns.push({ ...series[i], kind: "LW" });
  }
  return turns;
}

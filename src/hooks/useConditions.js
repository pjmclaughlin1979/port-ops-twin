import { useEffect, useState } from "react";
import { CONDITIONS_POLL_MS, MARINE_POINT, WEATHER_POINT } from "../config.js";

const toEpoch = (isoLocal, utcOffsetSeconds) =>
  Date.parse(`${isoLocal}Z`) - utcOffsetSeconds * 1000;

// Open-Meteo forecast + marine APIs for fixed harbour reference points:
// current conditions plus a 24 h outlook (gusts, visibility, tide, waves).
export function useConditions() {
  const [state, setState] = useState({ status: "loading", error: null });

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const weatherUrl =
          `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_POINT.latitude}&longitude=${WEATHER_POINT.longitude}` +
          "&current=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,visibility,precipitation,cloud_cover" +
          "&hourly=wind_speed_10m,wind_gusts_10m,visibility&forecast_hours=24&timezone=GMT";
        const marineUrl =
          `https://marine-api.open-meteo.com/v1/marine?latitude=${MARINE_POINT.latitude}&longitude=${MARINE_POINT.longitude}` +
          "&current=wave_height,sea_surface_temperature,sea_level_height_msl" +
          "&hourly=sea_level_height_msl,wave_height&forecast_hours=24&timezone=GMT";

        // Marine data failing (e.g. grid cell over land) shouldn't take
        // down the wind/visibility picture, so it degrades to null.
        const [weatherRes, marine] = await Promise.all([
          fetch(weatherUrl),
          fetch(marineUrl)
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null),
        ]);
        if (!weatherRes.ok) throw new Error(`Weather request failed (${weatherRes.status})`);
        const weather = await weatherRes.json();
        if (cancelled) return;

        const offset = weather.utc_offset_seconds ?? 0;
        const hourly = (weather.hourly?.time ?? []).map((time, i) => ({
          time: toEpoch(time, offset),
          wind: weather.hourly.wind_speed_10m[i],
          gust: weather.hourly.wind_gusts_10m[i],
          visibility: weather.hourly.visibility[i],
        }));
        const marineOffset = marine?.utc_offset_seconds ?? 0;
        const tide = (marine?.hourly?.time ?? []).map((time, i) => ({
          time: toEpoch(time, marineOffset),
          level: marine.hourly.sea_level_height_msl[i],
          wave: marine.hourly.wave_height[i],
        }));

        const c = weather.current;
        setState({
          status: "ready",
          error: null,
          fetchedAt: Date.now(),
          current: {
            temperature: c.temperature_2m,
            wind: c.wind_speed_10m,
            gust: c.wind_gusts_10m,
            windDirection: c.wind_direction_10m,
            weatherCode: c.weather_code,
            visibility: c.visibility,
            precipitation: c.precipitation,
            cloudCover: c.cloud_cover,
            waveHeight: marine?.current?.wave_height ?? null,
            seaTemperature: marine?.current?.sea_surface_temperature ?? null,
            seaLevel: marine?.current?.sea_level_height_msl ?? null,
          },
          hourly,
          tide,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch conditions", err);
        setState((prev) => ({ ...prev, status: "error", error: err?.message ?? "Conditions unavailable" }));
      }
    };

    refresh();
    const intervalId = setInterval(refresh, CONDITIONS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  return state;
}

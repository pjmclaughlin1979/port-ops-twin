export const PORTAL_URL = "https://www.arcgis.com";

// Cork Harbour digital twin WebScene (esriireland org). Shared to the
// org rather than publicly, so it needs a signed-in named user.
export const WEBSCENE_ITEM_ID = "ef2c4525126a4a26a5310b8ff90f8aba";

// Layers inside the WebScene, looked up by title.
export const VESSELS_LAYER_TITLE = "Vessels";
export const VESSEL_OUTLINES_LAYER_TITLE = "Vessel outlines";

// Port of Cork shipping schedule (40Geo Raptor Geo-IoT), public service.
export const MOVEMENTS_URL =
  "https://utility.arcgis.com/usrsvcs/servers/1c876bed756644a1b7916b0107d01cd8/rest/services/geoiot/port-of-cork-movements/FeatureServer/1";

// Fixed reference points for operational conditions — not the camera
// centre, so thresholds and alerts don't change as the user pans around.
export const WEATHER_POINT = { latitude: 51.84, longitude: -8.29 };
// Harbour mouth: the nearest Open-Meteo marine grid cell that is water.
export const MARINE_POINT = { latitude: 51.8, longitude: -8.26 };

export const VESSEL_POLL_MS = 20_000;
export const MOVEMENTS_POLL_MS = 60_000;
export const CONDITIONS_POLL_MS = 10 * 60_000;

// Placeholder operating limits, editable in the Conditions tool — not
// Port of Cork's actual limits.
export const DEFAULT_THRESHOLDS = {
  speedKnots: 10,
  staleMinutes: 30,
  gustKmh: 65,
  waveHeightM: 2.5,
  visibilityM: 1000,
};

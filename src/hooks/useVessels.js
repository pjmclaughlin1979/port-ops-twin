import { useEffect, useState } from "react";
import { VESSEL_POLL_MS } from "../config.js";
import { normalizeTimestamp } from "../lib/vessels.js";

function toVessel(feature, objectIdField) {
  const a = feature.attributes;
  return {
    id: a[objectIdField],
    name: a.NAME?.trim() || "Unnamed vessel",
    type: a.TYPE?.trim() || "Unknown",
    mmsi: a.MMSI ?? null,
    imo: a.IMO ?? null,
    callsign: a.CALLSIGN ?? null,
    destination: a.DESTINATION?.trim() || null,
    status: a.STATUS?.trim() || null,
    speed: a.SPEED ?? null,
    course: a.COURSE ?? null,
    heading: a.HEADING ?? null,
    timestamp: normalizeTimestamp(a.TIMESTAMP),
    latitude: feature.geometry?.latitude ?? null,
    longitude: feature.geometry?.longitude ?? null,
    graphic: feature,
  };
}

// Polls the whole AIS layer (not just what's on screen) so counts and
// alerts describe the harbour, independent of where the camera is.
export function useVessels(vesselsLayer) {
  const [state, setState] = useState({ status: "loading", vessels: [], updatedAt: null, error: null });

  useEffect(() => {
    if (!vesselsLayer) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const { features } = await vesselsLayer.queryFeatures({
          where: "1=1",
          outFields: ["*"],
          returnGeometry: true,
        });
        if (cancelled) return;
        const vessels = features
          .map((feature) => toVessel(feature, vesselsLayer.objectIdField))
          .sort((a, b) => a.name.localeCompare(b.name));
        setState({ status: "ready", vessels, updatedAt: Date.now(), error: null });
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to query vessels", err);
        setState((prev) => ({ ...prev, status: "error", error: err?.message ?? "Vessel query failed" }));
      }
    };

    refresh();
    const intervalId = setInterval(refresh, VESSEL_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [vesselsLayer]);

  return state;
}

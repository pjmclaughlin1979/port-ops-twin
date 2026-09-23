import { useCallback, useEffect, useMemo, useState } from "react";
import Graphic from "@arcgis/core/Graphic.js";
import Point from "@arcgis/core/geometry/Point.js";
import * as geodesicBufferOperator from "@arcgis/core/geometry/operators/geodesicBufferOperator.js";
import { haversineMetres } from "../lib/format.js";

const ZONE_COLOR = [255, 90, 70];

// An exclusion/safety radius (incident response, hazardous cargo, dive
// operations…) around a fixed point or a moving vessel. Vessels inside are
// derived from the live AIS list, so the zone keeps up as traffic moves.
export function useSafetyZone(zonesLayer, vessels) {
  const [zone, setZone] = useState(null);

  const centre = useMemo(() => {
    if (!zone) return null;
    if (zone.vesselId == null) return zone.point;
    const vessel = vessels.find((v) => v.id === zone.vesselId);
    if (!vessel || vessel.latitude == null) return zone.point;
    return { latitude: vessel.latitude, longitude: vessel.longitude };
  }, [zone, vessels]);

  useEffect(() => {
    if (!zonesLayer) return;
    if (!centre || !zone) {
      zonesLayer.removeAll();
      return;
    }
    let cancelled = false;
    (async () => {
      if (!geodesicBufferOperator.isLoaded()) await geodesicBufferOperator.load();
      if (cancelled) return;
      const point = new Point({ latitude: centre.latitude, longitude: centre.longitude });
      const ring = geodesicBufferOperator.execute(point, zone.radius, { unit: "meters" });
      zonesLayer.removeAll();
      zonesLayer.addMany([
        new Graphic({
          geometry: ring,
          symbol: {
            type: "simple-fill",
            color: [...ZONE_COLOR, 0.18],
            outline: { color: [...ZONE_COLOR, 0.95], width: 2 },
          },
        }),
        new Graphic({
          geometry: point,
          symbol: {
            type: "simple-marker",
            color: ZONE_COLOR,
            size: 10,
            outline: { color: [255, 255, 255], width: 1.5 },
          },
        }),
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [zonesLayer, centre, zone]);

  const inside = useMemo(() => {
    if (!centre || !zone) return [];
    return vessels
      .filter((v) => v.id !== zone.vesselId && v.latitude != null)
      .map((v) => ({ vessel: v, distance: haversineMetres(centre, v) }))
      .filter((entry) => entry.distance <= zone.radius)
      .sort((a, b) => a.distance - b.distance);
  }, [centre, zone, vessels]);

  const clear = useCallback(() => setZone(null), []);

  return { zone, setZone, centre, inside, clear };
}

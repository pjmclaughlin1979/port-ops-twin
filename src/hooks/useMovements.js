import { useEffect, useState } from "react";
import { MOVEMENTS_POLL_MS, MOVEMENTS_URL } from "../config.js";

function toMovement(attributes, index) {
  const loa = parseFloat(attributes.VESSEL_LOA);
  return {
    id: `${attributes.VESSEL}-${attributes.SRT}-${index}`,
    time: attributes.SRT,
    type: attributes.MOVE_TYPE,
    status: attributes.MOVEMENT_STATUS,
    confirmed: attributes.CONFIRMED === 1,
    vessel: attributes.VESSEL?.trim() ?? "",
    vesselType: attributes.VESSEL_TYPE?.trim() ?? "",
    loa: Number.isNaN(loa) ? null : loa,
    draught: attributes.MOVEMENT_DRAUGHT ?? null,
    from: attributes.FROM_LOC?.trim() ?? "",
    to: attributes.TO_LOC?.trim() ?? "",
  };
}

// The schedule is a public REST service, independent of the WebScene, so
// it's fetched directly rather than through the SDK.
export function useMovements() {
  const [state, setState] = useState({ status: "loading", movements: [], error: null });

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const params = new URLSearchParams({
          where: "MOVEMENT_STATUS <> 'COMPLETED'",
          outFields:
            "SRT,MOVE_TYPE,MOVEMENT_STATUS,CONFIRMED,VESSEL,VESSEL_TYPE,VESSEL_LOA,MOVEMENT_DRAUGHT,FROM_LOC,TO_LOC",
          orderByFields: "SRT ASC",
          resultRecordCount: "500",
          f: "json",
        });
        const response = await fetch(`${MOVEMENTS_URL}/query?${params}`);
        if (!response.ok) throw new Error(`Schedule request failed (${response.status})`);
        const data = await response.json();
        if (data.error) throw new Error(data.error.message ?? "Schedule query failed");
        if (cancelled) return;
        const movements = (data.features ?? []).map((f, i) => toMovement(f.attributes, i));
        setState({ status: "ready", movements, error: null });
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch the shipping schedule", err);
        setState((prev) => ({ ...prev, status: "error", error: err?.message ?? "Schedule unavailable" }));
      }
    };

    refresh();
    const intervalId = setInterval(refresh, MOVEMENTS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  return state;
}

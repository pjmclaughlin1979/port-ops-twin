import { useEffect, useMemo, useState } from "react";
import { vesselCategory } from "../../lib/vessels.js";
import { formatNumber, titleCase } from "../../lib/format.js";
import { Row, RowList, Segmented, ToolIntro } from "../ui.jsx";

const RADII = [
  { value: "250", label: "250 m" },
  { value: "500", label: "500 m" },
  { value: "1000", label: "1 km" },
  { value: "2000", label: "2 km" },
];

export default function SafetyZoneTool({ view, vessels, safetyZone, onFocus }) {
  const { zone, setZone, inside, clear } = safetyZone;
  const [radius, setRadius] = useState(zone ? String(zone.radius) : "500");
  const [isPlacing, setIsPlacing] = useState(false);
  const [vesselQuery, setVesselQuery] = useState("");

  // One-shot map click to drop the zone centre. Stops propagation so the
  // click doesn't also open a popup.
  useEffect(() => {
    if (!isPlacing || !view) return;
    const previousCursor = view.container.style.cursor;
    view.container.style.cursor = "crosshair";
    const handle = view.on("click", (event) => {
      event.stopPropagation();
      if (!event.mapPoint) return;
      setZone({
        point: { latitude: event.mapPoint.latitude, longitude: event.mapPoint.longitude },
        vesselId: null,
        label: "Map location",
        radius: Number(radius),
      });
      setIsPlacing(false);
    });
    return () => {
      handle.remove();
      view.container.style.cursor = previousCursor;
    };
  }, [isPlacing, view, radius, setZone]);

  const changeRadius = (value) => {
    setRadius(value);
    if (zone) setZone({ ...zone, radius: Number(value) });
  };

  const vesselMatches = useMemo(() => {
    const q = vesselQuery.trim().toLowerCase();
    if (!q) return [];
    return vessels.filter((v) => v.name.toLowerCase().includes(q)).slice(0, 6);
  }, [vessels, vesselQuery]);

  const centreOnVessel = (vessel) => {
    setZone({
      point: { latitude: vessel.latitude, longitude: vessel.longitude },
      vesselId: vessel.id,
      label: vessel.name,
      radius: Number(radius),
    });
    setVesselQuery("");
  };

  return (
    <div className="tool">
      <ToolIntro>
        Draw an exclusion radius for incident response, hazardous cargo operations or dive work, and
        see which vessels are inside it. Centred on a vessel, the zone follows it as it moves.
      </ToolIntro>

      <Segmented value={radius} options={RADII} onChange={changeRadius} label="Zone radius" />

      <div className="button-row">
        <calcite-button
          scale="s"
          icon-start="crosshair"
          appearance={isPlacing ? "solid" : "outline"}
          onClick={() => setIsPlacing((placing) => !placing)}
        >
          {isPlacing ? "Click the map…" : "Place on map"}
        </calcite-button>
        {zone && (
          <calcite-button scale="s" kind="neutral" appearance="outline" icon-start="trash" onClick={clear}>
            Clear zone
          </calcite-button>
        )}
      </div>

      <calcite-input-text
        placeholder="…or centre on a vessel"
        icon="search"
        clearable
        scale="s"
        value={vesselQuery}
        oncalciteInputTextInput={(event) => setVesselQuery(event.target.value)}
        oncalciteInputTextChange={(event) => setVesselQuery(event.target.value)}
      />
      <RowList>
        {vesselMatches.map((vessel) => (
          <Row
            key={vessel.id}
            title={vessel.name}
            subtitle={titleCase(vessel.type)}
            category={vesselCategory(vessel.type)}
            onClick={() => centreOnVessel(vessel)}
          />
        ))}
      </RowList>

      {zone && (
        <calcite-block
          heading={`${inside.length} vessel${inside.length === 1 ? "" : "s"} inside`}
          description={`${formatNumber(zone.radius, 0, " m")} around ${zone.label}`}
          expanded
        >
          <RowList empty="No other vessels inside the zone.">
            {inside.map(({ vessel, distance }) => (
              <Row
                key={vessel.id}
                title={vessel.name}
                subtitle={`${titleCase(vessel.type)} · ${formatNumber(vessel.speed, 1, " kn")}`}
                meta={formatNumber(distance, 0, " m")}
                category={vesselCategory(vessel.type)}
                onClick={() => onFocus(vessel)}
              />
            ))}
          </RowList>
        </calcite-block>
      )}
    </div>
  );
}

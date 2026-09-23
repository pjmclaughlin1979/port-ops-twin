import { useMemo, useState } from "react";
import { CATEGORIES, isUnderway, vesselCategory } from "../../lib/vessels.js";
import { formatAge, formatNumber, titleCase } from "../../lib/format.js";
import { Loading, Row, RowList, Segmented, Stat } from "../ui.jsx";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "underway", label: "Underway" },
  { value: "stationary", label: "Stationary" },
];

export default function TrafficTool({ vesselsState, alerts, thresholds, onFocus }) {
  const { status, vessels, updatedAt, error } = vesselsState;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const underwayCount = useMemo(() => vessels.filter(isUnderway).length, [vessels]);

  const breakdown = useMemo(() => {
    const counts = new Map();
    for (const vessel of vessels) {
      const category = vesselCategory(vessel.type);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [vessels]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vessels.filter((vessel) => {
      if (filter === "underway" && !isUnderway(vessel)) return false;
      if (filter === "stationary" && isUnderway(vessel)) return false;
      if (!q) return true;
      return [vessel.name, vessel.type, vessel.destination, vessel.mmsi?.toString()]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q));
    });
  }, [vessels, query, filter]);

  if (status === "loading" && vessels.length === 0) return <Loading label="Loading AIS traffic" />;
  if (status === "error" && vessels.length === 0) {
    return <calcite-notice open kind="danger" icon="exclamation-mark-triangle"><div slot="message">{error}</div></calcite-notice>;
  }

  const alertCount = alerts.speeding.length + alerts.stale.length;
  const max = breakdown[0]?.[1] ?? 1;

  return (
    <div className="tool">
      <div className="stats">
        <Stat label="In harbour" value={vessels.length} />
        <Stat label="Underway" value={underwayCount} />
        <Stat label="Stationary" value={vessels.length - underwayCount} />
      </div>
      <p className="muted small">AIS updated {formatAge(updatedAt)}</p>

      <calcite-block heading="By vessel type" collapsible expanded>
        <div className="bars">
          {breakdown.map(([category, count]) => (
            <div key={category} className="bars__row">
              <span className="bars__label">{CATEGORIES[category]}</span>
              <span className="bars__track">
                <span
                  className={`bars__fill swatch--${category}`}
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </span>
              <span className="bars__value">{count}</span>
            </div>
          ))}
        </div>
      </calcite-block>

      <calcite-block
        heading={`Alerts (${alertCount})`}
        description={`Over ${thresholds.speedKnots} kn · no AIS for ${thresholds.staleMinutes}+ min`}
        collapsible
        expanded
      >
        <RowList empty="No traffic alerts.">
          {alerts.speeding.map((vessel) => (
            <Row
              key={`speed-${vessel.id}`}
              title={vessel.name}
              subtitle="Above speed threshold"
              meta={formatNumber(vessel.speed, 1, " kn")}
              tone="danger"
              category={vesselCategory(vessel.type)}
              onClick={() => onFocus(vessel)}
            />
          ))}
          {alerts.stale.map((vessel) => (
            <Row
              key={`stale-${vessel.id}`}
              title={vessel.name}
              subtitle="AIS not reporting"
              meta={formatAge(vessel.timestamp)}
              tone="warning"
              category={vesselCategory(vessel.type)}
              onClick={() => onFocus(vessel)}
            />
          ))}
        </RowList>
      </calcite-block>

      <calcite-block heading={`Vessels (${filtered.length})`} collapsible expanded>
        <div className="stack">
          <calcite-input-text
            placeholder="Search name, type, MMSI, destination"
            icon="search"
            clearable
            scale="s"
            value={query}
            oncalciteInputTextInput={(event) => setQuery(event.target.value)}
            oncalciteInputTextChange={(event) => setQuery(event.target.value)}
          />
          <Segmented value={filter} options={FILTERS} onChange={setFilter} label="Vessel filter" />
          <RowList empty="No vessels match.">
            {filtered.map((vessel) => (
              <Row
                key={vessel.id}
                title={vessel.name}
                subtitle={[titleCase(vessel.type), vessel.status && titleCase(vessel.status)]
                  .filter(Boolean)
                  .join(" · ")}
                meta={formatNumber(vessel.speed, 1, " kn")}
                category={vesselCategory(vessel.type)}
                onClick={() => onFocus(vessel)}
              />
            ))}
          </RowList>
        </div>
      </calcite-block>
    </div>
  );
}

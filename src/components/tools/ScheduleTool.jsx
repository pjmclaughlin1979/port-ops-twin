import { useMemo, useState } from "react";
import { isPilotStation } from "../../lib/berths.js";
import { vesselCategory } from "../../lib/vessels.js";
import { formatNumber, formatTime, titleCase } from "../../lib/format.js";
import { Loading, Row, RowList, Segmented, Stat } from "../ui.jsx";

const WINDOWS = [
  { value: "24", label: "24 h" },
  { value: "48", label: "48 h" },
  { value: "168", label: "7 days" },
];

const KINDS = [
  { value: "all", label: "All" },
  { value: "ARRIVAL", label: "Arrivals" },
  { value: "DEPARTURE", label: "Departures" },
];

const dayLabel = (epochMs) =>
  new Date(epochMs).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

export default function ScheduleTool({ movementsState, onLocate }) {
  const { status, movements, error } = movementsState;
  const [windowHours, setWindowHours] = useState("48");
  const [kind, setKind] = useState("all");

  const inWindow = useMemo(() => {
    const now = Date.now();
    // Include movements due in the last hour: "APPROVED" ones slightly
    // overdue are still live operations until the feed completes them.
    const start = now - 60 * 60_000;
    const end = now + Number(windowHours) * 60 * 60_000;
    return movements.filter((m) => m.time >= start && m.time <= end);
  }, [movements, windowHours]);

  const listed = useMemo(
    () => inWindow.filter((m) => kind === "all" || m.type === kind),
    [inWindow, kind]
  );

  const byDay = useMemo(() => {
    const groups = new Map();
    for (const movement of listed) {
      const label = dayLabel(movement.time);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(movement);
    }
    return [...groups.entries()];
  }, [listed]);

  // Pilot demand: every arrival boards a pilot at its origin station and
  // every departure lands one at its destination station.
  const pilotStations = useMemo(() => {
    const stations = new Map();
    for (const m of inWindow) {
      const station = [m.from, m.to].find(isPilotStation);
      if (!station) continue;
      const entry = stations.get(station) ?? { station, count: 0, next: null };
      entry.count += 1;
      if (m.time >= Date.now() && (entry.next == null || m.time < entry.next)) entry.next = m.time;
      stations.set(station, entry);
    }
    return [...stations.values()].sort((a, b) => b.count - a.count);
  }, [inWindow]);

  if (status === "loading" && movements.length === 0) return <Loading label="Loading shipping schedule" />;
  if (status === "error" && movements.length === 0) {
    return <calcite-notice open kind="danger" icon="exclamation-mark-triangle"><div slot="message">{error}</div></calcite-notice>;
  }

  const arrivals = inWindow.filter((m) => m.type === "ARRIVAL").length;
  const departures = inWindow.filter((m) => m.type === "DEPARTURE").length;
  const pending = inWindow.filter((m) => m.status !== "APPROVED").length;

  return (
    <div className="tool">
      <Segmented value={windowHours} options={WINDOWS} onChange={setWindowHours} label="Time window" />
      <div className="stats">
        <Stat label="Arrivals" value={arrivals} />
        <Stat label="Departures" value={departures} />
        <Stat label="Pending approval" value={pending} tone={pending ? "warning" : undefined} />
      </div>

      <calcite-block heading="Pilot boardings" description="Movements through each pilot station" collapsible expanded>
        <RowList empty="No pilotage in this window.">
          {pilotStations.map((entry) => (
            <Row
              key={entry.station}
              title={titleCase(entry.station)}
              subtitle={entry.next ? `Next at ${formatTime(entry.next)}` : undefined}
              meta={entry.count}
            />
          ))}
        </RowList>
      </calcite-block>

      <calcite-block heading="Movements" collapsible expanded>
        <div className="stack">
          <Segmented value={kind} options={KINDS} onChange={setKind} label="Movement type" />
          {byDay.length === 0 && <p className="muted">No movements in this window.</p>}
          {byDay.map(([day, dayMovements]) => (
            <section key={day}>
              <h3 className="group-heading">{day}</h3>
              <RowList>
                {dayMovements.map((m) => (
                  <Row
                    key={m.id}
                    title={`${formatTime(m.time)} · ${m.vessel}`}
                    subtitle={`${m.type === "ARRIVAL" ? "Arr" : "Dep"} ${titleCase(m.from)} → ${titleCase(m.to)} · LOA ${formatNumber(m.loa, 0, " m")} · draught ${formatNumber(m.draught, 1, " m")}`}
                    meta={m.status === "APPROVED" ? (m.confirmed ? "Confirmed" : "Approved") : titleCase(m.status)}
                    tone={m.status === "APPROVED" ? undefined : "warning"}
                    category={vesselCategory(m.vesselType)}
                    onClick={() => onLocate(m.vessel)}
                  />
                ))}
              </RowList>
            </section>
          ))}
        </div>
      </calcite-block>
    </div>
  );
}

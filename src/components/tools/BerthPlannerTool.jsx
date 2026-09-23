import { useMemo, useState } from "react";
import { buildBerthPlan } from "../../lib/berths.js";
import { CATEGORIES, vesselCategory } from "../../lib/vessels.js";
import { formatDayTime, formatNumber, titleCase } from "../../lib/format.js";
import { Loading, Segmented, Stat } from "../ui.jsx";

const LANE_HEIGHT = 22;

const WINDOWS = [
  { value: "24", label: "24 h", tickHours: 3 },
  { value: "48", label: "48 h", tickHours: 6 },
  { value: "168", label: "7 days", tickHours: 24 },
];

function ticksFor(start, end, tickHours) {
  const step = tickHours * 60 * 60_000;
  const first = Math.ceil(start / step) * step;
  const ticks = [];
  for (let t = first; t < end; t += step) ticks.push(t);
  return ticks;
}

const tickLabel = (epochMs, tickHours) =>
  tickHours >= 24
    ? new Date(epochMs).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })
    : new Date(epochMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export default function BerthPlannerTool({ movementsState, onLocate }) {
  const { status, movements, error } = movementsState;
  const [windowHours, setWindowHours] = useState("48");
  const windowDef = WINDOWS.find((w) => w.value === windowHours);

  const { start, end, plan } = useMemo(() => {
    const windowStart = Date.now();
    const windowEnd = windowStart + Number(windowHours) * 60 * 60_000;
    return { start: windowStart, end: windowEnd, plan: buildBerthPlan(movements, windowStart, windowEnd) };
  }, [movements, windowHours]);

  if (status === "loading" && movements.length === 0) return <Loading label="Loading shipping schedule" />;
  if (status === "error" && movements.length === 0) {
    return <calcite-notice open kind="danger" icon="exclamation-mark-triangle"><div slot="message">{error}</div></calcite-notice>;
  }

  const span = end - start;
  const pct = (t) => ((t - start) / span) * 100;
  const occupiedNow = plan.filter((row) => row.stays.some((s) => s.start <= start + 60_000)).length;
  const sharedCount = plan.filter((row) => row.stays.some((s) => s.shared)).length;
  const ticks = ticksFor(start, end, windowDef.tickHours);
  const categoriesUsed = [...new Set(plan.flatMap((r) => r.stays.map((s) => vesselCategory(s.vesselType))))];

  return (
    <div className="tool">
      <Segmented value={windowHours} options={WINDOWS} onChange={setWindowHours} label="Planning window" />
      <div className="stats">
        <Stat label="Berths in plan" value={plan.length} />
        <Stat label="Occupied now" value={occupiedNow} />
        <Stat label="Shared windows" value={sharedCount} tone={sharedCount ? "warning" : undefined} />
      </div>

      {plan.length === 0 ? (
        <p className="muted">No berth activity in this window.</p>
      ) : (
        <div className="gantt" role="table" aria-label="Berth occupancy">
          <div className="gantt__row gantt__row--axis" role="row">
            <span className="gantt__berth" role="rowheader" />
            <span className="gantt__lane">
              {ticks.map((t) => (
                <span key={t} className="gantt__tick" style={{ left: `${pct(t)}%` }}>
                  {tickLabel(t, windowDef.tickHours)}
                </span>
              ))}
            </span>
          </div>
          {plan.map((row) => (
            <div key={row.berth} className="gantt__row" role="row">
              <span className="gantt__berth" role="rowheader" title={row.berth}>
                {titleCase(row.berth)}
              </span>
              <span className="gantt__lane" style={{ height: `${row.laneCount * LANE_HEIGHT + 6}px` }}>
                {ticks.map((t) => (
                  <span key={t} className="gantt__gridline" style={{ left: `${pct(t)}%` }} />
                ))}
                {row.stays.map((stay, i) => {
                  const category = vesselCategory(stay.vesselType);
                  const detail = [
                    stay.vessel,
                    titleCase(stay.vesselType),
                    `LOA ${formatNumber(stay.loa, 0, " m")}`,
                    `${stay.arrival ? `Arr ${formatDayTime(stay.arrival.time)}` : "Already alongside"} → ${
                      stay.departure ? `Dep ${formatDayTime(stay.departure.time)}` : "departure not yet scheduled"
                    }`,
                    stay.shared ? "Shares the berth with another vessel in this window" : null,
                  ]
                    .filter(Boolean)
                    .join("\n");
                  return (
                    <button
                      key={`${stay.vessel}-${i}`}
                      type="button"
                      className={`gantt__bar swatch--${category} ${stay.shared ? "gantt__bar--shared" : ""} ${
                        stay.departure ? "" : "gantt__bar--open-end"
                      }`}
                      style={{
                        left: `${pct(stay.start)}%`,
                        width: `${Math.max(pct(stay.end) - pct(stay.start), 0.8)}%`,
                        top: `${3 + stay.lane * LANE_HEIGHT}px`,
                        height: `${LANE_HEIGHT - 2}px`,
                      }}
                      title={detail}
                      aria-label={detail.replace(/\n/g, ", ")}
                      onClick={() => onLocate(stay.vessel)}
                    >
                      <span className="gantt__bar-label">{stay.vessel}</span>
                    </button>
                  );
                })}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="legend-row">
        {categoriesUsed.map((category) => (
          <span key={category} className="legend-row__item">
            <span className={`swatch swatch--${category}`} aria-hidden="true" />
            {CATEGORIES[category]}
          </span>
        ))}
        <span className="legend-row__item">
          <span className="swatch swatch--shared" aria-hidden="true" />
          Shared berth window
        </span>
      </div>
      <p className="muted small">
        Derived from the shipping schedule: an arrival opens a stay that the vessel's next departure from
        the same berth closes. Hover a bar for details, click to locate the vessel.
      </p>
    </div>
  );
}

// Pilot boarding stations appear in the schedule as "PS …" locations;
// everything else is a berth, quay or jetty.
export const isPilotStation = (location) => /^PS\b/i.test(location?.trim() ?? "");

// Turn the shipping schedule into per-berth occupancy bars. An arrival at a
// berth opens a stay that the same vessel's next departure from that berth
// closes. A departure with no matching arrival is a vessel already
// alongside (its arrival is complete and no longer in the feed), so its bar
// starts at the window start; an arrival with no departure yet runs to the
// window end.
export function buildBerthPlan(movements, windowStart, windowEnd) {
  const sorted = [...movements].sort((a, b) => a.time - b.time);
  const open = new Map();
  const stays = [];

  for (const movement of sorted) {
    const fromBerth = movement.from && !isPilotStation(movement.from) ? movement.from : null;
    const toBerth = movement.to && !isPilotStation(movement.to) ? movement.to : null;

    if (fromBerth) {
      const key = `${fromBerth}|${movement.vessel}`;
      const arrival = open.get(key) ?? null;
      open.delete(key);
      stays.push({
        berth: fromBerth,
        vessel: movement.vessel,
        vesselType: movement.vesselType,
        loa: movement.loa,
        start: arrival?.time ?? windowStart,
        end: movement.time,
        arrival,
        departure: movement,
      });
    }
    if (toBerth) {
      open.set(`${toBerth}|${movement.vessel}`, movement);
    }
  }

  for (const arrival of open.values()) {
    stays.push({
      berth: arrival.to,
      vessel: arrival.vessel,
      vesselType: arrival.vesselType,
      loa: arrival.loa,
      start: arrival.time,
      end: windowEnd,
      arrival,
      departure: null,
    });
  }

  const visible = stays
    .filter((stay) => stay.end > windowStart && stay.start < windowEnd)
    .map((stay) => ({
      ...stay,
      start: Math.max(stay.start, windowStart),
      end: Math.min(stay.end, windowEnd),
    }));

  const byBerth = new Map();
  for (const stay of visible) {
    if (!byBerth.has(stay.berth)) byBerth.set(stay.berth, []);
    byBerth.get(stay.berth).push(stay);
  }

  return [...byBerth.entries()]
    .map(([berth, berthStays]) => {
      berthStays.sort((a, b) => a.start - b.start);
      // Stays sharing a berth at the same time: common on long quays, but
      // worth flagging so planners can check the combined length fits.
      for (let i = 0; i < berthStays.length; i++) {
        for (let j = i + 1; j < berthStays.length; j++) {
          if (berthStays[j].start < berthStays[i].end) {
            berthStays[i].shared = true;
            berthStays[j].shared = true;
          }
        }
      }
      // Greedy lane assignment so concurrent stays render stacked rather
      // than on top of each other.
      const laneEnds = [];
      for (const stay of berthStays) {
        let lane = laneEnds.findIndex((end) => end <= stay.start);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = stay.end;
        stay.lane = lane;
      }
      return { berth, stays: berthStays, laneCount: Math.max(laneEnds.length, 1) };
    })
    .sort((a, b) => a.berth.localeCompare(b.berth));
}

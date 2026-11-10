import { CONDITIONS_POLL_MS, MOVEMENTS_POLL_MS, VESSEL_POLL_MS } from "../config.js";

// A feed counts as stale once three refreshes in a row have been missed:
// one failed poll is routine, three means the screen is showing old data.
const MISSED_POLLS = 3;

function check(label, pollMs, status, updatedAt, now) {
  if (updatedAt == null) {
    // Never loaded: only a problem once the first attempt has failed.
    return status === "error" ? { label, updatedAt: null } : null;
  }
  return now - updatedAt > pollMs * MISSED_POLLS ? { label, updatedAt } : null;
}

// Feeds whose on-screen data is out of date, for the header warning.
export function staleFeeds({ vesselsState, movementsState, conditions }, now) {
  return [
    check("AIS", VESSEL_POLL_MS, vesselsState.status, vesselsState.updatedAt, now),
    check("schedule", MOVEMENTS_POLL_MS, movementsState.status, movementsState.updatedAt, now),
    check("weather", CONDITIONS_POLL_MS, conditions.status, conditions.fetchedAt ?? null, now),
  ].filter(Boolean);
}

import { useCallback, useState } from "react";
import { DEFAULT_THRESHOLDS } from "../config.js";

const STORAGE_KEY = "port-ops-twin:thresholds";

function load() {
  try {
    return { ...DEFAULT_THRESHOLDS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

export function useThresholds() {
  const [thresholds, setThresholds] = useState(load);

  const update = useCallback((key, value) => {
    setThresholds((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable (private mode etc.) — keep in-memory only.
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setThresholds({ ...DEFAULT_THRESHOLDS });
  }, []);

  return { thresholds, update, reset };
}

// Everything behind sign-in. Loaded lazily from App.jsx so the sign-in
// page doesn't download the ArcGIS SDK, map components or scene code.
import "@arcgis/core/assets/esri/themes/dark/main.css";
import "./registerComponents.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePortScene } from "./hooks/usePortScene.js";
import { useVessels } from "./hooks/useVessels.js";
import { useMovements } from "./hooks/useMovements.js";
import { useConditions } from "./hooks/useConditions.js";
import { useThresholds } from "./hooks/useThresholds.js";
import { useSafetyZone } from "./hooks/useSafetyZone.js";
import { useNow } from "./hooks/useNow.js";
import { isInHarbour, isUnderway, normalizeName } from "./lib/vessels.js";
import { toSceneWeather } from "./lib/weather.js";
import { formatAge, formatNumber, formatTime } from "./lib/format.js";
import { staleFeeds } from "./lib/freshness.js";
import TrafficTool from "./components/tools/TrafficTool.jsx";
import ScheduleTool from "./components/tools/ScheduleTool.jsx";
import BerthPlannerTool from "./components/tools/BerthPlannerTool.jsx";
import ConditionsTool from "./components/tools/ConditionsTool.jsx";
import SafetyZoneTool from "./components/tools/SafetyZoneTool.jsx";
import {
  AnalysisTool,
  BasemapTool,
  LayersTool,
  LegendTool,
  LineOfSightTool,
  MarkupTool,
  SCENE_ID,
  SliceTool,
  SunShadowTool,
  ViewsTool,
  WeatherTool,
} from "./components/tools/SdkTools.jsx";
import { Loading } from "./components/ui.jsx";

const TOOL_GROUPS = [
  {
    label: "Operations",
    tools: [
      { id: "traffic", text: "Live traffic", icon: "dashboard" },
      { id: "schedule", text: "Arrivals & departures", icon: "calendar" },
      { id: "berths", text: "Berth planner", icon: "multi-timeline", wide: true },
      { id: "conditions", text: "Marine conditions", icon: "partly-cloudy" },
      { id: "zone", text: "Safety zone", icon: "buffer-point" },
    ],
  },
  {
    label: "Analysis",
    tools: [
      { id: "measure", text: "Measure & analyse", icon: "measure" },
      { id: "sight", text: "Line of sight", icon: "line-of-sight" },
      { id: "shadow", text: "Sun & shadow", icon: "measure-building-height-shadow" },
      { id: "weather", text: "Weather simulation", icon: "rain" },
      { id: "slice", text: "Slice", icon: "slice" },
      { id: "markup", text: "Markup", icon: "pencil" },
    ],
  },
  {
    label: "Map",
    tools: [
      { id: "layers", text: "Layers", icon: "layers" },
      { id: "legend", text: "Legend", icon: "legend" },
      { id: "basemap", text: "Basemap", icon: "basemap" },
      { id: "views", text: "Saved views", icon: "slideshow" },
    ],
  },
];

const ALL_TOOLS = TOOL_GROUPS.flatMap((group) => group.tools);

export default function PortTwin({ username, onSignOut }) {
  const sceneRef = useRef(null);
  const scene = usePortScene(sceneRef, true);
  const vesselsState = useVessels(scene.vesselsLayer);
  const movementsState = useMovements();
  const conditions = useConditions();
  const { thresholds, update: updateThreshold, reset: resetThresholds } = useThresholds();
  const safetyZone = useSafetyZone(scene.zonesLayer, vesselsState.vessels);
  const now = useNow(30_000);

  const [activeTool, setActiveTool] = useState("traffic");
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [mirrorWeather, setMirrorWeather] = useState(true);
  const [notice, setNotice] = useState(null);

  const vessels = vesselsState.vessels;
  const harbourVessels = useMemo(() => vessels.filter(isInHarbour), [vessels]);

  const alerts = useMemo(
    () => ({
      speeding: harbourVessels.filter((v) => v.speed != null && v.speed > thresholds.speedKnots),
      // Moored vessels routinely switch AIS off; going silent while
      // underway is the case worth flagging.
      stale: harbourVessels.filter(
        (v) => isUnderway(v) && v.timestamp != null && now - v.timestamp > thresholds.staleMinutes * 60_000
      ),
    }),
    [harbourVessels, thresholds, now]
  );

  const stale = staleFeeds({ vesselsState, movementsState, conditions }, now);

  const current = conditions.current;
  const conditionBreaches = current
    ? [
        (current.gust ?? 0) >= thresholds.gustKmh,
        (current.visibility ?? Infinity) < thresholds.visibilityM,
        (current.waveHeight ?? 0) >= thresholds.waveHeightM,
      ].filter(Boolean).length
    : 0;
  const trafficAlerts = alerts.speeding.length + alerts.stale.length;

  // Keep the 3D scene's weather in step with real conditions.
  useEffect(() => {
    if (!mirrorWeather || !scene.view || !current) return;
    scene.view.environment.weather = toSceneWeather(current);
  }, [mirrorWeather, scene.view, current]);

  const focusVessel = useCallback(
    (vessel) => {
      const view = scene.view;
      const graphic = vessel?.graphic;
      if (!view || !graphic?.geometry) return;
      view.goTo({ target: graphic, scale: 2500, tilt: 60 }, { duration: 1200 }).catch(() => {});
      view.openPopup({ features: [graphic], location: graphic.geometry });
    },
    [scene.view]
  );

  // Schedule entries only carry a vessel name, so match it to live AIS.
  const locateByName = useCallback(
    (name) => {
      const target = normalizeName(name);
      const vessel = vessels.find((v) => normalizeName(v.name) === target);
      if (vessel) focusVessel(vessel);
      else setNotice(`${name} isn't currently transmitting AIS in the harbour.`);
    },
    [vessels, focusVessel]
  );

  // Enter on the keyboard target opens details for what's inside it. The
  // SDK's own handling needs its beta popup component, so do it here with
  // the popup the rest of the app uses.
  const vesselsRef = useRef(vessels);
  vesselsRef.current = vessels;
  useEffect(() => {
    const sceneElement = sceneRef.current;
    const view = scene.view;
    if (!sceneElement || !view) return;
    const onSelect = async (event) => {
      event.preventDefault();
      const region = sceneElement.focusRegion;
      if (!region) return;
      const { results } = await view.hitTest(region);
      const seen = new Set();
      const features = [];
      for (const result of results) {
        const graphic = result.type === "graphic" ? result.graphic : null;
        if (!graphic || !graphic.getEffectivePopupTemplate?.()) continue;
        const key = `${graphic.layer?.id ?? "view"}:${graphic.getObjectId?.() ?? graphic.uid}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // Hit-test graphics only carry the fields needed for drawing, so
        // swap vessels for the full records already loaded.
        const vessel =
          graphic.layer === scene.vesselsLayer
            ? vesselsRef.current.find((v) => v.id === graphic.getObjectId())
            : null;
        features.push(vessel?.graphic ?? graphic);
      }
      if (features.length === 0) {
        setNotice("Nothing in the keyboard target. Move the map with the arrow keys and try again.");
        return;
      }
      view.openPopup({ features, location: features[0].geometry });
    };
    sceneElement.addEventListener("arcgisViewFocusRegionSelect", onSelect);
    return () => sceneElement.removeEventListener("arcgisViewFocusRegionSelect", onSelect);
  }, [scene.view, scene.vesselsLayer]);

  // The focus region is a keyboard target in the middle of the view:
  // Enter opens details for the features inside it.
  const toggleFocusRegion = () => {
    const sceneElement = sceneRef.current;
    if (!sceneElement) return;
    sceneElement.focusRegionVisible = !sceneElement.focusRegionVisible;
    if (sceneElement.focusRegionVisible) sceneElement.view?.focus();
  };

  const toggleTool = (id) => setActiveTool((currentTool) => (currentTool === id ? null : id));
  const activeDef = ALL_TOOLS.find((tool) => tool.id === activeTool);

  const renderTool = (id) => {
    switch (id) {
      case "traffic":
        return (
          <TrafficTool
            vesselsState={vesselsState}
            harbourVessels={harbourVessels}
            alerts={alerts}
            thresholds={thresholds}
            onFocus={focusVessel}
          />
        );
      case "schedule":
        return <ScheduleTool movementsState={movementsState} onLocate={locateByName} />;
      case "berths":
        return <BerthPlannerTool movementsState={movementsState} onLocate={locateByName} />;
      case "conditions":
        return (
          <ConditionsTool
            conditions={conditions}
            thresholds={thresholds}
            onThresholdChange={updateThreshold}
            onThresholdsReset={resetThresholds}
            mirrorWeather={mirrorWeather}
            onMirrorWeatherChange={setMirrorWeather}
          />
        );
      case "zone":
        return <SafetyZoneTool view={scene.view} vessels={vessels} safetyZone={safetyZone} onFocus={focusVessel} />;
      case "measure":
        return <AnalysisTool />;
      case "sight":
        return <LineOfSightTool />;
      case "shadow":
        return <SunShadowTool />;
      case "weather":
        return <WeatherTool mirrorWeather={mirrorWeather} />;
      case "slice":
        return <SliceTool />;
      case "markup":
        return <MarkupTool markupLayer={scene.markupLayer} />;
      case "layers":
        return <LayersTool />;
      case "legend":
        return <LegendTool />;
      case "basemap":
        return <BasemapTool />;
      case "views":
        return <ViewsTool slides={scene.slides} view={scene.view} />;
      default:
        return null;
    }
  };

  return (
    <calcite-shell>
      <calcite-navigation slot="header">
        <calcite-navigation-logo
          slot="logo"
          heading="Port of Cork · Operations Twin"
          description="Cork Harbour, live"
        />
        <div slot="content-end" className="status-strip">
          {stale.length > 0 && (
            <span className="status-pill status-pill--danger status-pill--static" role="status">
              Not updating:{" "}
              {stale
                .map((feed) => `${feed.label} (${feed.updatedAt ? `last ${formatAge(feed.updatedAt, now)}` : "unavailable"})`)
                .join(", ")}
            </span>
          )}
          <button type="button" className="status-pill" onClick={() => setActiveTool("traffic")}>
            <strong>{harbourVessels.length}</strong> in harbour · {harbourVessels.filter(isUnderway).length} underway
          </button>
          <button
            type="button"
            className={`status-pill ${trafficAlerts ? "status-pill--warning" : ""}`}
            onClick={() => setActiveTool("traffic")}
          >
            {trafficAlerts} traffic alert{trafficAlerts === 1 ? "" : "s"}
          </button>
          <button
            type="button"
            className={`status-pill ${conditionBreaches ? "status-pill--danger" : "status-pill--ok"}`}
            onClick={() => setActiveTool("conditions")}
          >
            {current
              ? `Gust ${formatNumber(current.gust, 0, " km/h")} · ${conditionBreaches ? `${conditionBreaches} limit${conditionBreaches === 1 ? "" : "s"} exceeded` : "within limits"}`
              : "Conditions…"}
          </button>
          <span className="status-clock">{formatTime(now)}</span>
          <calcite-action icon="sign-out" text={`Sign out ${username}`} title={`Sign out ${username}`} onClick={onSignOut} />
        </div>
      </calcite-navigation>

      <calcite-shell-panel
        slot="panel-start"
        position="start"
        collapsed={!activeDef}
        className={activeDef?.wide ? "tool-panel--wide" : undefined}
        resizable
      >
        <calcite-action-bar slot="action-bar">
          {TOOL_GROUPS.map((group) => (
            <calcite-action-group key={group.label} label={group.label}>
              {group.tools.map((tool) => (
                <calcite-action
                  key={tool.id}
                  text={tool.text}
                  icon={tool.icon}
                  active={tool.id === activeTool}
                  onClick={() => toggleTool(tool.id)}
                />
              ))}
            </calcite-action-group>
          ))}
          <calcite-action
            slot="actions-end"
            text="Vessel table"
            icon="table"
            active={isTableOpen}
            onClick={() => setIsTableOpen((open) => !open)}
          />
        </calcite-action-bar>

        {activeDef && (
          <calcite-panel
            key={activeDef.id}
            heading={activeDef.text}
            closable
            oncalcitePanelClose={() => setActiveTool(null)}
          >
            <div className="panel-body">
              {scene.status === "ready" ? renderTool(activeDef.id) : <Loading label="Loading scene" />}
            </div>
          </calcite-panel>
        )}
      </calcite-shell-panel>

      <div className="scene-wrap">
        <arcgis-scene id={SCENE_ID} ref={sceneRef} focusRegionShortcutEnabled>
          <arcgis-zoom slot="top-right" />
          <arcgis-navigation-toggle slot="top-right" />
          <arcgis-compass slot="top-right" />
          <arcgis-home slot="top-right" viewpoint={scene.startViewpoint ?? undefined} />
          <calcite-action
            slot="top-right"
            className="scene-action"
            icon="crosshair"
            text="Keyboard target: move the map with the arrow keys, then press Enter for vessel details (Shift+Alt+O)"
            onClick={toggleFocusRegion}
          />
        </arcgis-scene>
        {scene.status !== "ready" && (
          <div className="scene-overlay">
            {scene.status === "error" ? (
              <calcite-notice open kind="danger" icon="exclamation-mark-triangle">
                <div slot="title">The scene couldn't be loaded</div>
                <div slot="message">{scene.error}</div>
              </calcite-notice>
            ) : (
              <Loading label="Loading Cork Harbour scene" />
            )}
          </div>
        )}
      </div>

      {isTableOpen && scene.vesselsLayer && (
        <calcite-shell-panel slot="panel-bottom" layout="horizontal" resizable>
          <calcite-panel heading="Vessels (AIS)" closable oncalcitePanelClose={() => setIsTableOpen(false)}>
            <div className="table-host">
              <arcgis-feature-table referenceElement={SCENE_ID} layer={scene.vesselsLayer} />
            </div>
          </calcite-panel>
        </calcite-shell-panel>
      )}

      <calcite-alert
        slot="alerts"
        open={Boolean(notice)}
        kind="info"
        icon="information"
        autoClose
        label="Notice"
        oncalciteAlertClose={() => setNotice(null)}
      >
        <div slot="message">{notice}</div>
      </calcite-alert>
    </calcite-shell>
  );
}

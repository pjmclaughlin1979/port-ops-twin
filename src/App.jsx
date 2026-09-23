import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./hooks/useAuth.js";
import { usePortScene } from "./hooks/usePortScene.js";
import { useVessels } from "./hooks/useVessels.js";
import { useMovements } from "./hooks/useMovements.js";
import { useConditions } from "./hooks/useConditions.js";
import { useThresholds } from "./hooks/useThresholds.js";
import { useSafetyZone } from "./hooks/useSafetyZone.js";
import { useNow } from "./hooks/useNow.js";
import { isUnderway, normalizeName } from "./lib/vessels.js";
import { toSceneWeather } from "./lib/weather.js";
import { formatNumber, formatTime } from "./lib/format.js";
import TrafficTool from "./components/tools/TrafficTool.jsx";
import ScheduleTool from "./components/tools/ScheduleTool.jsx";
import BerthPlannerTool from "./components/tools/BerthPlannerTool.jsx";
import ConditionsTool from "./components/tools/ConditionsTool.jsx";
import SafetyZoneTool from "./components/tools/SafetyZoneTool.jsx";
import {
  BasemapTool,
  LayersTool,
  LegendTool,
  LineOfSightTool,
  MarkupTool,
  MeasureTool,
  ProfileTool,
  SCENE_ID,
  SliceTool,
  SunShadowTool,
  ViewsTool,
  VolumeTool,
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
      { id: "measure", text: "Measure", icon: "measure" },
      { id: "volume", text: "Stockpile volume", icon: "cut-and-fill-volume-calculation" },
      { id: "sight", text: "Line of sight", icon: "line-of-sight" },
      { id: "shadow", text: "Sun & shadow", icon: "measure-building-height-shadow" },
      { id: "weather", text: "Weather simulation", icon: "rain" },
      { id: "slice", text: "Slice", icon: "slice" },
      { id: "profile", text: "Elevation profile", icon: "absolute-elevation" },
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

export default function App() {
  const auth = useAuth();
  if (auth.status !== "signed-in") return <SignInScreen auth={auth} />;
  return <PortTwin username={auth.username} onSignOut={auth.signOut} />;
}

function SignInScreen({ auth }) {
  return (
    <main className="sign-in">
      <div className="sign-in__card">
        <h1>Port of Cork · Operations Twin</h1>
        <p>
          A live 3D digital twin of Cork Harbour: AIS traffic, the shipping schedule, berth occupancy,
          marine conditions and 3D analysis tools.
        </p>
        {auth.status === "error" ? (
          <calcite-notice open kind="danger" icon="exclamation-mark-triangle">
            <div slot="message">{auth.error}</div>
          </calcite-notice>
        ) : (
          <calcite-button
            width="full"
            icon-start="user"
            loading={auth.status === "checking"}
            disabled={auth.status === "checking"}
            onClick={auth.signIn}
          >
            {auth.status === "checking" ? "Checking sign-in…" : "Sign in with ArcGIS Online"}
          </calcite-button>
        )}
      </div>
    </main>
  );
}

function PortTwin({ username, onSignOut }) {
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

  const alerts = useMemo(
    () => ({
      speeding: vessels.filter((v) => v.speed != null && v.speed > thresholds.speedKnots),
      stale: vessels.filter(
        (v) => v.timestamp != null && now - v.timestamp > thresholds.staleMinutes * 60_000
      ),
    }),
    [vessels, thresholds, now]
  );

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

  const toggleTool = (id) => setActiveTool((currentTool) => (currentTool === id ? null : id));
  const activeDef = ALL_TOOLS.find((tool) => tool.id === activeTool);

  const renderTool = (id) => {
    switch (id) {
      case "traffic":
        return <TrafficTool vesselsState={vesselsState} alerts={alerts} thresholds={thresholds} onFocus={focusVessel} />;
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
        return <MeasureTool />;
      case "volume":
        return <VolumeTool />;
      case "sight":
        return <LineOfSightTool />;
      case "shadow":
        return <SunShadowTool />;
      case "weather":
        return <WeatherTool mirrorWeather={mirrorWeather} />;
      case "slice":
        return <SliceTool />;
      case "profile":
        return <ProfileTool />;
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
          <button type="button" className="status-pill" onClick={() => setActiveTool("traffic")}>
            <strong>{vessels.length}</strong> vessels · {vessels.filter(isUnderway).length} underway
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
        <arcgis-scene id={SCENE_ID} ref={sceneRef}>
          <arcgis-zoom slot="top-right" />
          <arcgis-navigation-toggle slot="top-right" />
          <arcgis-compass slot="top-right" />
          <arcgis-home slot="top-right" />
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

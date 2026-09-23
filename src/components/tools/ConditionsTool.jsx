import { compassPoint, formatNumber, formatTime } from "../../lib/format.js";
import { describeWeatherCode, findTideTurns } from "../../lib/weather.js";
import { Loading, Row, RowList, Stat } from "../ui.jsx";

const CHART_W = 300;
const CHART_H = 90;

function GustChart({ hourly, limit }) {
  const max = Math.max(limit * 1.2, ...hourly.map((h) => h.gust ?? 0));
  const barW = CHART_W / hourly.length;
  const y = (v) => CHART_H - (v / max) * CHART_H;
  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H + 16}`} className="chart" role="img" aria-label="24 hour gust forecast">
      {hourly.map((h, i) => (
        <rect
          key={h.time}
          x={i * barW + 1}
          y={y(h.gust ?? 0)}
          width={barW - 2}
          height={CHART_H - y(h.gust ?? 0)}
          className={(h.gust ?? 0) >= limit ? "chart__bar chart__bar--over" : "chart__bar"}
        >
          <title>{`${formatTime(h.time)} · gust ${formatNumber(h.gust, 0, " km/h")}`}</title>
        </rect>
      ))}
      <line x1="0" x2={CHART_W} y1={y(limit)} y2={y(limit)} className="chart__limit" />
      <text x={CHART_W - 2} y={y(limit) - 3} textAnchor="end" className="chart__text">
        limit {limit} km/h
      </text>
      {hourly
        .filter((_, i) => i % 6 === 0)
        .map((h) => (
          <text key={h.time} x={hourly.indexOf(h) * barW} y={CHART_H + 12} className="chart__text">
            {formatTime(h.time)}
          </text>
        ))}
    </svg>
  );
}

function TideChart({ tide }) {
  const levels = tide.map((t) => t.level).filter((v) => v != null);
  if (levels.length < 2) return <p className="muted">Tide forecast unavailable.</p>;
  const min = Math.min(...levels) - 0.2;
  const max = Math.max(...levels) + 0.2;
  const x = (i) => (i / (tide.length - 1)) * CHART_W;
  const y = (v) => CHART_H - ((v - min) / (max - min)) * CHART_H;
  const path = tide
    .map((t, i) => (t.level == null ? null : `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(t.level).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  const turns = findTideTurns(tide);
  const anchorFor = (px) => (px < 40 ? "start" : px > CHART_W - 40 ? "end" : "middle");
  return (
    <svg viewBox={`0 -14 ${CHART_W} ${CHART_H + 32}`} className="chart" role="img" aria-label="24 hour tide curve">
      <line x1="0" x2={CHART_W} y1={y(0)} y2={y(0)} className="chart__zero" />
      <path d={path} className="chart__line" />
      {turns.map((turn) => {
        const i = tide.findIndex((t) => t.time === turn.time);
        return (
          <g key={turn.time}>
            <circle cx={x(i)} cy={y(turn.level)} r="3" className="chart__point" />
            <text
              x={x(i)}
              y={turn.kind === "HW" ? y(turn.level) - 7 : y(turn.level) + 15}
              textAnchor={anchorFor(x(i))}
              className="chart__text"
            >
              {`${turn.kind} ${formatTime(turn.time)}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ThresholdInput({ label, value, suffix, step, onChange }) {
  return (
    <calcite-label scale="s">
      {label}
      <calcite-input-number
        scale="s"
        value={String(value)}
        min={0}
        step={step}
        suffix-text={suffix}
        oncalciteInputNumberChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isNaN(next) && event.target.value !== "") onChange(next);
        }}
      />
    </calcite-label>
  );
}

export default function ConditionsTool({
  conditions,
  thresholds,
  onThresholdChange,
  onThresholdsReset,
  mirrorWeather,
  onMirrorWeatherChange,
}) {
  if (conditions.status === "loading" && !conditions.current) return <Loading label="Loading conditions" />;
  if (!conditions.current) {
    return <calcite-notice open kind="danger" icon="exclamation-mark-triangle"><div slot="message">{conditions.error}</div></calcite-notice>;
  }

  const { current, hourly, tide } = conditions;
  const nextGust = hourly.find((h) => h.time > Date.now() && (h.gust ?? 0) >= thresholds.gustKmh);
  const lowVisibility = hourly.find((h) => h.time > Date.now() && (h.visibility ?? Infinity) < thresholds.visibilityM);

  const checks = [
    {
      key: "wind",
      title: "Wind (gusts)",
      value: formatNumber(current.gust, 0, " km/h"),
      ok: (current.gust ?? 0) < thresholds.gustKmh,
      note: nextGust ? `Forecast to exceed at ${formatTime(nextGust.time)}` : "Within limit for next 24 h",
    },
    {
      key: "visibility",
      title: "Visibility",
      value: current.visibility == null ? "—" : `${(current.visibility / 1000).toFixed(1)} km`,
      ok: (current.visibility ?? Infinity) >= thresholds.visibilityM,
      note: lowVisibility ? `Drops below minimum at ${formatTime(lowVisibility.time)}` : "Above minimum for next 24 h",
    },
    {
      key: "waves",
      title: "Wave height (harbour mouth)",
      value: formatNumber(current.waveHeight, 1, " m"),
      ok: (current.waveHeight ?? 0) < thresholds.waveHeightM,
      note: current.waveHeight == null ? "No marine data" : `Limit ${thresholds.waveHeightM} m`,
    },
  ];

  return (
    <div className="tool">
      <div className="stats">
        <Stat label={describeWeatherCode(current.weatherCode)} value={formatNumber(current.temperature, 0, "°C")} />
        <Stat
          label={`Wind ${compassPoint(current.windDirection)}`}
          value={formatNumber(current.wind, 0, " km/h")}
        />
        <Stat label="Sea temp" value={formatNumber(current.seaTemperature, 1, "°C")} />
      </div>

      <calcite-block heading="Operating limits" collapsible expanded>
        <RowList>
          {checks.map((check) => (
            <Row
              key={check.key}
              title={check.title}
              subtitle={check.note}
              meta={check.value}
              tone={check.ok ? "ok" : "danger"}
            />
          ))}
        </RowList>
      </calcite-block>

      <calcite-block heading="Gust outlook (24 h)" collapsible expanded>
        <GustChart hourly={hourly} limit={thresholds.gustKmh} />
      </calcite-block>

      <calcite-block
        heading="Tide (24 h)"
        description={`Now ${formatNumber(current.seaLevel, 2, " m")} relative to mean sea level · modelled, approximate`}
        collapsible
        expanded
      >
        <TideChart tide={tide} />
      </calcite-block>

      <calcite-block heading="Scene" collapsible expanded>
        <calcite-label layout="inline-space-between" scale="s">
          Mirror live weather in the 3D scene
          <calcite-switch
            checked={mirrorWeather}
            oncalciteSwitchChange={(event) => onMirrorWeatherChange(event.target.checked)}
          />
        </calcite-label>
      </calcite-block>

      <calcite-block
        heading="Thresholds"
        description="Placeholder defaults — set these to your port's own operating limits"
        collapsible
      >
        <div className="stack">
          <ThresholdInput label="Gust limit" suffix="km/h" step={1} value={thresholds.gustKmh} onChange={(v) => onThresholdChange("gustKmh", v)} />
          <ThresholdInput label="Minimum visibility" suffix="m" step={100} value={thresholds.visibilityM} onChange={(v) => onThresholdChange("visibilityM", v)} />
          <ThresholdInput label="Wave height limit" suffix="m" step={0.1} value={thresholds.waveHeightM} onChange={(v) => onThresholdChange("waveHeightM", v)} />
          <ThresholdInput label="Vessel speed alert" suffix="kn" step={0.5} value={thresholds.speedKnots} onChange={(v) => onThresholdChange("speedKnots", v)} />
          <ThresholdInput label="AIS silent after" suffix="min" step={5} value={thresholds.staleMinutes} onChange={(v) => onThresholdChange("staleMinutes", v)} />
          <calcite-button appearance="outline" kind="neutral" scale="s" onClick={onThresholdsReset}>
            Reset to defaults
          </calcite-button>
        </div>
      </calcite-block>

      <p className="muted small">Open-Meteo forecast and marine models · refreshed every 10 minutes.</p>
    </div>
  );
}

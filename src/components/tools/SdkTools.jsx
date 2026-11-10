import { ToolIntro } from "../ui.jsx";

// Thin wrappers around ArcGIS 5.x map components. Each one attaches to the
// <arcgis-scene id="port-scene"> through referenceElement, and is only
// mounted while its panel is open, so leaving a tool also clears its
// interactive analysis from the scene.
export const SCENE_ID = "port-scene";

export function AnalysisTool() {
  return (
    <div className="tool">
      <ToolIntro>
        Measure distances and areas, estimate bulk stockpile volumes (aggregates, grain, scrap) or
        cut-and-fill for yard works, and chart the ground profile along a quay or approach. Pick a
        tool from the bar, then click on the scene. Volume works on the photorealistic mesh and its
        results depend on zoom level.
      </ToolIntro>
      {/* The container shows one child at a time and builds its switcher
          from each child's icon and label. */}
      <arcgis-exploratory-analysis>
        <arcgis-direct-line-measurement-3d referenceElement={SCENE_ID} />
        <arcgis-area-measurement-3d referenceElement={SCENE_ID} />
        <arcgis-volume-measurement referenceElement={SCENE_ID} />
        <arcgis-elevation-profile referenceElement={SCENE_ID} />
      </arcgis-exploratory-analysis>
    </div>
  );
}

export function LineOfSightTool() {
  return (
    <div className="tool">
      <ToolIntro>
        Place an observer — a CCTV mast, VTS radar or pilot lookout — then targets, to check what is
        visible and what is blocked by cranes, sheds or terrain.
      </ToolIntro>
      <arcgis-line-of-sight referenceElement={SCENE_ID} />
    </div>
  );
}

export function SunShadowTool() {
  return (
    <div className="tool">
      <ToolIntro>
        Change the date and time of day, and visualise how long quays and yards stay in shadow from
        cranes, stacks and buildings — useful for lighting, solar and icing assessments.
      </ToolIntro>
      <arcgis-daylight referenceElement={SCENE_ID} />
      <arcgis-shadow-cast referenceElement={SCENE_ID} />
    </div>
  );
}

export function WeatherTool({ mirrorWeather }) {
  return (
    <div className="tool">
      <ToolIntro>Preview the harbour in fog, rain or snow to rehearse low-visibility operations.</ToolIntro>
      {mirrorWeather && (
        <calcite-notice open kind="info" icon="information" scale="s">
          <div slot="message">
            Live weather mirroring is on and will overwrite manual settings on the next refresh. Turn it off
            in Marine conditions to keep a simulated state.
          </div>
        </calcite-notice>
      )}
      <arcgis-weather referenceElement={SCENE_ID} />
    </div>
  );
}

export function SliceTool() {
  return (
    <div className="tool">
      <ToolIntro>Cut through buildings, sheds and terminal structures to inspect their interiors.</ToolIntro>
      <arcgis-slice referenceElement={SCENE_ID} />
    </div>
  );
}

export function MarkupTool({ markupLayer }) {
  return (
    <div className="tool">
      <ToolIntro>
        Sketch notes on the scene — laydown areas, closures, incident positions. Markup stays in place
        for this session when the panel is closed.
      </ToolIntro>
      <arcgis-sketch referenceElement={SCENE_ID} layer={markupLayer} />
      <calcite-button
        scale="s"
        kind="neutral"
        appearance="outline"
        icon-start="trash"
        onClick={() => markupLayer?.removeAll()}
      >
        Clear all markup
      </calcite-button>
    </div>
  );
}

export function LayersTool() {
  return <arcgis-layer-list referenceElement={SCENE_ID} />;
}

export function LegendTool() {
  return <arcgis-legend referenceElement={SCENE_ID} />;
}

export function BasemapTool() {
  return (
    <div className="tool">
      <ToolIntro>
        Switching basemap replaces the Google photorealistic mesh, which is part of this scene's basemap.
      </ToolIntro>
      <arcgis-basemap-gallery referenceElement={SCENE_ID} />
    </div>
  );
}

export function ViewsTool({ slides, view }) {
  if (!slides.length) return <p className="muted">This scene has no saved views.</p>;
  return (
    <ul className="slides">
      {slides.map((slide) => (
        <li key={slide.id}>
          <button
            type="button"
            className="slides__item"
            onClick={() => slide.applyTo(view, { duration: 1200 }).catch(() => {})}
          >
            {slide.thumbnail?.url && <img src={slide.thumbnail.url} alt="" />}
            <span>{slide.title?.text?.trim() || "Untitled view"}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

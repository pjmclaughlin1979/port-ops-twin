import { useEffect, useState } from "react";
import esriConfig from "@arcgis/core/config.js";
import WebScene from "@arcgis/core/WebScene.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import {
  START_SLIDE_TITLE,
  VESSEL_OUTLINES_LAYER_TITLE,
  VESSELS_LAYER_TITLE,
  WEBSCENE_ITEM_ID,
} from "../config.js";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function installGoogleTilesKey() {
  if (!GOOGLE_MAPS_API_KEY) return;
  if (esriConfig.request.interceptors.some((i) => i.__googleTilesKey)) return;
  // Child tile/texture requests don't reliably inherit the layer's
  // customParameters, so key every request to Google's tile endpoint.
  esriConfig.request.interceptors.push({
    __googleTilesKey: true,
    urls: /tile\.googleapis\.com/,
    before: (params) => {
      params.requestOptions.query = { ...params.requestOptions.query, key: GOOGLE_MAPS_API_KEY };
    },
  });
}

// Google Photorealistic 3D Tiles live in basemap.groundLayers and read
// their key from customParameters. Every slide carries its own basemap
// copy, so those need patching too or switching slides prompts sign-in.
function applyGoogleTilesKey(basemap) {
  basemap?.groundLayers?.forEach((layer) => {
    if (layer.type === "integrated-mesh-3dtiles") {
      layer.customParameters = { ...layer.customParameters, key: GOOGLE_MAPS_API_KEY };
    }
  });
}

const findFeatureLayer = (webscene, title) =>
  webscene.allLayers.find((layer) => layer.type === "feature" && layer.title === title) ?? null;

// Loads the WebScene ourselves (rather than via the component's item-id)
// so the Google key can be applied before any layer views are created,
// then hands it to the <arcgis-scene> element.
export function usePortScene(sceneRef, enabled) {
  const [scene, setScene] = useState({ status: "idle", error: null });

  useEffect(() => {
    const sceneElement = sceneRef.current;
    if (!enabled || !sceneElement) return;
    let cancelled = false;
    setScene({ status: "loading", error: null });

    (async () => {
      try {
        installGoogleTilesKey();
        const webscene = new WebScene({ portalItem: { id: WEBSCENE_ITEM_ID } });
        await webscene.load();
        if (cancelled) return;

        if (GOOGLE_MAPS_API_KEY) {
          applyGoogleTilesKey(webscene.basemap);
          webscene.presentation?.slides?.forEach((slide) => applyGoogleTilesKey(slide.basemap));
        }

        const markupLayer = new GraphicsLayer({ title: "Markup" });
        const zonesLayer = new GraphicsLayer({ title: "Safety zones", listMode: "hide" });
        webscene.addMany([markupLayer, zonesLayer]);

        sceneElement.map = webscene;
        await sceneElement.viewOnReady();
        if (cancelled) return;

        // Show the real sun position rather than the date the scene was
        // authored with (the Sun & shadow tool can still change it).
        sceneElement.view.environment.lighting = { type: "sun", date: new Date() };

        const startViewpoint =
          webscene.presentation?.slides?.find((slide) => slide.title?.text?.trim() === START_SLIDE_TITLE)
            ?.viewpoint ?? null;
        if (startViewpoint) {
          sceneElement.view.goTo(startViewpoint, { duration: 2500 }).catch(() => {});
        }

        setScene({
          status: "ready",
          error: null,
          view: sceneElement.view,
          webscene,
          vesselsLayer: findFeatureLayer(webscene, VESSELS_LAYER_TITLE),
          outlinesLayer: findFeatureLayer(webscene, VESSEL_OUTLINES_LAYER_TITLE),
          markupLayer,
          zonesLayer,
          slides: webscene.presentation?.slides?.toArray() ?? [],
          startViewpoint,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load the port scene", err);
        setScene({ status: "error", error: err?.message ?? "The scene failed to load." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, sceneRef]);

  return scene;
}

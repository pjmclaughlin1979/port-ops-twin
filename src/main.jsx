import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@esri/calcite-components/main.css";
import "@arcgis/core/assets/esri/themes/dark/main.css";
import "./registerComponents.js";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

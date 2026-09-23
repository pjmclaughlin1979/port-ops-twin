import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@esri/calcite-components/main.css";
// Only what the sign-in screen needs; the rest is registered by the
// lazily loaded PortTwin module.
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-notice";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

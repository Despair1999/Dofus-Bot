import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ActivityApp from "./v4/ActivityApp";
import "./styles.css";
const activityParameters = new URLSearchParams(location.search);
const activityMode =
  location.pathname.replace(/\/$/, "") === "/activity" ||
  (activityParameters.has("frame_id") && activityParameters.has("instance_id"));
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {activityMode ? <ActivityApp /> : <App />}
  </React.StrictMode>,
);

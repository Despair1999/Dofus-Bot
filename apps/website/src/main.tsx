import React, { Suspense, lazy, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "./style.css";
import PreviewGate from "./PreviewGate";
import { hasPreviewSession } from "./lib/access";

const App = lazy(() => import("./App"));
const LegalPage = lazy(() => import("./LegalPage").then(m => ({default: m.LegalPage})));

function PreviewApp() {
  const [unlocked, setUnlocked] = useState(hasPreviewSession);
  const path = location.pathname.replace(/\/$/, "") || "/";
  if (["/impressum", "/datenschutz", "/nutzungsbedingungen"].includes(path))
    return <Suspense fallback={<p role="status">Seite wird geladen …</p>}><LegalPage path={path}/></Suspense>;
  return unlocked
    ? <Suspense fallback={<div style={{minHeight:"100dvh",display:"grid",placeItems:"center",color:"#e2c686"}} role="status">Abenteuer wird geladen …</div>}><App /></Suspense>
    : <PreviewGate onUnlock={() => setUnlocked(true)} />;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><PreviewApp /></React.StrictMode>);

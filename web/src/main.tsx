import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installAccess, setAccessCode } from "./access";
import { initialDemo } from "./mode";
import "./styles.css";

installAccess();

// Demo links (#/sample/..., #/settings) are read once on load. Typing a new one into the address bar of an open
// app only fires hashchange, so reload to open that screen. The app itself never writes location.hash.
window.addEventListener("hashchange", () => {
  if (location.hash.startsWith("#/")) location.reload();
});

function AccessGate({ children }: { children: React.ReactNode }) {
  const [needed, setNeeded] = useState(false);
  const [code, setCode] = useState("");
  useEffect(() => {
    const on = () => setNeeded(true);
    window.addEventListener("er-access-needed", on);
    return () => window.removeEventListener("er-access-needed", on);
  }, []);
  if (!needed) return <>{children}</>;
  return (
    <div className="phone">
      <form
        className="gate"
        onSubmit={(e) => {
          e.preventDefault();
          setAccessCode(code.trim());
          location.reload();
        }}
      >
        <h1>Enter access code</h1>
        <p className="sub">This test version is private. Type the code you were given.</p>
        <input
          className="gate-input"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          aria-label="Access code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn" type="submit" disabled={!code.trim()}>Continue</button>
      </form>
    </div>
  );
}

// Close-up library review page (demo mode only): #/closeups, or #/closeups/<id> for one at phone size.
const closeups = location.hash.match(/^#\/closeups(?:\/(\w+))?/);
const CloseUpGallery = React.lazy(() => import("./closeups/gallery"));

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {closeups && (import.meta.env.DEV || initialDemo()) ? (
      <React.Suspense fallback={null}>
        <CloseUpGallery only={closeups[1]} />
      </React.Suspense>
    ) : (
      <AccessGate>
        <App />
      </AccessGate>
    )}
  </React.StrictMode>,
);

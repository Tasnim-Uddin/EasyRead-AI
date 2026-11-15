import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installAccess, setAccessCode } from "./access";
import { initialDemo } from "./mode";
import { t } from "./i18n";
import { RTL_CODES } from "./languages";
import "./styles.css";

installAccess();

// Demo links (#/sample/..., #/settings) are read once on load. Typing a new one into the address bar of an open
// app only fires hashchange, so reload to open that screen. The app itself never writes location.hash.
window.addEventListener("hashchange", () => {
  if (location.hash.startsWith("#/")) location.reload();
});

/** The language chosen before (App saves it as JSON under er.lang), so the access gate speaks it too. */
function savedLang(): string {
  try {
    const v = localStorage.getItem("er.lang");
    return v ? String(JSON.parse(v)) : "en";
  } catch {
    return "en";
  }
}

function AccessGate({ children }: { children: React.ReactNode }) {
  const [needed, setNeeded] = useState(false);
  const [code, setCode] = useState("");
  useEffect(() => {
    const on = () => setNeeded(true);
    window.addEventListener("er-access-needed", on);
    return () => window.removeEventListener("er-access-needed", on);
  }, []);
  if (!needed) return <>{children}</>;
  const lang = savedLang();
  return (
    <div className="phone" dir={RTL_CODES.has(lang) ? "rtl" : "ltr"} lang={lang}>
      <form
        className="gate"
        onSubmit={(e) => {
          e.preventDefault();
          setAccessCode(code.trim());
          location.reload();
        }}
      >
        <h1>{t(lang, "gateTitle")}</h1>
        <p className="sub">{t(lang, "gateSub")}</p>
        <input
          className="gate-input"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          aria-label={t(lang, "gateLabel")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn" type="submit" disabled={!code.trim()}>{t(lang, "gateGo")}</button>
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

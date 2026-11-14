import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installAccess, setAccessCode } from "./access";
import "./styles.css";

installAccess();

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

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AccessGate>
      <App />
    </AccessGate>
  </React.StrictMode>,
);

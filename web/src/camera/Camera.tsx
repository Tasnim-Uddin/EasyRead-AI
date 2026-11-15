/**
 * In-app camera (Figma 02a/02b) with a live paper outline, plus the camera permission screens (16b/16c).
 * The rear camera streams into a full-screen <video>; ~10 times a second a 224 px copy of the frame goes through the
 * dependency-free detector. The shutter draws the full-resolution frame to a canvas (iOS has no ImageCapture).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { t, tf } from "../i18n";
import { detectQuad, type Quad } from "./detect";
import { pixelsOf } from "./image";
import { CIcon } from "./icons";
import { Steady, normalise } from "./quad";
import "./capture.css";
import "./strings";

type CamState = "checking" | "ask" | "starting" | "live" | "denied" | "unavailable";

export interface Shot {
  file: File;
  url: string;
  /** The live outline at the moment of the shot (normalised), as a first guess for the crop screen. */
  guess: Quad | null;
}

const ASKED_KEY = "er.camAsked";
const AUTO_KEY = "er.autoShot";
const load = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const store = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: fine */
  }
};

interface CameraProps {
  lang: string;
  /** Pages already added (tray + waiting to be checked). */
  pages: number;
  thumb?: string | null;
  /** `more`: "Add another page" (stay in the camera); otherwise go on to check this photo. */
  onShot: (shot: Shot, more: boolean) => void;
  onClose: () => void;
  /** Pages so far: the page counter is a button to them. */
  onPages?: () => void;
  onPhotos: () => void;
  onSystemCamera: () => void;
}

export function CameraScreen({ lang, pages, thumb, onShot, onClose, onPages, onPhotos, onSystemCamera }: CameraProps) {
  const [state, setState] = useState<CamState>("checking");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [steady, setSteady] = useState(false);
  const [dims, setDims] = useState<[number, number]>([1080, 1920]);
  const [auto, setAuto] = useState(() => load(AUTO_KEY) === "1");
  const [flash, setFlash] = useState(false);
  const quadRef = useRef<Quad | null>(null);
  const dimsRef = useRef<[number, number]>([1080, 1920]);
  const busyRef = useRef(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      store(ASKED_KEY, "1");
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.setAttribute("playsinline", "true");
        v.muted = true;
        await v.play().catch(() => undefined);
      }
      setState("live");
    } catch (e) {
      const name = (e as DOMException)?.name;
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
    }
  }, []);

  // First visit: explain why we want the camera (16b) before the phone asks. Already allowed: open straight away.
  useEffect(() => {
    let gone = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setState("unavailable");
      let perm: PermissionState | null = null;
      try {
        perm = (await navigator.permissions?.query({ name: "camera" as PermissionName }))?.state ?? null;
      } catch {
        perm = null;
      }
      if (gone) return;
      if (perm === "denied") setState("denied");
      else if (perm === "granted" || load(ASKED_KEY)) void start();
      else setState("ask");
    })();
    return () => {
      gone = true;
      stop();
    };
  }, [start, stop]);

  // Live outline: a small copy of the frame through the detector, about 10 times a second.
  useEffect(() => {
    if (state !== "live") return;
    const canvas = document.createElement("canvas");
    const st = new Steady(0.025, 600);
    let last = 0;
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 100) return;
      last = now;
      const v = videoRef.current;
      if (!v || v.readyState < 2 || !v.videoWidth) return;
      if (dimsRef.current[0] !== v.videoWidth || dimsRef.current[1] !== v.videoHeight) {
        dimsRef.current = [v.videoWidth, v.videoHeight];
        setDims(dimsRef.current);
      }
      const px = pixelsOf(v, v.videoWidth, v.videoHeight, 224, canvas);
      const r = detectQuad(px, 224);
      const q = r.found ? normalise(r.corners, px.width, px.height) : null;
      quadRef.current = q;
      setQuad(q);
      const s = st.push(q, now);
      setSteady(s);
      if (s && autoRef.current && !busyRef.current) void shoot(false);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const autoRef = useRef(auto);
  autoRef.current = auto;

  async function shoot(more: boolean) {
    const v = videoRef.current;
    if (!v || !v.videoWidth || busyRef.current) return;
    busyRef.current = true;
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    try {
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
      if (!blob) return;
      const file = new File([blob], `page-${Date.now()}.jpg`, { type: "image/jpeg" });
      if (!more) stop();
      onShot({ file, url: URL.createObjectURL(file), guess: quadRef.current }, more);
    } finally {
      // A short pause so auto-capture never takes the same page twice.
      setTimeout(() => (busyRef.current = false), more ? 900 : 0);
    }
  }

  function close() {
    stop();
    onClose();
  }

  if (state === "ask") return <PermissionAsk lang={lang} onYes={() => void start()} onNo={() => setState("denied")} onHome={close} />;
  if (state === "denied" || state === "unavailable")
    return <PermissionOff lang={lang} unavailable={state === "unavailable"} onPhotos={onPhotos} onSystemCamera={onSystemCamera} onHome={close} />;

  const [vw, vh] = dims;
  const pts = quad?.map(([x, y]) => `${x * vw},${y * vh}`).join(" ");
  const L = Math.min(vw, vh) * 0.07; // corner bracket length
  return (
    <div className="cam-screen">
      <div className="cam-top">
        <button className="cam-round" onClick={close} aria-label={t(lang, "camClose")}>
          <CIcon name="x" />
        </button>
        <h1>{t(lang, "camTitle")}</h1>
        <span className="cam-pill">{tf(lang, "camPage", { n: pages + 1 })}</span>
      </div>
      <div className="cam-view">
        <video ref={videoRef} playsInline muted autoPlay />
        <svg className="cam-overlay" viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {quad && pts ? (
            <g className={"cam-quad" + (steady ? " steady" : "")}>
              <polygon points={pts} />
              {quad.map(([x, y], i) => {
                const p = quad[(i + 3) % 4], n = quad[(i + 1) % 4];
                const dir = (a: number[], b: number[]) => {
                  const dx = (b[0] - a[0]) * vw, dy = (b[1] - a[1]) * vh, d = Math.hypot(dx, dy) || 1;
                  return [(dx / d) * L, (dy / d) * L];
                };
                const [ax, ay] = dir([x, y], p), [bx, by] = dir([x, y], n);
                const cx = x * vw, cy = y * vh;
                return <path key={i} className="cam-corner" d={`M${cx + ax},${cy + ay}L${cx},${cy}L${cx + bx},${cy + by}`} />;
              })}
            </g>
          ) : (
            <g className="cam-box">
              <rect x={vw * 0.12} y={vh * 0.1} width={vw * 0.76} height={vh * 0.72} rx={8} />
            </g>
          )}
        </svg>
        {state !== "live" && <p className="cam-starting">{t(lang, "camStarting")}</p>}
        {flash && <div className="cam-flash" />}
        {state === "live" && (
          <p className={"cam-hint" + (steady ? " ok" : "")} role="status" aria-live="polite">
            {steady && <CIcon name="check" />}
            {t(lang, steady ? "camGotIt" : "camFit")}
          </p>
        )}
      </div>
      <div className="cam-bottom">
        <button className="cam-side" onClick={onPages} disabled={!onPages || pages === 0} aria-label={pages === 1 ? t(lang, "camOnePage") : tf(lang, "camPages", { n: pages })}>
          <span className="cam-thumb">
            {thumb ? <img src={thumb} alt="" /> : <i />}
            {pages > 0 && <b>{pages}</b>}
          </span>
          <span>{pages === 1 ? t(lang, "camOnePage") : tf(lang, "camPages", { n: pages })}</span>
        </button>
        <button className={"cam-shutter" + (steady ? " ready" : "")} onClick={() => void shoot(false)} disabled={state !== "live"} aria-label={t(lang, "camShutter")}>
          <i />
          <span>{t(lang, "camShutter")}</span>
        </button>
        <button className="cam-side" onClick={() => void shoot(true)} disabled={state !== "live"}>
          <span className="cam-plus">
            <CIcon name="plus" />
          </span>
          <span>{t(lang, "camAddPage")}</span>
        </button>
      </div>
      <label className="cam-auto">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => {
            setAuto(e.target.checked);
            store(AUTO_KEY, e.target.checked ? "1" : "0");
          }}
        />
        {t(lang, "camAuto")}
      </label>
    </div>
  );
}

/* ---------- 16b. may I use the camera? ---------- */
function PermissionAsk({ lang, onYes, onNo, onHome }: { lang: string; onYes: () => void; onNo: () => void; onHome: () => void }) {
  return (
    <div className="screen cap-screen">
      <div className="cap-top">
        <button className="cap-round" onClick={onHome} aria-label={t(lang, "backHome")}>
          <CIcon name="home" />
        </button>
      </div>
      <div className="perm-center">
        <div className="perm-halo">
          <span>
            <CIcon name="camera" size={40} />
          </span>
        </div>
        <h1>{t(lang, "permTitle")}</h1>
        <p>{t(lang, "permBody")}</p>
      </div>
      <div className="cap-foot">
        <button className="btn" onClick={onYes}>
          <CIcon name="check" />
          {t(lang, "permYes")}
        </button>
        <button className="btn cap-ghost" onClick={onNo}>
          {t(lang, "permNotNow")}
        </button>
        <p className="cap-note">{t(lang, "permNext")}</p>
      </div>
    </div>
  );
}

/* ---------- 16c. camera refused (or not available) ---------- */
function PermissionOff({ lang, unavailable, onPhotos, onSystemCamera, onHome }: { lang: string; unavailable: boolean; onPhotos: () => void; onSystemCamera: () => void; onHome: () => void }) {
  return (
    <div className="screen cap-screen">
      <div className="cap-top">
        <button className="cap-round" onClick={onHome} aria-label={t(lang, "backHome")}>
          <CIcon name="home" />
        </button>
      </div>
      <h1 className="cap-h1">{t(lang, "offTitle")}</h1>
      <p className="cap-sub">{t(lang, unavailable ? "offNoCam" : "offBody")}</p>
      <div className="off-card">
        <div className="off-row">
          <span className="off-ic">
            <CIcon name="camoff" />
          </span>
          <b>{t(lang, "camOff")}</b>
        </div>
        <button className="btn" onClick={onPhotos}>
          <CIcon name="image" />
          {t(lang, "photosInstead")}
        </button>
        <button className="btn cap-ghost" onClick={onSystemCamera}>
          <CIcon name="camera" />
          {t(lang, "phoneCamera")}
        </button>
      </div>
      <button className="btn cap-ghost" onClick={onHome}>
        <CIcon name="home" />
        {t(lang, "backHome")}
      </button>
      {!unavailable && <p className="cap-note">{t(lang, "offHow")}</p>}
    </div>
  );
}

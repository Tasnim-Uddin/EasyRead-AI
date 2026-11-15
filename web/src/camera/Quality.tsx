/** Photo check (Figma 17a): shown after the corners are set when the server's photo check found a problem. */
import type { ScanResult } from "../types";
import { t } from "../i18n";
import type { Quad } from "./detect";
import { CIcon } from "./icons";
import "./capture.css";
import "./strings";

type Issue = ScanResult["quality"]["issues"][number];

/** Title, body, "here" label and chip for each problem, most important first. */
const ISSUES: Record<Issue, { title: string; body: string; here: string; chip?: string; icon: string }> = {
  small: { title: "qSmallT", body: "qSmallB", here: "hereBlurry", icon: "blur" },
  blurry: { title: "qBlurryT", body: "qBlurryB", here: "hereBlurry", chip: "chipBlurry", icon: "blur" },
  dark: { title: "qDarkT", body: "qDarkB", here: "hereDark", chip: "chipDark", icon: "moon" },
  cut_off: { title: "qCutT", body: "qCutB", here: "hereCut", chip: "chipCut", icon: "crop" },
  glare: { title: "qGlareT", body: "qGlareB", here: "hereGlare", chip: "chipGlare", icon: "sun" },
  low_contrast: { title: "qFaintT", body: "qFaintB", here: "hereDark", chip: "chipDark", icon: "moon" },
};
const ORDER: Issue[] = ["small", "blurry", "cut_off", "dark", "glare", "low_contrast"];
const CHIPS: Issue[] = ["blurry", "dark", "cut_off", "glare"];

/** The problem to talk about first. */
export function mainIssue(issues: Issue[]): Issue | null {
  return ORDER.find((i) => issues.includes(i)) ?? null;
}

interface QualityProps {
  lang: string;
  url: string;
  quad: Quad;
  quality: ScanResult["quality"];
  onRetake: () => void;
  onUseAnyway: () => void;
  onHome: () => void;
}

export function QualityScreen({ lang, url, quad, quality, onRetake, onUseAnyway, onHome }: QualityProps) {
  const main = mainIssue(quality.issues) ?? "blurry";
  const info = ISSUES[main];
  // Where to draw the dashed "problem here" box: the glare region when known, else the paper itself.
  const xs = quad.map((p) => p[0]), ys = quad.map((p) => p[1]);
  const box = quality.region ?? [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  const showBox = main !== "dark" && main !== "low_contrast";
  const has = (i: Issue) => quality.issues.includes(i) || (i === "dark" && quality.issues.includes("low_contrast"));
  return (
    <div className="screen cap-screen q-screen">
      <div className="cap-top">
        <button className="cap-round" onClick={onHome} aria-label={t(lang, "backHome")}>
          <CIcon name="home" />
        </button>
      </div>
      <h1 className="cap-h1">{t(lang, info.title)}</h1>
      <p className="cap-sub">{t(lang, quality.block ? "qBlocked" : info.body)}</p>
      <div className="q-photo">
        <div className="q-frame">
          <img src={url} alt="" />
          {showBox && (
            <div className="q-box" style={{ left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${box[2] * 100}%`, height: `${box[3] * 100}%` }}>
              <span className="q-here">
                <CIcon name={info.icon} size={16} />
                {t(lang, info.here)}
              </span>
            </div>
          )}
        </div>
      </div>
      <p className="q-also">{t(lang, "alsoCheck")}</p>
      <ul className="q-chips">
        {CHIPS.map((c) => (
          <li key={c} className={has(c) ? "on" : ""}>
            <CIcon name={ISSUES[c].icon} size={18} />
            {t(lang, ISSUES[c].chip!)}
            {has(c) && ` ${t(lang, "thisOne")}`}
          </li>
        ))}
      </ul>
      <div className="cap-foot">
        <button className="btn" onClick={onRetake}>
          <CIcon name="camera" />
          {t(lang, "retakePhoto")}
        </button>
        {!quality.block && (
          <button className="cap-link" onClick={onUseAnyway}>
            {t(lang, "useAnyway")}
          </button>
        )}
      </div>
    </div>
  );
}

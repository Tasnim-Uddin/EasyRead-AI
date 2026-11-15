import { t } from "../i18n";
import Icon from "../icons";
import "./nav.css";

/**
 * The start of every top bar, the same on every screen: Home first (the very top-left corner), then the
 * back arrow to the previous screen. The whole bar mirrors in RTL (Home top-right there), nothing else moves.
 * `look` matches the bar's own round buttons (the plain screens or the guide stage).
 */
export function NavStart({ lang, onHome, onBack, backLabel, look = "round" }: { lang: string; onHome?: () => void; onBack?: () => void; backLabel?: string; look?: "round" | "gs-round" }) {
  if (!onHome && !onBack) return null;
  return (
    <div className="nav-start">
      {onHome && (
        <button type="button" className={look + " nav-home"} onClick={onHome} aria-label={t(lang, "home")} title={t(lang, "home")}>
          <Icon name="home" />
        </button>
      )}
      {onBack && (
        <button type="button" className={look + " nav-back" + (backLabel ? " back-named" : "")} onClick={onBack} aria-label={backLabel ?? t(lang, "back2")} title={backLabel ?? t(lang, "back2")}>
          <Icon name="back" />
          {backLabel && <span>{backLabel}</span>}
        </button>
      )}
    </div>
  );
}

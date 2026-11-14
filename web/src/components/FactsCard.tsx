import type { Facts } from "../types";
import { t } from "../i18n";

const DEVICE_NAMES: Record<string, string> = {
  inhaler_mdi: "Inhaler (shake, press, breathe in slowly)",
  inhaler_mdi_spacer: "Inhaler with spacer",
  inhaler_dry_powder: "Dry-powder inhaler (do not shake)",
  cream_ointment: "Cream or ointment",
  tablets: "Tablets",
  eye_drops: "Eye drops",
  nasal_spray: "Nasal spray",
};

// Shows what was read from the document. Low device confidence or unreadable parts are
// said out loud rather than guessed (AGENTS.md ground rules).
export default function FactsCard({ facts, lang }: { facts: Facts; lang: string }) {
  const known = facts.device_type !== "unknown" && facts.device_confidence >= 0.6;
  return (
    <section className="card facts">
      {facts.medicine && (
        <p>
          <strong>{t(lang, "medicine")}:</strong> {facts.medicine}
        </p>
      )}
      {facts.dose && (
        <p>
          <strong>{t(lang, "dose")}:</strong> {facts.dose}
        </p>
      )}
      {facts.frequency && (
        <p>
          <strong>{t(lang, "when")}:</strong> {facts.frequency}
        </p>
      )}
      <p>
        <strong>{t(lang, "yourDevice")}:</strong>{" "}
        {known ? (
          <>
            {DEVICE_NAMES[facts.device_type] ?? facts.device_type}{" "}
            <span className="note">({Math.round(facts.device_confidence * 100)}%)</span>
          </>
        ) : (
          t(lang, "notSure")
        )}
      </p>
      {facts.unreadable.length > 0 && (
        <p className="banner" role="alert">
          {t(lang, "unreadable")} {facts.unreadable.join("; ")}
        </p>
      )}
    </section>
  );
}

import type { Guide } from "../types";
import { t } from "../i18n";
import { safetyLines } from "./summary";

export function PrintSheet({ guide, lang }: { guide: Guide; lang: string }) {
  return (
    <div className="print-sheet">
      <h1>{guide.facts?.medicine ?? guide.facts?.title ?? t(lang, "sheetTitle")}</h1>
      <ol>
        {guide.steps.map((s) => (
          <li key={s.index} className={s.kind === "warning" || s.kind === "get_help" ? "warn" : ""}>
            <b>{s.index + 1}</b>
            {s.image_url && <img src={s.image_url} alt="" />}
            <span dir="auto">{s.text}</span>
          </li>
        ))}
      </ol>
      <p dir="auto">{safetyLines(guide, lang).join(" ")}</p>
      {guide.source.is_sample && <p>{t(lang, "printSample")}</p>}
    </div>
  );
}

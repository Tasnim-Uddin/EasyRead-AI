import type { ToolLogEntry } from "../types";
import { t } from "../i18n";

// Prize evidence: the Anam "tool-call log in a dev panel" (AGENTS.md prize table).
export default function DevPanel({ log, lang }: { log: ToolLogEntry[]; lang: string }) {
  return (
    <details className="devpanel">
      <summary>
        {t(lang, "devPanel")} ({log.length})
      </summary>
      <ol>
        {log.map((e, i) => (
          <li key={i}>
            <span className="tag">{e.source}</span> <code>{e.tool}</code>({JSON.stringify(e.args)}) · {e.ms} ms
            {e.say && <div className="say">→ {e.say}</div>}
          </li>
        ))}
      </ol>
    </details>
  );
}

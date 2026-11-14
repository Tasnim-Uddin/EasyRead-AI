import type { AnamState } from "../useAnam";
import { t } from "../i18n";

interface Props {
  state: AnamState;
  error: string | null;
  lang: string;
  caption: string;
  question: string;
  onQuestion: (q: string) => void;
  onAsk: (e: React.FormEvent) => void;
  answer: string | null;
  onStart: () => void;
  onStop: () => void;
}

export const AVATAR_VIDEO_ID = "anam-video";

export default function AvatarPanel(p: Props) {
  return (
    <section className="card avatar">
      <p className="avatar-name">
        <span className={"live" + (p.state === "live" ? " on" : "")} /> {t(p.lang, "guideName")}
      </p>
      <div className="avatar-stage">
        <video id={AVATAR_VIDEO_ID} autoPlay playsInline />
        {p.state !== "live" && (
          <div className="avatar-cover">
            <button className="btn primary big" onClick={p.onStart} disabled={p.state === "connecting"}>
              {p.state === "connecting" ? "…" : `🎙 ${t(p.lang, "talk")}`}
            </button>
            {p.state === "error" && (
              <p className="note" role="alert">
                Could not start the avatar{p.error ? `: ${p.error}` : ""}. You can still use the steps.
              </p>
            )}
          </div>
        )}
        {p.state === "live" && (
          <button className="btn stop" onClick={p.onStop}>
            End
          </button>
        )}
      </div>

      {p.caption && (
        <div className="bubble" aria-live="polite">
          <small>{t(p.lang, "captions")}</small>
          <p>{p.caption}</p>
        </div>
      )}

      <form className="askbox" onSubmit={p.onAsk}>
        <label>
          <strong>{t(p.lang, "askMe")}</strong>
          <input value={p.question} placeholder={t(p.lang, "typeQ")} onChange={(e) => p.onQuestion(e.target.value)} />
        </label>
        {p.answer && <p className="answer">{p.answer}</p>}
      </form>
    </section>
  );
}

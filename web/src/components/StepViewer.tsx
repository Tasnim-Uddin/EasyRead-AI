import type { Clip, Guide, Step } from "../types";
import { t } from "../i18n";
import { speak } from "../speech";

interface Props {
  guide: Guide;
  index: number;
  lang: string;
  clips: Clip[];
  playClip: boolean;
  onIndex: (i: number) => void;
  onWatch: () => void;
}

function Picture({ step }: { step: Step }) {
  if (step.image_url) {
    // Pictures carry no words, so they work in every language.
    return <img className="picture" src={step.image_url} alt="" />;
  }
  return (
    <div className="picture placeholder" aria-hidden="true">
      {step.status === "failed" ? "!" : <span className="spinner" />}
    </div>
  );
}

export default function StepViewer({ guide, index, lang, clips, playClip, onIndex, onWatch }: Props) {
  const step = guide.steps[index];
  if (!step) return null;
  const total = guide.steps.length;
  const clip = step.technique_clip_id ? clips.find((c) => c.id === step.technique_clip_id) : undefined;

  return (
    <section className="card viewer" aria-live="polite">
      <div className="stephead">
        <p className="stepno">
          {t(lang, "step")} {index + 1} {t(lang, "of")} {total}
        </p>
        <div className="progress" aria-hidden="true">
          {guide.steps.map((s) => (
            <button
              key={s.index}
              className={"seg" + (s.index <= index ? " on" : "")}
              onClick={() => onIndex(s.index)}
              tabIndex={-1}
            />
          ))}
        </div>
      </div>

      <Picture step={step} />
      <p className={`steptext kind-${step.kind}`}>{step.text}</p>
      <button className="btn pill" onClick={() => void speak(step.text, lang)}>
        🔊 {t(lang, "listenAgain")}
      </button>

      {step.kind === "how" && (
        <div className="clipbox">
          <button className="btn pill" onClick={onWatch}>
            ▶ {t(lang, "watch")}
          </button>
          {clip ? (
            <video
              key={clip.id + playClip}
              src={clip.video_url}
              poster={clip.poster_url}
              controls
              loop
              muted
              playsInline
              autoPlay={playClip}
              aria-label={clip.caption_en}
            />
          ) : (
            <p className="note">{t(lang, "noClip")}</p>
          )}
        </div>
      )}

      <div className="row nav">
        <button className="btn" onClick={() => onIndex(Math.max(0, index - 1))} disabled={index === 0}>
          ← {t(lang, "back")}
        </button>
        <button
          className="btn primary"
          onClick={() => onIndex(Math.min(total - 1, index + 1))}
          disabled={index >= total - 1}
        >
          {t(lang, "next")} →
        </button>
      </div>
    </section>
  );
}

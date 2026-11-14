import type { AnamState } from "../useAnam";

interface Props {
  state: AnamState;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
}

export const AVATAR_VIDEO_ID = "anam-video";

export default function AvatarPanel({ state, error, onStart, onStop }: Props) {
  return (
    <section className="card avatar">
      <video id={AVATAR_VIDEO_ID} autoPlay playsInline />
      {state !== "live" && (
        <div className="avatar-cover">
          <button className="btn primary big" onClick={onStart} disabled={state === "connecting"}>
            {state === "connecting" ? "Connecting…" : "🎙 Talk to the guide"}
          </button>
          {state === "error" && (
            <p className="note" role="alert">
              Could not start the avatar{error ? `: ${error}` : ""}. You can still use the steps.
            </p>
          )}
        </div>
      )}
      {state === "live" && (
        <button className="btn stop" onClick={onStop}>
          End
        </button>
      )}
    </section>
  );
}

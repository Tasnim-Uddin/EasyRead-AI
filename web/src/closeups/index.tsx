/**
 * Close-up library: small animated pictures that show one action (shake an inhaler, sign here, pay by card).
 * The server picks one per step (agent/visuals.py -> step.visual = { kind: "closeup", id }); ids.json is shared by
 * both sides. Each close-up fills its box (358 x 380 card, `slice`), loops while `playing`, and shows a still frame
 * when not playing or when the user prefers less motion. No words inside, and never mirrored for RTL.
 */
import React, { useEffect, useState } from "react";
import ids from "./ids.json";
import "./closeups.css";
import { C } from "./parts";
import * as M from "./medicine";
import * as P from "./papers";

export const CLOSEUP_IDS: readonly string[] = ids;

const ART: Record<string, () => React.ReactElement> = {
  inhaler_cap_off: M.InhalerCapOff,
  inhaler_shake: M.InhalerShake,
  inhaler_breathe_out: M.InhalerBreatheOut,
  inhaler_press_breathe_in: M.InhalerPressBreatheIn,
  inhaler_hold_breath: M.InhalerHoldBreath,
  inhaler_wait: M.InhalerWait,
  inhaler_cap_on: M.InhalerCapOn,
  spacer_use: M.SpacerUse,
  tablet_with_water: M.TabletWithWater,
  eye_drops: M.EyeDrops,
  liquid_measure_spoon: M.LiquidMeasureSpoon,
  cream_apply: M.CreamApply,
  rinse_mouth: M.RinseMouth,
  write_in_box: P.WriteInBox,
  sign_here: P.SignHere,
  tick_box: P.TickBox,
  pay_card: P.PayCard,
  pay_bank: P.PayBank,
  phone_call: P.PhoneCall,
  go_online: P.GoOnline,
  calendar_date: P.CalendarDate,
  post_letter: P.PostLetter,
  bring_document: P.BringDocument,
  keep_safe: P.KeepSafe,
  clock_wait: P.ClockWait,
  screwdriver_turn: P.ScrewdriverTurn,
  plug_in: P.PlugIn,
};

/** True when the library has a drawing for this id. */
export function hasCloseUp(id: string | null | undefined): boolean {
  return !!id && Object.prototype.hasOwnProperty.call(ART, id);
}

function useReducedMotion(): boolean {
  const q = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/**
 * Renders the close-up for `id` (nothing for an unknown id). Size it with CSS on the parent or `className`;
 * the SVG fills its box and crops like `object-fit: cover`.
 */
export function CloseUp({ id, playing, className }: { id: string; playing: boolean; className?: string }) {
  const reduced = useReducedMotion();
  const Art = hasCloseUp(id) ? ART[id] : null;
  if (!Art) return null;
  const on = playing && !reduced;
  return (
    <svg
      className={`closeup${on ? " cu-on" : ""}${className ? ` ${className}` : ""}`}
      data-closeup={id}
      viewBox="0 0 358 380"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="358" height="380" fill={C.bg} />
      <Art />
    </svg>
  );
}

export default CloseUp;

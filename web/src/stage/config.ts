/**
 * Stage feature flags.
 *
 * SHOW_CHECK: "Check I've got it" (the tell-back quiz) is hidden for now. All its code stays; add `?check=1` to the
 * URL (remembered for this visit) to bring the button back for development. The guide's own offer of the check is
 * switched on server-side with EASYREAD_SHOW_CHECK=1 (agent/persona.py).
 */
function fromUrl(name: string): boolean {
  try {
    const q = new URLSearchParams(location.search).get(name);
    if (q !== null) {
      const on = q !== "0" && q !== "false";
      try {
        if (on) sessionStorage.setItem("er." + name, "1");
        else sessionStorage.removeItem("er." + name);
      } catch {
        /* storage blocked: this page only */
      }
      return on;
    }
    return sessionStorage.getItem("er." + name) === "1";
  } catch {
    return false;
  }
}

export const SHOW_CHECK: boolean = fromUrl("check");

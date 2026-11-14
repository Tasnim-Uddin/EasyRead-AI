// Optional access gate for shared test builds. The server answers 401 on /api/* when ACCESS_CODE is set.
// The code comes from the link (/?code=... or /#code), is kept in localStorage, is sent as X-Access-Code on every
// /api request, and is mirrored into the er_access cookie so EventSource, <img> and <audio> requests (which cannot
// set headers) are let through too.
const KEY = "er.access";

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAccessCode(code: string) {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* storage blocked: the cookie below still works */
  }
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `er_access=${encodeURIComponent(code)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
}

/** Call once at start-up: picks the code out of the link, then wraps fetch. */
export function installAccess() {
  const hash = location.hash.replace(/^#\/?(code=)?/, "");
  const query = new URLSearchParams(location.search).get("code");
  const fromLink = query || (/^[\w-]{3,64}$/.test(hash) ? hash : "");
  if (fromLink) {
    setAccessCode(fromLink);
    history.replaceState(null, "", location.pathname); // keep the code out of the address bar and history
  } else if (read()) {
    setAccessCode(read());
  }
  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!/^(https?:\/\/[^/]+)?\/api\//.test(url)) return orig(input, init);
    const code = read();
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (code) headers.set("X-Access-Code", code);
    const res = await orig(input, { ...init, headers });
    if (res.status === 401) window.dispatchEvent(new Event("er-access-needed"));
    return res;
  };
}

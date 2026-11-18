// Accounts through Supabase Auth, by plain requests (no library).
//   - Every player starts with a silent guest account (anonymous sign-in) kept in this browser.
//   - google() and email() attach a Google account or an email address to that same account, so the profile
//     is kept and can be opened on any device. If the Google account or email already has a profile, the
//     player is signed in to that one instead.
//   - Both come back to the game with the new sign-in in the address's # part; consume() picks it up.
// When the server has no accounts set up (your own machine), access() returns null and the game uses display names only.
const KEY = "powerplay-auth";

export function createAuth(api) {
  let config = null, session = null, pending = null;
  try { session = JSON.parse(localStorage.getItem(KEY)); } catch {}
  const now = () => Date.now() / 1000;
  const keep = s => { session = s; try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch {} };
  const supabase = async () => (config ??= await fetch(`${api}/api/config`).then(r => r.json()).catch(() => ({}))).supabase ?? null;
  const here = () => encodeURIComponent(location.origin + location.pathname);   // where Google and email links send the player back to

  async function req(path, { method = "POST", body, bearer } = {}) {
    const sb = await supabase();
    const r = await fetch(`${sb.url}/auth/v1/${path}`, { method, headers: { apikey: sb.key, "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: body && JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.msg || j.error_description || j.message || "That did not work. Try again."), { code: j.error_code ?? "", status: r.status });
    return j;
  }
  async function fresh() {
    if (!(await supabase())) return null;
    const stored = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
    session = stored() ?? session;   // another tab may already have renewed the sign-in
    if (session?.access_token && session.expires_at - 60 > now()) return session.access_token;
    let next = null;
    if (session?.refresh_token) {
      const used = session.refresh_token;
      try { next = await req("token?grant_type=refresh_token", { body: { refresh_token: used } }); }
      catch (e) {
        const other = stored();
        if (other?.refresh_token && other.refresh_token !== used) { session = other; return fresh(); }   // another tab renewed it first: use theirs
        // A dropped connection or a busy service says nothing about the account. Keep the sign-in and say so: starting a
        // new guest account here would silently swap the player for a stranger and hide every room and record they have.
        if (!e.status || e.status >= 500 || e.status === 429) throw new Error("Could not reach the sign-in service. Check your connection and try again.");
      }   // only a sign-in the service itself refuses falls through to a new guest
    }
    next ??= await req("signup", { body: {} }).catch(() => { throw new Error("Could not start your guest account. Check your connection and try again."); });   // no email or phone: a guest
    keep({ access_token: next.access_token, refresh_token: next.refresh_token, expires_at: next.expires_at ?? now() + (next.expires_in ?? 3600) });
    return session.access_token;
  }
  const access = () => (pending ??= fresh().finally(() => { pending = null; }));   // one at a time, so two callers never both sign up

  return {
    access,
    enabled: async () => !!(await supabase()),
    emailOn: async () => { await supabase(); return !!config.email; },   // off until the server has a mail service (EMAIL_SIGNIN=on)
    me: async () => req("user", { method: "GET", bearer: await access() }),   // { id, email, is_anonymous, ... }
    // Back from Google or an email link? Returns { ok } or { error, code }, or null when this is an ordinary visit.
    consume() {
      const h = new URLSearchParams(location.hash.slice(1));
      if (!h.get("access_token") && !h.get("error")) return null;
      history.replaceState(null, "", location.pathname);
      if (h.get("error")) return { error: h.get("error_description") ?? "Sign-in failed.", code: h.get("error_code") ?? "" };
      keep({ access_token: h.get("access_token"), refresh_token: h.get("refresh_token"), expires_at: +h.get("expires_at") || now() + (+h.get("expires_in") || 3600) });
      return { ok: true };
    },
    // attach: true adds Google to the current (guest) account; false signs in to whichever account Google already has
    async google(attach = true) {
      const sb = await supabase();
      if (!attach) return void (location.href = `${sb.url}/auth/v1/authorize?provider=google&redirect_to=${here()}`);
      try {
        const j = await req(`user/identities/authorize?provider=google&redirect_to=${here()}&skip_http_redirect=true`, { method: "GET", bearer: await access() });
        location.href = j.url;
      } catch (e) {
        if (!/manual linking/i.test(e.message)) throw e;
        location.href = `${sb.url}/auth/v1/authorize?provider=google&redirect_to=${here()}`;   // linking is switched off in Supabase: a plain sign-in still works, but the guest's records are not carried over
      }
    },
    // Sends a link. "saved": the address was added to this account. "signin": the address already had a profile, the link opens that one.
    async email(address) {
      try { await req(`user?redirect_to=${here()}`, { method: "PUT", bearer: await access(), body: { email: address } }); return "saved"; }
      catch (e) {
        if (!/already|exists|registered/i.test(`${e.message} ${e.code}`)) throw e;
        await req(`otp?redirect_to=${here()}`, { body: { email: address, create_user: false } });
        return "signin";
      }
    },
    async signOut() { const a = session?.access_token; keep(null); if (a) await req("logout", { bearer: a }).catch(() => {}); },
  };
}

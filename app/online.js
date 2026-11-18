// Multiplayer screens. The server (server/rooms.mjs) owns the room; this file shows the latest view it sent
// and turns clicks into requests. Shared drawing helpers come from app.js through `ctx`.
import { SQUAD, MAX_OVERSEAS, MIN_BOWLERS, needs, blockReason, openSlots, swap, chemistry, shifts } from "./rules.mjs";
import { grade } from "./story.mjs";
import { createAuth } from "./auth.js";

export function createOnline(ctx) {
  const { data, card, playerCard, icon, esc, ovr, place, side, nameParts, openSheet, closeSheet, inspect, resultRow, scorecard, render, ordinal, allPacks, roster, draftAside, xiButton, swapRows, planEditor, attackEditor, slotHead, reviewSheet, scoutReport, matchups, league, post: matchPost, chemLine, badge, traits, cabinet, tray, slotRow, placed, clubCrest, balanceReport, styleNudge } = ctx;
  const club = () => ctx.club();
  const GOOGLE = `<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;   // Google's own mark, as its sign-in branding asks
  let room = null, stream = null, error = "", seenDay = -1, copied = false, mode = "h2h", typed = null, swapFrom = null, planTab = "home", myRooms = [], note = "", scoutOpp = null, allRooms = false, bowlTab = "", quiet = false, chatOpen = false, chatRead = 0;
  // the ways to play; the server (MODES in server/rooms.mjs) enforces the sizes
  const MODES = [["h2h", "sword", "Head to head", "1 v 1", "Two of you, one draft, best of five. No excuses and no net run rate."],
    ["mini", "users-three", "Mini league", "2 to 4 players", "Four teams, home and away, then a final. All-time XIs fill any empty chairs."],
    ["league", "trophy", "Full league", "Up to 10 players", "Six to ten teams and full playoffs. Cancel your evening."]];
  const st = () => ctx.state(), o = () => st().o;
  const me = () => room.players.find(p => p.id === room.you);
  const nameOf = id => (id === room.you ? "You" : room.players.find(p => p.id === id)?.name ?? "Someone");

  const API = document.querySelector('meta[name="api-base"]')?.content ?? "";   // another host's address, or "" for this one
  const auth = createAuth(API);
  let profile = null, retried = false, loaded = false;
  async function post(path, body, retry = true) {
    const r = await fetch(API + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    // the server forgets sessions when it restarts: quietly sign in again and repeat the request once
    if (!r.ok && retry && body.token && /session has ended/.test(j.error ?? "") && o()?.name) { await session(o().name); return post(path, { ...body, token: o().token }, false); }
    if (!r.ok) throw new Error(j.error || "The server did not answer. Try again.");
    return j;
  }
  // a server session for this player; with accounts switched on it is tied to their (guest) account
  async function session(name) { const c = club(); st().o = { ...(await post("/api/session", { name: c?.name ?? name, access: await auth.access(), club: c }, false)), code: o()?.code }; }
  async function clubChanged(c) {   // keep the saved profile in step; a room already joined keeps the club it started with
    try { if (!o()?.code) await session(c.name); if (o()?.token) await post("/api/profile", { token: o().token, club: c }); } catch {}
  }
  async function loadProfile() {
    try {
      if (!o()?.token) { if (!(await auth.access())) return; await session(o()?.name ?? "Player"); }
      const c = cabinet();
      profile = await post("/api/profile", { token: o().token, solo: c.seasons ? c : undefined });
      if (profile?.club?.team) ctx.adoptClub({ name: profile.name, ...profile.club });   // signing in on a new device brings the club with it
    } catch { profile = null; }
    loaded = true;
    try { myRooms = o()?.token ? (await post("/api/rooms/mine", { token: o().token })).rooms : []; } catch { myRooms = []; }
    if ((st().screen === "online" && !o()?.code) || st().screen === "records") render();
  }
  // one line on where a room stands, for the list of your rooms
  const standing = r => (r.phase === "lobby" ? (r.with.length ? "In the lobby, waiting to start" : "Waiting for someone to join")
    : r.phase === "draft" ? (r.turn ? "Your pick" : "Draft under way") : r.phase === "lineup" ? (r.ready ? "Team sheet in, waiting for the others" : "Set your team sheet")
    : r.phase === "season" ? `${r.stage ?? "Next match"} to play` : r.won ? "Finished: you won it" : "Finished");
  // three at most: the ones still being played come first (the server sends the most recently used first)
  const roomList = () => (myRooms.length ? `<div class="panel stack"><h3>Your rooms</h3><p class="muted" style="font-size:13px">${myRooms.length > 3 && !allRooms ? `Your three most recent of ${myRooms.length}, the ones still going first.` : "Open one to carry on."}</p>
    <div class="sheetlist">${[...myRooms].sort((a, b) => (a.phase === "done") - (b.phase === "done")).slice(0, allRooms ? undefined : 3).map(r => `<button class="srow roomrow" data-action="o-switch" data-code="${r.code}"><span class="pos">${icon(r.mode === "h2h" ? "sword" : r.mode === "mini" ? "users-three" : "trophy")}</span>
      <span class="who"><b>${esc(r.modeName)}${r.with.length ? ` with ${esc(r.with.join(", "))}` : ""}</b><span class="${r.turn || (r.phase === "lineup" && !r.ready) || r.phase === "season" ? "todo" : ""}">${esc(standing(r))} · room ${r.code}</span></span>${icon("caret-right")}</button>`).join("")}</div>${myRooms.length > 3 ? `<div class="row"><button class="btn ghost" data-action="o-all-rooms">${allRooms ? "Show fewer" : `Show all ${myRooms.length}`}</button></div>` : ""}</div>` : "");
  // ---------- records: you against each friend, from every finished room ----------
  const when = t => (t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
  const friendRows = fs => `<div class="sheetlist">${fs.map(f => `<div class="vs"><span class="vs-who"><b>${esc(f.name)}</b><span class="muted">${esc(f.team ?? "")}</span></span>
    <span class="vs-n"><b>${f.won}–${f.lost}</b><small>Matches</small></span>${f.seriesWon + f.seriesLost ? `<span class="vs-n"><b>${f.seriesWon}–${f.seriesLost}</b><small>Series</small></span>` : ""}
    <span class="vs-n"><b>${f.above}/${f.rooms}</b><small>Finished above</small></span></div>`).join("")}</div>`;
  function records() {
    const p = profile, head = '<div><h1>Records</h1><p class="muted">You against your friends, from every room you have finished.</p></div>';
    if (!p) return `<section class="stack">${head}<p class="muted">${loaded ? "The records could not be fetched. Check your connection and try again." : "Fetching the scorebook…"}</p></section>`;
    if (!p.accounts) return `<section class="stack">${head}<p class="muted">Records are not kept on this copy of the game.</p></section>`;
    return `<section class="stack">${head}
      <div class="kpis"><div class="kpi"><b>${p.rooms}</b><span>Rooms finished</span></div><div class="kpi"><b>${p.titles}</b><span>Titles with friends</span></div>
        <div class="kpi"><b>${p.won}–${p.lost}</b><span>Matches won–lost</span></div><div class="kpi"><b>${p.solo?.titles ?? 0}</b><span>Solo titles in ${p.solo?.seasons ?? 0}</span></div></div>
      <div class="panel stack"><h3>Head to head</h3>${p.friends.length ? `${friendRows(p.friends)}<p class="muted" style="font-size:12px">Matches: every game between your two sides. Series: head-to-head rooms won and lost. Finished above: rooms where you ended higher than them.</p>`
        : `<p class="muted">Nothing in the book yet. Finish a room with a friend and the bragging rights get written down here.</p><div class="row"><button class="btn primary" data-action="o-open">${icon("users-three")} Play a friend</button></div>`}</div>
      ${p.recent.length ? `<div class="panel stack"><h3>Recent rooms</h3><div class="sheetlist">${p.recent.map(r => `<div class="rec"><span><b>${MODES.find(x => x[0] === r.mode)?.[2] ?? "Room"}</b>${r.with.length ? ` with ${esc(r.with.join(", "))}` : ""}<br>
        <span class="muted">${when(r.when)} · ${esc(r.team)} · ${r.won}–${r.lost}</span></span><b class="${r.champion ? "hotnum" : ""}">${r.champion ? `${icon("trophy")} Won` : `${ordinal(r.position)} of ${r.sides}`}</b></div>`).join("")}</div></div>` : ""}
      <p class="muted" style="font-size:13px">Playing as a guest? These live with this browser until you sign in. <button class="link" data-action="account">Sign in to keep them</button></p></section>`;
  }
  const act = action => post(`/api/rooms/${o().code}/act`, { token: o().token, action }).then(() => { error = ""; }).catch(e => { error = e.message; render(); });

  function connect() {
    stream?.close();
    // shortcut: the session token travels in the stream's address because EventSource cannot send headers; move to a cookie with a real sign-in
    stream = new EventSource(`${API}/api/rooms/${o().code}/events?token=${o().token}`);
    stream.onmessage = e => { retried = false; update(JSON.parse(e.data)); };
    stream.addEventListener("refused", e => {
      const why = JSON.parse(e.data).error;
      stream.close();
      if (/session has ended/.test(why) && !retried && o()?.name) { retried = true; return session(o().name).then(connect, () => { error = why; leave(); render(); }); }   // the server restarted
      error = why; leave(); render();
    });
  }
  const unhash = () => { if (/^#room-/.test(location.hash)) history.replaceState(null, "", location.pathname); };   // the invite is used up
  function leave() { stream?.close(); stream = null; room = null; seenDay = -1; if (o()) delete o().code; chat(); }
  function update(next) {
    const first = !room;
    // a buzz when it becomes your pick, or when someone walks into your lobby
    if (room && ((next.draft?.turn === next.you && room.draft?.turn !== next.you) || (next.phase === "lobby" && next.players.length > room.players.length))) try { navigator.vibrate?.(120); } catch {}
    if (next.closed) {   // the host called the room off
      note = next.by === me()?.name ? `You closed room ${next.code}.` : next.by ? `${next.by} closed room ${next.code}.` : `Room ${next.code} was closed.`;
      leave(); loadProfile(); if (st().screen === "match") st().screen = "online";
      return render();
    }
    room = next;
    if (room.me?.team) st().name = room.me.team;   // so results are drawn from this player's side
    if (first) seenDay = room.matchday;
    if (room.matchday > seenDay) {                 // a matchday was just played: watch your own match
      seenDay = room.matchday;
      const mine = !quiet && room.season.last.find(m => m.home === room.me.team || m.away === room.me.team);   // quiet: he asked for the results only
      quiet = false;
      if (mine) { closeSheet(); Object.assign(st(), { screen: "match", watch: mine, watchDone: false }); return render(); }
    }
    chat();
    if (st().screen === "online") render();        // never redraw under someone watching a match
  }

  // ---------- room chat: lives outside the redrawn page, so a message arriving never takes the keyboard or the half-typed line away ----------
  const $chat = document.body.appendChild(Object.assign(document.createElement("div"), { id: "chat", hidden: true }));
  $chat.innerHTML = `<button class="chatfab" data-action="o-chat" aria-label="Room chat">${icon("chat-circle-dots")}<b hidden></b></button>
    <form class="chatbox" hidden><div class="row between"><h3>Room chat</h3><button type="button" class="btn ghost" data-action="o-chat" aria-label="Close chat">${icon("x")}</button></div>
      <div class="chatlog" role="log" aria-live="polite"></div>
      <div class="emojis" role="group" aria-label="Add an emoji">${["🔥", "😂", "😭", "👏", "🐐", "💀", "😤", "🤝", "🏏", "🏆"].map(e => `<button type="button" data-emoji="${e}" aria-label="Add ${e}">${e}</button>`).join("")}</div>
      <div class="row"><input id="o-say" maxlength="200" autocomplete="off" enterkeyhint="send" placeholder="Say something" aria-label="Message"><button class="btn primary" aria-label="Send">${icon("paper-plane-right")}</button></div></form>`;
  const $log = $chat.querySelector(".chatlog"), $box = $chat.querySelector(".chatbox"), $say = $chat.querySelector("#o-say"), $unread = $chat.querySelector(".chatfab b");
  function chat() {
    const on = !!room && ["lobby", "draft", "lineup"].includes(room.phase), lines = on ? room.chat ?? [] : [];
    $chat.hidden = !on;
    if (!on) { chatOpen = false; chatRead = 0; }
    $box.hidden = !chatOpen;
    const last = lines.at(-1)?.n ?? 0, stuck = $log.scrollHeight - $log.scrollTop - $log.clientHeight < 40;
    if ($log.dataset.last !== String(last) || !lines.length) {
      $log.innerHTML = lines.length ? lines.map(l => `<p class="${l.by === room.you ? "me" : ""}"><b>${esc(l.by === room.you ? "You" : l.name)}</b> ${esc(l.text)}</p>`).join("") : '<p class="muted">Nobody has said anything yet. Go on, start the sledging.</p>';
      $log.dataset.last = last;
      if (stuck || lines.at(-1)?.by === room?.you) $log.scrollTop = $log.scrollHeight;
    }
    if (chatOpen) chatRead = last;
    const unread = lines.filter(l => l.n > chatRead && l.by !== room.you).length;
    $unread.hidden = !unread; $unread.textContent = unread;
  }
  $box.addEventListener("click", e => {   // an emoji goes on the end of the line being typed (or is the whole message: Send is one more tap)
    const emoji = e.target.closest("[data-emoji]")?.dataset.emoji;
    if (emoji && ($say.value + emoji).length <= $say.maxLength) { $say.value += emoji; $say.focus(); }
  });
  $box.addEventListener("submit", e => {
    e.preventDefault();
    const text = $say.value.trim();
    if (!text || !room) return;
    $say.value = "";
    post(`/api/rooms/${o().code}/act`, { token: o().token, action: { type: "say", text } }).catch(err => { $say.value = text; error = err.message; render(); });
  });
  async function enter(joinCode) {
    const name = document.getElementById("o-name").value.trim();
    if (!name) { error = "Enter your name first."; return render(); }
    try {
      if (o()?.name !== name || !o()?.token) await session(name);
      o().code = joinCode ? (await post(`/api/rooms/${encodeURIComponent(joinCode)}/join`, { token: o().token })).code : (await post("/api/rooms", { token: o().token, mode })).code;
      error = ""; history.replaceState(null, "", location.pathname);
      connect();
    } catch (e) { error = e.message; }
    render();
  }

  // ---------- account: guest by default, Google or email to keep the profile ----------
  const forget = () => { if (o()) delete o().token; profile = null; };   // the next request signs in again, as whoever the player now is
  async function accountSheet(note = "", extra = "") {
    const close = `<button class="btn icon ghost" data-action="close-sheet" aria-label="Close account">${icon("x")}</button>`;
    openSheet(`<div class="row between"><h2>Account</h2>${close}</div><p class="muted">One moment…</p>`, "Account");
    let body;
    try {
      if (!(await auth.enabled())) body = '<div class="panel stack"><h3>Player Profile</h3><p class="muted">You are playing with display names. Your franchise settings, match records, and multiplayer data are saved locally on this device.</p></div>';
      else {
        const mail = await auth.emailOn(), me = await auth.me(), via = me.app_metadata?.providers?.includes("google") ? "Google" : "email";
        body = me.is_anonymous
          ? `<p class="muted">You are playing as a guest. Your profile and records are kept in this browser only, so clearing your data or changing phone loses them. Sign in once to keep them and use them on any device.</p>
            <div class="row"><button class="gbtn" data-action="acct-google">${GOOGLE}<span>Continue with Google</span></button></div>
            ${mail ? `<label class="field">Or use your email<input id="acct-email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" style="font:500 16px var(--text);text-transform:none;letter-spacing:0"></label>
            <div class="row"><button class="btn" data-action="acct-email">${icon("envelope-simple")} Email me a sign-in link</button></div>` : ""}
            <p class="muted" style="font-size:12px">Your email address is stored only to sign you in. It is never shown to other players and you will not be sent marketing. <a href="privacy.html" style="color:inherit">Privacy</a></p>`
          : `<div class="panel stack"><h3>Signed in with ${via}</h3><b style="font:600 17px var(--text);overflow-wrap:anywhere">${esc(me.email ?? "Your account")}</b>
              <span class="muted" style="font-size:13px">Your profile is saved. Sign in the same way on another device to pick it up there.</span></div>
            <div class="row"><button class="btn ghost" data-action="acct-signout">${icon("sign-out")} Sign out</button></div>`;
      }
    } catch (e) { body = `<p class="chip warn" role="alert">${icon("warning")} ${esc(e.message)}</p>`; }
    if ($open()) openSheet(`<div class="row between"><h2>Account</h2>${close}</div>${note ? `<p class="chip ok">${icon("check")} ${esc(note)}</p>` : ""}${extra}${body}
      ${o()?.admin || location.hash === "#admin" ? `<div class="row" style="justify-content:flex-end"><button class="btn ghost" data-action="admin-open" style="min-height:40px;padding:0 14px;font-size:13px">${icon("gear-six")} Admin</button></div>` : ""}`, "Account");
  }
  const $open = () => !document.getElementById("sheet").hidden;
  // Signing in to a profile that already exists would leave this device's guest games behind. Before leaving for Google
  // the guest's sign-in is noted; on the way back the server is shown both sign-ins and moves the guest's games across.
  const CARRY = "powerplay-carry";
  const noteGuest = async () => { try { localStorage.setItem(CARRY, await auth.access()); } catch {} };
  async function carryOver() {
    let from = null;
    try { from = localStorage.getItem(CARRY); localStorage.removeItem(CARRY); } catch {}
    if (!from) return 0;
    try { const r = await post("/api/merge", { from, access: await auth.access() }, false); return (r.games ?? 0) + 0; } catch { return 0; }   // nothing is lost by a failed merge: the guest's games stay where they were
  }
  function arrive() {   // called once at start: are we coming back from Google or an email link?
    const back = auth.consume();
    if (!back) return;
    forget();
    if (back.ok) return void carryOver().then(n => loadProfile().then(() => { const said = `You are signed in.${n ? ` ${n} game${n === 1 ? "" : "s"} played on this device before you signed in ${n === 1 ? "has" : "have"} been added to your profile.` : ""}`;
      return club() ? accountSheet(`${said} Your club and records are saved.`) : ctx.openClub(`${said} Now set up your club.`); }));
    if (/already/.test(back.code + back.error)) return void accountSheet("", `<p class="chip warn" role="alert">${icon("warning")} That Google account already has a Powerplay profile.</p>
      <div class="row"><button class="btn" data-action="acct-switch">Switch to that profile</button></div><p class="muted" style="font-size:13px">The games you have played on this device come with you.</p>`);
    accountSheet("", `<p class="chip warn" role="alert">${icon("warning")} ${esc(back.error)}</p>`);
  }

  // ---------- drawing ----------
  const clock = () => (room.deadline ? `<span class="clock num" data-deadline="${room.deadline}"></span>` : "");
  const banner = () => (error ? `<p class="chip warn" role="alert">${icon("warning")} ${esc(error)}</p>` : "");
  const lineOf = p => p.slots.map(k => k && card(k));   // a player's twelve places, null where empty
  const rivals = () => room.players.filter(p => p.id !== room.you).map(p => ({ name: p.name, cards: p.picks.map(card) }));   // what the others have drafted so far
  const views = {
    entry() {
      const code = (location.hash.match(/^#room-([A-Za-z]{5})$/) ?? [])[1] ?? "";
      const who = `${club() ? `<div class="clubline">${clubCrest(club())}<div><b>${esc(club().team)}</b><span class="muted">Managed by ${esc(club().name)}</span></div><button class="btn ghost" data-action="club-open">Edit club</button></div><input id="o-name" type="hidden" value="${esc(club().name)}">`
          : `        <label class="field">Your name<input id="o-name" maxlength="18" autocomplete="nickname" value="${esc(typed ?? (o()?.name && o().name !== "Player" ? o().name : profile?.name && profile.name !== "Player" ? profile.name : ""))}"></label>
        <div class="row"><button class="btn ghost" data-action="club-open">${icon("shield-star")} Set up your club</button><span class="muted" style="font-size:13px">Skip the name box next time, and play in your own colours.</span></div>`}`;
      // arriving on an invite link: joining is the only thing on the screen
      if (code) return `<section class="stack">
        <h1>You're <em>invited</em></h1>
        <p class="muted">A friend has a room open and is waiting for you. Join and you draft against them from the same squads.</p>
        <div class="turnbar mine" role="status"><div><small>Room code</small><b>${esc(code.toUpperCase())}</b></div>${icon("users-three")}</div>
        ${who}<input id="o-code" type="hidden" value="${esc(code.toUpperCase())}">
        ${banner()}
        <div class="row"><button class="btn primary big" data-action="o-join">${icon("sign-in")} Join the room</button></div>
        <p class="muted" style="font-size:13px">Not what you wanted? <button class="link" data-action="o-own">Start your own room instead</button></p></section>`;
      return `<section class="stack">
        <h1>Multi<em>player</em></h1>
        <p class="muted">One draft, shared squads. If your mate takes Bumrah, Bumrah is gone. Start a room and send your friends the code, or join one of theirs.</p>
        ${who}
        ${note ? `<p class="chip ok" role="status">${icon("check")} ${esc(note)}</p>` : ""}${banner()}
        <h3>Start a room</h3>
        <div class="modes" role="group" aria-label="Game mode">${MODES.map(([k, ic, name, size, text]) => `<button class="mode" data-action="o-mode" data-m="${k}" aria-pressed="${k === mode}">${icon(ic)}<b>${name}</b><span class="tag">${size}</span><span>${text}</span></button>`).join("")}</div>
        <div class="row"><button class="btn primary big" data-action="o-create">${icon("plus")} Create room</button><span class="muted">${MODES.find(x => x[0] === mode)[2]}</span></div>
        ${roomList()}
        <div class="panel stack"><h3>Got a room code?</h3>
          <div class="row" style="align-items:flex-end"><label class="field" style="flex:1 1 160px">Room code<input id="o-code" maxlength="5" autocapitalize="characters" autocomplete="off"></label>
            <button class="btn primary" data-action="o-join">${icon("sign-in")} Join room</button></div></div>
        ${profile?.accounts ? `<div class="panel stack"><div class="row between"><h3>Your profile</h3><button class="btn ghost" data-action="account" style="min-height:40px;padding:0 14px;font-size:13px">${icon("user-circle")} Account</button></div>
          <div class="kpis"><div class="kpi"><b>${profile.rooms}</b><span>Rooms finished</span></div><div class="kpi"><b>${profile.titles}</b><span>Titles with friends</span></div>
            <div class="kpi"><b>${profile.won}–${profile.lost}</b><span>Won–lost</span></div><div class="kpi"><b>${profile.solo?.titles ?? 0}</b><span>Solo titles in ${profile.solo?.seasons ?? 0}</span></div></div>
          ${profile.friends.length ? `${friendRows(profile.friends.slice(0, 3))}<div class="row"><button class="btn ghost" data-action="records">All records</button></div>`
            : '<p class="muted" style="font-size:13px">Finish a room with friends and the bragging rights get written down here.</p>'}</div>` : ""}
        <div class="row"><button class="btn ghost" data-action="home">Back</button></div></section>`;
    },
    lobby() {
      const host = room.host === room.you;
      return `<section class="stack">
        <h3>${esc(room.modeName)} · room code</h3><h1 class="code">${room.code}</h1>
        <div class="row"><button class="btn" data-action="o-copy">${icon(copied ? "check" : "link")} ${copied ? "Link copied" : "Copy invite link"}</button></div>
        <div class="panel stack"><h3>In the room · ${room.players.length} of ${room.max}</h3>
          <div class="sheetlist">${room.players.map((p, i) => `<div class="srow"><span class="pos num">${i + 1}</span><span class="dot ${p.online ? "on" : ""}" title="${p.online ? "Connected" : "Away"}"></span>
            <span class="who"><b>${esc(p.name)}${p.id === room.you ? " (you)" : ""}</b><span>${p.id === room.host ? "Host" : "Player"}</span></span><span class="here ${p.online ? "on" : ""}">${p.online ? "Here now" : "Away"}</span></div>`).join("")}</div></div>
        ${(() => { const others = room.players.filter(p => p.id !== room.you), names = others.map(p => esc(p.name)).join(", "), boss = room.players.find(p => p.id === room.host);
          return !others.length ? "" : `<div class="turnbar ${host ? "mine" : ""}" role="status"><div><small>${host ? (others.every(p => !p.online) ? "Not here yet" : `${others.length === 1 ? "Your opponent is" : `${others.length} players are`} in`) : "You're in the room"}</small>
            <b>${host ? (others.every(p => !p.online) ? `Waiting for ${names} to come over` : `${names} ${others.length === 1 ? "has" : "have"} joined`) : boss.online ? `${esc(boss.name)} is here too` : `${esc(boss.name)} has stepped away`}</b></div></div>`; })()}
        ${banner()}
        <div class="row">${host ? `<button class="btn primary big" data-action="o-start" ${room.players.length < 2 ? "disabled" : ""}>Start the draft</button>` : `<p class="muted">${esc(room.players.find(p => p.id === room.host).name)} starts the draft from their screen. Nothing for you to press. Pads on.</p>`}
          <button class="btn ghost" data-action="o-leave">Leave room</button></div>
        ${host && room.players.length < 2 ? '<p class="muted" style="font-size:14px">It takes two to argue. Share the code or the link.</p>' : ""}</section>`;
    },
    draft() {
      const d = room.draft, mine = me(), squad = lineOf(mine), n = needs(squad), myTurn = d.turn === room.you;
      const pack = allPacks.find(p => p.id === d.pack.id), avail = pack.cards.filter(c => d.avail.includes(c.key));
      const ball = i => `<span class="ball ${i < d.round - 1 ? "done" : i === d.round - 1 ? "now" : ""}"></span>`;
      return `<div class="split"><section class="stack">
        <div class="row between"><div class="steps" role="img" aria-label="Round ${d.round} of ${d.rounds}">${Array.from({ length: d.rounds }, (_, i) => ball(i)).join("")}</div></div>
        <div class="turnbar ${myTurn ? "mine" : ""}" role="status"><div><small>${myTurn ? "You're up" : "Not your turn yet"}</small><b>${myTurn ? "Your pick" : `${esc(nameOf(d.turn))} is picking`}</b></div>${clock()}</div>
        <div class="packhead"><h3>Round ${d.round} of ${d.rounds} · ${avail.length} players left in this pack</h3>
          ${slotHead(pack, "o-reroll", mine.rerolls, myTurn && mine.rerolls > 0)}</div>
        <div class="scrollx" aria-label="Picking order"><span class="chip plain">Still to pick this round</span>${d.queue.map((id, i) => `<span class="chip ${i === 0 ? "ok" : ""}">${i + 1}. ${esc(nameOf(id))}</span>`).join("")}</div>
        <p class="muted" style="font-size:13px">${d.round === 1 ? `${d.first === room.you ? "You were" : `${esc(nameOf(d.first))} was`} drawn to pick first. ` : ""}The order moves up one each round: whoever picks second this round picks first in the next, and this round's first goes to the back. Each player can be in only one squad, whichever season: once someone has him, he is gone.${mine.rerolls ? " On your pick, Reroll swaps this squad for a fresh one." : ""}</p>
        ${banner()}
        <div class="row">${xiButton(squad)}<span class="chip ${n.keeper ? (n.left <= 3 ? "warn" : "") : "ok"}">${icon(n.keeper ? "hand-palm" : "check")} ${n.keeper ? "Keeper needed" : "Keeper"}</span>
          <span class="chip ${n.bowlers ? (n.bowlers >= n.left - 1 ? "warn" : "") : "ok"}">${icon(n.bowlers ? "target" : "check")} Bowlers ${MIN_BOWLERS - n.bowlers}/${MIN_BOWLERS}</span>
          <span class="chip ${n.overseas >= MAX_OVERSEAS ? "warn" : ""}">${icon("airplane-tilt")} Overseas ${n.overseas}/${MAX_OVERSEAS}</span></div>
        ${styleNudge(squad, avail)}
        ${(() => { const hints = avail.filter(c => !blockReason(c, squad)).map(c => ({ c, e: matchups(c, rivals()).find(x => x.good) })).filter(x => x.e).sort((a, b) => b.e.weight - a.e.weight).slice(0, 2);
          return hints.length ? `<div class="nudge matchup">${icon("sword")}<span>${hints.map(({ c, e }) => `<b>${esc(c.name)}</b>: ${esc(e.text[0].toLowerCase() + e.text.slice(1))}`).join("<br>")}</span></div>` : ""; })()}
        <div class="cards">${avail.map((c, i) => playerCard(c, { i, why: blockReason(c, squad), action: "o-inspect" })).join("")}</div>
        ${d.taken.length ? `<p class="muted" style="font-size:14px">Taken this round: ${d.taken.map(t => `${esc(data.cards[t.key].name)} (${esc(nameOf(t.by))}${t.auto ? ", on the clock" : ""})`).join(", ")}</p>` : ""}
        <div class="panel stack"><h3>The room</h3><div class="sheetlist">${room.players.map(p => { const cs = p.picks.map(card), avg = cs.length ? Math.round(cs.reduce((s, c) => s + c.overall, 0) / cs.length) : "–";
          return `<button class="srow" data-action="o-roster" data-id="${p.id}" aria-label="See ${esc(p.name)}'s picks"><span class="pos num">${p.picks.length}</span><span class="ovr">${avg}</span><span class="who"><b>${esc(p.name)}${p.id === room.you ? " (you)" : ""}</b>
            <span>${cs.slice(-3).reverse().map(c => esc(nameParts(c.name)[1])).join(", ") || "No picks yet"}</span></span><span class="dot ${p.online ? "on" : ""}"></span></button>`; }).join("")}</div>
          <p class="muted" style="font-size:13px">Tap a player to snoop on every pick they have made.</p></div>
      </section>${draftAside(squad)}</div>
      ${tray(squad)}`;
    },
    lineup() {
      const ready = room.players.filter(p => p.ready).length, mine = me();
      return `<section class="stack">
        <div class="row between"><h1>Your all-time <em>${league()} XI</em></h1><span class="turn">${clock()}</span></div>
        <p class="muted">The draft is done. Choose your ground, set your sides for home and away, and say what you do at the toss. This is the only time you ready up: once everyone has, each of you plays through the matches at your own pace.</p>
        ${(() => { const g = grade(placed(lineOf(mine))), rank = room.players.map(p => grade(placed(lineOf(p))).avg).filter(a => a > g.avg).length + 1;
          return `<div class="grade"><b>${g.letter}</b><div><h3>Draft grade</h3><p>${g.line}</p><p class="muted">Rated ${g.avg}, the ${rank === 1 ? "best" : ordinal(rank) + " best"} squad of ${room.players.length} in the room. Pick of your draft: ${esc(g.steal.name)} (${g.steal.overall})</p></div></div>`; })()}
        ${chemLine(mine.picks.map(card))}
        ${balanceReport(lineOf(mine))}
        <div class="row">${room.players.filter(p => p.id !== room.you).map(p => `<button class="btn ghost" data-action="o-roster" data-id="${p.id}">${icon("binoculars")} ${esc(p.name)}'s squad</button>`).join("")}</div>
        ${club() ? `<div class="clubline">${badge(room.me.team, true)}<div><b>${esc(room.me.team)}</b><span class="muted">Managed by ${esc(club().name)}</span></div></div>`
          : `<label class="field">Team name<input id="o-team" maxlength="24" autocomplete="off" value="${esc(room.me.team)}"></label>`}
        <div class="stack"><h3>Home ground</h3><div class="grounds" data-keep="grounds">${Object.values(data.venues).map(v => { const by = room.players.find(p => p.id !== room.you && p.venue === v.name);
          return `<button class="ground" data-action="o-venue" data-v="${esc(v.name)}" aria-pressed="${v.name === room.me.venue}" ${by ? "disabled" : ""}>${by ? `<span class="taken">${icon("lock-simple")} ${esc(by.name)}'s ground</span>` : ""}
          <b>${esc(v.name)}</b>${traits(v)}</button>`; }).join("")}</div></div>
        <div class="panel stack"><h3>Your XI</h3>${planEditor({ home: lineOf(mine), away: (room.me.away ?? mine.slots).map(card), toss: room.me.toss, venue: room.me.venue }, { tab: planTab, from: swapFrom }, { tab: "o-plan-tab", toss: "o-toss", swap: "o-swap" }, mine.ready)}</div>
        ${(() => { const others = room.players.filter(p => p.id !== room.you), opp = others.find(p => p.id === scoutOpp) ?? others[0];
          return `<div class="panel stack"><h3>Scouting report</h3><p class="muted" style="font-size:13px">Real records between your players and ${esc(opp.name)}'s. The match plays every one of them.</p>
            ${others.length > 1 ? `<div class="scrollx" role="group" aria-label="Opponent">${others.map(p => `<button class="chip" data-action="o-scout" data-id="${p.id}" aria-pressed="${p === opp}">${esc(p.name)}</button>`).join("")}</div>` : ""}
            ${others.length > 1 ? `<p class="muted" style="font-size:13px">A change made here goes into your bowling plan against ${esc(opp.name)} only.</p>` : ""}
            ${scoutReport(lineOf(mine), lineOf(opp), opp.name, (others.length > 1 ? room.me.bowlVs[opp.id] : null) ?? room.me.bowl, mine.ready ? null : "o-bowl", others.length > 1 ? opp.id : "")}</div>
          <div class="panel stack"><h3>Your attack</h3>${attackEditor(lineOf(mine), room.me.bowl, "o-bowl", mine.ready, others.length > 1 ? { tabs: others.map(p => [p.id, p.name]), on: bowlTab, plans: room.me.bowlVs, tab: "o-bowl-tab" } : null)}</div>`; })()}
        ${banner()}
        <div class="row"><button class="btn primary big" data-action="o-ready" ${mine.ready ? "disabled" : ""}>${mine.ready ? "Waiting for the others" : "Padded up"}</button><span class="muted">${ready} of ${room.players.length} ready</span></div>
      </section>`;
    },
    season() {
      const s = room.season, team = room.me.team, pos = s.standings.findIndex(r => r.team === team), row = s.standings[pos], mine = me();
      const owner = t => room.players.find(p => p.team === t);
      const fx = s.upcoming?.fixtures.find(f => f.home === team || f.away === team) ?? s.upcoming?.fixtures[0];
      const ready = room.players.filter(p => p.ready).length, show = t => (t === team ? t : place(t));
      const series = s.standings.length === 2, opp = fx && (fx.home === team ? fx.away : fx.away === team ? fx.home : null);
      const teamBtn = t => `<button class="link" data-action="o-roster" data-team="${esc(t)}">${esc(show(t))}</button>`;
      return `<section class="stack">
        <div class="kpis"><div class="kpi"><b>${row.won}–${row.lost}</b><span>Won–lost</span></div><div class="kpi"><b>${series ? `${row.played}/5` : ordinal(pos + 1)}</b><span>${series ? "Matches played" : "Position"}</span></div>
          ${series ? "" : `<div class="kpi"><b>${row.points}</b><span>Points</span></div><div class="kpi"><b>${(row.nrr >= 0 ? "+" : "") + row.nrr.toFixed(2)}</b><span>Net run rate</span></div>`}</div>
        ${s.done ? `<div class="title ${s.champion === team ? "" : "plain"}"><i class="ph-fill ph-trophy" aria-hidden="true"></i><h3>${series ? "Series winners" : "Champions"}</h3><h1>${esc(show(s.champion))}</h1>
            <p class="muted">${series ? `${s.champion === team ? "You took" : esc(owner(s.champion).name) + " took"} the series ${s.standings[0].won}–${s.standings[1].won}.` : s.champion === team ? "You took the title." : owner(s.champion) ? `${esc(owner(s.champion).name)} took the title. You finished ${ordinal(pos + 1)}.` : `You finished ${ordinal(pos + 1)} in the league.`}</p>
            ${series ? (room.rematch ? `<p class="chip ok" role="status">${icon("arrows-counter-clockwise")} A rematch is waiting in room ${room.rematch}</p>` : "") : ""}
            <div class="row" style="justify-content:center">${series ? (room.rematch ? `<button class="btn primary big" data-action="o-switch" data-code="${room.rematch}">${icon("sword")} Join the rematch</button>`
                : `<button class="btn primary big" data-action="o-rematch">${icon("arrows-counter-clockwise")} Rematch</button>`) : ""}
              <button class="btn ${series ? "" : "primary big"}" data-action="o-exit">${icon("house")} Home</button><button class="btn" data-action="o-review">${icon("question")} Why it went that way</button></div></div>`
          : `<div class="fixture"><div class="row between"><h3>${esc(fx.stage ?? s.upcoming.stage)}</h3><span class="muted" style="font-size:13px">${icon("map-pin")} ${esc(fx.venue)}</span></div>
            <div class="versus"><div class="side">${badge(fx.home, true)}<b>${esc(show(fx.home))}</b></div><span class="v">v</span><div class="side">${badge(fx.away, true)}<b>${esc(show(fx.away))}</b></div></div>
            ${traits(data.venues[fx.venue])}
            <div class="row"><button class="btn primary big" data-action="o-next">${icon("play")} ${opp ? "Play match" : "Play on"}</button>
              <button class="btn ghost" data-action="o-sim-all">${icon("fast-forward")} ${series ? "Sim the series" : !s.leagueDone ? "Sim the league" : s.upcoming.stage === "Final" ? "Sim the final" : "Sim the playoffs"}</button>
              <span class="muted" style="font-size:13px">No waiting: everyone plays through at their own pace.</span>
              ${opp ? `<button class="btn ghost" data-action="o-roster" data-team="${esc(opp)}">${icon("binoculars")} Scout ${esc(show(opp))}</button>` : ""}</div></div>`}
        ${banner()}
        <div class="dash"><div class="stack">
        ${s.last.length ? `<h3>${esc(/^Match/.test(s.last[0].stage) ? s.last[0].stage : "Playoffs")} results</h3>
          <div class="stack">${s.last.map((m, i) => [m, i]).sort((a, b) => (b[0].home === team || b[0].away === team) - (a[0].home === team || a[0].away === team)).map(([m, i]) => resultRow(m, i, "o-card")).join("")}</div>` : ""}
          ${(m => (m ? matchPost(m) : ""))(s.last.find(m => m.home === team || m.away === team))}
          </div><div class="stack">
          <div class="panel scroll"><h3>${series ? "The series" : "League table"}</h3><table><thead><tr><th>#</th><th class="l">Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th><th>NRR</th></tr></thead><tbody>
            ${s.standings.map((r, i) => `<tr class="${r.team === team ? "me" : ""} ${!series && i === (s.standings.length >= 6 ? 3 : 1) ? "cut" : ""}"><td>${i + 1}</td><td class="l">${badge(r.team)}${teamBtn(r.team)}${owner(r.team) && r.team !== team ? ` <span class="tag">${esc(owner(r.team).name)}</span>` : ""}</td>
              <td>${r.played}</td><td>${r.won}</td><td>${r.lost}</td><td><b>${r.points}</b></td><td>${(r.nrr >= 0 ? "+" : "") + r.nrr.toFixed(2)}</td></tr>`).join("")}</tbody></table></div>
            <div class="panel scroll"><h3><span class="tag orange">Orange Cap</span> Most runs</h3><table><tbody>${s.orangeCap.map((x, i) => `<tr class="${x.team === team ? "me" : ""}"><td>${i + 1}</td><td class="l">${badge(x.team)}${esc(x.name)}</td><td><b>${x.runs}</b></td></tr>`).join("")}</tbody></table></div>
            <div class="panel scroll"><h3><span class="tag purple">Purple Cap</span> Most wickets</h3><table><tbody>${s.purpleCap.map((x, i) => `<tr class="${x.team === team ? "me" : ""}"><td>${i + 1}</td><td class="l">${badge(x.team)}${esc(x.name)}</td><td><b>${x.wickets}</b></td></tr>`).join("")}</tbody></table></div>
          </div></div>
      </section>`;
    },
  };
  views.done = views.season;

  function screen() {
    if (!o()?.code) return views.entry();
    if (!room) return `<p class="loading">Joining room ${esc(o().code)}…</p>`;
    const early = ["lobby", "draft", "lineup"].includes(room.phase);
    return `<div class="row between roombar"><button class="btn ghost" data-action="o-out">${icon("caret-left")} My rooms</button>
      ${early ? `<button class="btn ghost" data-action="o-close">${icon("x-circle")} Close room</button>` : ""}</div>${views[room.phase]()}`;
  }

  // ---------- requests ----------
  const actions = {
    "o-open"() { st().screen = "online"; error = note = ""; if (o()?.code && !stream) connect(); else loadProfile(); },
    "o-mode"(el) { typed = document.getElementById("o-name").value; mode = el.dataset.m; },
    "o-create"() { enter(null); return false; },
    "o-join"() { const code = document.getElementById("o-code").value.trim().toUpperCase(); if (code.length !== 5) { error = "A room code has five letters."; return; } enter(code); return false; },
    "o-start"() { act({ type: "start" }); return false; },
    "o-leave"() { act({ type: "leave" }).then(() => { leave(); unhash(); render(); }); return false; },
    "o-exit"() { leave(); unhash(); st().screen = "home"; },
    "o-copy"() {
      const link = `${location.origin}/join/${room.code}`;   // its own address, so chat apps show the invite preview rather than the home page's
      (navigator.clipboard?.writeText(link) ?? Promise.reject()).then(() => { copied = true; }, () => { error = `Share this link: ${link}`; }).then(render);
      return false;
    },
    "o-inspect"(el) {
      const c = card(el.dataset.key), d = room.draft;
      openSheet(inspect(c, blockReason(c, lineOf(me())), "o-pick", d.turn === room.you ? null : `Waiting for ${nameOf(d.turn)}`, openSlots(c, lineOf(me())), matchups(c, rivals())), `${c.name}, ${place(c.team, c.season)} ${c.season}`);
      return false;
    },
    "o-pick"(el) { closeSheet(); act({ type: "pick", key: el.dataset.key, slot: +el.dataset.slot }); return false; },
    "o-venue"(el) { room.me.venue = el.dataset.v; act({ type: "venue", name: el.dataset.v }); },
    "o-ready"() { swapFrom = null; act({ type: "ready" }); return false; },
    "o-reroll"() { act({ type: "reroll" }); return false; },
    "o-rematch"() {   // a new room with the same two players; you are taken straight to it, your opponent is offered it on their results screen
      post(`/api/rooms/${o().code}/act`, { token: o().token, action: { type: "rematch" } }).then(r => { leave(); o().code = r.code; error = ""; connect(); render(); }, e => { error = e.message; render(); });
      return false;
    },
    // step out to the list without leaving the room: it carries on, and is there to open again
    "o-out"() { leave(); unhash(); error = ""; loadProfile(); },
    "o-switch"(el) { note = error = ""; o().code = el.dataset.code; room = null; connect(); },
    "o-close"() { if (confirm(`Close room ${room.code} for everyone in it? ${room.phase === "lobby" ? "It cannot be reopened." : "The draft so far is thrown away."}`)) act({ type: "close" }); return false; },
    "o-plan-tab"(el) { planTab = el.dataset.t; swapFrom = null; },
    "o-toss"(el) { act({ type: "toss", where: planTab, call: el.dataset.c || null }); return false; },
    "o-all-rooms"() { allRooms = !allRooms; },
    "o-scout"(el) { scoutOpp = bowlTab = el.dataset.id; },   // the attack below opens on the same opponent
    "o-bowl-tab"(el) { bowlTab = el.dataset.id; },
    "o-bowl"(el) { act({ type: "bowl", key: el.dataset.key, role: el.dataset.r || null, vs: el.dataset.vs || undefined, reset: !!el.dataset.reset }); return false; },
    "o-next"() { act({ type: "next" }); return false; },
    "o-sim-all"() { quiet = true; act({ type: "next", all: true }); return false; },   // the rest of the league (or the series, or the playoffs) as results only
    "o-chat"() { chatOpen = !chatOpen; chat(); if (chatOpen) { $log.scrollTop = $log.scrollHeight; $say.focus(); } return false; },
    "o-review"() {   // the server sends every match your side played; the review is worked out here
      openSheet(`<p class="muted">Going back through the scorecards…</p>`, "Review");
      post(`/api/rooms/${o().code}/matches`, { token: o().token }).then(r => reviewSheet(r.matches), e => openSheet(`<p class="chip warn" role="alert">${icon("warning")} ${esc(e.message)}</p><div class="row"><button class="btn ghost" data-action="close-sheet">Close</button></div>`, "Review"));
      return false;
    },
    "o-own"() { history.replaceState(null, "", location.pathname); error = ""; },
    "o-swap"(el) {   // same two taps as the solo team sheet; the server makes the trade
      const n = +el.dataset.n, from = swapFrom, away = planTab === "away";
      if (from != null && swap(away ? (room.me.away ?? me().slots).map(card) : lineOf(me()), from, n)) { swapFrom = null; act({ type: "swap", a: from, b: n, away }); return false; }
      swapFrom = from === n ? null : n;
    },
    records() { st().screen = "records"; loaded = false; loadProfile(); },
    account() { accountSheet(); return false; },
    "acct-google"() { noteGuest().then(() => auth.google()).catch(e => accountSheet("", `<p class="chip warn" role="alert">${icon("warning")} ${esc(e.message)}</p>`)); return false; },
    "acct-switch"() { noteGuest().then(() => auth.google(false)); return false; },
    "acct-email"() {
      const address = document.getElementById("acct-email").value.trim();
      if (!/^\S+@\S+\.\S+$/.test(address)) { accountSheet("", `<p class="chip warn" role="alert">${icon("warning")} Enter a full email address.</p>`); return false; }
      auth.email(address).then(kind => accountSheet(kind === "saved" ? `Check ${address}: open the link in the email on this device to finish.` : `That address already has a profile. Check ${address} for a link that opens it.`),
        e => accountSheet("", `<p class="chip warn" role="alert">${icon("warning")} ${esc(e.message)}</p>`));
      return false;
    },
    "acct-signout"() { auth.signOut().then(() => { forget(); leave(); closeSheet(); if (st().screen === "online") st().screen = "home"; render(); }); return false; },
    "o-roster"(el) {   // a player's picks so far, or any side in the season
      const t = el.dataset.team, p = room.players.find(x => (t ? x.team === t : x.id === el.dataset.id)), mine = p?.id === room.you;
      const keys = !p ? data.teams[t] : p.slots.filter(Boolean);
      openSheet(roster(p ? p.team ?? `${p.name}'s picks` : `${place(t)} all-time XI`, !p ? "Fills an empty place in the league" : mine ? "Your squad" : `Drafted by ${p.name}`, keys), "Squad"); return false;
    },
    "o-card"(el) { openSheet(scorecard(room.season.last[+el.dataset.i]), "Scorecard"); return false; },
  };
  document.addEventListener("change", e => { if (e.target.id === "o-team" && room) act({ type: "team", name: e.target.value }); });
  setInterval(() => {   // countdowns
    for (const el of document.querySelectorAll("[data-deadline]")) { const s = Math.max(0, Math.round((+el.dataset.deadline - Date.now()) / 1000)); el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; el.classList.toggle("low", s <= 10); }
  }, 500);

  const kitOf = team => room?.players.find(p => p.team === team && p.id !== room.you)?.kit ?? null;   // another player's colours and crest
  return { screen, records, actions, arrive, kitOf, clubChanged, resume() { if (o()?.code) connect(); }, // every side in this room's season, as the match engine takes them (for the "Why?" sheet). Other players' away sides are not shown to you, so their home side stands in.
    teams() {
      const out = {};
      for (const p of room.players) { const line = lineOf(p), mine = p.id === room.you;
        out[p.team] = { name: p.team, players: p.slots, chem: chemistry(line), shift: shifts(line), toss: mine ? room.me.toss?.home : undefined, bowl: mine ? room.me.bowl : undefined,
          bowlVs: mine ? Object.fromEntries(Object.entries(room.me.bowlVs ?? {}).map(([id, plan]) => [room.players.find(q => q.id === id)?.team, plan])) : undefined,
          away: mine ? { players: room.me.away ?? p.slots, shift: shifts((room.me.away ?? p.slots).map(card)), toss: room.me.toss?.away } : undefined }; }
      for (const t of room.season.standings) out[t.team] ??= { name: t.team, players: data.teams[t.team] };
      return out;
    },
    get pack() { return room?.phase === "draft" ? room.draft.pack.id : null; }, get where() { return room ? `Room ${room.code}` : "Online"; }, get phase() { return room?.phase ?? "entry"; }, get active() { return !!o()?.code; } };
}

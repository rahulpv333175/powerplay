// The admin screen: change draft rules, multiplayer clocks, match-engine tuning and individual player ratings.
// The server decides who may (an account listed in ADMIN_EMAILS, or the ADMIN_KEY passcode) and applies what is saved;
// this file only draws the form. Limits come from sim/settings.mjs so the form and the server agree.
import { LIMITS, DEFAULTS } from "../sim/settings.mjs";

const FIELDS = {
  rules: ["Draft rules", { maxOverseas: ["Overseas players allowed", "in a side of twelve"], minBowlers: ["Bowlers required", "places 8 to 11 give four; five means the Impact place or an all-rounder must bowl"], rerolls: ["Rerolls per draft", "each player's own; rooms of 5 to 7 get one more, 8 to 10 two more"] }],
  clocks: ["Multiplayer clocks (seconds)", { pick: ["Time for each pick", "then the best legal player is taken for them"], lineup: ["Time on the team sheet", "before the season starts on its own"], ready: ["Time between matches", "before the next one starts on its own"] }],
  engine: ["Match engine", { runs: ["Scoring", "1.03 is calibrated to real seasons; higher means bigger totals"], wickets: ["Wickets", "1.0 is calibrated; higher means more wickets"], chemistry: ["Chemistry lift per level", "0.008 = 0.8% for linked players"],
    class: ["Class", "0 to 1: how much of a hostile ground the very best players shrug off"], pitchOfTheDay: ["Pitch variation", "how much a ground differs from one match to the next"] }],
};

export function createAdmin({ API, data, TUNE, state, render, icon, esc, place, reapply, closeSheet }) {
  let key = "", draft = null, note = "", error = "", query = "", busy = false;
  const token = () => state().o?.token;
  async function call(settings) {
    const r = await fetch(`${API}/api/admin`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: token(), key, settings }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "The server did not answer.");
    return j.settings;
  }
  const open = s => { draft = { rules: {}, clocks: {}, engine: {}, ...structuredClone(s), ratings: { ...s.ratings } }; error = ""; };
  const original = (c, f) => (c.base ? c.base[f] : c[f]);   // a card's rating before any admin change
  function collect() {   // read the form back into the draft (the page is redrawn on every action)
    for (const el of document.querySelectorAll("[data-set]")) { const [g, k] = el.dataset.set.split("."); if (el.value === "") delete draft[g][k]; else draft[g][k] = +el.value; }
    for (const el of document.querySelectorAll("[data-rate]")) {
      const [k, f] = el.dataset.rate.split("|"), c = data.cards[k], v = el.value === "" ? null : Math.round(+el.value);
      const one = { ...draft.ratings[k] };
      if (v == null || v === original(c, f)) delete one[f]; else one[f] = v;
      if (Object.keys(one).length) draft.ratings[k] = one; else delete draft.ratings[k];
    }
    query = document.getElementById("a-q")?.value ?? query;
  }
  const rateRow = k => { const c = data.cards[k], r = draft.ratings[k] ?? {};
    const box = f => `<input class="a-num" type="number" min="20" max="99" inputmode="numeric" data-rate="${esc(k)}|${f}" value="${r[f] ?? original(c, f) ?? ""}" aria-label="${esc(c.name)} ${c.season} ${f === "bat" ? "batting" : "bowling"} rating">`;
    return `<tr class="${draft.ratings[k] ? "me" : ""}"><td class="l">${esc(c.name)} <span class="muted">${place(c.team, c.season)} ${c.season}</span></td><td class="muted">${original(c, "bat") ?? "–"} / ${original(c, "bowl") ?? "–"}</td><td>${box("bat")}</td><td>${box("bowl")}</td>
      <td>${draft.ratings[k] ? `<button class="btn icon ghost" data-action="admin-unrate" data-key="${esc(k)}" aria-label="Remove the change to ${esc(c.name)} ${c.season}">${icon("arrow-counter-clockwise")}</button>` : ""}</td></tr>`; };

  function screen() {
    const head = `<div class="row between"><h1>Admin</h1><button class="btn ghost" data-action="home">Back</button></div>`;
    if (!draft) return `<section class="stack">${head}
      <p class="muted">Changes here apply to every player. Sign in with an admin account, or enter the admin passcode.</p>
      <label class="field">Admin passcode<input id="a-key" type="password" autocomplete="off" style="font:500 16px var(--text);text-transform:none;letter-spacing:0"></label>
      ${error ? `<p class="chip warn" role="alert">${icon("warning")} ${esc(error)}</p>` : ""}
      <div class="row"><button class="btn primary big" data-action="admin-unlock" ${busy ? "disabled" : ""}>Unlock</button></div></section>`;
    const found = query.trim().length >= 2 ? Object.keys(data.cards).filter(k => data.cards[k].overall != null && data.cards[k].name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => data.cards[a].name.localeCompare(data.cards[b].name) || data.cards[a].season - data.cards[b].season).slice(0, 30) : [];
    const changed = Object.keys(draft.ratings).filter(k => k in data.cards && !found.includes(k));
    const table = keys => `<div class="scroll"><table><thead><tr><th class="l">Player</th><th>Built bat / bowl</th><th>Bat</th><th>Bowl</th><th></th></tr></thead><tbody>${keys.map(rateRow).join("")}</tbody></table></div>`;
    return `<section class="stack">${head}
      <p class="muted">Changes apply to every player as soon as you save: new drafts, new picks and matches not yet played. Leave a box empty to use the built-in value.</p>
      ${note ? `<p class="chip ok">${icon("check")} ${esc(note)}</p>` : ""}${error ? `<p class="chip warn" role="alert">${icon("warning")} ${esc(error)}</p>` : ""}
      <div class="panel stack"><h3>Names</h3>
        <p class="muted" style="font-size:13px">Neutral names removes the league and franchise names from the game: "IPL" becomes "T20" and sides are shown as cities (CSK becomes CHE). Players, colours and grounds stay. Turn it on if a rights holder objects, then save.</p>
        <div class="row"><button class="btn ${draft.neutral ? "primary" : ""}" data-action="admin-neutral" aria-pressed="${!!draft.neutral}">${icon(draft.neutral ? "check-square" : "square")} Neutral names: ${draft.neutral ? "on" : "off"}</button></div></div>
      ${Object.entries(FIELDS).map(([g, [title, fields]]) => `<div class="panel stack"><h3>${title}</h3><div class="a-grid">${Object.entries(fields).map(([k, [label, hint]]) => { const [lo, hi, whole] = LIMITS[g][k];
        return `<label class="a-field"><b>${label}</b><input class="a-num" type="number" min="${lo}" max="${hi}" step="${whole ? 1 : "any"}" inputmode="decimal" data-set="${g}.${k}" value="${draft[g][k] ?? ""}" placeholder="${g === "engine" ? TUNE[k] : DEFAULTS[g][k]}"><span>${hint} (${lo} to ${hi})</span></label>`; }).join("")}</div></div>`).join("")}
      <div class="panel stack"><h3>Player ratings</h3>
        <p class="muted" style="font-size:13px">Search a player, then set the batting or bowling rating for any of his seasons (20 to 99). His strength in matches moves with the rating, and his overall follows.</p>
        <div class="row" style="align-items:flex-end"><label class="field" style="flex:1 1 200px">Player name<input id="a-q" autocomplete="off" value="${esc(query)}" style="font:500 16px var(--text);text-transform:none;letter-spacing:0"></label>
          <button class="btn" data-action="admin-search">${icon("magnifying-glass")} Search</button></div>
        ${found.length ? table(found) : query.trim().length >= 2 ? '<p class="muted">Nobody by that name.</p>' : ""}
        ${changed.length ? `<h3>Changed so far</h3>${table(changed)}` : ""}</div>
      <div class="row"><button class="btn primary big" data-action="admin-save" ${busy ? "disabled" : ""}>${icon("floppy-disk")} Save changes</button>
        <button class="btn ghost" data-action="admin-reset" ${busy ? "disabled" : ""}>Reset everything to built-in values</button></div></section>`;
  }
  const run = (settings, done) => { busy = true; note = error = ""; call(settings).then(s => { if (settings) reapply(s); open(s); note = done ?? ""; }, e => { error = e.message; }).finally(() => { busy = false; render(); }); };
  const actions = {
    "admin-open"() { closeSheet(); state().screen = "admin"; draft = null; note = error = ""; if (token() || key) run(undefined); },   // an admin account gets straight in
    "admin-unlock"() { key = document.getElementById("a-key").value; run(undefined); },
    "admin-search"() { collect(); note = ""; },
    "admin-unrate"(el) { collect(); delete draft.ratings[el.dataset.key]; },
    "admin-neutral"() { collect(); draft.neutral = !draft.neutral; },
    "admin-save"() { collect(); run(draft, "Saved. The changes are live for every player."); },
    "admin-reset"() { if (confirm("Remove every admin change and go back to the built-in rules, engine and ratings? (Neutral names stays as it is.)")) run(draft.neutral ? { neutral: true } : {}, "Everything is back to the built-in values."); },
  };
  return { screen, actions };
}

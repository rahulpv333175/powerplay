// Powerplay: IPL Mega Auction, Franchise Strategy & T20 Engine.
// Everything runs in the browser; the match engine is the same module the tests use.
// Design system: app/style.css and docs/brand-guidelines.md.
import { createSim, TUNE } from "../sim/engine.mjs";
import { applySettings } from "../sim/settings.mjs";
import { createAdmin } from "./admin.js";
import { STYLES, balance, gaps } from "./styles.mjs";
import { createSeason, versus } from "../sim/league.mjs";
import { SQUAD, MAX_OVERSEAS, MIN_BOWLERS, REROLLS, SLOTS, isBowler, needs, blockReason, openSlots, slotCost, ratingAt, shifts, emptyLineup, packs, deal, chemistry, configure, swap, swapsFor, setBowlRole, BOWL_ROLES } from "./rules.mjs";
import { shareImage, drawPost, drawSquad } from "./share.js";
import { createOnline } from "./online.js";
import { story, grade, awards } from "./story.mjs";
import { explain, review } from "./why.mjs";
import { scout, edges, duel, played } from "./scout.mjs";
import { createAuction } from "./auction.js";

// the mark: a white cricket ball coming in on fire (it reuses the gradients and clip defined once in index.html)
const MARK = `<svg viewBox="0 2 98 94" aria-hidden="true"><path transform="translate(66 62) rotate(0) scale(1) translate(-66 -62)" fill="url(#fo)" d="M88 73C94 55 85 38 66 35C50 33 36 24 30 6C30 18 33 26 41 31C28 30 16 24 9 12C12 26 20 37 33 43C20 44 9 40 2 32C8 46 20 56 35 58C25 61 16 60 9 56C17 68 28 74 42 74C36 78 30 80 25 80C44 92 76 92 88 73Z"/><path transform="translate(66 62) rotate(2) scale(0.85) translate(-66 -62)" fill="url(#fm)" d="M88 73C94 55 85 38 66 35C50 33 36 24 30 6C30 18 33 26 41 31C28 30 16 24 9 12C12 26 20 37 33 43C20 44 9 40 2 32C8 46 20 56 35 58C25 61 16 60 9 56C17 68 28 74 42 74C36 78 30 80 25 80C44 92 76 92 88 73Z"/><path transform="translate(66 62) rotate(4) scale(0.7) translate(-66 -62)" fill="#ff5a4a" d="M88 73C94 55 85 38 66 35C50 33 36 24 30 6C30 18 33 26 41 31C28 30 16 24 9 12C12 26 20 37 33 43C20 44 9 40 2 32C8 46 20 56 35 58C25 61 16 60 9 56C17 68 28 74 42 74C36 78 30 80 25 80C44 92 76 92 88 73Z"/><path transform="translate(66 62) rotate(6) scale(0.55) translate(-66 -62)" fill="#ffb9ad" d="M88 73C94 55 85 38 66 35C50 33 36 24 30 6C30 18 33 26 41 31C28 30 16 24 9 12C12 26 20 37 33 43C20 44 9 40 2 32C8 46 20 56 35 58C25 61 16 60 9 56C17 68 28 74 42 74C36 78 30 80 25 80C44 92 76 92 88 73Z"/><circle cx="66" cy="62" r="20.5" fill="url(#wb)"/><g fill="none" clip-path="url(#wbc)"><path d="M61.0 41.5Q71.5 62 65.5 82.5" stroke="#c1121f" stroke-width="11" stroke-dasharray="1 2.4" opacity=".55"/><path d="M57.0 41.5Q67.5 62 61.5 82.5M61.0 41.5Q71.5 62 65.5 82.5M65.0 41.5Q75.5 62 69.5 82.5" stroke="#c1121f" stroke-width="1.35"/></g><circle cx="66" cy="62" r="20.5" fill="none" stroke="#7a0a12" stroke-opacity=".35" stroke-width=".8"/></svg>`;
const BRAND = "Powerplay", HANDLE = "powerplay";   // HANDLE: the made-up social account that posts results
// Each side: abbreviation and its colours (main, deep, light accent). Abbreviations and colours follow the era.
const TEAMS = { "Chennai Super Kings": ["CSK", "#f2a900", "#123f92", "#fff3b0"], "Mumbai Indians": ["MI", "#0a57c2", "#06245c", "#f2c94c"],
  "Royal Challengers Bengaluru": ["RCB", "#e11b22", "#0c0c0e", "#f5c443"], "Kolkata Knight Riders": ["KKR", "#4b2a8f", "#1d0f3d", "#f2c028"],
  "Sunrisers Hyderabad": ["SRH", "#f2601d", "#1a1a1a", "#ffd9a0"], "Rajasthan Royals": ["RR", "#e8208a", "#1b3f9c", "#ffd1ea"],
  "Delhi Capitals": ["DC", "#1d5fd0", "#8f1024", "#ffd0d0"], "Punjab Kings": ["PBKS", "#dd1f2d", "#5a0d14", "#e6e8ea"],
  "Gujarat Titans": ["GT", "#24407f", "#0b1226", "#d8c27a"], "Lucknow Super Giants": ["LSG", "#00a3ad", "#0b2f6b", "#ffc37a"],
  "Deccan Chargers": ["DCH", "#2a3f9d", "#0c1238", "#d7dbe6"], "Pune Warriors": ["PWI", "#1aa7c2", "#0a2a33", "#d8f6ff"],
  "Rising Pune Supergiant": ["RPS", "#7a2bb5", "#2a0c45", "#ffb3d6"], "Gujarat Lions": ["GL", "#e5651c", "#1a3f9c", "#ffe0c2"], "Kochi Tuskers Kerala": ["KTK", "#f0811c", "#4b1f86", "#ffe7c2"] };
// Neutral names: a switch on the admin screen for the day a rights holder objects. Franchise abbreviations become
// city codes and "IPL" becomes "T20" everywhere the game writes them; players, colours and grounds stay.
const CITY = { "Chennai Super Kings": "CHE", "Mumbai Indians": "MUM", "Royal Challengers Bengaluru": "BLR", "Kolkata Knight Riders": "KOL", "Sunrisers Hyderabad": "HYD", "Rajasthan Royals": "JAI",
  "Delhi Capitals": "DEL", "Punjab Kings": "PJB", "Gujarat Titans": "AHM", "Lucknow Super Giants": "LKO", "Deccan Chargers": "DEC", "Pune Warriors": "PNE", "Rising Pune Supergiant": "PNE",
  "Gujarat Lions": "RJK", "Kochi Tuskers Kerala": "KOC" };
let neutral = false;
try { neutral = localStorage.getItem("powerplay-neutral") === "1"; } catch {}   // remembered, so the launch screen is right before the server answers
const league = () => (neutral ? "T20" : "IPL");
const prize = () => (neutral ? "the title" : "the IPL");   // what you are trying to win
function setNeutral(on) {
  neutral = !!on;
  try { neutral ? localStorage.setItem("powerplay-neutral", "1") : localStorage.removeItem("powerplay-neutral"); } catch {}
  const p = document.querySelector(".splash p"); if (p) p.textContent = `Powerplay · Build your ${league()} XI`;
}
setNeutral(neutral);
function side(team, season = 9999) {
  if (neutral && CITY[team]) { const [, a, b, c] = TEAMS[team]; return { ab: CITY[team], a, b, c }; }
  if (team === "Delhi Capitals" && season <= 2018) return { ab: "DD", a: "#d71920", b: "#12235e", c: "#ffd9a0" };   // Daredevils era
  if (team === "Punjab Kings" && season <= 2020) return { ab: "KXIP", a: "#dd1f2d", b: "#5a0d14", c: "#e6e8ea" };  // Kings XI era
  const [ab, a, b, c] = TEAMS[team] ?? [team, "#3a4270", "#151a3a", "#ffd76a"];
  return { ab, a, b, c };
}
const place = (team, season) => side(team, season).ab;
const NAT = { India: "IND", Australia: "AUS", "South Africa": "SA", England: "ENG", "United Kingdom": "ENG", "New Zealand": "NZ", "Sri Lanka": "SL", "West Indies": "WI", Pakistan: "PAK",
  Afghanistan: "AFG", Bangladesh: "BAN", Zimbabwe: "ZIM", Ireland: "IRE", Netherlands: "NED", Nepal: "NEP", Singapore: "AUS", "United States": "USA", Namibia: "NAM", Kenya: "KEN" };
const SAVE = "powerplay-game-v2", KEEP = "floodlit-v3";   // SAVE: the draft or season in progress; KEEP: the trophy cabinet and room details (key kept from the working title)
const $app = document.getElementById("app"), $where = document.getElementById("where"), $sheet = document.getElementById("sheet");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tier = r => (r >= 95 ? "legend" : r >= 85 ? "gold" : r >= 75 ? "silver" : "bronze");
const ovr = c => { const t = side(c.team, c.season); return `<span class="ovr" style="--a:${t.a};--b:${t.b}">${c.overall ?? "–"}</span>`; };
const icon = (name, label) => `<i class="ph-bold ph-${name}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}></i>`;
const ordinal = n => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let data, sim, allPacks, online, admin, auction, live = null, ticker = null;
const API = document.querySelector('meta[name="api-base"]')?.content ?? "";   // the multiplayer server, or "" when this host is it
let state = { screen: "home" };
const load = () => { try { return JSON.parse(localStorage.getItem(SAVE)); } catch { return null; } };
const card = key => ({ key, ...data.cards[key] });
const squadCards = () => (state.picks ?? []).map(card);
const lineup = () => (state.slots ?? emptyLineup()).map(k => k && card(k));   // the twelve places, null where empty
const label = team => (team === state.name ? team : place(team));
const isMine = m => m.home === state.name || m.away === state.name;
const avg = xs => Math.round(xs.reduce((t, x) => t + x, 0) / Math.max(1, xs.length));
const cabinet = () => { try { return JSON.parse(localStorage.getItem(KEEP + "-cabinet")) ?? {}; } catch { return {}; } };
const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
// which franchises are linked in a squad: three from one side is a link, five a core
function chemLine(cards) {
  const n = {};
  for (const c of cards) (n[c.team] ??= []).push(c);
  const groups = Object.values(n).filter(g => g.length >= 2).sort((a, b) => b.length - a.length);
  return `<div class="chem">${icon("link")} Chemistry ${groups.map(g => { const t = side(g[0].team, g.at(-1).season); return `<b class="${g.length >= 3 ? "" : "off"}" style="--a:${t.a};--b:${t.b}" title="${g.map(c => esc(c.name)).join(", ")}">${t.ab} ×${g.length}${g.length >= 5 ? " core" : g.length >= 3 ? " linked" : ""}</b>`; }).join("") || "<span>none yet</span>"}
    <span>Three old team-mates click and play a little better. Five and it's a proper dressing room.</span></div>`;
}
// a ground's character as badges: its pitch type first, then what the numbers say about it
const TRAIT = { "High-scoring": "trend-up", "Low-scoring": "trend-down", "Six-hitting ground": "rocket-launch", "Hard to clear the rope": "arrows-out", "Helps spin": "spiral", "Helps pace": "wind",
  "New-ball wickets": "target", "Hard to defend at the death": "fire", "Chasing ground": "flag-checkered", "Bat-first ground": "shield", Balanced: "scales", flat: "road-horizon", turning: "spiral", seaming: "wind", balanced: "scales" };
const traits = v => `<span class="traits"><span class="trait pitch">${icon(TRAIT[v.pitch])}${v.pitch[0].toUpperCase() + v.pitch.slice(1)} pitch</span>${v.tags.filter(t => t !== "Balanced").map(t => `<span class="trait">${icon(TRAIT[t])}${t}</span>`).join("")}</span>`;
// each side's emblem: a plain symbol on its colours (made for this game; not any team's logo)
const EMBLEM = { "Chennai Super Kings": "crown", "Mumbai Indians": "waves", "Royal Challengers Bengaluru": "shield-chevron", "Kolkata Knight Riders": "horse", "Sunrisers Hyderabad": "sun",
  "Rajasthan Royals": "diamond", "Delhi Capitals": "bank", "Punjab Kings": "sword", "Gujarat Titans": "mountains", "Lucknow Super Giants": "star-four", "Deccan Chargers": "lightning",
  "Pune Warriors": "shield", "Rising Pune Supergiant": "arrow-fat-up", "Gujarat Lions": "paw-print", "Kochi Tuskers Kerala": "tree-palm" };
const shared = [];   // matches with a post on screen, for the share button
// how a side shapes up by phase, the styles it has, and the jobs nobody is doing
function balanceReport(line) {
  const b = balance(line), have = {}, word = v => (v == null ? "–" : v >= 86 ? "Strong" : v >= 76 ? "Solid" : v >= 68 ? "Thin" : "Weak");
  for (const c of line) for (const st of c?.styles ?? []) have[st] = (have[st] ?? 0) + 1;
  const bars = (title, vals) => `<div class="bal"><h3>${title}</h3>${["Powerplay", "Middle", "Death"].map((p, k) => `<div class="bar"><span>${p}</span><i><b style="width:${vals[k] ?? 0}%"></b></i><span class="${vals[k] != null && vals[k] < 68 ? "low" : ""}">${word(vals[k])}</span></div>`).join("")}</div>`;
  return `<div class="panel stack"><div class="row between"><h3>How your XI shapes up</h3><span class="muted" style="font-size:12px">by phase of the innings</span></div>
    <div class="grid2">${bars("Batting", b.bat)}${bars("Bowling", b.bowl)}</div>
    ${Object.keys(have).length ? `<div class="row">${Object.entries(have).map(([st, n]) => `<span class="chip">${icon(STYLES[st].icon)} ${st}${n > 1 ? ` ×${n}` : ""}</span>`).join("")}</div>` : ""}
    ${gaps(line).length ? `<div class="notes">${gaps(line).map(([, text]) => `<div>${icon("warning")}${text}</div>`).join("")}</div>` : `<p class="chip ok" style="align-self:flex-start">${icon("check")} Every job covered</p>`}</div>`;
}
// during the draft: the first job nobody is doing that someone in this squad could do
function styleNudge(line, cards) {
  if (line.filter(Boolean).length < 3) return "";
  for (const [st, text] of gaps(line)) {
    const c = cards.find(x => x.styles.includes(st) && !blockReason(x, line));
    if (c) return `<p class="nudge">${icon(STYLES[st].icon)} ${text}. ${esc(full(c))} can do that job (${st}).</p>`;
  }
  return "";
}
const styleChips = (cards, on, action) => { const all = [...new Set(cards.flatMap(c => c.styles))].filter(st => STYLES[st]);
  return all.length ? `<div class="scrollx" role="group" aria-label="Filter by playstyle">${all.map(st => `<button class="chip" data-action="${action}" data-s="${st}" aria-pressed="${st === on}">${icon(STYLES[st].icon)} ${st}</button>`).join("")}</div>` : ""; };
const prow = (c, i) => `<div class="srow"><span class="pos num">${i + 1}</span>${ovr(c)}<span class="who"><b>${esc(full(c))}</b><span>${place(c.team, c.season)} ${c.season} · ${c.role}${c.wk ? " · keeper" : ""}${c.overseas ? " · overseas" : ""}</span></span>
  <span class="pair num"><b>${c.bat ?? "–"}</b> bat<br><b>${c.bowl ?? "–"}</b> bowl</span></div>`;
// the side taking shape, place by place: beside the draft on wide screens, in the tray at the bottom on phones
const SHORT = ["OP", "OP", "3", "4", "5", "6", "7", "8", "9", "10", "11", "IMP"];
const slotRow = (c, n) => (c ? `<div class="srow"><span class="pos num">${SHORT[n]}</span>${ovr({ ...c, overall: ratingAt(c, n) })}<span class="who"><b>${esc(full(c))}</b><span>${SLOTS[n]} · ${place(c.team, c.season)} ${c.season}${c.wk ? " · keeper" : ""}${c.overseas ? " · overseas" : ""}${slotCost(c, n) ? ` · <i class="oop">out of position${ratingAt(c, n) < c.overall ? ` (${c.overall} at home)` : ""}</i>` : ""}</span></span>
    <span class="pair num"><b>${c.bat ?? "–"}</b> bat<br><b>${c.bowl ?? "–"}</b> bowl</span></div>`
  : `<div class="srow empty"><span class="pos num">${SHORT[n]}</span><span class="ovr"></span><span class="who"><b>${SLOTS[n]}</b><span>Open</span></span><span></span></div>`);
const placed = line => line.flatMap((c, n) => (c ? [{ ...c, overall: ratingAt(c, n) }] : []));   // the side, each man rated where he actually bats
const draftAside = line => { const squad = placed(line); return `<aside class="aside panel stack"><div class="row between"><h3>Your XI</h3><span class="muted num">${squad.length}/${SQUAD}${squad.length ? ` · rated ${avg(squad.map(c => c.overall))}` : ""}</span></div>
  <div class="sheetlist">${line.map(slotRow).join("")}</div></aside>`; };
// The finished team sheet as buttons: tap a player, then a lit one, and the two trade places.
const swapRows = (line, from, action) => {
  const can = from == null ? [] : swapsFor(line, from), a = line[from], last = c => esc(nameParts(c.name)[1]);
  return `<p class="muted" style="font-size:13px">${from == null ? "Want a different order? Tap a player, then the one to trade places with. Two players can swap when each has batted in the other's spot. To bring the Impact Player into the XI, swap him with someone whose spot he has batted in."
    : can.length ? `Tap a lit player to trade places with ${last(a)}, or tap ${last(a)} again to leave him be.` : `Nobody else can bat where ${last(a)} is. Tap him again to leave him be.`}</p>
  <div class="sheetlist">${line.map((c, n) => { const row = slotRow(c, n), to = can.includes(n);
    return `<button class="srow ${n === from ? "picked" : to ? "canswap" : from != null ? "dim" : ""}" data-action="${action}" data-n="${n}" aria-pressed="${n === from}">${row.slice(row.indexOf(">") + 1, row.lastIndexOf("</div>"))}${
      to ? `<span class="swapnote">${icon("arrows-left-right")} Swap: ${last(c)} ${ratingAt(c, from)} at ${SLOTS[from]}, ${last(a)} ${ratingAt(a, n)} at ${SLOTS[n]}</span>` : ""}</button>`; }).join("")}</div>`;
};
// The team sheet for home and away games: a tab for each, the call at the toss, and (until it is locked) tap-to-swap.
//   plan: { home, away: twelve cards each, toss: { home, away }, venue }   ui: { tab, from }   act: the names of the tab, toss and swap actions
const planEditor = (plan, { tab = "home", from = null }, act, locked = false) => {
  const line = plan[tab], call = plan.toss?.[tab] ?? "", same = plan.away.every((c, n) => c.key === plan.home[n].key);
  const seg = (v, text) => `<button class="chip" data-action="${act.toss}" data-c="${v}" aria-pressed="${call === v}" ${locked ? "disabled" : ""}>${text}</button>`;
  return `<div class="row" role="tablist" aria-label="Home or away side">${[["home", "house", "Home games"], ["away", "airplane-tilt", "Away games"]].map(([t, ic, text]) =>
      `<button class="chip" role="tab" data-action="${act.tab}" data-t="${t}" aria-selected="${t === tab}" aria-pressed="${t === tab}">${icon(ic)} ${text}</button>`).join("")}</div>
    <p class="muted" style="font-size:13px">${tab === "home" ? `Your side at ${esc(plan.venue.split(",")[0])}.` : `Your side on the road${same ? ": the same as at home until you change it" : ""}.`} Set it once here and it is used all season.</p>
    <div class="row" role="group" aria-label="If you win the toss"><span class="muted" style="font-size:13px">If you win the toss</span>${seg("bat", "Bat first")}${seg("bowl", "Bowl first")}${seg("", "Captain decides")}</div>
    ${locked ? `<div class="sheetlist">${line.map(slotRow).join("")}</div>` : swapRows(line, from, act.swap)}`;
};
// The bowling plan: for each bowler, when he is used. One tap per bowler; "Captain" leaves him to the engine.
//   vs (optional): plans kept for single opponents. { tabs: [[id, label]], on: the open tab ("" = all games), plans: { id: plan }, tab: the action that opens a tab }
const attackEditor = (squad, all = {}, action, locked = false, vs = null) => {
  const on = vs?.on && vs.tabs.some(([id]) => id === vs.on) ? vs.on : "", own = on ? vs.plans?.[on] : null, plan = own ?? all, who = on && vs.tabs.find(([id]) => id === on)[1];
  const tabs = !vs?.tabs.length ? "" : `<div class="scrollx" role="group" aria-label="Bowling plan for" data-keep="plans"><button class="chip" data-action="${vs.tab}" data-id="" aria-pressed="${!on}">All games</button>
      ${vs.tabs.map(([id, label]) => `<button class="chip" data-action="${vs.tab}" data-id="${esc(id)}" aria-pressed="${id === on}">${vs.plans?.[id] ? icon("check") : ""}v ${esc(label)}</button>`).join("")}</div>
    <p class="muted" style="font-size:13px">${!on ? "This plan is used in every game that has no plan of its own. Open an opponent to set one for them alone." : own ? `Your plan against ${esc(who)} only.` : `Against ${esc(who)} you are on the all-games plan. Change anything here and it applies to ${esc(who)} alone.`}
      ${own && !locked ? `<button class="link" data-action="${action}" data-vs="${esc(on)}" data-reset="1">Go back to the all-games plan</button>` : ""}</p>`;
  const bowlers = squad.filter(isBowler).sort((a, b) => b.bowl - a.bowl), opts = [["", "Captain"], ...Object.entries(BOWL_ROLES), ["off", "Rest"]];
  return `${tabs}<p class="muted" style="font-size:13px">Say when each bowler is used. He bowls there first and stays out of the other phases where the overs allow; nobody bowls more than four. "Captain" leaves it to your captain, "Rest" keeps him out of the attack.</p>
    <div class="sheetlist">${bowlers.map(c => `<div class="bowlrow"><span class="who"><b>${esc(full(c))}</b><span>${c.bowl} bowling · ${esc(c.type ?? c.kind)}${c.styles?.length ? ` · ${esc(c.styles.filter(s => STYLES[s]?.side !== "bat").slice(0, 2).join(", "))}` : ""}</span></span>
      <span class="row" role="group" aria-label="When ${esc(c.name)} bowls">${opts.map(([v, text]) => `<button class="chip" data-action="${action}" data-key="${c.key}" data-r="${v}" data-vs="${esc(on)}" aria-pressed="${(plan[c.key] ?? "") === v}" ${locked ? "disabled" : ""}>${text}</button>`).join("")}</span></div>`).join("")}</div>`;
};
// phones have no side panel: this opens the same list of places in a sheet
const xiButton = line => `<button class="btn xi-btn" data-action="my-xi">${icon("list-numbers")} Your XI ${placed(line).length}/${SQUAD}</button>`;
const tray = (line, fresh = null) => `<div class="tray"><div class="tray-in"><h3>Your XI</h3><div class="scrollx">${line.map((c, n) => (c
  ? `<span class="slot filled ${c.key === fresh ? "new" : ""}" style="--a:${side(c.team, c.season).a};--b:${side(c.team, c.season).b}"><small>${SHORT[n]}</small><b class="num">${ratingAt(c, n)}</b>${esc(nameParts(full(c))[1])}</span>`
  : `<span class="slot"><small>${SHORT[n]}</small>${n === 11 ? "Impact" : n < 2 ? "Opener" : n > 6 ? "Bowler" : "Batter"}</span>`)).join("")}</div></div></div>`;

// ---------- player card ----------
function nameParts(name) { const i = name.indexOf(" "); return i < 0 ? ["", name] : [name.slice(0, i), name.slice(i + 1)]; }
// the season's real numbers for the card face: three for a specialist, four for an all-rounder
function stats(c) {
  const avg = c.outs ? (c.runs / c.outs).toFixed(1) : c.runs ? `${c.runs}*` : "–", sr = c.balls ? (100 * c.runs / c.balls).toFixed(0) : "–";
  const econ = c.bowl_balls ? (6 * c.conceded / c.bowl_balls).toFixed(2) : "–", bowlAvg = c.wkts ? (c.conceded / c.wkts).toFixed(1) : "–";
  if (c.role === "all-rounder") return [["Runs", c.runs], ["SR", sr], ["Wkts", c.wkts], ["Econ", econ]];
  if (c.role === "bowler") return [["Wkts", c.wkts], ["Econ", econ], ["Avg", bowlAvg]];
  return [["Runs", c.runs], ["Avg", avg], ["SR", sr]];
}
const full = c => c.full ?? c.name;
// The picture on each card, drawn for this game: a cricket ball (stitched seam round the middle), a bat, the stumps
// for a keeper, bat and ball for an all-rounder. One colour, so it takes the card's own tint.
const SEAM = (x, y, r) => { const k = r / 28, p = dx => `M${x + (dx - 4) * k} ${y - 27 * k}Q${x + (dx + 6) * k} ${y} ${x + dx * k} ${y + 27 * k}`;
  return `<g fill="none" stroke="#000" stroke-opacity=".42"><path d="${p(0)}" stroke-width="${13 * k}" stroke-dasharray="${1.3 * k} ${3 * k}" stroke-opacity=".3"/><path d="${p(-5)}${p(0)}${p(5)}" stroke-width="${1.7 * k}"/></g>`; };
const BAT = '<rect x="29" y="1" width="6" height="20" rx="2.6"/><path d="M23 22.5q0-4.5 4.5-4.5h9q4.5 0 4.5 4.5V54q0 7-9 7t-9-7z"/><g fill="none" stroke="#000" stroke-opacity=".34"><path d="M32 23v36" stroke-width="1.6"/><path d="M29 5.5h6M29 9.5h6M29 13.5h6" stroke-width="1.3"/></g>';
const EMBLEMS = {
  ball: `<svg viewBox="0 0 64 64" fill="currentColor"><circle cx="32" cy="32" r="28"/>${SEAM(32, 32, 28)}</svg>`,
  bat: `<svg viewBox="0 0 64 64" fill="currentColor"><g transform="rotate(38 32 32)">${BAT}</g></svg>`,
  both: `<svg viewBox="0 0 64 64" fill="currentColor"><g transform="rotate(38 36 30) translate(4 -2)">${BAT}</g><circle cx="15" cy="49" r="11"/>${SEAM(15, 49, 11)}</svg>`,
  stumps: '<svg viewBox="0 0 64 64" fill="currentColor"><rect x="15" y="15" width="7" height="46" rx="2.5"/><rect x="28.5" y="15" width="7" height="46" rx="2.5"/><rect x="42" y="15" width="7" height="46" rx="2.5"/><rect x="13.5" y="8" width="17" height="5" rx="2.5" transform="rotate(-9 22 10)"/><rect x="33.5" y="8" width="17" height="5" rx="2.5"/></svg>',
};
// where he bats by nature ("Opener", "No. 4"), or his trade for a specialist bowler
function homeSpot(c) {
  if (c.role === "bowler") return c.kind === "spin" ? "Spinner" : "Pacer";
  const n = SLOTS.findIndex((_, k) => k < 11 && slotCost(c, k) === 0);
  return n <= 1 ? "Opener" : SLOTS[n];
}
function playerCard(c, { i = 0, why = null, action = null } = {}) {
  const [first, last] = nameParts(full(c)), t = side(c.team, c.season), tag = action ? "button" : "div", keeper = c.wk && c.role !== "bowler", st = stats(c);
  const pos = keeper ? `Keeper · ${homeSpot(c)}` : c.role === "all-rounder" ? `All-round · ${homeSpot(c)}` : homeSpot(c);
  const emblem = keeper ? "stumps" : c.role === "bowler" ? "ball" : c.role === "all-rounder" ? "both" : "bat";
  const cap = c.cap?.includes("orange") ? "Orange Cap" : c.cap?.includes("purple") ? "Purple Cap" : c.styles?.[0] ?? "";
  return `<${tag} class="fc ${tier(c.overall)} ${why ? "blocked" : ""}" style="--a:${t.a};--b:${t.b};--c:${t.c};--i:${i}" ${action ? `data-action="${action}" data-key="${c.key}" aria-label="${esc(full(c))}, ${t.ab} ${c.season}, rated ${c.overall}${why ? ". " + why : ""}"` : ""}>
    <div class="fc-top"><div><span class="fc-ovr">${c.overall}</span><span class="fc-pos">${pos}</span><span class="fc-nat">${NAT[c.country] ?? esc(c.country.slice(0, 3))}${c.overseas ? " · overseas" : ""}</span></div><div class="fc-club">${t.ab}<small>${c.season}</small></div></div>
    <span class="fc-emblem" aria-hidden="true">${EMBLEMS[emblem]}</span>
    ${c.styles?.length ? `<span class="fc-styles">${c.styles.slice(0, 4).map(st => `<i class="ph-fill ph-${STYLES[st].icon}" title="${st}" role="img" aria-label="${st}"></i>`).join("")}</span>` : ""}
    <div class="fc-name"><small>${esc(first)}</small>${esc(last)}</div>${cap ? `<span class="fc-cap">${esc(cap)}</span>` : ""}
    <dl class="fc-stats n${st.length}">${st.map(([k, v]) => `<div><dd>${v}</dd><dt>${k}</dt></div>`).join("")}</dl>
    ${why ? `<div class="fc-why">${why}</div>` : ""}</${tag}>`;
}

// ---------- helpers for the home page and the reference pages ----------
const teamTile = t => { const cs = data.teams[t].map(card), v = Object.values(data.venues).find(x => x.home === t);
  return `<button class="teamtile" data-action="roster" data-team="${esc(t)}" style="--a:${side(t).a};--b:${side(t).b}">${badge(t, true)}<b>${place(t)}</b><span class="num">Rated ${avg(cs.map(c => c.overall))}</span><span>${esc(v.name.split(",")[0])}</span></button>`; };
const topCards = n => Object.keys(data.cards).map(card).filter(c => c.overall != null).sort((a, b) => b.overall - a.overall || b.runs + 20 * b.wkts - a.runs - 20 * a.wkts).slice(0, n);
function playerGrid() {
  const q = (state.pq ?? "").trim().toLowerCase(), f = FILTERS[state.pf ?? "all"][1];
  const found = Object.keys(data.cards).map(card).filter(c => c.overall != null && f(c) && (!state.pstyle || c.styles.includes(state.pstyle)) && (!q || full(c).toLowerCase().includes(q) || c.name.toLowerCase().includes(q)))
    .sort((a, b) => b.overall - a.overall || b.season - a.season).slice(0, 40);
  return found.map((c, i) => playerCard(c, { i, action: "peek" })).join("") || '<p class="muted">Nobody by that name. Check the spelling, or try a surname.</p>';
}

// ---------- screens ----------
const FILTERS = { all: ["All", () => true], bat: ["Batters", c => c.role === "batter"], bowl: ["Bowlers", c => c.role === "bowler"], ar: ["All-rounders", c => c.role === "all-rounder"], wk: ["Keepers", c => c.wk] };
const screens = {
  home() {
    const resume = load(), find = (n, s) => { const [key, c] = Object.entries(data.cards).find(([, c]) => c.name === n && c.season === s); return { key, ...c }; };
    return `<section class="hero">
        <div class="stack">
          <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 14px;background:rgba(255,59,48,0.14);border:1px solid rgba(255,59,48,0.32);border-radius:20px;width:fit-content;font-size:12px;font-weight:700;color:#ff5247;letter-spacing:0.5px;text-transform:uppercase;">
            ⚡ Official Powerplay Engine
          </div>
          <h1>Dominate the <em>Powerplay.</em></h1>
          <p class="hero-sub">Live IPL Mega Auction · 2026 Franchise Rosters · Real-Time Bidding</p>
          <p>Command the hammer in high-stakes mega auctions with real-time timers under BCCI rules, retain your 2026 stars, or draft your dream T20 squad to claim ${prize()}.</p>
          <div class="cta">
            <button class="btn big" data-action="auction" style="background:linear-gradient(135deg,#ff3b30,#ff9500);color:#fff;font-weight:800;border:none;box-shadow:0 4px 22px rgba(255,59,48,0.45);transform:scale(1.02);">${icon("gavel")} IPL Mega Auction</button>
            <button class="btn primary big" data-action="new">${icon("user")} Single Player</button>
            <button class="btn big multi" data-action="o-open">${icon("users-three")} Multiplayer</button>
            <button class="tile" data-action="club-open">${club ? `${clubCrest(club, false)}<b>${esc(club.team)}</b><span>Managed by ${esc(club.name)} · tap to edit your club</span>` : `${icon("shield-star")}<b>Set up your club</b><span>Name, colours and crest</span>`}</button>
            ${resume && resume.screen !== "home" && resume.screen !== "online" ? `<button class="tile" data-action="resume">${icon("clock-counter-clockwise")}<b>Resume single player</b><span>${resume.screen === "season" ? "Back to your season" : "Finish your draft"}</span></button>` : ""}</div>
        ${cabinet().seasons ? `<p class="cab">${icon("trophy")} <b>${count(cabinet().titles, "title")}</b> in ${count(cabinet().seasons, "season")} · best league finish ${ordinal(cabinet().best)}</p>` : ""}</div>
        <div class="fan" aria-hidden="true">${[find("JJ Bumrah", 2026) || find("SL Malinga", 2011), find("H Klaasen", 2026) || find("AD Russell", 2019), find("V Kohli", 2026) || find("V Kohli", 2016)].map(c => playerCard(c)).join("")}</div>
      </section>
      <section class="how">
        <div class="panel">${icon("gavel")}<b>Live IPL Mega Auction</b><span class="muted">Real-time paddle bidding, 5s/10s timer, authentic 2026 franchise squads, BCCI retention slabs & mystery gavel draws.</span></div>
        <div class="panel">${icon("cards-three")}<b>Build Your Powerplay XI</b><span class="muted">Draft twelve players across modern and classic IPL eras. Impact player rules, max 4 overseas, and balanced bowling.</span></div>
        <div class="panel">${icon("trophy")}<b>Win ${prize()}</b><span class="muted">Simulate fourteen league games and playoffs against all 10 franchises on authentic home venues.</span></div>
      </section>
      <section class="stack"><div class="row between"><h2>The sides between you and the trophy</h2><button class="btn ghost" data-action="go" data-s="teams">All ten 2026 squads</button></div>
        <div class="teamrow">${Object.keys(data.teams).map(teamTile).join("")}</div></section>
      <section class="stack"><div class="row between"><h2>The best there has been</h2><button class="btn ghost" data-action="go" data-s="players">Browse every player</button></div>
        <div class="cardrow">${topCards(8).map((c, i) => playerCard(c, { i, action: "peek" })).join("")}</div></section>
      <section class="stack"><div class="row between"><h2>New here?</h2><button class="btn ghost" data-action="go" data-s="rules">How it works</button></div>
        <p class="muted">Ratings come from every ball bowled since 2008. Matches are played out ball by ball, on real grounds, with real match-ups. No two seasons go the same way.</p></section>`;
  },

  // ---------- reference pages ----------
  teams() {
    return `<section class="stack"><h1>Official 2026 <em>Squads</em></h1>
      <p class="muted">The official 2026 playing 12 for all ten franchises. Tap one to inspect the line-up, overseas balance, and player ratings.</p>
      <div class="teamgrid">${Object.keys(data.teams).map(teamTile).join("")}</div>
      <div class="row"><button class="btn primary big" data-action="new">${icon("user")} Play single player</button><button class="btn ghost" data-action="home">Back</button></div></section>`;
  },
  players() {
    return `<section class="stack"><h1>Every <em>player</em></h1>
      <p class="muted">${Object.keys(data.cards).length.toLocaleString()} player-seasons since 2008, each rated on what he did that year. Tap a card for the detail.</p>
      <label class="field">Find a player<input id="p-q" autocomplete="off" placeholder="Kohli, Bumrah, Gayle" value="${esc(state.pq ?? "")}" style="font:500 16px var(--text);text-transform:none;letter-spacing:0"></label>
      <div class="scrollx" role="group" aria-label="Filter players">${Object.entries(FILTERS).map(([k, [name]]) => `<button class="chip" data-action="pfilter" data-f="${k}" aria-pressed="${k === (state.pf ?? "all")}">${name}</button>`).join("")}</div>
      ${styleChips(Object.values(data.cards), state.pstyle, "pstyle")}
      <div class="cards" id="p-grid">${playerGrid()}</div>
      <div class="row"><button class="btn ghost" data-action="home">Back</button></div></section>`;
  },
  rules() {
    const item = (ic, title, text) => `<div class="panel stack">${icon(ic)}<h2>${title}</h2><p class="muted">${text}</p></div>`;
    return `<section class="stack"><h1>How it <em>works</em></h1>
      <div class="rulegrid">
        ${item("cards-three", "The draft", `Twelve picks. Each pick shows you one squad from one season; take one player and move on. You get ${REROLLS} reroll${REROLLS === 1 ? "" : "s"} if a squad does nothing for you.`)}
        ${item("list-numbers", "Where he bats", "Every pick goes into a place in the order: opener to No. 11, plus an Impact Player. A player is offered the places he actually batted. His natural spot costs nothing; play him elsewhere and his rating drops.")}
        ${item("scales", "Squad rules", `At most ${MAX_OVERSEAS} overseas players, at least one wicketkeeper and ${MIN_BOWLERS} bowlers. Places 8 to 11 are for bowlers.`)}
        ${item("chart-line-up", "Ratings", "Out of 99, for that player in that season, built from every ball: runs and wickets against what an average player managed in the same phase and role. Orange and Purple Cap winners sit at the top.")}
        ${item("link", "Chemistry", "Three players from the same franchise click and play a little better. Five make a proper dressing room.")}
        ${item("map-pin", "Grounds", "Every ground plays differently: flat, turning or seaming, with its own powerplay, middle and death overs. Pick a home ground that suits your side.")}
        ${item("cricket", "Matches", "Played ball by ball. Batter against bowler type, phase of the innings, the ground, the chase. Good players can still fail and the tail can still win you one.")}
        ${item("trophy", "The season", `Building the XI is half of it. The other half is winning ${prize()}: fourteen league games against nine all-time franchise XIs (five of them twice, four once, as in the real league), then playoffs for the top four. Win the final and the trophy goes in your cabinet.`)}
        ${item("users-three", "Multiplayer", "Head to head is a best-of-five series. Mini league is four teams and a final. Full league is up to ten players with playoffs. Everyone drafts from the same squads, and a player can be in only one side: once someone has him, every season of his is gone. You ready up once, then play through your matches at your own pace.")}
        ${item("coin", "Home, away and the toss", "After the draft you can set one batting order for home games and another for away, and say whether you bat or bowl if you win the toss. Leave the toss alone and your captain goes by the ground.")}
        ${item("target", "Your attack", "Say which bowlers take the new ball, the middle overs and the death, or rest one. Bowlers are better in some phases than others, and batters have real records against the bowlers they have faced, so who bowls when changes the result.")}
        ${item("binoculars", "Scouting", "In a room, your team sheet shows the match-ups that matter against each opponent: your bowler who keeps getting their opener, their bowler who has your No. 3's number. During the draft, a player's sheet tells you what he would mean against the players the others have already taken.")}
        ${item("question", "Why you won or lost", "Every result has a Why button. It replays that exact fixture 300 times to show the real odds, how much the ground mattered, how each side's spin and pace fare against the other's batters, and where the match was decided.")}
        ${item("shield-star", "Your club", "One name, colours and crest for everything you play. Sign in with Google to keep it, and your records, on any device.")}
      </div>
      <div class="row"><button class="btn primary big" data-action="new">${icon("user")} Play single player</button><button class="btn ghost" data-action="home">Back</button></div></section>`;
  },

  draft() {
    const squad = squadCards(), line = lineup(), n = needs(line), pack = allPacks.find(p => p.id === state.pack), f = state.filter ?? "all";
    const shown = pack.cards.filter(FILTERS[f][1]).filter(c => !state.fstyle || c.styles.includes(state.fstyle));
    const ball = i => `<span class="ball ${i < squad.length ? "done" : i === squad.length ? "now" : ""} ${i === squad.length - 1 && state.reveal ? "new" : ""}"></span>`;
    return `<div class="split"><section class="stack">
      <div class="row between">
        <div class="steps" role="img" aria-label="Pick ${squad.length + 1} of ${SQUAD}">${SHORT.map((_, i) => ball(i)).join("")}</div></div>
      <div class="packhead"><h3>Pick ${squad.length + 1} of ${SQUAD} · who's in, and where does he bat?</h3>
        ${slotHead(pack, "reroll", state.rerolls, !!state.rerolls)}</div>
      <div class="row">${xiButton(line)}<span class="chip ${n.keeper ? (n.left <= 3 ? "warn" : "") : "ok"}">${icon(n.keeper ? "hand-palm" : "check")} ${n.keeper ? "Keeper needed" : "Keeper"}</span>
        <span class="chip ${n.bowlers ? (n.bowlers >= n.left - 1 ? "warn" : "") : "ok"}">${icon(n.bowlers ? "target" : "check")} Bowlers ${MIN_BOWLERS - n.bowlers}/${MIN_BOWLERS}</span>
        <span class="chip ${n.overseas >= MAX_OVERSEAS ? "warn" : ""}">${icon("airplane-tilt")} Overseas ${n.overseas}/${MAX_OVERSEAS}</span></div>
      ${(() => { const have = squad.filter(c => c.team === pack.team).length; return have ? `<p class="muted" style="font-size:13px">${icon("link")} You have ${have} from ${place(pack.team, pack.season)}. ${have === 2 ? "One more and they click." : have === 4 ? "One more and it's a proper dressing room." : have >= 3 ? "They already click." : "Two more and they click."}</p>` : ""; })()}
      <div class="scrollx" role="group" aria-label="Filter players">${Object.entries(FILTERS).map(([k, [name, fn]]) => `<button class="chip" data-action="filter" data-f="${k}" aria-pressed="${k === f}">${name} <span class="num">${pack.cards.filter(fn).length}</span></button>`).join("")}</div>
      ${styleChips(pack.cards, state.fstyle, "fstyle")}
      ${styleNudge(line, pack.cards)}
      <div class="cards ${state.reveal ? "deal late" : ""}">${shown.map((c, i) => playerCard(c, { i, why: blockReason(c, line), action: "inspect" })).join("") || '<p class="muted">Nobody in this squad fits that filter. Try another.</p>'}</div>
    </section>${draftAside(line)}</div>
    ${tray(line, state.reveal ? state.picks.at(-1) : null)}`;
  },

  squad() {
    const order = state.order.map(card), side = sim.sides({ name: "x", players: state.order });
    const noBat = order.find(c => !side.batting.some(p => p.key === c.key)), noBowl = order.find(c => !side.bowling.some(p => p.key === c.key));
    const g = grade(placed(order));
    return `<section class="stack">
      <h1>Your all-time <em>${league()} XI</em></h1>
      <div class="grade"><b>${g.letter}</b><div><h3>The verdict on your draft</h3><p>${g.line}</p><p class="muted">Steal of the draft: ${esc(g.steal.name)}, ${place(g.steal.team, g.steal.season)} ${g.steal.season} (${g.steal.overall})</p></div></div>
      <div class="kpis"><div class="kpi"><b>${avg(placed(order).map(c => c.overall))}</b><span>Squad rating</span></div>
        <div class="kpi"><b>${avg(side.batting.slice(0, 7).map(c => c.bat ?? 0))}</b><span>Top seven</span></div>
        <div class="kpi"><b>${avg(order.filter(isBowler).map(c => c.bowl))}</b><span>Bowling</span></div>
        <div class="kpi"><b>${order.filter(c => c.overseas).length}/${MAX_OVERSEAS}</b><span>Overseas</span></div></div>
      ${chemLine(order)}
      ${balanceReport(order)}
      <div class="clubline">${badge(state.name, true)}<div><b>${esc(state.name)}</b><span class="muted">${club ? `Managed by ${esc(club.name)}` : "Your club is not set up yet"}</span></div>
        <button class="btn ghost" data-action="club-open">${club ? "Edit club" : "Set up your club"}</button></div>
      <div class="stack"><h3>Home ground</h3>
        <div class="grounds" data-keep="grounds">${Object.values(data.venues).map(v => `<button class="ground" data-action="venue" data-v="${esc(v.name)}" aria-pressed="${v.name === state.venue}">
          <b>${esc(v.name)}</b>${traits(v)}</button>`).join("")}</div></div>
      <div class="panel stack"><div class="row between"><h3>Your XI</h3><span class="muted" style="font-size:13px">Impact Player rule: ${esc(nameParts(noBat.name)[1])} bowls only, ${esc(nameParts(noBowl.name)[1])} bats only</span></div>
        ${planEditor({ home: order, away: (state.awaySlots ?? state.slots).map(card), toss: state.toss, venue: state.venue }, { tab: state.planTab, from: state.swapFrom ?? null }, { tab: "plan-tab", toss: "plan-toss", swap: "swap" })}</div>
      <div class="panel stack"><h3>Your attack</h3>${attackEditor(order, state.bowlPlan, "bowl-role", false, { tabs: Object.keys(data.teams).map(t => [t, place(t)]), on: state.bowlTab, plans: state.bowlVs, tab: "bowl-tab" })}</div>
      <div class="row"><button class="btn primary big" data-action="start-season">Take the field</button><button class="btn" data-action="share-squad">${icon("image")} Share squad</button></div>
    </section>`;
  },

  season() {
    const me = state.name, table = live.standings(), mine = table.findIndex(r => r.team === me), row = table[mine], up = live.upcoming(), tab = state.tab ?? "match";
    const all = [...live.played.flat(), ...live.playoffs];
    const form = t => `<span class="form" aria-label="Recent form">${all.filter(m => m.home === t || m.away === t).slice(-5).map(m => `<span class="${m.winner === t ? "w" : ""}">${m.winner === t ? "W" : "L"}</span>`).join("")}</span>`;
    const fx = up?.fixtures.find(f => f.home === me || f.away === me) ?? up?.fixtures[0];
    const totalDays = live.played.length;
    const hasPlayoffs = live.playoffs && live.playoffs.length > 0;
    let activeDay = state.viewDay;
    if (activeDay == null || (activeDay !== "playoffs" && activeDay >= totalDays)) {
      activeDay = hasPlayoffs ? "playoffs" : Math.max(0, totalDays - 1);
    }
    const selectedMatches = activeDay === "playoffs" ? live.playoffs : (live.played[activeDay] ?? []);
    const dayTitle = activeDay === "playoffs" ? "Playoffs" : (live.rounds[activeDay]?.stage || `Matchday ${activeDay + 1}`);

    const matchdayResultsView = () => (selectedMatches.length || totalDays ? `
      <div class="row between" style="margin-top:20px;align-items:center">
        <h3>${esc(dayTitle)} results</h3>
        <span class="muted" style="font-size:12px">${selectedMatches.length} match${selectedMatches.length === 1 ? "" : "es"}</span>
      </div>
      ${totalDays > 1 || hasPlayoffs ? `
        <div class="scrollx" data-keep="md-chips" role="group" aria-label="Select matchday" style="gap:6px;margin:8px 0 14px;padding-bottom:4px">
          ${live.played.map((_, i) => `<button class="chip" data-action="matchday-select" data-day="${i}" aria-pressed="${activeDay === i}">MD ${i + 1}</button>`).join("")}
          ${hasPlayoffs ? `<button class="chip" data-action="matchday-select" data-day="playoffs" aria-pressed="${activeDay === "playoffs"}" style="${activeDay === "playoffs" ? "color:var(--gold);font-weight:700" : ""}">${icon("trophy")} Playoffs</button>` : ""}
        </div>
      ` : ""}
      <div class="stack">${[...selectedMatches].sort((a, b) => isMine(b) - isMine(a)).map(m => resultRow(m, all.indexOf(m))).join("")}</div>
    ` : "");

    const views = {
      match: () => `${live.done ? `<div class="title ${live.champion === me ? "" : "plain"}"><i class="ph-fill ph-trophy" aria-hidden="true"></i><h3>Champions</h3><h1>${esc(label(live.champion))}</h1>
            <p class="muted">${live.champion === me ? "Champions. Somebody book the open-top bus." : `You finished ${ordinal(mine + 1)}${live.playoffs.some(isMine) ? " and made the playoffs. So close" : " and missed the playoffs, so they went on without you. There is always next season"}.`}</p>
            <div class="row" style="justify-content:center"><button class="btn primary big" data-action="new">Go again</button><button class="btn" data-action="home">${icon("house")} Home</button><button class="btn" data-action="review">${icon("question")} Why it went that way</button></div></div>
            <div class="awards">${[{ icon: "trophy", title: "Record", text: `${row.won} won, ${row.lost} lost · ${ordinal(mine + 1)} in the league` }, ...awards(all, me, label)].map(a => `<div class="panel">${icon(a.icon)}<h3>${a.title}</h3><b>${esc(a.text)}</b></div>`).join("")}</div>`
          : `<div class="fixture" style="--h:${(fx.home === me ? kit(me) : side(fx.home)).a};--w:${(fx.away === me ? kit(me) : side(fx.away)).a}"><div class="row between"><h3>${esc(fx.stage ?? up.stage)}</h3><span class="muted" style="font-size:13px">${icon("map-pin")} ${esc(fx.venue)}</span></div>
            <div class="versus"><div class="side">${badge(fx.home, true)}<b>${esc(label(fx.home))}</b>${form(fx.home)}</div><span class="v">v</span><div class="side">${badge(fx.away, true)}<b>${esc(label(fx.away))}</b>${form(fx.away)}</div></div>
            ${traits(data.venues[fx.venue])}${isMine(fx) ? "" : '<p class="muted" style="font-size:13px">Your lot have the night off.</p>'}
            <div class="row"><button class="btn primary big" data-action="play">${icon("play")} ${isMine(fx) ? "Play match" : "Play"}</button>
              <button class="btn" data-action="quick">${icon("fast-forward")} Quick result</button>
              <button class="btn ghost" data-action="sim-all">${live.leagueDone ? "Sim to the final" : "Sim the league"}</button>
              ${isMine(fx) ? `<button class="btn ghost" data-action="roster" data-team="${esc(fx.home === me ? fx.away : fx.home)}">${icon("binoculars")} Scout ${esc(label(fx.home === me ? fx.away : fx.home))}</button>` : ""}</div></div>`}
        ${matchdayResultsView()}`,
      table: () => `<div class="panel scroll"><table><thead><tr><th>#</th><th class="l">Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th><th>NRR</th></tr></thead><tbody>
          ${table.map((r, i) => `<tr class="${r.team === me ? "me" : ""} ${i === 3 ? "cut" : ""}"><td>${i + 1}</td><td class="l">${badge(r.team)}<button class="link" data-action="roster" data-team="${esc(r.team)}">${esc(label(r.team))}</button></td><td>${r.played}</td><td>${r.won}</td><td>${r.lost}</td><td><b>${r.points}</b></td><td>${(r.nrr >= 0 ? "+" : "") + r.nrr.toFixed(2)}</td></tr>`).join("")}
        </tbody></table></div><p class="muted" style="font-size:13px">Top four make the playoffs. Tap a side to scout its squad.</p>
        ${matchdayResultsView()}`,
      stats: () => `<div class="grid2">
          <div class="panel scroll"><h3><span class="tag orange">Orange Cap</span> Most runs</h3><table><tbody>${live.orangeCap().map((x, i) => `<tr class="${x.team === me ? "me" : ""}"><td>${i + 1}</td><td class="l">${badge(x.team)}${esc(x.name)}</td><td><b>${x.runs}</b></td><td class="muted">SR ${x.balls ? (100 * x.runs / x.balls).toFixed(0) : "–"}</td></tr>`).join("")}</tbody></table></div>
          <div class="panel scroll"><h3><span class="tag purple">Purple Cap</span> Most wickets</h3><table><tbody>${live.purpleCap().map((x, i) => `<tr class="${x.team === me ? "me" : ""}"><td>${i + 1}</td><td class="l">${badge(x.team)}${esc(x.name)}</td><td><b>${x.wickets}</b></td><td class="muted">econ ${x.balls ? (6 * x.runs / x.balls).toFixed(2) : "–"}</td></tr>`).join("")}</tbody></table></div></div>`,
      squad: () => `<div class="panel stack"><div class="row between"><h3>${esc(me)}</h3><span class="muted" style="font-size:13px">${icon("map-pin")} ${esc(state.venue)}</span></div>
          ${chemLine(state.order.map(card))}<div class="sheetlist">${state.order.map(card).map(prow).join("")}</div>
          <div class="row"><button class="btn" data-action="share-squad">${icon("image")} Share squad</button></div></div>`,
      feed: () => { const posts = all.filter(m => isMine(m) || m.stage === "Final").reverse().slice(0, 8);
        const tags = [...new Set(posts.map(m => story(m, label).tag))].slice(0, 4);
        return `<div class="row between"><h3>What they're saying</h3>${tags.length ? `<div class="trend">${icon("trend-up")} Trending ${tags.map(t => `<b>${esc(t)}</b>`).join("")}</div>` : ""}</div>${posts.length ? `<div class="feedlist">${posts.map(post).join("")}</div>` : '<p class="muted">Nothing to post yet. Go and play a match.</p>'}`; },
    };
    const tv = k => `<div class="tv stack" data-on="${tab === k}">${views[k]()}</div>`;   // phones show one tab; wide screens show them all
    const tabBtn = (k, ic, text) => `<button role="tab" data-action="tab" data-t="${k}" aria-selected="${tab === k}">${icon(ic)}${text}</button>`;
    return `<section class="stack">
        <div class="kpis"><div class="kpi"><b>${row.won}–${row.lost}</b><span>Won–lost</span></div><div class="kpi"><b>${ordinal(mine + 1)}</b><span>Position</span></div>
          <div class="kpi"><b>${row.points}</b><span>Points</span></div><div class="kpi"><b>${(row.nrr >= 0 ? "+" : "") + row.nrr.toFixed(2)}</b><span>Net run rate</span></div></div>
        <div class="dash"><div class="stack">${tv("match")}${tv("stats")}</div><div class="stack">${tv("table")}${tv("squad")}</div></div>${tv("feed")}</section>
      <nav class="tabs" role="tablist" aria-label="Season">${tabBtn("match", "cricket", "Match")}${tabBtn("table", "ranking", "Table")}${tabBtn("stats", "chart-bar", "Caps")}${tabBtn("squad", "users-three", "Squad")}${tabBtn("feed", "chat-circle-text", "Feed")}</nav>`;
  },

  match() {
    const m = state.watch;
    return `<section class="mc">
      <div class="mc-top"><span>${esc(m.stage)} · ${esc(m.venue)}</span><span class="row" style="flex-wrap:nowrap;gap:6px"><button class="btn ghost" data-action="speed" id="speed" aria-label="Playback speed">${SPEEDS[state.speed ?? 1][0]}</button>
        <button class="btn ghost" data-action="skip" id="skip">${icon("skip-forward")} Skip</button></span></div>
      <p class="mc-toss">${esc(m.toss.replace(m.home, label(m.home)).replace(m.away, label(m.away)))}. It is ${esc(m.pitch)}.</p>
      ${data.venues[m.venue] ? traits(data.venues[m.venue]) : ""}
      <div class="mc-grid"><div class="stack">
        <div class="mc-bug" id="m-bug"></div>
        <div class="mc-flash" id="m-flash" aria-hidden="true"></div>
        <div class="mc-miles" id="m-miles" aria-label="Milestones"></div>
        <div class="mc-panel" id="m-over"></div>
        <div class="mc-panel" id="m-crease"></div>
      </div><div class="stack">
        <div class="mc-panel" id="m-win"></div>
        <div class="mc-panel" id="m-manh"></div>
        <div class="mc-panel feed" id="feed" aria-live="polite"></div>
      </div></div>
      <div id="verdict" hidden></div></section>`;
  },
};

function resultRow(m, index, action = "scorecard") {
  const cls = t => (m.winner === t ? "" : "lost");
  return `<button class="result-row ${isMine(m) ? "mine" : ""}" data-action="${action}" data-i="${index}">
    ${m.innings.map(inn => `<span class="t ${cls(inn.team)}">${badge(inn.team)}${esc(label(inn.team))}</span><span class="s ${cls(inn.team)}">${inn.score}/${inn.wickets} <span class="muted" style="font:500 13px var(--text)">(${inn.overs})</span></span>`).join("")}
    <span class="note">${/^Match/.test(m.stage) ? "" : esc(m.stage) + " · "}${esc(m.result.replace(m.winner, label(m.winner)))} · Player of the match ${esc(m.playerOfMatch.name)}</span></button>`;
}
// the match as a post on a made-up social feed (laid out like a real one: avatar, text, picture, actions, replies)
const kilo = n => (n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n));
const ago = m => { const h = 1 + (m.innings[0].score + m.innings[1].score) % 9; return `${h}h`; };
function post(m) {
  const st = story(m, label), w = m.winner === state.name ? kit(m.winner) : side(m.winner), act = (ic, n, extra = "") => `<span ${extra}>${icon(ic)} ${n}</span>`;
  return `<article class="post">
    <header><span class="avatar">${MARK}</span>
      <span class="who"><b>${BRAND} Live <i class="ph-fill ph-seal-check" role="img" aria-label="Verified"></i></b><span>@${HANDLE}live · ${ago(m)}</span></span>${icon("dots-three")}</header>
    <p><b>${esc(st.headline)}.</b> ${esc(st.body)} <span class="hash">${esc(st.tag)}</span></p>
    <div class="post-media" style="--a:${w.a};--b:${w.b}"><span class="pm-kicker">Result · ${esc(m.stage)}</span>
      ${m.innings.map(inn => `<div class="${m.winner === inn.team ? "won" : ""}">${badge(inn.team)}<b>${esc(label(inn.team))}</b><span class="num">${inn.score}/${inn.wickets}<small>(${inn.overs})</small></span></div>`).join("")}
      ${st.moments.length ? `<p>${st.moments.map(x => `<span>${icon(x.icon)} ${esc(x.text)}</span>`).join("")}</p>` : ""}
      <span class="pm-brand">${esc(m.venue)} · ${BRAND}</span></div>
    <div class="post-acts">${act("chat-circle", kilo(Math.round(st.likes / 14)))}${act("repeat", kilo(st.reposts))}
      <button data-action="like" data-n="${st.likes}" aria-label="Like this post" aria-pressed="false">${icon("heart")} <span>${kilo(st.likes)}</span></button>${act("chart-bar", kilo(st.likes * 23))}
      <button data-action="share" data-i="${shared.push(m) - 1}" aria-label="Share as an image">${icon("export")}</button></div>
    <div class="post-replies">${st.replies.map((r, n) => `<div><span class="avatar fan" style="--h:${(st.likes * (n + 3)) % 360}">${r.name[0]}</span><div><b>${r.name}</b> <span>${r.who} · ${5 + n * 7}m</span><p>${esc(r.text)}</p>
      <small>${icon("heart")} ${r.likes}</small></div></div>`).join("")}</div></article>`;
}
// a side's crest: its emblem on its colours (your own side wears the house colours; other drafted sides get a colour from their name)
function badge(t, big = false) {
  const mine = t === state.name, theirs = mine ? null : online?.kitOf(t);   // another player's club, in a room
  let k = mine ? kit(t) : theirs?.a ? theirs : side(t);
  if (!TEAMS[t] && !mine && !theirs?.a) { let h = 0; for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) % 360; k = { a: `hsl(${h} 62% 46%)`, b: `hsl(${h} 70% 16%)` }; }
  const emblem = mine ? club?.emblem ?? "cricket" : theirs?.emblem ?? EMBLEM[t] ?? "cricket";
  return `<span class="crest ${big ? "big" : ""}" style="--a:${k.a};--b:${k.b}" title="${esc(t)}"><i class="ph-fill ph-${emblem}" aria-hidden="true"></i></span>`;
}

// ---------- your club: one name, colours and crest for everything you play ----------
const CLUB_KEY = "powerplay-club";
let club = null, clubDraft = null;
try { club = JSON.parse(localStorage.getItem(CLUB_KEY)); } catch {}
const CLUB_COLOURS = [["#d1121f", "#5c0a12"], ["#0a57c2", "#06245c"], ["#f2a900", "#6b4300"], ["#7a2bb5", "#2a0c45"], ["#00a3ad", "#06363a"], ["#1f9d55", "#0b3d24"], ["#f2601d", "#5a1d05"], ["#e8208a", "#4a0a3a"], ["#3a4270", "#151a3a"], ["#4b5563", "#111827"]];
const CLUB_EMBLEMS = ["fire", "crown", "lightning", "shield-chevron", "sword", "sun", "star-four", "mountains", "paw-print", "horse", "diamond", "rocket-launch"];
const clubCrest = (c, big = true) => `<span class="crest ${big ? "big" : ""}" style="--a:${c.a};--b:${c.b}"><i class="ph-fill ph-${c.emblem}" aria-hidden="true"></i></span>`;
function saveClub(c) { club = c; try { localStorage.setItem(CLUB_KEY, JSON.stringify(c)); } catch {} }
function clubSheet(note = "", warn = "") {
  const d = clubDraft ??= { name: club?.name ?? (state.o?.name && state.o.name !== "Player" ? state.o.name : ""), team: club?.team ?? "", a: club?.a ?? CLUB_COLOURS[0][0], b: club?.b ?? CLUB_COLOURS[0][1], emblem: club?.emblem ?? "fire", venue: club?.venue ?? Object.keys(data.venues)[0] };
  openSheet(`<div class="row between"><h2>${club ? "Your club" : "Set up your club"}</h2><button class="btn icon ghost" data-action="close-sheet" aria-label="Close">${icon("x")}</button></div>
    ${note ? `<p class="chip ok">${icon("check")} ${esc(note)}</p>` : ""}
    <p class="muted">One club for everything you play: every draft, every room, every record.</p>
    <div class="clubline">${clubCrest(d)}<div><b>${esc(d.team || "Your team")}</b><span class="muted">Managed by ${esc(d.name || "you")}</span></div></div>
    <label class="field">Your name<input id="club-name" maxlength="18" autocomplete="nickname" value="${esc(d.name)}"></label>
    <label class="field">Team name<input id="club-team" maxlength="24" autocomplete="off" placeholder="Night Watch" value="${esc(d.team)}"></label>
    <h3>Club colours</h3><div class="swatches" role="group" aria-label="Club colours">${CLUB_COLOURS.map(([a, b], n) => `<button class="swatch" data-action="club-colour" data-i="${n}" aria-pressed="${a === d.a}" aria-label="Colour ${n + 1}" style="--a:${a};--b:${b}"></button>`).join("")}</div>
    <h3>Crest</h3><div class="swatches" role="group" aria-label="Crest">${CLUB_EMBLEMS.map(e => `<button class="swatch em" data-action="club-emblem" data-e="${e}" aria-pressed="${e === d.emblem}" aria-label="${e.replace("-", " ")}"><i class="ph-fill ph-${e}" aria-hidden="true"></i></button>`).join("")}</div>
    <label class="field">Home ground<select id="club-venue">${Object.keys(data.venues).map(v => `<option ${v === d.venue ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
    ${warn ? `<p class="chip warn" role="alert">${icon("warning")} ${esc(warn)}</p>` : ""}
    <div class="row"><button class="btn primary big" data-action="club-save">Save club</button></div>`, "Your club");
}
function readClub() {   // the sheet is redrawn when a colour or crest is chosen: keep what has been typed
  const v = id => document.getElementById(id)?.value;
  if (clubDraft && v("club-name") != null) Object.assign(clubDraft, { name: v("club-name").trim().slice(0, 18), team: v("club-team").trim().slice(0, 24), venue: v("club-venue") });
}
// any side's twelve, in a sheet
function roster(title, sub, keys) {
  const cs = keys.map(card);
  return `<div class="row between"><div><h2>${esc(title)}</h2><p class="muted" style="font-size:13px">${esc(sub)}</p></div><button class="btn icon ghost" data-action="close-sheet" aria-label="Close squad">${icon("x")}</button></div>
    ${cs.length ? `<div class="kpis"><div class="kpi"><b>${avg(cs.map(c => c.overall))}</b><span>Squad rating</span></div><div class="kpi"><b>${avg(cs.map(c => c.bat ?? 0).sort((a, b) => b - a).slice(0, 7))}</b><span>Top seven</span></div>
      <div class="kpi"><b>${avg(cs.filter(isBowler).map(c => c.bowl))}</b><span>Bowling</span></div><div class="kpi"><b>${cs.filter(c => c.overseas).length}/${MAX_OVERSEAS}</b><span>Overseas</span></div></div>
      <div class="sheetlist">${cs.map(prow).join("")}</div>` : '<p class="muted">No picks yet. The paddle is still down.</p>'}`;
}
// "Why did it go that way?": the match is replayed 300 times with the same sides, here and at a neutral ground (app/why.mjs)
let soloTeams = {}, whyMatch = null;
const whyLabel = m => (isMine(m) ? (m.winner === state.name ? "Why you won" : "Why you lost") : "Why?");
function whySheet(m, watching) {
  const teams = online.active ? online.teams() : soloTeams, visitors = teams[m.away];
  const e = explain({ m, sim, home: versus(teams[m.home], m.away), away: versus(visitors.away ? { ...visitors, ...visitors.away } : visitors, m.home), cards: t => teams[t].players.map(card), me: isMine(m) ? state.name : null, label, venues: data.venues, h2h: data.h2h });
  openSheet(`<div class="row between" style="flex-wrap:nowrap;align-items:flex-start"><div style="min-width:0"><h2>${esc(e.headline)}</h2><p class="muted" style="font-size:14px">${esc(m.result.replace(m.winner, label(m.winner)))} · ${esc(m.venue)}</p></div>
      <button class="btn icon ghost" data-action="close-sheet" aria-label="Close">${icon("x")}</button></div>
    <div class="whys">${e.points.map(p => `<div class="why">${icon(p.icon)}<div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div></div>`).join("")}</div>
    <p class="muted" style="font-size:12px">The odds come from playing this exact fixture 300 more times with the same two sides, so they are good to a few points either way.</p>
    ${watching ? '<div class="row" style="justify-content:center"><button class="btn primary big" data-action="after-match">Continue</button></div>' : ""}`, e.headline);
}
// The match summary, as a broadcast would put it up at the end: each innings with its three best with bat and ball, the
// result, the player of the match, and how the head-to-head match-ups that met in this match turned out.
function summary(m) {
  const nm = x => x.player?.name ?? x.name, teams = online.active ? online.teams() : soloTeams, cardsOf = t => teams[t]?.players.map(card) ?? [];
  const ov = b => `${Math.floor(b / 6)}${b % 6 ? "." + b % 6 : ""}`;
  const block = inn => { const t = kit(inn.team);
    const bats = [...inn.batting].sort((a, b) => b.runs - a.runs || a.balls - b.balls).slice(0, 3), bowls = [...inn.bowling].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs).slice(0, 3);
    return `<section class="tv-inn" style="--a:${t.a};--b:${t.b}"><header>${badge(inn.team, true)}<b>${esc(label(inn.team))}</b><span class="num">${inn.score}<i>/</i>${inn.wickets}</span><small class="num">${inn.overs} ov</small></header>
      <div class="tv-cols"><ul aria-label="Batting">${bats.map(x => `<li><span>${esc(nm(x))}${x.out ? "" : "*"}</span><b class="num">${x.runs}</b><small class="num">${x.balls}</small></li>`).join("")}</ul>
        <ul aria-label="Bowling">${bowls.map(x => `<li><span>${esc(nm(x))}</span><b class="num">${x.wickets}/${x.runs}</b><small class="num">${ov(x.balls)}</small></li>`).join("")}</ul></div></section>`; };
  // a match-up counts as going your way when your man came out on top, whichever way the history pointed
  const ups = played(m, cardsOf, data.h2h).slice(0, 3).map(u => { const fig = `${u.runs} off ${u.balls}${u.out ? ", out" : ""}`, bowlerWon = (u.edge === "bowler") === u.held;
    const mine = u.bowlTeam === state.name ? bowlerWon : u.batTeam === state.name ? !bowlerWon : null;
    const text = u.edge === "bowler" ? (u.held ? `${u.bowl} had the better of ${u.bat} again` : `${u.bat} got away from ${u.bowl} this time`) : u.held ? `${u.bat} took to ${u.bowl} again` : `${u.bowl} kept ${u.bat} quiet this time`;
    return `<li class="${mine == null ? "" : mine ? "good" : "bad"}">${icon(mine === false ? "x" : "check")}<span><b>${esc(text)}</b> ${fig}</span></li>`; });
  return `<div class="tv"><header class="tv-top"><b>Match summary</b><span>${esc(m.stage)} · ${esc(m.venue.split(",")[0])}</span></header>
    ${m.innings.map(block).join("")}
    <div class="tv-result"><b>${esc(m.result.replace(m.winner, label(m.winner)))}</b><span>${icon("medal")} Player of the match: ${esc(m.playerOfMatch.name)}</span></div>
    ${ups.length ? `<div class="tv-ups"><h3>Match-ups</h3><ul>${ups.join("")}</ul></div>` : ""}</div>`;
}
// the whole series or season: what happened across every match, and what would change it
function reviewSheet(matches) {
  const teams = online.active ? online.teams() : soloTeams;
  const r = review({ matches, me: state.name, teams, sim, cards: t => teams[t].players.map(card), label, venues: data.venues });
  openSheet(`<div class="row between" style="flex-wrap:nowrap;align-items:flex-start"><div style="min-width:0"><h2>${esc(r.headline)}</h2><p class="muted" style="font-size:14px">${esc(state.name)} · ${matches.length} matches</p></div>
      <button class="btn icon ghost" data-action="close-sheet" aria-label="Close">${icon("x")}</button></div>
    <div class="whys">${r.points.map(p => `<div class="why">${icon(p.icon)}<div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div></div>`).join("")}</div>
    <h3>What to change</h3><ul class="changes">${r.changes.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
    <p class="muted" style="font-size:12px">The odds come from playing each of these fixtures 40 more times with the same sides. Everything else is counted from the scorecards.</p>`, r.headline);
}
function scorecard(m) {
  whyMatch = m;
  const tableFor = inn => `<div class="stack"><div class="scroll"><table><thead><tr><th class="l">${esc(label(inn.team))} ${inn.score}/${inn.wickets} (${inn.overs})</th><th class="l"></th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr></thead><tbody>
      ${inn.batting.map(x => `<tr><td class="l">${esc(x.player?.name ?? x.name)}</td><td class="l muted">${esc(x.out ?? "not out")}</td><td><b>${x.runs}</b></td><td>${x.balls}</td><td>${x.fours}</td><td>${x.sixes}</td></tr>`).join("")}</tbody></table></div>
    <div class="scroll"><table><thead><tr><th class="l">Bowling</th><th>O</th><th>R</th><th>W</th></tr></thead><tbody>
      ${inn.bowling.map(x => `<tr><td class="l">${esc(x.player?.name ?? x.name)}</td><td>${Math.floor(x.balls / 6)}${x.balls % 6 ? "." + x.balls % 6 : ""}</td><td>${x.runs}</td><td><b>${x.wickets}</b></td></tr>`).join("")}</tbody></table></div></div>`;
  return `<div class="row between"><div><h2>${esc(label(m.innings[0].team))} v ${esc(label(m.innings[1].team))}</h2><p class="muted" style="font-size:14px">${esc(m.result.replace(m.winner, label(m.winner)))} · ${esc(m.venue)}</p></div>
      <button class="btn icon ghost" data-action="close-sheet" aria-label="Close scorecard">${icon("x")}</button></div>
    <div class="row"><button class="btn" data-action="why">${icon("question")} ${whyLabel(m)}</button></div>${post(m)}${m.innings.map(tableFor).join("")}`;
}
// The scouting report for a team sheet: match-ups between your twelve and one opponent's, with one-tap changes to the bowling plan.
//   plan: your bowling plan so far; action: the bowling-plan action for the one-tap buttons (null when the sheet is locked)
//   vs: the opponent's id when the change should go into the plan kept for him alone
const scoutReport = (mine, theirs, who, plan = {}, action = null, vs = "") => {
  const found = scout(mine, theirs, data.h2h);
  return found.length ? `<div class="whys">${found.map(x => `<div class="why">${icon(x.icon)}<div><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p>
      ${x.set && action ? (plan[x.set.key] === x.set.role ? `<p class="chip ok" style="margin-top:8px">${icon("check")} Done</p>` : `<button class="btn" style="margin-top:8px" data-action="${action}" data-key="${x.set.key}" data-r="${x.set.role}" data-vs="${esc(vs)}">${icon("target")} ${esc(x.set.label)}</button>`) : ""}</div></div>`).join("")}</div>`
    : `<p class="muted">No strong history between your players and ${esc(who)}'s. This one comes down to the ratings and the ground.</p>`;
};
// during a room's draft: what this card would mean against the players the others already have
const matchups = (c, others) => edges(c, others, data.h2h);
function inspect(c, why = blockReason(c, lineup()), action = "pick", wait = null, places = openSlots(c, lineup()), extra = []) {
  const cells = [];
  if (c.balls >= 30) cells.push([c.runs, "Runs"], [(100 * c.runs / c.balls).toFixed(0), "Strike rate"], [c.outs ? (c.runs / c.outs).toFixed(1) : "–", "Average"]);
  if (c.bowl_balls >= 24) cells.push([c.wkts, "Wickets"], [(6 * c.conceded / c.bowl_balls).toFixed(2), "Economy"], [(c.bowl_balls / 6).toFixed(0), "Overs"]);
  const notes = [];
  if (c.balls >= 100) {
    const mu = Object.entries(c.mu).map(([t, [, out]]) => [out, t]).sort((x, y) => y[0] - x[0]);
    if (mu[0]?.[0] >= 1.08) notes.push(`${icon("warning")}Gets out more often to ${mu[0][1]}`);
    if (mu.at(-1)?.[0] <= 0.9) notes.push(`${icon("shield-check")}Hard to dismiss with ${mu.at(-1)[1]}`);
  }
  // one chip per position: the two opening places are one choice, and so are a bowler's 8 to 11 (he takes the first one free)
  const choices = [], seen = new Set();
  for (const n of places) {
    const name = n === 11 ? "Impact" : n <= 1 ? "Opener" : c.role === "bowler" ? "Bowler" : SLOTS[n];
    if (!seen.has(name)) { seen.add(name); choices.push([n, name]); }
  }
  const best = Object.entries(c.vn).map(([v, [bat, bowl]]) => [Math.max(bat, bowl), v]).sort((x, y) => y[0] - x[0])[0];
  if (best?.[0] >= 1.5) notes.push(`${icon("map-pin")}Strong record at ${best[1]}`);
  for (const x of extra.slice(0, 3)) notes.push(`${icon(x.good ? "sword" : "shield-warning")}${esc(x.text)}`);
  return `<div class="detail">${playerCard(c)}<div class="stack">
        <div><h2>${esc(full(c))}</h2><p class="muted" style="font-size:14px">${place(c.team, c.season)} ${c.season} · ${c.role}${c.bowl_balls >= 60 ? `, ${c.type}` : ""}</p></div>
        <div class="rated"><div><b>${c.bat ?? "–"}</b><span>Batting</span></div><div><b>${c.bowl ?? "–"}</b><span>Bowling</span></div><div><b>${homeSpot(c)}</b><span>${c.role === "bowler" ? "Bowls" : "Bats best at"}</span></div></div></div></div>
    ${cells.length ? `<div class="statgrid">${cells.map(([v, k]) => `<div><b>${v}</b><span>${k}</span></div>`).join("")}</div>` : ""}
    ${c.styles.length ? `<div class="styles">${c.styles.map(st => `<div><i class="ph-fill ph-${STYLES[st].icon}" aria-hidden="true"></i><span><b>${st}</b>${STYLES[st].say(c)}</span></div>`).join("")}</div>` : ""}
    ${notes.length ? `<div class="notes">${notes.map(x => `<div>${x}</div>`).join("")}</div>` : ""}
    ${why ? `<p class="chip warn" style="align-self:flex-start">${icon("warning")} ${why}</p>` : ""}
    ${!action ? '<div class="row"><button class="btn ghost" data-action="close-sheet">Close</button></div>' : why || wait ? `<div class="row"><button class="btn primary big" disabled>${esc(wait ?? "Not this time")}</button><button class="btn ghost" data-action="close-sheet">Back to the squad</button></div>`
      : `<div class="row between"><h3>Where does ${esc(nameParts(full(c))[1])} bat?</h3><span class="muted" style="font-size:12px">His rating in each place</span></div>
        <div class="places">${choices.map(([n, name]) => `<button class="place ${slotCost(c, n) ? "off" : ""}" data-action="${action}" data-key="${c.key}" data-slot="${n}" aria-label="${name}, rated ${ratingAt(c, n)}${slotCost(c, n) ? ", away from his best place" : ""}"><span>${name}</span><b class="num">${ratingAt(c, n)}</b></button>`).join("")}</div>
        <div class="row"><button class="btn ghost" data-action="close-sheet">Back to the squad</button></div>`}`;
}
function openSheet(html, labelText, cls = "") {
  $sheet.innerHTML = `<div class="sheet-in ${cls}" role="dialog" aria-modal="true" aria-label="${esc(labelText)}">${html}</div>`;
  $sheet.hidden = false;
  $sheet.querySelector("button")?.focus();
}
const closeSheet = () => { $sheet.hidden = true; $sheet.innerHTML = ""; };

// ---------- match playback: every ball, as a broadcast would show it ----------
const SPEEDS = [["1×", 1], ["2×", 0.45], ["Fast", 0.1]];
const SAY = { 0: "dot ball", 1: "quick single", 2: "back for two", 3: "three, good running", 4: "FOUR", 5: "five runs", 6: "SIX", w: "wide", b: "leg bye", W: "OUT", R: "RUN OUT" };
const kit = t => (t === state.name ? { a: club?.a ?? "#d1121f", b: club?.b ?? "#5c0a12" } : online?.kitOf(t)?.a ? online.kitOf(t) : side(t));   // your side wears your club's colours (the house red until you choose)
function playback() {
  const m = state.watch, nm = x => x.player?.name ?? x.name, short = n => nameParts(n)[1], el = id => document.getElementById(id);
  const inn = m.innings.map(x => ({ src: x, team: x.team, kit: kit(x.team), score: 0, wkts: 0, legal: 0, crease: [0, 1], next: 2, over: [], bars: [], overRuns: 0, overWk: 0, part: [0, 0], lastWkt: "",
    bat: x.batting.map(b => ({ name: nm(b), runs: 0, balls: 0, fours: 0, sixes: 0 })), bowl: x.bowling.map(b => ({ name: nm(b), balls: 0, runs: 0, wickets: 0 })) }));
  const events = m.innings.flatMap((x, i) => [...x.log.map(([b, w, c]) => ({ i, b, w, c })), { i, end: true }]);
  const target = () => inn[0].score + 1;
  let k = 0, cur = inn[0], flash = { big: "PLAY", sub: `${label(inn[0].team)} to bat first. Pads on.`, cls: "brk" }, ended = false;
  const lines = [], miles = [];
  const sides = online.active ? online.teams() : soloTeams, who = (t, name) => sides[t]?.players.map(card).find(c => c.name === name);   // the card behind a name on the scorecard
  // A milestone takes over the ball's flash, is kept in the strip under it and gets a line in the feed.
  // Only the biggest one on a ball is shown (a hundred beats a team 200 that arrived on the same shot).
  const mile = (big, sub, chip, minor = false) => { if (flash?.cls === "mile" && !flash.minor) return; flash = { big, sub, cls: "mile", minor }; miles.unshift(chip); lines.unshift(`★ ${big}: ${sub}`); };

  function apply(e) {   // moves the match on one ball; no drawing here, so Skip can run it flat out
    const s = cur = inn[e.i];
    flash = null;
    if (e.end) {
      if (!s.overDone && s.over.length) s.bars.push({ runs: s.overRuns, wk: s.overWk });
      lines.unshift(`${label(s.team)} finish on ${s.score}/${s.wkts}`);
      flash = e.i ? { big: "RESULT", sub: m.result.replace(m.winner, label(m.winner)), cls: "brk" } : { big: "INNINGS BREAK", sub: `${label(inn[1].team)} need ${target()} to win`, cls: "brk" };
      return;
    }
    if (s.overDone) { s.over = []; s.overRuns = 0; s.overWk = 0; s.overDone = false; }
    const bat = s.bat[e.b], bowl = s.bowl[e.w], c = e.c, was = { score: s.score, stand: s.part[0] }, team = label(s.team);
    s.bowler = e.w;
    if (c === "w") { s.score++; bowl.runs++; s.overRuns++; s.part[0]++; s.over.push("wd"); }
    else {
      s.legal++; bat.balls++; bowl.balls++; s.part[1]++; s.striker = e.b;
      if (c === "W" || c === "R") {
        s.wkts++; s.overWk++; s.over.push("W"); if (c === "W") bowl.wickets++;
        s.lastWkt = `${bat.name} ${bat.runs} (${bat.balls})`;
        flash = { big: "WICKET", sub: `${bat.name} ${c === "R" ? "run out" : "b " + short(bowl.name)} ${bat.runs} (${bat.balls})`, cls: "wkt" };
        s.crease = s.crease.map(x => (x === e.b ? s.next++ : x)); s.part = [0, 0]; was.stand = 0;
        if (c === "W") {   // the bowler's hauls, and three in three balls
          bowl.run = (bowl.run ?? 0) + 1;
          const fig = `${bowl.name} ${bowl.wickets}/${bowl.runs}`, got = `gets ${short(bat.name)} for ${bat.runs}`;
          if (bowl.run === 3) mile("HAT-TRICK", `${fig}, ${got}`, `${short(bowl.name)} hat-trick`);
          else if (bowl.wickets >= 3) mile(["THREE-FOR", "FOUR-FOR", "FIVE-FOR", "SIX-FOR"][Math.min(3, bowl.wickets - 3)], `${fig}, ${got}`, `${short(bowl.name)} ${bowl.wickets} wkts`);
          // the match-up came off: this bowler has this batter's number in real matches, and has him again
          const d = duel(who(s.team, bat.name) ?? {}, who(inn[1 - e.i].team, bowl.name) ?? {}, data.h2h);
          if (d?.edge === "bowler") mile("GOT HIM AGAIN", `${bowl.name} has ${short(bat.name)}'s number. In real matches: ${d.record}`, `${short(bowl.name)} got ${short(bat.name)}`);
        } else bowl.run = 0;
      } else if (c === "b") { s.score++; s.overRuns++; s.part[0]++; s.over.push("lb"); }
      else {
        const runs = +c;
        s.score += runs; bat.runs += runs; bowl.runs += runs; s.overRuns += runs; s.part[0] += runs; s.over.push(runs ? c : "•");
        if (runs === 4) bat.fours++; if (runs === 6) bat.sixes++;
        if (runs >= 4) flash = { big: SAY[runs], sub: `${short(bat.name)} off ${short(bowl.name)}`, cls: runs === 4 ? "four" : "six" };
        bowl.run = 0;
        for (const mark of [150, 100, 50]) if (bat.runs >= mark && bat.runs - runs < mark) { mile(mark === 50 ? "FIFTY" : mark === 100 ? "HUNDRED" : "150", `${bat.name} ${bat.runs} (${bat.balls})`, `${short(bat.name)} ${mark}`); break; }
      }
      // the side's landmarks and the partnership's: smaller moments, shown only if nothing bigger happened on this ball
      for (const mark of [250, 200, 150, 100]) if (s.score >= mark && was.score < mark) { mile(`${mark} UP`, `${team} ${s.score}/${s.wkts} in ${Math.floor(s.legal / 6)}.${s.legal % 6} overs`, `${team} ${mark}`, true); break; }
      for (const mark of [150, 100, 50]) if (s.part[0] >= mark && was.stand < mark) { const [x, y] = s.crease.map(i => s.bat[i]).filter(Boolean); if (x && y) mile(`${mark} STAND`, `${short(x.name)} and ${short(y.name)}, ${s.part[0]} off ${s.part[1]}`, `${short(x.name)}–${short(y.name)} ${mark}`, true); break; }
      if (s.legal % 6 === 0 && s.overRuns === 0 && !s.over.includes("wd")) mile("MAIDEN", `${bowl.name} ${Math.floor(bowl.balls / 6)}–${bowl.runs}–${bowl.wickets}`, `${short(bowl.name)} maiden`, true);
      if (s.legal % 6 === 0) { s.bars.push({ runs: s.overRuns, wk: s.overWk }); s.overDone = true; }
    }
    const n = c === "w" ? s.legal : s.legal - 1;
    lines.unshift(`${Math.floor(n / 6)}.${n % 6 + 1} ${short(bowl.name)} to ${short(bat?.name ?? "")}, ${SAY[c]}`);
    flash ??= { big: s.over.at(-1) === "•" ? "0" : s.over.at(-1), sub: lines[0], cls: "" };
    if (flash.cls === "mile") [lines[0], lines[1]] = [lines[1], lines[0]];   // the ball first, then what it brought up
  }
  // shortcut: a rough win predictor (projected score against par or the target), not a fitted model; replace if it ever looks silly
  function prob() {
    const s = cur, left = s.wkts >= 10 ? 0 : 120 - s.legal, proj = s.score + left * 1.57 * Math.max(0.3, 1 - 0.07 * s.wkts * Math.sqrt(left / 120));
    const bat = s === inn[0] ? 1 / (1 + Math.exp(-(proj - 188) / 25)) : ended || !left || s.score >= target() ? +(m.winner === s.team) : 1 / (1 + Math.exp(-(proj - target()) / (5 + left * 0.14)));
    return s === inn[0] ? bat : 1 - bat;
  }
  function paint() {
    const s = cur, o = inn[s === inn[0] ? 1 : 0], chasing = s === inn[1], left = 120 - s.legal, need = target() - s.score;
    const proj = Math.round(s.score + left * (0.5 * s.score / Math.max(1, s.legal) + 0.785));
    el("m-bug").style.cssText = `--a:${s.kit.a};--b:${s.kit.b}`;
    el("m-bug").innerHTML = `<div class="mc-team">${badge(s.team, true)}<b>${esc(label(s.team))}</b><span>${chasing ? `Chasing ${target()}` : "First innings"}</span></div>
      <div class="mc-score"><b class="num">${s.score}<i>/</i>${s.wkts}</b><span class="num">${Math.floor(s.legal / 6)}.${s.legal % 6} overs</span></div>
      <div class="mc-eq">${ended ? esc(m.result.replace(m.winner, label(m.winner))) : chasing ? `Need <b>${Math.max(0, need)}</b> off <b>${left}</b> · required rate <b>${left ? (6 * need / left).toFixed(2) : "–"}</b>` : `Run rate <b>${s.legal ? (6 * s.score / s.legal).toFixed(2) : "0.00"}</b> · projected <b>${proj}</b>`}</div>
      <div class="mc-other">${chasing ? `${esc(label(o.team))} ${o.score}/${o.wkts} (${o.src.overs})` : `${esc(label(o.team))} yet to bat`}</div>`;
    el("m-flash").innerHTML = `<div class="mc-ball ${flash.cls} ${flash.minor ? "minor" : ""}">${flash.cls === "mile" ? `<i class="ph-fill ph-star" aria-hidden="true"></i>` : ""}<b>${esc(flash.big)}</b><span>${esc(flash.sub)}</span></div>`;
    el("m-miles").innerHTML = miles.slice(0, 8).map((t, i) => `<span class="${i === 0 && flash.cls === "mile" ? "new" : ""}"><i class="ph-fill ph-star" aria-hidden="true"></i>${esc(t)}</span>`).join("");
    const bw = s.bowl[s.bowler];
    el("m-over").innerHTML = `<div class="row between"><h3>Over ${Math.min(20, Math.floor((s.legal - (s.overDone ? 1 : 0)) / 6) + 1)}${bw ? ` · ${esc(bw.name)}` : ""}</h3>${bw ? `<span class="num muted">${Math.floor(bw.balls / 6)}.${bw.balls % 6}–${bw.runs}–${bw.wickets}</span>` : ""}</div>
      <div class="mc-balls">${s.over.map(b => `<i class="${b === "W" ? "wkt" : b === "4" ? "four" : b === "6" ? "six" : b === "•" ? "dot" : ""}">${b}</i>`).join("")}${Array.from({ length: Math.max(0, 6 - s.over.filter(b => b !== "wd").length) }, () => '<i class="todo"></i>').join("")}<b class="num">${s.overRuns}</b></div>`;
    el("m-crease").innerHTML = `<table><thead><tr><th class="l">Batting</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>
      ${s.crease.filter(i => s.bat[i]).map(i => { const b = s.bat[i]; return `<tr class="${i === s.striker ? "me" : ""}"><td class="l">${esc(b.name)}${i === s.striker ? " *" : ""}</td><td><b>${b.runs}</b></td><td>${b.balls}</td><td>${b.fours}</td><td>${b.sixes}</td><td>${b.balls ? (100 * b.runs / b.balls).toFixed(0) : "–"}</td></tr>`; }).join("")}</tbody></table>
      <p class="muted">Partnership ${s.part[0]} (${s.part[1]})${s.lastWkt ? ` · last wicket ${esc(s.lastWkt)}` : ""}</p>`;
    const p = Math.round(100 * prob()), [x, y] = inn;
    el("m-win").innerHTML = `<h3>Win predictor</h3><div class="mc-prob"><span style="flex-basis:${p}%;--a:${x.kit.a}">${esc(label(x.team))} <b class="num">${p}%</b></span><span style="--a:${y.kit.a}"><b class="num">${100 - p}%</b> ${esc(label(y.team))}</span></div>`;
    el("m-manh").innerHTML = `<h3>Runs per over</h3>${inn.map(t => `<div class="mc-bars" style="--a:${t.kit.a}"><span>${esc(label(t.team))}</span>${Array.from({ length: 20 }, (_, n) => (t.bars[n]
      ? `<i class="${t.bars[n].wk ? "wk" : ""} ${t === s && n === t.bars.length - 1 && t.overDone ? "new" : ""}" style="height:${Math.min(100, 6 + t.bars[n].runs * 4)}%" title="Over ${n + 1}: ${t.bars[n].runs} runs"></i>` : '<i class="none"></i>')).join("")}</div>
      <div class="mc-ph">${[["Powerplay", 0, 6], ["Middle", 6, 15], ["Death", 15, 20]].map(([name, a, b]) => { const part = t.bars.slice(a, b); return `<span>${name} <b class="num">${part.length ? `${part.reduce((x, o) => x + o.runs, 0)}/${part.reduce((x, o) => x + o.wk, 0)}` : "–"}</b></span>`; }).join("")}</div>`).join("")}`;
    el("feed").innerHTML = lines.slice(0, 5).map(x => `<div>${esc(x)}</div>`).join("");
  }
  function finish() {
    clearTimeout(ticker); ticker = null;
    while (k < events.length) apply(events[k++]);
    ended = state.watchDone = true;
    flash = { big: m.winner === state.name ? "YOU WIN" : `${label(m.winner)} WIN`, sub: m.result.replace(m.winner, label(m.winner)), cls: m.winner === state.name ? "six" : "brk" };
    paint();
    el("skip").hidden = el("speed").hidden = true;
    const v = el("verdict");
    v.hidden = false;
    v.className = "verdict rise " + (m.winner === state.name ? "win" : "");
    v.innerHTML = `<p class="muted">Player of the match: ${esc(m.playerOfMatch.name)}</p>
      <div class="row" style="justify-content:center"><button class="btn primary big" data-action="after-match">Continue</button><button class="btn" data-action="why" data-watch="1">${icon("question")} ${whyLabel(state.watch)}</button><button class="btn" data-action="scorecard" data-watch="1">${icon("list-numbers")} Scorecard</button>
        <button class="btn ghost" data-action="view-summary">${icon("television-simple")} Summary</button><button class="btn ghost" data-action="view-post">${icon("chat-circle-text")} Post</button></div>`;
    if (!m.posted) {   // once per match: the summary comes up on its own
      m.posted = true;
      ticker = setTimeout(() => actions["view-summary"](), 1100);   // the summary first; Continue on it brings up the post
    }
  }
  if (state.watchDone || reduced) return finish();
  paint();
  const step = () => {
    const e = events[k++];
    apply(e); paint();
    if (k >= events.length) return finish();
    const wait = e.end ? 2400 : flash.cls === "mile" ? (flash.minor ? 1500 : 2200) : flash.cls === "wkt" ? 1400 : flash.cls ? 850 : 300;
    ticker = setTimeout(step, (wait + (cur.overDone ? 300 : 0)) * SPEEDS[state.speed ?? 1][1]);
  };
  ticker = setTimeout(step, 900);
}

// ---------- actions ----------
function buildSeason() {
  if (window._auctionTournamentTeams) {
    const teams = window._auctionTournamentTeams;
    soloTeams = Object.fromEntries(teams.map(t => [t.name, t]));
    live = createSeason(sim, teams, { seed: state.seasonSeed });
    for (let i = 0; i < state.played; i++) live.playNext();
    return;
  }
  const awaySlots = state.awaySlots ?? state.order;   // his side and toss call for away games; the same as at home unless he changed them
  const me = { name: state.name, players: state.order, venue: state.venue, chem: chemistry(squadCards()), shift: shifts(lineup()), toss: state.toss?.home, bowl: state.bowlPlan, bowlVs: state.bowlVs,
    away: { players: awaySlots, shift: shifts(awaySlots.map(card)), toss: state.toss?.away } };
  const others = state.opponents.map(name => ({ name, players: data.teams[name], venue: Object.values(data.venues).find(v => v.home === name).name }));
  soloTeams = Object.fromEntries([me, ...others].map(t => [t.name, t]));
  live = createSeason(sim, [me, ...others], { seed: state.seasonSeed });
  for (let i = 0; i < state.played; i++) live.playNext();   // the same seed replays the same season
}
// still in the hunt: the league is on, or you made the top four and have not been knocked out
const alive = () => !live.leagueDone || (live.standings().findIndex(r => r.team === state.name) < 4 && !live.playoffs.some(m => m.loser === state.name && m.stage !== "Qualifier 1"));
function playOne() {
  state.last = live.playNext(); state.played++;
  while (!live.done && !alive()) { live.playNext(); state.played++; }   // out of it: the rest is played without you, straight to the season's end (state.last stays on your own last round)
  if (live.done && !state.logged) {   // the trophy cabinet on the home screen
    const c = cabinet(), pos = live.standings().findIndex(r => r.team === state.name) + 1;
    state.logged = true;
    try { localStorage.setItem(KEEP + "-cabinet", JSON.stringify({ seasons: (c.seasons ?? 0) + 1, titles: (c.titles ?? 0) + (live.champion === state.name), best: Math.min(c.best ?? 99, pos) })); } catch {}
  }
  return state.last;
}
const actions = {
  home() { state.screen = "home"; },
  auction() { state.screen = "auction"; auction?.actions?.auction?.(); },
  "matchday-select"(el) {
    state.viewDay = el.dataset.day === "playoffs" ? "playoffs" : +el.dataset.day;
  },
  resume() { const o = state.o; state = load(); state.o ??= o; if (state.screen === "match") state.screen = "season"; if (state.screen === "season") buildSeason(); },
  new() { state = { screen: "draft", picks: [], slots: emptyLineup(), used: [], rerolls: REROLLS, filter: "all", o: state.o, speed: state.speed }; actions.dealPack(); },
  dealPack() { const p = deal(allPacks, state.used, lineup()); Object.assign(state, { pack: p.id, filter: "all", fstyle: null, reveal: true }); state.used.push(p.id); },
  reroll() { if (state.rerolls) { state.rerolls--; actions.dealPack(); } },
  filter(el) { state.filter = el.dataset.f; },
  inspect(el) { const c = card(el.dataset.key); openSheet(inspect(c), `${c.name}, ${place(c.team, c.season)} ${c.season}`); return false; },
  "close-sheet"() { closeSheet(); return false; },
  pick(el) {
    const c = card(el.dataset.key);
    const slot = +el.dataset.slot;
    if (!openSlots(c, lineup()).includes(slot)) return false;
    closeSheet();
    state.picks.push(c.key); state.slots[slot] = c.key;
    if (state.picks.length < SQUAD) return actions.dealPack();
    Object.assign(state, { screen: "squad", order: [...state.slots], name: club?.team ?? "My XI", venue: club?.venue ?? Object.keys(data.venues)[0] });   // the places are the batting order
    if (!club) setTimeout(() => { clubDraft = null; clubSheet("Your XI is picked. Now give your club a name."); }, 400);
  },
  venue(el) { state.venue = el.dataset.v; },
  "start-season"() {
    const names = Object.keys(data.teams), rest = Math.floor(Math.random() * names.length);
    state.name = club?.team ?? state.name ?? "My XI";
    if (names.includes(state.name)) state.name += " XI";
    state.opponents = names.filter((_, i) => i !== rest);   // nine of the ten all-time XIs; one sits the season out
    Object.assign(state, { screen: "season", tab: "match", seasonSeed: Math.floor(Math.random() * 2 ** 31), played: 0, last: null });
    buildSeason();
  },
  tab(el) { state.tab = el.dataset.t; },
  roster(el) {
    const t = el.dataset.team, mine = t === state.name;
    openSheet(roster(mine ? t : `${place(t)} all-time XI`, `Home ground: ${mine ? state.venue : Object.values(data.venues).find(v => v.home === t).name}`, mine ? state.order : data.teams[t]), "Squad"); return false;
  },
  share(el) {   // the post as a picture: the phone's share sheet where there is one, a download otherwise
    const m = shared[+el.dataset.i], st = story(m, label);
    shareImage(ctx => drawPost(ctx, { m, st, label, colours: side(m.winner), brand: BRAND }), "match.png", st.text).then(() => { el.innerHTML = `${icon("check")} Done`; }, () => {});
    return false;
  },
  "share-squad"(el) {
    const cs = state.order.map(card).map(c => ({ ...c, ...side(c.team, c.season) }));
    shareImage(ctx => drawSquad(ctx, { name: state.name, cards: cs, g: grade(cs), brand: BRAND, league: league() }), "squad.png", `${state.name}: my ${BRAND} draft`).then(() => { el.innerHTML = `${icon("check")} Done`; }, () => {});
    return false;
  },
  play() { const mine = playOne().find(isMine); if (mine) Object.assign(state, { screen: "match", watch: mine, watchDone: false }); },
  quick() { playOne(); },
  "sim-all"() { const league = !live.leagueDone; while (!live.done && (!league || !live.leagueDone)) playOne(); },
  skip() { state.watchDone = true; },
  go(el) { state.screen = el.dataset.s; },
  review() { reviewSheet([...live.played.flat(), ...live.playoffs].filter(isMine)); return false; },
  why(el) { whySheet(el.dataset.watch ? state.watch : whyMatch, !!el.dataset.watch); return false; },
  swap(el) {   // team sheet: first tap chooses a player, a second tap on a lit player trades their places
    const away = state.planTab === "away", n = +el.dataset.n, from = state.swapFrom ?? null;
    const next = from != null && swap(away ? (state.awaySlots ?? state.slots).map(card) : lineup(), from, n);
    if (!next) state.swapFrom = from === n ? null : n;
    else if (away) Object.assign(state, { awaySlots: next.map(c => c.key), swapFrom: null });
    else Object.assign(state, { slots: next.map(c => c.key), swapFrom: null }), state.order = [...state.slots];
  },
  "bowl-role"(el) {   // data-vs: the opponent whose plan this is ("" = the all-games plan); a plan for one opponent starts from the all-games one
    const vs = el.dataset.vs, plans = { ...state.bowlVs };
    if (!vs) { state.bowlPlan = setBowlRole(squadCards(), state.bowlPlan ?? {}, el.dataset.key, el.dataset.r || null) ?? state.bowlPlan; return; }
    if (el.dataset.reset) delete plans[vs]; else plans[vs] = setBowlRole(squadCards(), plans[vs] ?? state.bowlPlan ?? {}, el.dataset.key, el.dataset.r || null) ?? plans[vs];
    state.bowlVs = plans;
  },
  "bowl-tab"(el) { state.bowlTab = el.dataset.id; },
  "plan-tab"(el) { Object.assign(state, { planTab: el.dataset.t, swapFrom: null }); },
  "plan-toss"(el) { state.toss = { ...state.toss, [state.planTab ?? "home"]: el.dataset.c || null }; },
  "my-xi"() {
    openSheet(`<div class="row between"><h2>Your XI so far</h2><button class="btn icon ghost" data-action="close-sheet" aria-label="Close your XI">${icon("x")}</button></div>${document.querySelector(".aside").innerHTML}`, "Your XI so far");
    return false;
  },
  "to-draft"() { const s = load(); s && !["home", "online"].includes(s.screen) ? actions.resume() : actions.new(); },   // the bar's Draft button: back to the one in progress, else a new one
  menu() {
    const s = load(), going = s && !["home", "online"].includes(s.screen);
    const row = (ic, label, attrs) => `<button ${attrs}>${icon(ic)}<span>${label}</span></button>`;
    openSheet(`<div class="row between"><h2>Menu</h2><button class="btn icon ghost" data-action="close-sheet" aria-label="Close menu">${icon("x")}</button></div>
      <nav class="menu" aria-label="All pages">
        ${row("house", "Home", 'data-action="home"')}${row("gavel", "IPL Mega Auction", 'data-action="auction"')}${row("user", going ? "Resume single player" : "Single player", 'data-action="to-draft"')}
        ${row("users-three", "Multiplayer", 'data-action="o-open"')}${row("trophy", "Records", 'data-action="records"')}
        ${row("shield", "2026 Squads", 'data-action="go" data-s="teams"')}${row("cards", "Players", 'data-action="go" data-s="players"')}
        ${row("book-open", "How it works", 'data-action="go" data-s="rules"')}${row("identification-card", "Your club", 'data-action="club-open"')}
        ${row("user-circle", "Account", 'data-action="account"')}<a href="privacy.html">${icon("lock-simple")}<span>Privacy</span></a></nav>`, "Menu");
    return false;
  },
  peek(el) { const c = card(el.dataset.key); openSheet(inspect(c, null, null), `${c.name}, ${place(c.team, c.season)} ${c.season}`); return false; },   // look, do not pick
  pfilter(el) { state.pf = el.dataset.f; },
  pstyle(el) { state.pstyle = state.pstyle === el.dataset.s ? null : el.dataset.s; },   // tap again to clear
  fstyle(el) { state.fstyle = state.fstyle === el.dataset.s ? null : el.dataset.s; },
  "club-open"() { clubDraft = null; clubSheet(); return false; },
  "club-colour"(el) { readClub(); [clubDraft.a, clubDraft.b] = CLUB_COLOURS[+el.dataset.i]; clubSheet(); return false; },
  "club-emblem"(el) { readClub(); clubDraft.emblem = el.dataset.e; clubSheet(); return false; },
  "club-save"() {
    readClub();
    if (!clubDraft.name || !clubDraft.team) { clubSheet("", "Give yourself a name and your team a name."); return false; }
    saveClub({ ...clubDraft, team: clubDraft.team in data.teams ? `${clubDraft.team} XI`.slice(0, 24) : clubDraft.team });   // a franchise's own name is taken
    clubDraft = null; closeSheet();
    if (state.screen === "squad") Object.assign(state, { name: club.team, venue: club.venue });   // a season already under way keeps the name it started with
    online.clubChanged(club);
  },
  "view-summary"() {
    if (state.watch) openSheet(`${summary(state.watch)}<div class="row" style="justify-content:center"><button class="btn primary big" data-action="view-post">Continue</button><button class="btn" data-action="why" data-watch="1">${icon("question")} ${whyLabel(state.watch)}</button></div>`, "Match summary", "pop");
    return false;
  },
  "view-post"() {
    clearTimeout(ticker); document.querySelector(".toast")?.classList.add("gone");
    if (state.watch) openSheet(`${post(state.watch)}<div class="row" style="justify-content:center"><button class="btn primary big" data-action="after-match">Continue</button><button class="btn" data-action="why" data-watch="1">${icon("question")} ${whyLabel(state.watch)}</button><button class="btn" data-action="close-sheet">Close</button></div>`, "Match post", "pop");
    return false;
  },
  like(el) { const on = el.getAttribute("aria-pressed") !== "true"; el.setAttribute("aria-pressed", on); el.querySelector("span").textContent = kilo(+el.dataset.n + on); el.querySelector("i").className = `ph-${on ? "fill" : "bold"} ph-heart`; return false; },
  speed(el) { state.speed = ((state.speed ?? 1) + 1) % SPEEDS.length; el.textContent = SPEEDS[state.speed][0]; return false; },
  "after-match"() { closeSheet(); Object.assign(state, { screen: online.active ? "online" : "season", tab: "match", watch: null }); },
  scorecard(el) {
    const m = el.dataset.watch ? state.watch : [...live.played.flat(), ...live.playoffs][+el.dataset.i];
    openSheet(scorecard(m), "Scorecard"); return false;
  },
};

// The squad on offer, shown in a slot-machine window: crest, team and year, each in its own cell.
// The reroll button sits right beside it: it is the lever on the machine.
const slotHead = (pack, action, left, on) => `<div class="slotrow"><h1 class="packslot" aria-label="${place(pack.team, pack.season)} ${pack.season}"><span class="slot-cell" id="spin-crest">${badge(pack.team, true)}</span><span class="slot-cell" id="spin-team">${place(pack.team, pack.season)}</span><span class="slot-cell" id="spin-season"><em>${pack.season}</em></span></h1>
  <button class="rerollbtn" data-action="${action}" ${on ? "" : "disabled"} aria-label="Reroll: swap this squad for a fresh one. ${left} left">${icon("arrows-clockwise")}<b>Reroll</b><span>${left} left</span></button></div>`;
// A new squad arrives like a slot machine: all three reels spin at the same speed and stop one after another, left to right
// (crest, team, year), each cell flashing as it lands. It runs whenever the pack on screen is not the one last shown
// (a pick, a reroll, a new round), solo or in a room.
const ROLL = [1100, 1500, 1900];   // when each reel stops, in milliseconds; the spin speed is the same for all three
let shownPack = null;
function rollPack(id) {
  if (id === shownPack) return;
  shownPack = id;
  const cells = ["spin-crest", "spin-team", "spin-season"].map(k => document.getElementById(k));
  if (!cells[0] || reduced) return;
  const any = list => list[Math.floor(Math.random() * list.length)], final = cells[1].textContent;
  const names = [...new Set(allPacks.map(p => place(p.team, p.season)))], like = names.filter(t => t.length === final.length);   // stops as wide as the one it lands on
  const filler = [() => badge(any(Object.keys(data.teams)), true), () => esc(any(like.length > 2 ? like : names)), () => `<em>${any(allPacks).season}</em>`];
  cells.forEach((el, k) => {
    const last = el.innerHTML, stops = Math.round(ROLL[k] / 110);   // one stop every 110ms, so a longer spin passes more of them
    el.classList.remove("landed"); el.classList.add("rolling");
    // the real content keeps its place, hidden, so the window never changes size; the reel runs on top and ends on that same content
    el.innerHTML = `<span class="reel-hold">${last}</span><span class="reel" aria-hidden="true" style="--n:${stops};animation-duration:${ROLL[k]}ms">${Array.from({ length: stops }, filler[k]).map(h => `<i>${h}</i>`).join("")}<i>${last}</i></span>`;
    el.querySelector(".reel").addEventListener("animationend", () => { if (el.isConnected) { el.innerHTML = last; el.classList.remove("rolling"); el.classList.add("landed"); } }, { once: true });
  });
}
let shown = "";
function render() {
  clearInterval(ticker); ticker = null;
  document.querySelector(".toast")?.remove();
  const view = state.screen === "online" ? "o-" + online.phase : state.screen + (state.screen === "season" ? state.tab : "");
  // a sideways list keeps its place when the same screen is redrawn (choosing a ground no longer jumps back to the first one)
  const kept = view === shown ? [...$app.querySelectorAll("[data-keep]")].map(e => [e.dataset.keep, e.scrollLeft]) : [];
  $app.classList.toggle("enter", view !== shown); shown = view;
  document.body.classList.toggle("matchday", state.screen === "match");
  document.body.classList.toggle("inroom", state.screen === "online");   // the room chat button shows only on the room's own screens
  document.body.classList.toggle("in-auction", state.screen === "auction");
  // the bottom bar shows while browsing; a draft, a season and a room have their own bars there (auction hides it to not block bidding)
  const isDocked = (["home", "teams", "players", "rules", "records"].includes(state.screen) || (state.screen === "online" && !online.active)) && state.screen !== "auction";
  document.body.classList.toggle("docked", isDocked);
  const dockEl = document.querySelector(".dock");
  if (dockEl) {
    if (state.screen === "auction") {
      dockEl.style.setProperty("display", "none", "important");
      dockEl.classList.add("auction-hidden");
    } else {
      dockEl.classList.remove("auction-hidden");
      dockEl.style.removeProperty("display");
    }
  }
  for (const b of document.querySelectorAll(".dock button")) b.toggleAttribute("aria-current", b.dataset.on === state.screen);   // the match centre is its own zone   // entrance motion only when the view changes
  $app.innerHTML = state.screen === "online" ? online.screen() : state.screen === "records" ? online.records() : state.screen === "admin" ? admin.screen() : state.screen === "auction" ? auction.screen() : screens[state.screen]();
  for (const [k, x] of kept) { const el = $app.querySelector(`[data-keep="${k}"]`); if (el) el.scrollLeft = x; }
  $where.textContent = { home: "", draft: "Single player", squad: "Single player", season: live?.done ? "Single player · over" : "Single player", match: "Match centre", online: online.where, admin: "Admin", teams: "Teams", players: "Players", rules: "Rules", records: "Records", auction: auction?.where || "IPL Mega Auction" }[state.screen];
  document.title = `${BRAND} · IPL Mega Auction & Franchise Cricket`;
  if (state.screen === "draft") { rollPack(state.pack); state.reveal = false; }
  else if (state.screen === "online" && online.pack) rollPack(online.pack);
  else if (state.screen !== "match") shownPack = null;   // leaving the draft: the next one rolls in from the start
  if (state.screen === "match") playback();
  // the save keeps no scorecards: the season is rebuilt from its seed
  try {
    if (["draft", "squad", "season"].includes(state.screen)) localStorage.setItem(SAVE, JSON.stringify({ ...state, last: null, watch: null, o: undefined }));
    if (state.o) localStorage.setItem(KEEP + "-online", JSON.stringify(state.o));   // name, session and room, so a refresh rejoins
  } catch {}
}
document.addEventListener("click", e => {
  if (e.target === $sheet) return closeSheet();
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const before = state.screen;
  if (el.closest(".menu")) closeSheet();
  if ((actions[el.dataset.action] ?? online.actions[el.dataset.action] ?? auction?.actions[el.dataset.action] ?? admin.actions[el.dataset.action])(el) === false) return;   // sheet-only and server requests redraw themselves
  render();
  if (state.screen !== before || ["pick", "reroll", "tab"].includes(el.dataset.action)) scrollTo({ top: 0 });
});
// cards lean towards the pointer
if (!reduced && matchMedia("(hover: hover)").matches) document.addEventListener("pointermove", e => {
  const el = e.target.closest?.("button.fc"); if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--rx", `${((e.clientY - r.top) / r.height - 0.5) * -12}deg`); el.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 14}deg`);
});
document.addEventListener("input", e => {   // the player search filters as you type, without losing your place in the box
  if (e.target.id === "p-q") { state.pq = e.target.value; document.getElementById("p-grid").innerHTML = playerGrid(); }
});
addEventListener("hashchange", () => {
  if (/^#room-[A-Za-z]{5}$/.test(location.hash) && online && !online.active) { state.screen = "online"; render(); }
  if (/^#auction/i.test(location.hash)) { state.screen = "auction"; auction?.actions?.auction?.(); render(); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$sheet.hidden) closeSheet(); });
document.addEventListener("change", e => { if (e.target.id === "team-name") state.name = e.target.value.trim().slice(0, 24) || "My XI"; });

try {
  // the launch animation gets its full run even when the data arrives at once
  let config;
  [data, config] = await Promise.all([fetch("../sim/data.json").then(r => r.json()), fetch(`${API}/api/config`).then(r => r.json()).catch(() => ({})), new Promise(r => setTimeout(r, reduced ? 0 : 2100))]);
  setNeutral(config.settings?.neutral);
  applySettings(config.settings ?? {}, { data, TUNE, configure });   // whatever the admin has changed: rules, engine, ratings
  sim = createSim(data);
  allPacks = packs(data.cards);
  auction = createAuction({
    data, sim, card, playerCard, icon, esc, place, side, nameParts, openSheet, closeSheet, inspect,
    render, state: () => state, createSeason
  });
  online = createOnline({ state: () => state, data, card, playerCard, icon, esc, ovr, place, side, nameParts, openSheet, closeSheet, inspect, resultRow, scorecard, render, ordinal, allPacks, roster, draftAside, xiButton, swapRows, planEditor, attackEditor, slotHead, reviewSheet, scoutReport, matchups, league, post, chemLine, badge, traits, cabinet, tray, slotRow, placed,
    balanceReport, styleNudge, club: () => club, clubCrest, openClub(note) { clubDraft = null; clubSheet(note); }, adoptClub(c) { if (!club && c?.team) { saveClub(c); render(); } } });
  try { state.o = JSON.parse(localStorage.getItem(KEEP + "-online")) ?? undefined; } catch {}
  admin = createAdmin({ API, data, TUNE, state: () => state, render, icon, esc, place, closeSheet,
    reapply(settings) { setNeutral(settings.neutral); applySettings(settings, { data, TUNE, configure }); allPacks.splice(0, allPacks.length, ...packs(data.cards)); } });   // packs hold copies of the cards
  online.arrive();   // back from Google or an email sign-in link
  const invite = (location.hash.match(/^#room-([A-Za-z]{5})$/) ?? [])[1]?.toUpperCase();
  if (/^#auction/i.test(location.hash)) { state.screen = "auction"; auction?.actions?.auction?.(); }
  if (invite && state.o?.code && state.o.code !== invite) delete state.o.code;   // an invite to another room wins over one remembered from before
  if (state.o?.code || invite) { state.screen = "online"; online.resume(); }   // a refresh, or an invite link
  render();
} catch (err) {
  $app.innerHTML = `<p class="loading">Rain delay: the game data would not load. ${esc(err.message)}</p>`;
}

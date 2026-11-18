// Draft rules, kept apart from the screen code so they can be tested on their own (node app/rules.test.mjs).
export const SQUAD = 12;
export let MAX_OVERSEAS = 4, MIN_BOWLERS = 5, REROLLS = 2;
// the admin screen can change these; importers see the new values straight away
export function configure({ maxOverseas, minBowlers, rerolls } = {}) {
  if (Number.isInteger(maxOverseas)) MAX_OVERSEAS = Math.max(0, Math.min(SQUAD, maxOverseas));
  if (Number.isInteger(minBowlers)) MIN_BOWLERS = Math.max(4, Math.min(5, minBowlers));   // places 8 to 11 give four; the Impact place can give a fifth
  if (Number.isInteger(rerolls)) REROLLS = Math.max(0, Math.min(10, rerolls));
}

export const isBowler = c => c.bowl != null && c.bowl_balls >= 60;

// The twelve places in a side, in batting order. Every pick goes into one of them, so the draft IS the team sheet.
export const SLOTS = ["Opener", "Opener", "No. 3", "No. 4", "No. 5", "No. 6", "No. 7", "No. 8", "No. 9", "No. 10", "No. 11", "Impact Player"];
const IMPACT = 11, BOWLER_SLOTS = [7, 8, 9, 10];
export const emptyLineup = () => new Array(SQUAD).fill(null);
const filled = lineup => lineup.filter(Boolean);
const put = (lineup, n, card) => Object.assign([...lineup], { [n]: card });

// Where a card can bat, and what it costs him away from his best place.
//   batters and all-rounders: up to three places (card.spots; the two opening places count as one): where he batted
//     most that season, any place he has batted 25 or more innings in his IPL career, then his other places that season.
//     A one-position player also gets the place below it.
//   natural places (card.nat): his home that season and every 25-innings career place. These cost nothing.
//   specialist bowlers: 8 to 11        anyone: the Impact Player, at no cost
// Any other place costs batting rating points by how far it is from his nearest natural place, taken from what real
// batters did away from their usual spot (2008-2026, every ball, against their own season norm with phase and role
// held equal): one place higher than usual cost about 3 points, one place lower about 1, two places about 10 to 13.
// Two-place moves are often forced by a bad match situation, so they are priced a little under the raw numbers.
const DROP = { "-2": 9, "-1": 3, 0: 0, 1: 2, 2: 7 };   // places above (-) or below (+) home -> points lost
function spots(c) {   // [home, ...alternates] as positions; 2 stands for opener
  const hi = c.role === "all-rounder" ? 8 : 7;
  const s = c.spots?.length ? c.spots.slice(0, 3) : [Math.max(2, Math.min(hi, Math.round(c.pos || hi)))];
  return s.length > 1 ? s : [s[0], s[0] < hi ? s[0] + 1 : s[0] - 1];
}
function steps(c, n) {   // signed places from home, or null if he cannot go there
  if (n === IMPACT) return 0;
  if (c.role === "bowler") return isBowler(c) && BOWLER_SLOTS.includes(n) ? 0 : null;
  const p = n <= 1 ? 2 : n + 1, s = spots(c);
  if (!s.includes(p)) return null;
  const natural = c.nat?.length ? c.nat : [s[0]], near = natural.reduce((a, b) => (Math.abs(p - b) < Math.abs(p - a) ? b : a));
  return Math.max(-2, Math.min(2, p - near));
}
export const slotCost = (c, n) => { const d = steps(c, n); return d == null ? null : Math.abs(d); };   // 0 = his own spot
export const slotDrop = (c, n) => DROP[steps(c, n)];                                                      // batting points lost there
export const slotsFor = c => SLOTS.map((_, n) => n).filter(n => steps(c, n) != null);
// his rating in place n: the batting drop only pulls the overall down as far as it was built on his batting
export const ratingAt = (c, n) => (c.overall == null ? null : c.overall - (Math.max(c.bat ?? 0, c.bowl ?? 0) - Math.max((c.bat ?? 0) - slotDrop(c, n), c.bowl ?? 0)));
// batting points each out-of-position player gives up, for the match engine: { cardKey: points }
export const shifts = lineup => Object.fromEntries(lineup.flatMap((c, n) => (c && slotDrop(c, n) ? [[c.key, slotDrop(c, n)]] : [])));

// After the draft: the players in places a and b trade places, allowed when each can play the other's place
// (anyone can go to Impact Player). The same twelve stay, so the squad rules still hold. null if they cannot.
export function swap(lineup, a, b) {
  const x = lineup[a], y = lineup[b];
  if (a === b || !x || !y || steps(x, b) == null || steps(y, a) == null) return null;
  return put(put(lineup, a, y), b, x);
}
export const swapsFor = (lineup, a) => lineup.map((_, b) => b).filter(b => swap(lineup, a, b));

// The bowling plan: { cardKey: "pp" | "mid" | "death" | "off" } says when each bowler is used ("off" rests him; no entry
// leaves it to the captain). Returns the plan with this change made, or null if it is not allowed: only the side's
// own bowlers can be given a job, and five of them must stay in the attack.
export const BOWL_ROLES = { pp: "New ball", mid: "Middle", death: "Death" };
export function setBowlRole(squad, plan, key, role) {
  const bowlers = squad.filter(isBowler);
  if (!bowlers.some(c => c.key === key) || (role != null && role !== "off" && !(role in BOWL_ROLES))) return null;
  const next = { ...plan };
  if (role == null) delete next[key]; else next[key] = role;
  return bowlers.filter(c => next[c.key] !== "off").length >= MIN_BOWLERS ? next : null;
}

// what the side still lacks (lineup: twelve places, null where empty)
export function needs(lineup) {
  const squad = filled(lineup);
  return { keeper: !squad.some(c => c.wk), bowlers: Math.max(0, MIN_BOWLERS - squad.filter(isBowler).length),
           overseas: squad.filter(c => c.overseas).length, left: SQUAD - squad.length };
}

// Would the side still be able to finish legally with this card in this place? Places 8 to 11 always yield a bowler;
// beyond those only the Impact place is counted on for one, and a keeper needs a batting place (or a free Impact place).
function canFinish(lineup) {
  const open = lineup.flatMap((c, n) => (c ? [] : [n])), n = needs(lineup);
  const shortBowlers = n.bowlers - open.filter(k => BOWLER_SLOTS.includes(k)).length, impact = open.includes(IMPACT);
  if (shortBowlers > (impact ? 1 : 0)) return "bowlers";
  if (n.keeper && !open.some(k => k < 7) && !(impact && shortBowlers < 1)) return "keeper";
  return null;
}
// the open places this card may take right now
export function openSlots(card, lineup) {
  const squad = filled(lineup);
  if (squad.some(c => c.id === card.id) || (card.overseas && squad.filter(c => c.overseas).length >= MAX_OVERSEAS)) return [];
  return slotsFor(card).filter(n => !lineup[n] && !canFinish(put(lineup, n, card)));
}
// why a card cannot be picked right now, or null if it can
export function blockReason(card, lineup) {
  const squad = filled(lineup);
  if (squad.some(c => c.id === card.id)) return "Already in your XI. Even he cannot bat twice";
  if (card.overseas && squad.filter(c => c.overseas).length >= MAX_OVERSEAS) return `${MAX_OVERSEAS} overseas players is the limit. Take it up with the rule book`;
  if (openSlots(card, lineup).length) return null;
  const free = slotsFor(card).filter(n => !lineup[n]);
  if (!free.length) return "His spots in the order are gone";
  return canFinish(put(lineup, free[0], card)) === "keeper" ? "Someone has to keep wicket" : "You are short of bowlers";
}

// every team-season that can be dealt, with its pickable cards (best first)
export function packs(cards) {
  const out = new Map();
  for (const [key, c] of Object.entries(cards)) {
    if (c.overall == null || (c.balls < 30 && c.bowl_balls < 24)) continue;
    const id = `${c.team}|${c.season}`;
    if (!out.has(id)) out.set(id, { id, team: c.team, season: c.season, cards: [] });
    out.get(id).cards.push({ key, ...c });
  }
  for (const p of out.values()) p.cards.sort((a, b) => b.overall - a.overall);
  return [...out.values()];
}

// a pack not seen yet in this draft that offers at least one legal pick (lineup: the twelve places so far)
export function deal(all, used, squad, random = Math.random) {
  const fresh = all.filter(p => !used.includes(p.id));
  for (let i = 0; i < 200; i++) {
    const p = fresh[Math.floor(random() * fresh.length)];
    if (p.cards.some(c => !blockReason(c, squad))) return p;
  }
  throw new Error("no pack offers a legal pick");
}

// Chemistry: players who wore the same shirt play better together. Three or more from one franchise are linked
// (level 1); five or more are a core (level 2). The match engine gives a linked player a small lift per level.
export function chemistry(squad) {
  const n = {};
  for (const c of squad) n[c.team] = (n[c.team] ?? 0) + 1;
  return Object.fromEntries(squad.map(c => [c.key, n[c.team] >= 5 ? 2 : n[c.team] >= 3 ? 1 : 0]));
}

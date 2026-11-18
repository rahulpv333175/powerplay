// Scouting: the match-ups between two squads that are worth planning around. Pure, so it can be tested: node app/rules.test.mjs
//
// Everything here is read from the same data the match engine plays with, so a match-up shown is a match-up that counts:
//   h2h   one batter against one bowler, where they have met for 30+ balls in real matches: { batId: { bowlId: [run, out, balls, runs, outs] } }
//         (run and out are multipliers against what the two would do anyway; the last three are the raw record)
//   mu    on each card: his record against each type of bowling, [run, out] multipliers
const isBowler = c => c.bowl != null && c.bowl_balls >= 60;
const last = n => n.slice(n.indexOf(" ") + 1);
const times = n => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const list = a => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`);
const SPOT = n => (n <= 1 ? "opens for them" : n === 11 ? "is their Impact Player" : `bats at No. ${n + 1} for them`);
// the place that decides when he is likely to be in: his own, or for the Impact Player the place he usually bats
const where = (c, n) => (n === 11 ? Math.max(0, (c.spots?.[0] ?? 5) - 1) : n);
// when a batter in place n is most likely to be in: the phase a bowler should be saved for to meet him
const PHASE = n => (n <= 2 ? ["pp", "the new ball"] : n <= 5 ? ["mid", "the middle overs"] : ["death", "the death"]);

// One batter against one bowler: who has the upper hand, if either, with the record behind it.
export function duel(bat, bowl, h2h) {
  const r = h2h?.[bat.id]?.[bowl.id];
  if (!r) return null;
  const [run, out, balls, runs, outs] = r;
  const edge = out >= 1.15 || run <= 0.9 ? "bowler" : (run >= 1.08 && out <= 1.05) || out <= 0.8 ? "batter" : null;
  return edge && { edge, weight: balls * (Math.abs(run - 1) + Math.abs(out - 1)), record: `${runs} off ${balls} balls, ${outs ? `out ${times(outs)}` : "never out"}` };
}

// The report for a team sheet. mine and theirs are the twelve cards of each side in their batting places.
//   -> [{ icon, title, text, set?: { key, role, label } }]   set: a one-tap change to the bowling plan that follows from it
export function scout(mine, theirs, h2h) {
  const pairs = (bats, bowls) => bats.flatMap((bat, n) => (bat ? bowls.filter(b => b && isBowler(b)).map(bowl => ({ bat, bowl, n, d: duel(bat, bowl, h2h) })) : [])).filter(x => x.d).sort((a, b) => b.d.weight - a.d.weight);
  const us = pairs(theirs, mine), them = pairs(mine, theirs), out = [];
  // 1. my bowlers who own one of their batters, and when to bowl them
  const used = new Set();
  for (const { bat, bowl, n, d } of us.filter(x => x.d.edge === "bowler")) {
    if (used.has(bowl.key) || used.size >= 3 || bat.role === "bowler") continue;
    used.add(bowl.key);
    const [role, when] = PHASE(where(bat, n));
    out.push({ icon: "target", title: `${last(bowl.name)} has ${last(bat.name)}'s number`, text: `${bowl.name} against ${bat.name} in real matches: ${d.record}. ${last(bat.name)} ${SPOT(n)}, so ${last(bowl.name)} wants ${when}.`,
      set: { key: bowl.key, role, label: `Give ${last(bowl.name)} ${when}` } });
  }
  // 2. their batters who score freely off one of my bowlers: keep them apart
  for (const { bat, bowl, n, d } of us.filter(x => x.d.edge === "batter").slice(0, 2))
    out.push({ icon: "warning", title: `Keep ${last(bowl.name)} away from ${last(bat.name)}`, text: `${bat.name} off ${bowl.name}: ${d.record}. He ${SPOT(n)}, so ${last(bowl.name)} is better used away from ${PHASE(where(bat, n))[1]}.` });
  // 3. their bowlers who own one of my batters, and my batters who like one of theirs
  for (const { bat, bowl, d } of them.filter(x => x.d.edge === "bowler" && x.bat.role !== "bowler").slice(0, 2))
    out.push({ icon: "shield-warning", title: `${last(bowl.name)} is a threat to ${last(bat.name)}`, text: `${bowl.name} against your ${bat.name}: ${d.record}. If you can, bat ${last(bat.name)} where he is less likely to face him early.` });
  for (const { bat, bowl, d } of them.filter(x => x.d.edge === "batter").slice(0, 1))
    out.push({ icon: "lightning", title: `${last(bat.name)} likes ${last(bowl.name)}`, text: `Your ${bat.name} off their ${bowl.name}: ${d.record}. One to look forward to.` });
  // 4. a kind of bowling that troubles several of their top seven, where I have it (and the same in reverse)
  const trouble = (bats, type) => bats.slice(0, 7).filter(c => c && c.role !== "bowler" && (c.mu?.[type]?.[1] ?? 1) >= 1.12).map(c => last(c.name));
  const best = (side, type) => side.filter(c => c && isBowler(c) && c.type === type).sort((a, b) => b.bowl - a.bowl)[0];
  const types = side => [...new Set(side.filter(c => c && isBowler(c)).map(c => c.type))];
  const mineHits = types(mine).map(t => ({ t, who: trouble(theirs, t), b: best(mine, t) })).filter(x => x.who.length >= 2).sort((a, b) => b.who.length - a.who.length)[0];
  if (mineHits) out.push({ icon: "arrows-clockwise", title: `Their top order and ${mineHits.t}`, text: `${list(mineHits.who)} get out more often than usual to ${mineHits.t}. ${mineHits.b.name} is your ${mineHits.t} bowler: get him on while they are in.` });
  const theirHits = types(theirs).map(t => ({ t, who: trouble(mine, t), b: best(theirs, t) })).filter(x => x.who.length >= 2).sort((a, b) => b.who.length - a.who.length)[0];
  if (theirHits) out.push({ icon: "shield-warning", title: `Your top order and ${theirHits.t}`, text: `${list(theirHits.who)} get out more often than usual to ${theirHits.t}, and they have ${theirHits.b.name}.` });
  return out.slice(0, 6);
}

// During a draft: what a card on offer would mean against the players the others have already taken.
//   others: [{ name, cards }]   -> [{ good, text }] strongest first
export function edges(card, others, h2h) {
  const out = [];
  for (const { name, cards } of others) for (const c of cards) {
    const asBowler = isBowler(card) && duel(c, card, h2h), asBatter = isBowler(c) && duel(card, c, h2h);
    if (asBowler?.edge === "bowler") out.push({ good: true, weight: asBowler.weight, text: `Has ${last(c.name)}'s number (${name}'s pick): ${asBowler.record}` });
    if (asBowler?.edge === "batter") out.push({ good: false, weight: asBowler.weight, text: `${last(c.name)} (${name}'s pick) scores freely off him: ${asBowler.record}` });
    if (asBatter?.edge === "batter") out.push({ good: true, weight: asBatter.weight, text: `Scores freely off ${last(c.name)} (${name}'s pick): ${asBatter.record}` });
    if (asBatter?.edge === "bowler") out.push({ good: false, weight: asBatter.weight, text: `${last(c.name)} (${name}'s pick) has his number: ${asBatter.record}` });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

// After a match: the head-to-head match-ups that actually met in it, and how each went.
//   m: the match (local or slimmed); cards(team): that side's twelve
//   -> [{ bat, bowl, batTeam, bowlTeam, edge, balls, runs, out, held }] strongest history first
//   held: the match went the way the history said (the bowler got him or kept him quiet; the batter scored freely and survived)
export function played(m, cards, h2h) {
  const nm = x => x.player?.name ?? x.name, out = [];
  for (const [k, inn] of m.innings.entries()) {
    const batTeam = inn.team, bowlTeam = m.innings[1 - k].team, find = (t, n) => cards(t).find(c => c.name === n), met = new Map();
    for (const [b, w, code] of inn.log) {
      if (code === "w" || b < 0 || w < 0) continue;
      const key = `${b}|${w}`, r = met.get(key) ?? met.set(key, { b, w, balls: 0, runs: 0, out: false }).get(key);
      r.balls++; if (code === "W") r.out = true; else if (code !== "R" && code !== "b") r.runs += +code;
    }
    for (const r of met.values()) {
      const bat = find(batTeam, nm(inn.batting[r.b])), bowl = find(bowlTeam, nm(inn.bowling[r.w])), d = bat && bowl && duel(bat, bowl, h2h);
      if (!d) continue;
      const held = d.edge === "bowler" ? r.out || (r.balls >= 6 && r.runs < r.balls) : !r.out && r.balls >= 4 && r.runs >= 1.4 * r.balls;
      out.push({ bat: bat.name, bowl: bowl.name, batTeam, bowlTeam, edge: d.edge, weight: d.weight, balls: r.balls, runs: r.runs, out: r.out, held });
    }
  }
  return out.sort((a, b) => b.weight - a.weight);
}

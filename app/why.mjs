// "Why did it go that way?" for one finished match. Pure, so it can be tested: node app/rules.test.mjs
//
// Nothing here is made up after the fact. Two kinds of evidence are used:
//   - what happened: the scorecard of the match itself (runs by phase, what each side's spin and pace went for);
//   - what usually happens: the same two sides are played again many times at the same ground, and again at a
//     neutral one, with the engine that produced the result. That gives the odds, how much the ground moved them,
//     and how each attack fares against the other side's batters on an average night.
//
//   explain({ m, sim, home, away, cards, me, label, venues })
//     m            the match (as played locally, or the slimmed one a room sends)
//     home, away   the two sides as the engine takes them: { name, players, chem, shift, toss }
//     cards(name)  that side's twelve cards            me   the reader's own side, or null
//   -> { headline, odds, points: [{ icon, title, text }] }
const PHASES = [["powerplay", 0, 6], ["middle overs", 6, 15], ["death overs", 15, 20]];
const perOver = (runs, balls) => (balls ? (6 * runs / balls).toFixed(1) : "–");
const pct = x => Math.round(100 * x);
const list = a => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`);

export function explain({ m, sim, home, away, cards, me = null, label = t => t, venues = {}, h2h = {}, n = 300 }) {   // n replays: enough that the odds are good to a few points either way
  const win = m.winner, lose = win === m.home ? m.away : m.home, mine = me === win || me === lose;
  const W = me === win ? "You" : label(win), L = me === lose ? "You" : label(lose), w = me === win ? "you" : label(win), their = t => (t === me ? "your" : `${label(t)}'s`);   // sides take a plural verb: "MI win", "you win"
  const kindOf = Object.fromEntries([home.name, away.name].flatMap(t => cards(t).map(c => [`${t}|${c.name}`, c.kind])));
  const ground = m.venue.split(",")[0], v = venues[m.venue];

  // ---- what usually happens: replay the fixture here, and at a neutral ground ----
  const tally = () => ({ wins: 0, spin: { [home.name]: [0, 0], [away.name]: [0, 0] }, pace: { [home.name]: [0, 0], [away.name]: [0, 0] } });
  const here = tally(), neutral = tally();
  const seed0 = [...`${m.home}${m.away}${m.venue}`].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);   // the same match is always explained the same way
  for (let i = 0; i < n; i++) for (const [t, venue] of [[here, m.venue], [neutral, undefined]]) {
    const r = sim.match({ home, away, venue: venue && venues[venue] ? venue : undefined, seed: seed0 + i * 2 + 1 });
    if (r.winner === win) t.wins++;
    for (const inn of r.innings) { const bowlers = inn.team === home.name ? away.name : home.name;
      for (const x of inn.bowling) { const k = t[x.player.kind === "spin" ? "spin" : "pace"][bowlers]; k[0] += x.runs; k[1] += x.balls; } }
  }
  const odds = here.wins / n, oddsNeutral = neutral.wins / n;

  // ---- what happened ----
  const inn = t => m.innings.find(i => i.team === t);
  const phase = (i, a, b) => i.byOver.filter(o => o.over > a && o.over <= b).reduce((s, o) => s + o.runs, 0);
  const today = (bowlers, kind) => { const i = inn(bowlers === home.name ? away.name : home.name); let runs = 0, balls = 0;
    for (const x of i.bowling) if ((kindOf[`${bowlers}|${x.player?.name ?? x.name}`] === "spin" ? "spin" : "pace") === kind) { runs += x.runs; balls += x.balls; }
    return [runs, balls]; };

  const points = [];
  // 1. the odds
  const fair = odds >= 0.6 ? `${W} win this match-up about ${pct(odds)} times in 100 at ${ground}. The result went with the stronger side.`
    : odds >= 0.4 ? `Close to a coin toss: ${w} win it about ${pct(odds)} times in 100 at ${ground}. On another night it goes the other way.`
    : `An upset. ${W} win this only about ${pct(odds)} times in 100 at ${ground}. ${L} are the stronger side and had a bad day.`;
  points.push({ icon: "scales", title: "On the balance of play", text: fair });

  // 2. the ground
  const swing = pct(odds) - pct(oddsNeutral);
  if (v) points.push({ icon: "map-pin", title: `What ${ground} did`, text: Math.abs(swing) >= 7
    ? `The ground mattered. At a neutral venue ${w} win about ${pct(oddsNeutral)} in 100; at ${ground} it is ${pct(odds)}. It ${swing > 0 ? "suited" : "worked against"} ${me === win ? "you" : label(win)}${v.pitch ? ` (a ${v.pitch} pitch)` : ""}.`
    : `The ground made little difference to the odds: about ${pct(oddsNeutral)} in 100 at a neutral venue, ${pct(odds)} at ${ground}. The players counted for more than the pitch.` });

  // 3. spin and pace: how each attack does against these batters on an average night, and what it did today
  for (const bowlers of [lose, win]) {
    const batters = bowlers === home.name ? away.name : home.name, s = here.spin[bowlers], p = here.pace[bowlers], ts = today(bowlers, "spin"), tp = today(bowlers, "pace");
    if (s[1] / n < 18 || p[1] / n < 18) continue;   // an attack that is nearly all one kind has nothing to compare
    const gap = 6 * s[0] / s[1] - 6 * p[0] / p[1];
    if (Math.abs(gap) < 0.35 && bowlers === win) continue;
    const top = cards(batters).filter(c => c.role !== "bowler").slice(0, 7), types = [...new Set(cards(bowlers).filter(c => c.kind === "spin" && c.bowl_balls >= 60).map(c => c.type))];
    const like = top.filter(c => types.length && types.reduce((t, ty) => t + (c.mu?.[ty]?.[0] ?? 1), 0) / types.length > 1.02).map(c => c.name);
    points.push({ icon: "arrows-clockwise", title: `${bowlers === me ? "Your" : `${label(bowlers)}'s`} spin and pace`, text:
      `Against ${their(batters)} batters at ${ground}, ${their(bowlers)} spinners go for ${perOver(...s)} an over on an average night and the quicks for ${perOver(...p)}. ` +
      `In this match it was ${perOver(...ts)} and ${perOver(...tp)}.` +
      (gap > 0.35 ? ` Spin was the dearer option here${like.length >= 2 ? `: ${list(like.slice(0, 4))} all score faster than usual against ${list(types)}` : ""}.` : gap < -0.35 ? " Spin was the better option here." : "") });
    break;   // one attack is enough: the loser's if it is telling, else the winner's
  }

  // 4. where the match was decided
  // (a successful chase stops when the runs are got, so its death overs are not a fair comparison)
  const a = inn(win), b = inn(lose), chased = m.innings[1].team === win, swings = PHASES.slice(0, chased ? 2 : 3).map(([name, x, y]) => ({ name, mine: phase(a, x, y), theirs: phase(b, x, y) })).sort((p, q) => (q.mine - q.theirs) - (p.mine - p.theirs));
  if (swings[0].mine - swings[0].theirs >= 8) points.push({ icon: "chart-bar", title: "Where it was won",
    text: `${W} took the ${swings[0].name} ${swings[0].mine}–${swings[0].theirs}.${swings.at(-1).mine < swings.at(-1).theirs - 7 ? ` ${L} had the better of the ${swings.at(-1).name} (${swings.at(-1).theirs}–${swings.at(-1).mine}), which was not enough.` : ""}` });

  // 5. head-to-head records that were in play: a batter and a bowler from this match who have real history
  const idOf = Object.fromEntries([home.name, away.name].flatMap(t => cards(t).map(c => [`${t}|${c.name}`, c.id]))), duels = [];
  for (const i of m.innings) { const bowlTeam = i.team === home.name ? away.name : home.name;
    for (const x of i.batting) for (const y of i.bowling) { const bat = x.player?.name ?? x.name, bowl = y.player?.name ?? y.name, rec = h2h[idOf[`${i.team}|${bat}`]]?.[idOf[`${bowlTeam}|${bowl}`]];
      if (rec) duels.push({ bat, bowl, rec, weight: rec[2] * (Math.abs(rec[0] - 1) + Math.abs(rec[1] - 1)) }); } }
  duels.sort((p, q) => q.weight - p.weight);
  if (duels.length) points.push({ icon: "sword", title: "Old scores", text: duels.slice(0, 2).map(({ bat, bowl, rec: [run, out, balls, runs, outs] }) =>
    `${bat} against ${bowl} in real matches: ${runs} off ${balls} balls, out ${outs === 1 ? "once" : `${outs} times`}${out >= 1.15 ? ", so the bowler has his number" : run >= 1.08 && out < 1.1 ? ", so the batter likes him" : run <= 0.92 ? ", so he is kept quiet" : ""}.`).join(" ") + " The match plays these records." });

  // 6. the day itself
  points.push({ icon: "sun", title: "On the day", text: `${m.toss.replace(m.home, label(m.home)).replace(m.away, label(m.away))}, on ${m.pitch}. Player of the match: ${m.playerOfMatch.name}.` });

  const headline = !mine ? `Why ${label(win)} won` : me === win ? "Why you won" : "Why you lost";
  return { headline, odds, oddsNeutral, points };
}

// "Why did the whole series (or season) go that way, and what would change it?" for one side.
//
//   review({ matches, me, teams, sim, cards, label, venues })
//     matches       every match this side has played, in order (local or slimmed)
//     teams         { name: side as the engine takes it, with .shift (rating points lost out of position) and .away }
//   -> { headline, points: [{ icon, title, text }], changes: [text] }
//
// As with a single match, the odds come from replaying each fixture with the same sides; everything else is counted
// from the scorecards. The suggestions are only made where the numbers are clear enough to act on.
const STYLE_FOR = { bat: ["Powerplay Enforcer", "Anchor", "Finisher"], bowl: ["New-Ball Striker", "Middle-Overs Choke", "Death Specialist"] };
export function review({ matches, me, teams, sim, cards, label = t => t, venues = {}, n = 40 }) {
  const nm = x => x.player?.name ?? x.name, played = matches.length, rpo = ([r, b]) => (b ? 6 * r / b : 0), fx = x => x.toFixed(1);
  const kind = Object.fromEntries(Object.keys(teams).flatMap(t => cards(t).map(c => [`${t}|${c.name}`, c.kind === "spin" ? "spin" : "pace"])));
  const T = () => [0, 0], add = (t, r, b) => { t[0] += r; t[1] += b; };
  const bat = { all: T(), ph: [T(), T(), T()], spin: T(), pace: T() }, bowl = { all: T(), ph: [T(), T(), T()], spin: T(), pace: T() };
  const rec = { home: T(), away: T(), first: T(), chase: T() }, won = t => { t[0]++; }, lost = t => { t[1]++; };   // [won, lost]
  const batters = {}, bowlers = {};
  let wins = 0, expected = 0;
  for (const [k, m] of matches.entries()) {
    const opp = m.home === me ? m.away : m.home, mine = m.innings.find(i => i.team === me), theirs = m.innings.find(i => i.team === opp), w = m.winner === me;
    wins += w;
    (w ? won : lost)(m.home === me ? rec.home : rec.away); (w ? won : lost)(m.innings[0].team === me ? rec.first : rec.chase);
    // the odds of this fixture, from replays with the same two sides
    const vs = (t, other) => (t.bowlVs?.[other] ? { ...t, bowl: t.bowlVs[other] } : t);   // his bowling plan for this opponent, as the season used it
    const visitors = teams[m.away], home = vs(teams[m.home], m.away), away = vs(visitors.away ? { ...visitors, ...visitors.away } : visitors, m.home);
    for (let i = 0; i < n; i++) expected += (sim.match({ home, away, venue: venues[m.venue] ? m.venue : undefined, seed: 1000 * (k + 1) + i }).winner === me) / n;
    for (const [inn, side, bowlTeam] of [[mine, bat, opp], [theirs, bowl, me]]) {
      for (const o of inn.byOver) { const balls = o.over * 6 <= inn.balls ? 6 : Math.max(0, inn.balls - (o.over - 1) * 6); add(side.ph[o.over <= 6 ? 0 : o.over <= 15 ? 1 : 2], o.runs, balls); add(side.all, o.runs, balls); }
      for (const x of inn.bowling) add(side[kind[`${bowlTeam}|${nm(x)}`] ?? "pace"], x.runs, x.balls);
    }
    for (const x of mine.batting) { const p = (batters[nm(x)] ??= { name: nm(x), runs: 0, balls: 0, inns: 0 }); p.runs += x.runs; p.balls += x.balls; p.inns++; }
    for (const x of theirs.bowling) { const p = (bowlers[nm(x)] ??= { name: nm(x), runs: 0, balls: 0, wickets: 0 }); p.runs += x.runs; p.balls += x.balls; p.wickets += x.wickets; }
  }
  const series = Object.keys(teams).length === 2, what = series ? "series" : "season", games = `${played} match${played === 1 ? "" : "es"}`;
  const points = [], changes = [];

  // 1. results against the odds
  const gap = wins - expected;
  points.push({ icon: "scales", title: "Results against the odds", text: `You won ${wins} of ${games}. A side like yours wins about ${fx(expected)} of them against these opponents at these grounds. ` +
    (gap >= 1.2 ? "You got more than your share: some close ones fell your way." : gap <= -1.2 ? "You got less than your share: this was partly bad luck, not all bad selection." : "The results were about what the two squads deserved.") });

  // 2. scoring rate, for and against, and the phase that hurt or helped most
  const names = ["powerplay", "middle overs", "death overs"], diff = names.map((_, i) => rpo(bat.ph[i]) - rpo(bowl.ph[i]));
  const worst = diff.indexOf(Math.min(...diff)), best = diff.indexOf(Math.max(...diff));
  points.push({ icon: "chart-bar", title: "Runs for and against", text: `You scored ${fx(rpo(bat.all))} an over and conceded ${fx(rpo(bowl.all))}. ` +
    `Your best phase was the ${names[best]} (${fx(rpo(bat.ph[best]))} for, ${fx(rpo(bowl.ph[best]))} against)` + (worst !== best && diff[worst] < 0 ? `; your worst was the ${names[worst]} (${fx(rpo(bat.ph[worst]))} for, ${fx(rpo(bowl.ph[worst]))} against).` : ".") });

  // 3. spin and pace, with the bat and with the ball
  const spinPace = [];
  if (bat.spin[1] >= 24 && bat.pace[1] >= 24) spinPace.push(`Your batters scored ${fx(rpo(bat.spin))} an over off spin and ${fx(rpo(bat.pace))} off pace.`);
  if (bowl.spin[1] >= 24 && bowl.pace[1] >= 24) spinPace.push(`Your spinners went for ${fx(rpo(bowl.spin))} an over and your quicks for ${fx(rpo(bowl.pace))}.`);
  if (spinPace.length) points.push({ icon: "arrows-clockwise", title: "Spin and pace", text: spinPace.join(" ") });

  // 4. home and away, batting first and chasing
  const wl = ([w, l]) => `${w}–${l}`;
  points.push({ icon: "map-pin", title: "Where and how you won", text: `At home ${wl(rec.home)}, away ${wl(rec.away)}. Batting first ${wl(rec.first)}, chasing ${wl(rec.chase)}.` });

  // 5. who carried it and who did not
  const bats = Object.values(batters).filter(p => p.inns >= Math.max(2, played / 2)), bowls = Object.values(bowlers).filter(p => p.balls >= Math.max(24, played * 9));
  const topBat = [...bats].sort((a, b) => b.runs - a.runs)[0], topBowl = [...bowls].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];
  const order = cards(me).filter(c => c.role !== "bowler").map(c => c.name), front = bats.filter(p => order.indexOf(p.name) > -1 && order.indexOf(p.name) < 6);
  const weakBat = [...front].sort((a, b) => a.runs / a.inns - b.runs / b.inns)[0], dearBowl = [...bowls].sort((a, b) => rpo([b.runs, b.balls]) - rpo([a.runs, a.balls]))[0];
  if (topBat || topBowl) points.push({ icon: "star", title: "Who carried it", text: [topBat && `${topBat.name} made ${topBat.runs} runs at ${fx(100 * topBat.runs / Math.max(1, topBat.balls))} per 100 balls`,
    topBowl && `${topBowl.name} took ${topBowl.wickets} wicket${topBowl.wickets === 1 ? "" : "s"} at ${fx(rpo([topBowl.runs, topBowl.balls]))} an over`].filter(Boolean).join("; ") + "." });

  // ---- what to change: only where the numbers are clear ----
  const enough = t => t[0] + t[1] >= 2, rate = t => t[0] / Math.max(1, t[0] + t[1]);
  if (enough(rec.first) && enough(rec.chase) && Math.abs(rate(rec.first) - rate(rec.chase)) >= 0.34) { const chase = rate(rec.chase) > rate(rec.first);
    changes.push(`Call the toss. You were ${wl(rec.chase)} chasing and ${wl(rec.first)} batting first, so choose to ${chase ? "bowl" : "bat"} when you win it.`); }
  if (enough(rec.home) && enough(rec.away) && rate(rec.away) - rate(rec.home) >= 0.34) { const v = venues[teams[me].venue], spinHeavy = bowl.spin[1] > bowl.pace[1];
    changes.push(`Rethink your home ground. You were ${wl(rec.home)} at ${teams[me].venue?.split(",")[0] ?? "home"} and ${wl(rec.away)} away${v?.pitch ? `; it is a ${v.pitch} pitch and your attack is mostly ${spinHeavy ? "spin" : "pace"}` : ""}.`); }
  if (diff[worst] <= -1) { const isBat = rpo(bowl.ph[worst]) / rpo(bowl.all) <= rpo(bat.ph[worst]) / rpo(bat.all);   // the bowling leaked no more than usual in that phase, so the batting is what fell short
    changes.push(`Fix the ${names[worst]}. You were outscored there by ${fx(-diff[worst])} an over. Next draft, look for a ${STYLE_FOR[isBat ? "bat" : "bowl"][worst]}${isBat ? " in the order" : " in the attack"}.`); }
  if (bat.spin[1] >= 36 && bat.pace[1] >= 36 && Math.abs(rpo(bat.spin) - rpo(bat.pace)) >= 1.3) { const slow = rpo(bat.spin) < rpo(bat.pace) ? "spin" : "pace";
    changes.push(`Your batters were held by ${slow} (${fx(rpo(bat[slow]))} an over). A player's sheet shows what troubles him: pick batters without that mark against ${slow}.`); }
  const moved = Object.entries(teams[me].shift ?? {}).map(([key, pts]) => ({ name: cards(me).find(c => c.key === key)?.name, pts })).filter(x => x.name && x.pts >= 3);
  if (moved.length) changes.push(`${list(moved.map(x => x.name).slice(0, 3))} batted out of position all ${what} and gave up ${moved.reduce((t, x) => t + x.pts, 0)} batting points${moved.length > 1 ? " between them" : ""}. Swap ${moved.length > 1 ? "them to natural spots" : "him to his natural spot"} on the team sheet.`);
  if (weakBat && topBat && weakBat !== topBat && weakBat.runs / weakBat.inns < 14) changes.push(`${weakBat.name} averaged ${fx(weakBat.runs / weakBat.inns)} runs an innings in your top six. That place is worth more.`);
  if (dearBowl && dearBowl !== topBowl && rpo([dearBowl.runs, dearBowl.balls]) - rpo(bowl.all) >= 1.2) changes.push(`${dearBowl.name} went for ${fx(rpo([dearBowl.runs, dearBowl.balls]))} an over, well above the rest of your attack.`);
  if (!changes.length) changes.push(gap <= -1.2 ? "Not much. The squad was good enough and the odds did not fall your way. The same side wins more often than not." : "Nothing stands out. No one part of the side cost you more than the others.");

  return { headline: `Why the ${what} went that way`, wins, expected, points, changes: changes.slice(0, 4) };
}

// Ball-by-ball T20 match engine. No dependencies; runs in Node and in the browser.
//
//   import { createSim } from "./engine.mjs";
//   const sim = createSim(data);                       // data = sim/data.json
//   const match = sim.match({ home, away, venue, seed });
//
// A team is { name, players: [12 card keys in batting order] }. The 12th man works as the Impact Player:
// the side bats without its weakest batter and bowls without its weakest bowler.
//
// Every ball starts from the league-average ball for that phase and is adjusted, in order, by:
// batter (level, style, phase shape) -> bowler (same) -> ground (phase, bowler type, batter hand, innings,
// sixes and fours; the best players are affected less by conditions that are against them) -> batter-v-bowler-type match-up -> each player's record at the ground -> match situation.
// The same seed always replays the same match.

const PHASES = ["powerplay", "middle", "death"];
const RUNS = [0, 1, 2, 3, 4, 6];
const phaseOf = over => (over < 6 ? 0 : over < 15 ? 1 : 2);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Tunable game-feel constants, calibrated in sim/test.mjs against real matches of the last five seasons
export const TUNE = {
  runOut: 0.06,            // share of dismissals that are run-outs (not credited to the bowler)
  legBye: 0.028,           // chance a legal ball also yields a bye or leg-bye (about 3 runs an innings, as in real matches)
  venueAdj: 130,           // a player's ground record is in runs per 100 balls; divide by this to get a multiplier
  runs: 1.03, wickets: 1.0, // final calibration of scoring and dismissals against real matches
  // the shape of an innings: powerplay / middle (overs 7-15) / death (16-20) scoring and wickets, set so simulated
  // phase totals match real ones (the match-situation rules below otherwise make the middle too quick and the death too slow)
  phaseRuns: [1, 0.94, 1.05], phaseWkts: [1, 1.09, 0.95],
  class: 0.35,             // share of a ground's hostile conditions that the very best players shrug off (none below 85, all of it at 99)
  chaseDeath: 1.06,        // death-overs scoring when chasing: the chase rules set most of the pace there; this keeps chases winning about half
  pitchOfTheDay: 0.08,     // match-to-match variation in how the surface plays (real grounds are not the same every night)
  pitchLean: 0.05,         // and in whom it helps: on a given night the same square turns a little more, or carries a little more for the quicks
  wicketsInHand: [0.06, 0.20],   // scoring / risk change when a side has more wickets in hand than usual
  rebuild: 0.48,           // how much risk a side cuts out when it has fewer wickets in hand than usual
  chase: [0.10, 0.40],     // scoring / risk change per unit of required-rate pressure
  rotation: 0.8,           // how much a captain's bowling plan varies from match to match (0 = the same plan every night, which
                           // handed two bowlers a side every death over and produced 40-wicket seasons)
  parRate: 10.5, chemistry: 0.008,           // required rate (runs an over) at which a chase feels neutral
};

export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSim(data) {
  const card = key => {
    const c = data.cards[key];
    if (!c) throw new Error(`unknown card ${key}`);
    return { key, id: c.id || key.split(':')[0], ...c };
  };

  // 12 named players -> who bats (11) and who bowls (11), by the Impact Player rule
  function sides(team) {
    // team.chem (optional): { key: level } from the draft's chemistry rule; each level lifts scoring and tightens bowling a little
    // team.shift (optional): { key: rating points } a batter gives up for batting away from his usual place
    const L = data.levels;
    const squad = team.players.map(card).map(p => {
      const lift = 1 + TUNE.chemistry * (team.chem?.[p.key] ?? 0), drop = (team.shift?.[p.key] ?? 0) / (L?.spread ?? 15);
      let rm = p.rm * lift * Math.exp(-(L?.bat[0] ?? 0.08) * drop);
      let om = p.om * Math.exp((L?.bat[1] ?? 0.2) * drop);
      let em = p.em / lift;
      let wm = p.wm ?? 1.0;

      // Underdog & Low-Rated Player Competitiveness Boost:
      // Taking lower-rated players does not mean they won't perform!
      const batRating = p.bat ?? p.overall ?? 70;
      const bowlRating = p.bowl ?? p.overall ?? 70;

      // If batter is lower-rated (< 82), lift scoring floor and reduce excessive wicket risk
      if (batRating < 82) {
        const underdogLift = 1 + 0.14 * ((82 - batRating) / 20);
        rm = Math.max(rm * underdogLift, 0.98);
        om = Math.min(om / underdogLift, 1.04);
      }

      // If bowler is lower-rated (< 82), tighten economy and raise wicket punch
      if (bowlRating < 82) {
        const bowlerPunch = 1 + 0.12 * ((82 - bowlRating) / 20);
        wm = Math.max(wm * bowlerPunch, 0.98);
        em = Math.min(em / bowlerPunch, 1.02);
      }

      return { ...p, rm, om, em, wm, batRating, bowlRating };
    });
    if (squad.length !== 12) throw new Error(`${team.name}: a squad is 12 players, got ${squad.length}`);
    if (new Set(squad.map(p => p.id)).size !== 12) throw new Error(`${team.name}: the same player appears twice`);
    if (squad.filter(p => p.overseas).length > 4) throw new Error(`${team.name}: more than 4 overseas players`);
    const weakestBat = [...squad].sort((a, b) => (a.bat ?? 0) - (b.bat ?? 0))[0];
    const weakestBowl = [...squad].filter(p => p !== weakestBat).sort((a, b) => (a.bowl ?? 0) - (b.bowl ?? 0))[0];
    return { name: team.name, toss: team.toss, roles: team.bowl, batting: squad.filter(p => p !== weakestBat), bowling: squad.filter(p => p !== weakestBowl) };
  }

  // Who bowls each over. The five best bowlers share all 20 overs (four each, never two in a row), each used
  // where he is strongest: death overs are assigned first, then the powerplay, then the middle.
  // A sixth or seventh bowler is only brought in when five cannot cover the innings.
  //
  // roles (optional): the manager's own plan, { cardKey: "pp" | "mid" | "death" | "off" }. A bowler given a phase bowls
  // there first and is kept out of the other phases as far as the overs allow (he still has four overs, and a phase
  // may need more hands than were named for it). "off" rests him unless the side cannot find 20 overs without him.
  function bowlingPlan(bowlers, rand = () => 0.5, roles = {}) {   // no random source: the plan with no wobble
    const want = p => ({ pp: 0, mid: 1, death: 2 })[roles?.[p.key]], off = p => roles?.[p.key] === "off";
    const ranked = [...bowlers].sort((a, b) => off(a) - off(b) || (want(b) != null) - (want(a) != null) || (b.bowl ?? 0) - (a.bowl ?? 0));
    const named = ranked.filter(p => want(p) != null).length;
    // captains do not use the same plan every night: each bowler's worth in each phase wobbles a little from match to match,
    // so the death overs (where wickets are cheapest) are shared around instead of going to the same two men all season
    const mood = new Map(bowlers.map(p => [p, [0, 1, 2].map(() => TUNE.rotation * (rand() - 0.5))]));
    const value = (p, ph) => -Math.log((p.em ?? 1.0) * (p.pe?.[ph] ?? 1.0)) + 0.5 * Math.log((p.wm ?? 1.0) * (p.pw?.[ph] ?? 1.0)) + mood.get(p)[ph] + (want(p) == null ? 0 : want(p) === ph ? 3 : -3);
    const order = [19, 18, 17, 16, 0, 1, 2, 3, 4, 5, 15, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    for (const size of [5, 6, 7].filter(n => n >= Math.min(7, named))) {   // everyone the manager named a phase for is in the attack
      const pool = ranked.slice(0, size), quota = new Map(pool.map(p => [p, 4])), plan = new Array(20).fill(null);
      let budget = 20000;   // search steps before giving up on this pool
      const fill = i => {
        if (i === order.length) return true;
        if (--budget < 0) return false;
        const over = order[i], ph = phaseOf(over);
        const ok = pool.filter(p => quota.get(p) > 0 && plan[over - 1] !== p && plan[over + 1] !== p).sort((a, b) => value(b, ph) - value(a, ph));
        for (const p of ok) {
          plan[over] = p; quota.set(p, quota.get(p) - 1);
          if (fill(i + 1)) return true;
          plan[over] = null; quota.set(p, quota.get(p) + 1);
        }
        return false;
      };
      if (pool.length >= 5 && fill(0)) return plan;
    }
    throw new Error("could not fill 20 overs: the side needs at least five bowlers");
  }

  function innings({ bat, bowl, venue, rand, target = null, second = false, maxOvers = 20, maxWickets = 10, pitch = 1, lean = 0 }) {
    const plan = bowlingPlan(bowl.bowling, rand, bowl.roles);
    const order = bat.batting;
    const B = order.map(p => ({ player: p, runs: 0, balls: 0, fours: 0, sixes: 0, out: null }));
    const W = new Map();
    const figures = p => W.get(p) ?? W.set(p, { player: p, balls: 0, runs: 0, wickets: 0 }).get(p);
    let score = 0, wickets = 0, legal = 0, striker = 0, other = 1, next = 2;
    const fall = [], overs = [], log = [];   // log: every ball as [batter, bowler, code] for the match centre
    const v = venue;
    const innF = second && v ? [v.innings.second.runs / v.overall.runs, v.innings.second.wkts / v.overall.wkts] : [1, 1];

    done: for (let over = 0; over < maxOvers; over++) {
      const bowler = plan[over], fig = figures(bowler), ph = phaseOf(over), base = data.base[ph];
      const vk = v?.[bowler.kind]?.[PHASES[ph]] ?? {}, today = Math.exp(bowler.kind === "spin" ? lean : -lean);   // the day's lean, for or against this kind of bowling
      const vRuns = (vk.runs ?? v?.phase[PHASES[ph]].runs ?? 1) / today, vWkts = (vk.wkts ?? v?.phase[PHASES[ph]].wkts ?? 1) * today;
      let ballsThisOver = 0, runsThisOver = 0, extras = 0;
      while (ballsThisOver < 6) {
        if (extras < 4 && rand() < base.wide) { score++; fig.runs++; runsThisOver++; extras++; log.push([B[striker], fig, "w"]); if (target !== null && score >= target) break done; continue; }
        const b = B[striker], p = b.player;
        // match-ups: his record against this type of bowling, and on top of it his own record against this very bowler (data.h2h), where the two have met enough for it to mean something
        const bType = bowler.type || (bowler.kind === "spin" ? "off spin" : "right-arm pace");
        const type = (p.mu && p.mu[bType]) ? p.mu[bType] : [1, 1], pair = data.h2h?.[p.id]?.[bowler.id], muRun = type[0] * (pair?.[0] ?? 1), muOut = type[1] * (pair?.[1] ?? 1);
        const batHere = (p.vn?.[v?.name]?.[0] ?? 0) / TUNE.venueAdj, bowlHere = (bowler.vn?.[v?.name]?.[1] ?? 0) / TUNE.venueAdj;
        // match situation: wickets in hand against the usual, and required rate when chasing
        const usual = 10 - 6 * Math.pow(legal / (maxOvers * 6), 1.2);
        const spare = clamp((10 - wickets - usual) / 3, -1, 1);
        let iRun = TUNE.runs * (target !== null && ph === 2 ? TUNE.chaseDeath : TUNE.phaseRuns[ph]) * pitch * (1 + TUNE.wicketsInHand[0] * spare), iOut = TUNE.wickets * TUNE.phaseWkts[ph] / pitch * (1 + (spare < 0 ? TUNE.rebuild : TUNE.wicketsInHand[1]) * spare);
        if (target !== null) {
          const left = maxOvers * 6 - legal, need = target - score;
          const pressure = clamp((need / left * 6 - TUNE.parRate) / 6, -0.5, 1);
          iRun *= 1 + TUNE.chase[0] * pressure; iOut *= 1 + TUNE.chase[1] * pressure;
        }
        // class tells: a top batter is hurt less by a bowler-friendly ground, a top bowler less by a flat one
        const batClass = 1 - TUNE.class * clamp(((p.bat ?? 0) - 85) / 14, 0, 1), bowlClass = 1 - TUNE.class * clamp(((bowler.bowl ?? 0) - 85) / 14, 0, 1);
        const gRuns = 1 + (vRuns - 1) * (vRuns < 1 ? batClass : bowlClass), gWkts = 1 + (vWkts - 1) * (vWkts > 1 ? batClass : bowlClass);

        // Fearless intent & match-day breakout form for lower-rated players
        const isUnderdogBat = (p.batRating ?? p.bat ?? p.overall ?? 75) < 82;
        b.formMultiplier ??= (isUnderdogBat && rand() < 0.35) ? 1.20 : 1.0;
        const fearlessDeathBoost = (isUnderdogBat && ph === 2) ? 1.15 : 1.0;
        const fearlessDeathProtection = (isUnderdogBat && ph === 2) ? 0.88 : 1.0;

        const isUnderdogBowl = (bowler.bowlRating ?? bowler.bowl ?? bowler.overall ?? 75) < 82;
        fig.formMultiplier ??= (isUnderdogBowl && rand() < 0.35) ? 1.18 : 1.0;

        const pOut = clamp(base.out * (p.om ?? 1.0) * fearlessDeathProtection * (p.po?.[ph] ?? 1.0) * ((bowler.wm ?? 1.0) * fig.formMultiplier) * (bowler.pw?.[ph] ?? 1.0) * gWkts * innF[1] * muOut * iOut, 0.004, 0.3);
        ballsThisOver++; legal++; b.balls++; fig.balls++;
        if (rand() < pOut) {
          wickets++;
          const runOut = rand() < TUNE.runOut;
          if (!runOut) fig.wickets++;
          b.out = runOut ? "run out" : `b ${bowler.name}`;
          log.push([b, fig, runOut ? "R" : "W"]);
          fall.push({ wicket: wickets, score, over: `${over}.${ballsThisOver}`, batter: p.name });
          if (wickets >= maxWickets || next >= order.length) break done;
          striker = next++;
          continue;
        }
        // scoring: tilt the phase's run distribution so its average moves by the combined multiplier
        const handRate = v && p.hand && v.hand?.[p.hand] ? v.hand[p.hand].runs / v.overall.runs : 1;
        const M = (p.rm ?? 1.0) * b.formMultiplier * fearlessDeathBoost * (p.pr?.[ph] ?? 1.0) * ((bowler.em ?? 1.0) / fig.formMultiplier) * (bowler.pe?.[ph] ?? 1.0) * gRuns * innF[0] * muRun * (1 + batHere) * (1 - bowlHere)
          * handRate * iRun;
        // the ground first reshapes how runs come (more sixes at Chinnaswamy, more fours at Mohali) ...
        let sum0 = 0, mean0 = 0;
        const w0 = RUNS.map(r => {
          const x = base.runs[r] * (v && r === 4 ? v.overall.fours / v.overall.runs : v && r === 6 ? v.overall.sixes / v.overall.runs : 1);
          sum0 += x; mean0 += r * x;
          return x;
        });
        // ... then the whole distribution is tilted so its average lands exactly on the target
        const tilt = (M * base.mean - mean0 / sum0) / base.var;
        let total = 0;
        const w = RUNS.map((r, i) => { const x = w0[i] * Math.exp(tilt * r); total += x; return x; });
        let pick = rand() * total, runs = 6;
        for (let i = 0; i < RUNS.length; i++) { pick -= w[i]; if (pick <= 0) { runs = RUNS[i]; break; } }
        const bye = runs === 0 && rand() < TUNE.legBye / base.runs[0] ? 1 : 0;   // only off a ball the batter did not score from
        log.push([b, fig, bye ? "b" : String(runs)]);
        score += runs + bye; b.runs += runs; fig.runs += runs; runsThisOver += runs + bye;
        if (runs === 4) b.fours++; if (runs === 6) b.sixes++;
        if ((runs + bye) % 2) [striker, other] = [other, striker];
        if (target !== null && score >= target) break done;
      }
      overs.push({ over: over + 1, bowler: bowler.name, runs: runsThisOver, score, wickets });
      [striker, other] = [other, striker];
    }
    const batting = B.filter(b => b.balls || b.out), bowling = [...W.values()];
    // codes: "0".."6" runs off the bat, "w" wide, "b" leg bye, "W" wicket, "R" run out; batter and bowler are indexes into the lists below
    return { team: bat.name, score, wickets, balls: legal, overs: `${Math.floor(legal / 6)}.${legal % 6}`,
             batting, bowling, fall, byOver: overs, log: log.map(([b, f, c]) => [batting.indexOf(b), bowling.indexOf(f), c]) };
  }

  function match({ home, away, venue, seed = 1 }) {
    const rand = rng(seed);
    const v = venue ? data.venues[venue] : null;
    if (venue && !v) throw new Error(`unknown venue ${venue}`);
    const a = sides(home), b = sides(away);
    const tossWinner = rand() < 0.5 ? a : b;
    // team.toss: "bat" or "bowl" is that side's standing call if it wins the toss; without one the captain goes by the ground's history
    const byGround = rand() < (v ? v.scores.toss_field_first_pct / 100 : 0.6), fieldFirst = tossWinner.toss ? tossWinner.toss === "bowl" : byGround;
    const first = (tossWinner === a) === fieldFirst ? b : a, chasing = first === a ? b : a;
    // the surface on the day: above 1 is a flat pitch (more runs, fewer wickets), below 1 helps the bowlers
    const pitch = Math.exp(TUNE.pitchOfTheDay * Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand()));
    // above 0 the surface is drier and helps spin (spinners cheaper and more dangerous, quicks the opposite); below 0 it has more in it for pace
    const lean = TUNE.pitchLean * Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    const pitchReport = (pitch > 1.05 ? "a flat pitch, full of runs" : pitch < 0.95 ? "a pitch with plenty for the bowlers" : "a typical pitch for this ground")
      + (lean > 0.04 ? ", drier than usual and turning" : lean < -0.04 ? ", with a tinge of green for the quicks" : "");
    const one = innings({ bat: first, bowl: chasing, venue: v, rand, pitch, lean });
    const two = innings({ bat: chasing, bowl: first, venue: v, rand, target: one.score + 1, second: true, pitch, lean });
    let winner, result, superOver = null;
    if (two.score > one.score) { winner = chasing.name; result = `${winner} won by ${10 - two.wickets} wicket${10 - two.wickets === 1 ? "" : "s"} with ${120 - two.balls} ball${120 - two.balls === 1 ? "" : "s"} left`; }
    else if (two.score < one.score) { winner = first.name; result = `${winner} won by ${one.score - two.score} run${one.score - two.score === 1 ? "" : "s"}`; }
    else {   // tie: one-over eliminators until someone wins
      for (;;) {
        const s1 = innings({ bat: chasing, bowl: first, venue: v, rand, maxOvers: 1, maxWickets: 2 });
        const s2 = innings({ bat: first, bowl: chasing, venue: v, rand, maxOvers: 1, maxWickets: 2, target: s1.score + 1 });
        superOver = { [chasing.name]: s1.score, [first.name]: s2.score };
        if (s1.score !== s2.score) { winner = s2.score > s1.score ? first.name : chasing.name; break; }
      }
      result = `Match tied; ${winner} won the Super Over`;
    }
    // player of the match: runs (faster is better), wickets and economy, with a small edge to the winning side
    const points = [];
    for (const inn of [one, two]) {
      for (const x of inn.batting) points.push([x.player, inn.team, x.runs + 0.5 * (x.runs - x.balls)]);
      const fielding = inn === one ? chasing.name : first.name;
      for (const x of inn.bowling) points.push([x.player, fielding, 25 * x.wickets - 0.7 * (x.runs - 1.35 * x.balls)]);
    }
    const tally = new Map();
    for (const [p, team, pts] of points) tally.set(p, { name: p.name, team, points: (tally.get(p)?.points ?? 0) + pts });
    const best = [...tally.values()].map(t => ({ ...t, points: t.points * (t.team === winner ? 1.15 : 1) })).sort((x, y) => y.points - x.points)[0];
    return { venue: venue ?? "neutral", seed, pitch: pitchReport, toss: `${tossWinner.name} won the toss and chose to ${fieldFirst ? "field" : "bat"}`,
             innings: [one, two], winner, result, superOver, playerOfMatch: { name: best.name, team: best.team } };
  }

  return { match, innings, sides, bowlingPlan };
}

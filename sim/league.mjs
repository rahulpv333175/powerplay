// A season on top of the match engine: a league in matchdays (home and away, capped at 14 games a side), then the four-match playoffs.
//   const s = createSeason(sim, teams, { seed });   // teams: [{ name, players: [12 keys], venue, toss?, away?: { players, shift, toss } }]
//   while (!s.done) s.playNext();                    // one matchday (or playoff stage) at a time
// Teams are read when each match is played, so a side can change its order between matchdays.
// Run directly for a demo with the draft all-time XIs:   node sim/league.mjs [seed]
import { rng } from "./engine.mjs";

// `restore` (optional) is what state() returned earlier: with the same seed and teams the season carries on exactly
// where it stopped, which is how a multiplayer room survives a server restart.
// a side may keep a bowling plan for one opponent: team.bowlVs = { [their name]: plan } is used in place of team.bowl against them
export const versus = (team, other) => (team.bowlVs?.[other] ? { ...team, bowl: team.bowlVs[other] } : team);

export function createSeason(sim, teams, { seed = 1, finalVenue = "Motera, Ahmedabad", restore = null } = {}) {
  const rand = rng(seed);
  let drawn = 0;   // match seeds handed out so far
  const nextSeed = () => (drawn++, Math.floor(rand() * 2 ** 31));
  const byName = Object.fromEntries(teams.map(t => [t.name, t]));
  const table = new Map(teams.map(t => [t.name, { team: t.name, played: 0, won: 0, lost: 0, points: 0, runsFor: 0, ballsFor: 0, runsAgainst: 0, ballsAgainst: 0 }]));
  const bat = new Map(), bowl = new Map();   // season tallies for the Orange and Purple Caps

  // every side plays once per matchday: circle method for the first half, reversed venues for the second
  const order = [...teams];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const half = [];
  for (let r = 0; r < order.length - 1; r++) {
    half.push(Array.from({ length: order.length / 2 }, (_, i) => ((r + i) % 2 ? [order[i], order[order.length - 1 - i]] : [order[order.length - 1 - i], order[i]])));
    order.splice(1, 0, order.pop());
  }
  // two sides play a head-to-head series instead: best of five, grounds alternating, first to three wins
  const SERIES = 5, LEAGUE_GAMES = 14, series = teams.length === 2;
  const rounds = series
    ? Array.from({ length: SERIES }, (_, i) => ({ stage: `Match ${i + 1} of ${SERIES}`, fixtures: [{ home: order[i % 2].name, away: order[1 - i % 2].name, venue: order[i % 2].venue }] }))
    // the return games stop once every side has played LEAGUE_GAMES: ten teams play 14 each as the real league does
    // (five opponents twice, four once) instead of 18; eight teams or fewer still meet everyone home and away
    : [...half, ...half.map(day => day.map(([h, a]) => [a, h])).slice(0, Math.max(0, LEAGUE_GAMES - half.length))].map((day, i) => ({ stage: `Matchday ${i + 1}`, fixtures: day.map(([h, a]) => ({ home: h.name, away: a.name, venue: h.venue })) }));

  function record(m, league) {
    for (const [i, inn] of m.innings.entries()) {
      const other = m.innings[1 - i];
      if (league) {   // the league table (and net run rate) is frozen once the playoffs start
        // a side bowled out is charged the full 20 overs, as in the real net-run-rate rule
        const row = table.get(inn.team), faced = inn.wickets === 10 ? 120 : inn.balls;
        row.runsFor += inn.score; row.ballsFor += faced;
        table.get(other.team).runsAgainst += inn.score; table.get(other.team).ballsAgainst += faced;
      }
      for (const x of inn.batting) { const r = bat.get(x.player.key) ?? { name: x.player.name, team: inn.team, runs: 0, balls: 0 }; r.runs += x.runs; r.balls += x.balls; bat.set(x.player.key, r); }
      for (const x of inn.bowling) { const r = bowl.get(x.player.key) ?? { name: x.player.name, team: other.team, wickets: 0, runs: 0, balls: 0 }; r.wickets += x.wickets; r.runs += x.runs; r.balls += x.balls; bowl.set(x.player.key, r); }
    }
  }
  if (teams.length % 2) throw new Error("a league needs an even number of teams");
  const play = (f, stage, league) => {
    // a side may name a different order and toss call for away games: team.away = { players, shift, toss }
    const visitors = byName[f.away], m = sim.match({ home: versus(byName[f.home], f.away), away: versus(visitors.away ? { ...visitors, ...visitors.away } : visitors, f.home), venue: f.venue, seed: nextSeed() });
    record(m, league);
    return { stage, home: f.home, away: f.away, ...m, loser: m.winner === f.home ? f.away : f.home };
  };
  const standings = () => [...table.values()].map(r => ({ ...r, nrr: r.ballsFor && r.ballsAgainst ? 6 * (r.runsFor / r.ballsFor - r.runsAgainst / r.ballsAgainst) : 0 }))
    .sort((x, y) => y.points - x.points || y.nrr - x.nrr);
  const top = (map, key) => [...map.values()].sort((x, y) => y[key] - x[key] || x.balls - y.balls).slice(0, 5);

  const s = {
    rounds, played: [], playoffs: [], champion: null, done: false,
    standings, orangeCap: () => top(bat, "runs"), purpleCap: () => top(bowl, "wickets"),
    get leagueDone() { return s.played.length >= rounds.length; },
    // what the next call to playNext() will play
    upcoming() {
      if (s.done) return null;
      if (!s.leagueDone) return rounds[s.played.length];
      const [a, b, c, d] = standings().map(r => r.team), [q1, el, q2] = s.playoffs;
      // a small league (four teams) goes straight to a final between the top two
      if (teams.length < 6) return { stage: "Final", fixtures: [{ home: a, away: b, venue: finalVenue, stage: "Final" }] };
      if (!q1) return { stage: "Qualifier 1 and Eliminator", fixtures: [{ home: a, away: b, venue: byName[a].venue, stage: "Qualifier 1" }, { home: c, away: d, venue: byName[c].venue, stage: "Eliminator" }] };
      if (!q2) return { stage: "Qualifier 2", fixtures: [{ home: q1.loser, away: el.winner, venue: finalVenue, stage: "Qualifier 2" }] };
      return { stage: "Final", fixtures: [{ home: q1.winner, away: q2.winner, venue: finalVenue, stage: "Final" }] };
    },
    playNext() {
      const up = s.upcoming();
      if (!up) return [];
      const league = !s.leagueDone;
      const matches = up.fixtures.map(f => play(f, f.stage ?? up.stage, league));
      if (league) {
        for (const m of matches) for (const t of [m.home, m.away]) { const row = table.get(t); row.played++; if (m.winner === t) { row.won++; row.points += 2; } else row.lost++; }
        s.played.push(matches);
        const lead = standings()[0];
        if (series && lead.won > SERIES / 2) { s.champion = lead.team; s.done = true; }
      } else {
        s.playoffs.push(...matches);
        if (up.stage === "Final") { s.champion = matches[0].winner; s.done = true; }
      }
      return matches;
    },
    state: () => ({ table: [...table.values()], bat: [...bat], bowl: [...bowl], drawn, played: s.played.length, champion: s.champion, done: s.done,
      playoffs: s.playoffs.map(m => ({ stage: m.stage, home: m.home, away: m.away, winner: m.winner, loser: m.loser })) }),
  };
  if (restore) {
    for (const row of restore.table) table.set(row.team, row);
    for (const [k, v] of restore.bat) bat.set(k, v);
    for (const [k, v] of restore.bowl) bowl.set(k, v);
    while (drawn < restore.drawn) nextSeed();   // the fixture list above already used the same draws as before
    Object.assign(s, { played: Array.from({ length: restore.played }, () => []), playoffs: restore.playoffs, champion: restore.champion, done: restore.done });
  }
  return s;
}

// the whole season in one call
export function season(sim, teams, opts) {
  const s = createSeason(sim, teams, opts);
  while (!s.done) s.playNext();
  return { standings: s.standings(), matches: s.played.flat(), playoffs: s.playoffs, champion: s.champion, orangeCap: s.orangeCap(), purpleCap: s.purpleCap() };
}

if (typeof process !== "undefined" && process.argv[1] && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]) {
  const { readFileSync } = await import("node:fs");
  const { createSim } = await import("./engine.mjs");
  const data = JSON.parse(readFileSync(new URL("./data.json", import.meta.url)));
  const home = Object.fromEntries(Object.values(data.venues).map(v => [v.home, v.name]));
  const teams = Object.entries(data.teams).map(([name, players]) => ({ name, players, venue: home[name] }));
  const s = season(createSim(data), teams, { seed: Number(process.argv[2] ?? 2026) });
  // self-check: a full double round-robin, every side at home and away against each other once
  console.assert(s.matches.length === 90 && s.standings.every(r => r.played === 18), "schedule is not a double round-robin");
  console.assert(new Set(s.matches.map(m => `${m.home}|${m.away}`)).size === 90, "a fixture repeats");
  console.log("team                           P   W   L  Pts    NRR");
  for (const r of s.standings) console.log(`${r.team.padEnd(30)}${String(r.played).padStart(2)}${String(r.won).padStart(4)}${String(r.lost).padStart(4)}${String(r.points).padStart(5)}  ${(r.nrr >= 0 ? "+" : "") + r.nrr.toFixed(3)}`);
  console.log();
  for (const m of s.playoffs) console.log(`${m.stage.padEnd(12)} ${m.innings[0].team} ${m.innings[0].score}/${m.innings[0].wickets} v ${m.innings[1].team} ${m.innings[1].score}/${m.innings[1].wickets} (${m.innings[1].overs}) — ${m.result}. Player of the match: ${m.playerOfMatch.name}`);
  console.log(`\nChampions: ${s.champion}`);
  console.log("Orange Cap: " + s.orangeCap.map(x => `${x.name} ${x.runs} (SR ${(100 * x.runs / x.balls).toFixed(0)})`).join(", "));
  console.log("Purple Cap: " + s.purpleCap.map(x => `${x.name} ${x.wickets} (econ ${(6 * x.runs / x.balls).toFixed(2)})`).join(", "));
}

// Playstyles: labels a player earned from his real numbers that season (scripts/splits.py decides who gets which).
// The match engine already uses those numbers, so a style gives NO extra boost: this file only explains each style
// in the engine's own terms and reads the balance of a squad. Tested in app/rules.test.mjs.
import { isBowler } from "./rules.mjs";

const SPIN = ["off spin", "leg spin", "left-arm orthodox", "left-arm wrist spin"], PACE = ["right-arm pace", "left-arm pace"];
const avg = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const against = (c, types) => { const xs = types.map(t => c.mu?.[t]?.[0]).filter(Boolean); return xs.length ? avg(xs) : 1; };
// "N% more / fewer than an average player", from the multipliers the engine applies; a plain line when the edge is under 3%
const more = (x, text, plain) => (x - 1 >= 0.03 ? text.replace("N", Math.round(100 * (x - 1))) : plain);
const fewer = (x, text, plain) => (1 - x >= 0.03 ? text.replace("N", Math.round(100 * (1 - x))) : plain);

export const STYLES = {
  "Powerplay Enforcer": { icon: "lightning", say: c => more(c.rm * c.pr[0], "Scores N% faster than an average batter in the powerplay.", "Goes hard in the powerplay.") },
  Anchor: { icon: "anchor", say: c => fewer(c.om, "N% harder to get out than an average batter.", "Very hard to get out.") },
  Finisher: { icon: "flag-checkered", say: c => more(c.rm * c.pr[2], "Scores N% faster than an average batter in overs 16 to 20.", "At his best in the last five overs.") },
  "Six Machine": { icon: "rocket-launch", say: c => more(c.rm, "One of the biggest six-hitters of his season. Scores N% faster than an average batter.", "One of the biggest six-hitters of his season.") },
  "Spin Basher": { icon: "spiral", say: c => more(c.rm * against(c, SPIN), "Scores N% faster than an average batter against spin.", "Takes spin apart.") },
  "Pace Hitter": { icon: "wind", say: c => more(c.rm * against(c, PACE), "Scores N% faster than an average batter against pace.", "Feeds on pace.") },
  "New-Ball Striker": { icon: "target", say: c => more(c.wm * c.pw[0], "Takes wickets N% more often than an average bowler in the powerplay.", "Strikes with the new ball.") },
  "Middle-Overs Choke": { icon: "lock", say: c => fewer(c.em * c.pe[1], "Concedes N% fewer runs than an average bowler in overs 7 to 15.", "Dries up the middle overs.") },
  "Death Specialist": { icon: "fire", say: c => fewer(c.em * c.pe[2], "Concedes N% fewer runs than an average bowler in overs 16 to 20.", "Holds his nerve at the death.") },
  "Strike Bowler": { icon: "crosshair", say: c => more(c.wm, "Takes wickets N% more often than an average bowler.", "A wicket-taker.") },
  Miser: { icon: "piggy-bank", say: c => fewer(c.em, "Concedes N% fewer runs than an average bowler.", "Gives nothing away.") },
};

// A side by phase, 20 to 99 (75 is an average side). Batting: whoever is likely to be in then (openers and No. 3 in
// the powerplay, 3 to 6 in the middle, 5 to 8 at the death). Bowling: the three best bowlers for that phase.
// lineup: the twelve places, null where empty. A phase with nobody yet is null.
const clip = x => Math.max(20, Math.min(99, Math.round(x)));
export function balance(lineup) {
  const bat = (from, to, k) => { const cs = lineup.slice(from, to).filter(Boolean); return cs.length ? clip(75 + 90 * Math.log(avg(cs.map(c => c.rm * c.pr[k])))) : null; };
  const bowlers = lineup.filter(c => c && isBowler(c));
  const bowl = k => { const best = bowlers.map(c => c.em * c.pe[k]).sort((a, b) => a - b).slice(0, 3); return best.length ? clip(75 + 110 * Math.log(1 / avg(best))) : null; };
  return { bat: [bat(0, 3, 0), bat(2, 6, 1), bat(4, 8, 2)], bowl: [bowl(0), bowl(1), bowl(2)] };
}

// the jobs a good side has covered, most important first; gaps() returns the ones nobody in the lineup does
const JOBS = [["Death Specialist", "Nobody to bowl at the death"], ["New-Ball Striker", "No one to strike with the new ball"], ["Finisher", "No finisher"],
  ["Powerplay Enforcer", "No one to attack the powerplay"], ["Middle-Overs Choke", "Nobody to squeeze the middle overs"]];
export function gaps(lineup) {
  const have = new Set(lineup.filter(Boolean).flatMap(c => c.styles ?? []));
  return JOBS.filter(([style]) => !have.has(style));
}

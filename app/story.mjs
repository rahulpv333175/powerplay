// The words around the numbers: a social-style post for every match, a grade for a draft, awards for a season.
// Pure functions (no page code) so they can be tested: node app/rules.test.mjs
const nm = x => x.player?.name ?? x.name;   // local matches carry player objects, room matches carry names
const last = n => n.slice(n.indexOf(" ") + 1);
const s = n => (n === 1 ? "" : "s");
const hash = t => { let h = 7; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

// made-up fans; {h} hero, {W} winner, {L} loser
const FANS = [["Cover Drive Club", "@cover_drive_club"], ["Yorker Factory", "@yorker_factory"], ["Third Man Tales", "@thirdman_tales"],
  ["Deep Midwicket", "@deep_midwicket"], ["Silly Point FC", "@silly_point_fc"], ["Slog Sweep Daily", "@slog_sweep_daily"]];
const REPLIES = {
  thriller: ["My heart cannot take this side.", "Nobody sit down, nobody breathe.", "Match of the season and it is not close.", "{L} will not sleep tonight."],
  ton: ["{h} is batting on a different pitch to everyone else.", "Put {h} in a museum.", "Bowlers, we are sorry. {h} is not.", "That hundred had everything."],
  five: ["{h} was unplayable today.", "Stumps everywhere. {h} on one.", "{L} never saw it coming.", "Give {h} the new ball forever."],
  rout: ["That was over by the powerplay.", "{L}, blink twice if you need help.", "Net run rate going to the moon.", "Statement win from {W}."],
  win: ["Two points. Onwards.", "Job done, no fuss.", "{h} delivers again.", "{W} are building something."],
};

export function story(m, label = t => t) {
  const [one, two] = m.innings, loser = m.winner === one.team ? two.team : one.team, W = label(m.winner), L = label(loser);
  const bats = m.innings.flatMap(inn => inn.batting.map(x => ({ ...x, name: nm(x), team: inn.team })));
  const bowls = m.innings.flatMap((inn, i) => inn.bowling.map(x => ({ ...x, name: nm(x), team: m.innings[1 - i].team })));
  const moments = [
    ...bats.filter(x => x.runs >= 100).map(x => ({ kind: "ton", icon: "star", name: x.name, team: x.team, text: `Hundred: ${x.name} ${x.runs} (${x.balls})` })),
    ...bowls.filter(x => x.wickets >= 5).map(x => ({ kind: "five", icon: "fire", name: x.name, team: x.team, text: `Five-for: ${x.name} ${x.wickets}/${x.runs}` })),
    ...bats.filter(x => x.runs >= 50 && x.runs < 100 && x.balls <= 22).map(x => ({ kind: "blitz", icon: "lightning", text: `Blitz: ${x.name} ${x.runs} (${x.balls})` })),
    ...m.innings.filter(inn => inn.score >= 220).map(inn => ({ kind: "total", icon: "trend-up", text: `${label(inn.team)} pile up ${inn.score}` })),
    ...m.innings.filter(inn => inn.wickets === 10 && inn.score < 120).map(inn => ({ kind: "collapse", icon: "trend-down", text: `${label(inn.team)} skittled for ${inn.score}` })),
  ];
  const ton = moments.find(x => x.kind === "ton" && x.team === m.winner), five = moments.find(x => x.kind === "five" && x.team === m.winner);
  const chased = two.score > one.score, runs = one.score - two.score, left = 120 - two.balls;
  const hero = m.playerOfMatch.name, hb = bats.find(x => x.name === hero && x.runs >= 15), hw = bowls.find(x => x.name === hero && x.wickets);
  const close = m.superOver || (chased ? left <= 2 : runs <= 5);
  const headline = m.superOver ? `Super Over! ${W} hold their nerve`
    : chased && left <= 2 ? `Last-over heist: ${W} get home ${left ? `with ${left} ball${s(left)} left` : "off the final ball"}`
    : !chased && runs <= 5 ? `${W} cling on by ${runs} run${s(runs)}`
    : ton ? `${last(ton.name)} hundred powers ${W}`
    : five ? `${last(five.name)} rips through ${L}`
    : !chased && runs >= 60 ? `${W} flatten ${L} by ${runs} runs`
    : chased && left >= 30 ? `${W} stroll home with ${left} balls to spare`
    : chased && one.score >= 200 ? `${W} hunt down ${one.score}`
    : hb?.runs >= 70 ? `${last(hero)}'s ${hb.runs} sets up ${W}`
    : hw?.wickets >= 3 ? `${last(hero)} takes ${hw.wickets} as ${W} beat ${L}`
    : chased ? `${W} chase ${one.score + 1} to beat ${L}` : `${W} defend ${one.score} against ${L}`;
  const mood = close ? "thriller" : ton ? "ton" : five ? "five" : (!chased && runs >= 60) || (chased && left >= 30) ? "rout" : "win";
  const line = [hb && `${hb.runs} off ${hb.balls}`, hw && `${hw.wickets}/${hw.runs}`].filter(Boolean).join(" and ");
  const h = hash(m.result + one.score + two.score + hero), fill = t => t.replace("{h}", last(hero)).replace("{W}", W).replace("{L}", L);
  const replies = [0, 1].map(i => ({ name: FANS[(h + i * 3) % FANS.length][0], who: FANS[(h + i * 3) % FANS.length][1], likes: 40 + (h >>> (i + 3)) % 900, text: fill(REPLIES[mood][(h + i) % 4]) }));
  const likes = (close ? 9000 : 1500) + h % 9000, body = `${hero}${line ? ` (${line})` : ""} is player of the match at ${m.venue.split(",")[0]}.`;
  const score = m.innings.map(inn => `${label(inn.team)} ${inn.score}/${inn.wickets} (${inn.overs})`).join(" · ");
  return { headline, body, moments: moments.slice(0, 3), mood, replies, likes, reposts: Math.round(likes / 6), tag: `#${W}v${L}`.replace(/\s+/g, ""), text: `${headline}. ${score}. ${body}` };
}

// A letter for a finished draft, from the squad's average rating. Cut-offs come from 400 simulated drafts:
// always taking the best card averages about 90, picking at random about 67.
export function grade(cards) {
  const avg = cards.reduce((t, c) => t + c.overall, 0) / Math.max(1, cards.length);
  const [letter, line] = avg >= 92 ? ["A+", "The auction table just went very quiet."] : avg >= 90 ? ["A", "Title favourites on paper. Sadly it is played on grass."]
    : avg >= 88 ? ["B", "Good enough to win it, with a little luck and a kind toss."] : avg >= 85 ? ["C", "Playoffs if it clicks. Net run rate may get involved."]
    : avg >= 80 ? ["D", "Your stars will have to fire every single night."] : ["E", "Brave. Captaincy material, possibly."];
  const steal = [...cards].sort((a, b) => b.overall - a.overall)[0];
  return { letter, line, avg: Math.round(avg), steal };
}

// End-of-season awards for one side, from every match it played.
export function awards(matches, team, label = t => t) {
  const mine = matches.filter(m => m.home === team || m.away === team), out = [];
  const potm = {};
  for (const m of mine) if (m.playerOfMatch.team === team) potm[m.playerOfMatch.name] = (potm[m.playerOfMatch.name] ?? 0) + 1;
  const star = Object.entries(potm).sort((a, b) => b[1] - a[1])[0];
  if (star) out.push({ icon: "medal", title: "Your player of the season", text: `${star[0]} · ${star[1]} match award${s(star[1])}` });
  let bat = null, bowl = null, total = null;
  for (const m of mine) m.innings.forEach((inn, i) => {
    const other = m.innings[1 - i].team, v = label(other);
    if (inn.team === team) {
      for (const x of inn.batting) if (!bat || x.runs > bat.runs) bat = { runs: x.runs, text: `${nm(x)} ${x.runs} (${x.balls}) v ${v}` };
      if (!total || inn.score > total.score) total = { score: inn.score, text: `${inn.score}/${inn.wickets} v ${v}` };
    } else for (const x of inn.bowling) if (!bowl || x.wickets > bowl.wickets || (x.wickets === bowl.wickets && x.runs < bowl.runs)) bowl = { wickets: x.wickets, runs: x.runs, text: `${nm(x)} ${x.wickets}/${x.runs} v ${label(inn.team)}` };
  });
  if (bat) out.push({ icon: "cricket", title: "Best innings", text: bat.text });
  if (bowl) out.push({ icon: "target", title: "Best bowling", text: bowl.text });
  if (total) out.push({ icon: "trend-up", title: "Highest total", text: total.text });
  return out;
}

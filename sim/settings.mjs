// Admin settings, applied on top of the built data. The server and the game in the browser both use this,
// so a match is simulated the same way in both places.
//
//   settings = { rules: { maxOverseas, minBowlers, rerolls },          draft rules
//                clocks: { pick, lineup, ready },                        multiplayer timers, in seconds
//                engine: { runs, wickets, chemistry, class, pitchOfTheDay },   match engine multipliers
//                ratings: { "playerId:season": { bat, bowl } },          re-rated cards
//                neutral: true }                                         the game drops league and franchise names (app/app.js shows cities and "T20")
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const DEFAULTS = { rules: { maxOverseas: 4, minBowlers: 5, rerolls: 2 }, clocks: { pick: 45, lineup: 120, ready: 60 }, engine: {}, ratings: {} };
// what each field may be: [lowest, highest, whole numbers only]
export const LIMITS = { rules: { maxOverseas: [0, 12, true], minBowlers: [4, 5, true], rerolls: [0, 10, true] }, clocks: { pick: [10, 600, true], lineup: [20, 1800, true], ready: [10, 1800, true] },
  engine: { runs: [0.8, 1.25], wickets: [0.7, 1.4], chemistry: [0, 0.05], class: [0, 1], pitchOfTheDay: [0, 0.3] } };

// Anything sent by the admin screen, reduced to known fields within their limits. Unknown cards and junk are dropped.
export function cleanSettings(raw, data) {
  const out = { rules: {}, clocks: {}, engine: {}, ratings: {} };
  for (const [group, fields] of Object.entries(LIMITS)) for (const [k, [lo, hi, whole]] of Object.entries(fields)) {
    const v = Number(raw?.[group]?.[k]);
    if (raw?.[group]?.[k] != null && raw[group][k] !== "" && Number.isFinite(v)) out[group][k] = clamp(whole ? Math.round(v) : v, lo, hi);
  }
  for (const [key, r] of Object.entries(raw?.ratings ?? {}).slice(0, 3000)) {
    if (!(key in data.cards)) continue;
    const one = {};
    for (const f of ["bat", "bowl"]) if (r?.[f] != null && r[f] !== "" && Number.isFinite(+r[f])) one[f] = clamp(Math.round(+r[f]), 20, 99);
    if (Object.keys(one).length) out.ratings[key] = one;
  }
  if (raw?.neutral === true) out.neutral = true;
  return out;
}

let baseTune = null;   // the engine's own values, remembered the first time so a setting can be taken away again
// Applies settings in place: draft rules, engine tuning and re-rated cards. Safe to call again with new settings.
export function applySettings(settings, { data, TUNE, configure }) {
  const s = { ...DEFAULTS, ...settings };
  baseTune ??= { ...TUNE };
  Object.assign(TUNE, baseTune, s.engine);
  configure({ ...DEFAULTS.rules, ...s.rules });
  const L = data.levels, ratings = s.ratings ?? {};
  for (const [key, c] of Object.entries(data.cards)) {
    if (!c.base && !(key in ratings)) continue;
    c.base ??= { bat: c.bat, bowl: c.bowl, overall: c.overall, rm: c.rm, om: c.om, em: c.em, wm: c.wm };
    const b = c.base, bat = ratings[key]?.bat ?? b.bat, bowl = ratings[key]?.bowl ?? b.bowl;
    // a rating point moves match strength by the same amount the data build uses (scripts/export_sim.py)
    const db = ((bat ?? L.none) - (b.bat ?? L.none)) / L.spread, dw = ((bowl ?? L.none) - (b.bowl ?? L.none)) / L.spread;
    Object.assign(c, { bat, bowl, rm: clamp(b.rm * Math.exp(L.bat[0] * db), 0.6, 1.6), om: clamp(b.om * Math.exp(-L.bat[1] * db), L.out[0], L.out[1]),
      em: clamp(b.em * Math.exp(-L.bowl[0] * dw), 0.75, 1.35), wm: clamp(b.wm * Math.exp(L.bowl[1] * dw), 0.4, L.wkt),
      overall: b.overall == null ? null : clamp(b.overall + Math.max(bat ?? 0, bowl ?? 0) - Math.max(b.bat ?? 0, b.bowl ?? 0), 20, 99) });
  }
  return { ...DEFAULTS.clocks, ...s.clocks };   // the timers, for the room server
}

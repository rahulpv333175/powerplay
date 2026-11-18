// Shareable pictures, drawn on a canvas in the house style: a match post and a squad sheet (1080 x 1350, the
// portrait size social apps show uncropped). No player photos or logos: type, team colours and numbers only.
const W = 1080, H = 1350, INK = "#070b1f", DIM = "#aab1d8", HOT = "#d1121f", HOT2 = "#ff5147";
const display = (px, weight = 900) => `italic ${weight} ${px}px "Saira Condensed", "Arial Narrow", sans-serif`;
const text = (px, weight = 500) => `${weight} ${px}px Saira, system-ui, sans-serif`;

export async function shareImage(draw, name, caption) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  await Promise.all([document.fonts.load(display(80)), document.fonts.load(text(30)), document.fonts.load(text(30, 700))]).catch(() => {});
  draw(c.getContext("2d"));
  const blob = await new Promise(r => c.toBlob(r, "image/png")), file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], text: caption });
  const a = document.createElement("a");   // no share sheet (most desktops): save the picture instead
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const hot = (ctx, x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, HOT); g.addColorStop(1, HOT2); return g; };
function cut(ctx, x, y, w, h, c = 28) {   // the house shape: a panel with two corners cut
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.closePath();
}
function lines(ctx, words, max) {
  const out = [""];
  for (const w of words.split(" ")) { const t = out.at(-1) ? `${out.at(-1)} ${w}` : w; if (ctx.measureText(t).width > max && out.at(-1)) out.push(w); else out[out.length - 1] = t; }
  return out;
}
function frame(ctx, brand, kicker) {   // night sky, floodlight, wordmark; returns the y where content starts
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, col] of [[900, 0, 900, "rgba(20,32,77,.9)"], [0, H, 800, "rgba(74,12,20,.8)"]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "transparent"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = "rgba(255,255,255,.05)"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(420, 0); ctx.lineTo(W, 760); ctx.lineTo(W, 1180); ctx.closePath(); ctx.fill();
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  // the mark: a white cricket ball coming in on fire (the header's drawing: a 100-unit grid, drawn here at 0.72x)
  const FLAME = new Path2D("M88 73C94 55 85 38 66 35C50 33 36 24 30 6C30 18 33 26 41 31C28 30 16 24 9 12C12 26 20 37 33 43C20 44 9 40 2 32C8 46 20 56 35 58C25 61 16 60 9 56C17 68 28 74 42 74C36 78 30 80 25 80C44 92 76 92 88 73Z");
  ctx.save(); ctx.translate(62, 54); ctx.scale(0.72, 0.72);
  const outer = ctx.createLinearGradient(90, 90, 5, 5); outer.addColorStop(0, "#c1121f"); outer.addColorStop(1, "#6d0810");
  const mid = ctx.createLinearGradient(90, 90, 5, 5); mid.addColorStop(0, "#ff3b30"); mid.addColorStop(1, "#c1121f");
  for (const [scale, turn, fill] of [[1, 0, outer], [0.85, 2, mid], [0.7, 4, "#ff5a4a"], [0.55, 6, "#ffb9ad"]]) {
    ctx.save(); ctx.translate(66, 62); ctx.rotate(turn * Math.PI / 180); ctx.scale(scale, scale); ctx.translate(-66, -62); ctx.fillStyle = fill; ctx.fill(FLAME); ctx.restore();
  }
  const white = ctx.createRadialGradient(59, 55, 1, 66, 62, 21); white.addColorStop(0, "#fff"); white.addColorStop(0.6, "#eef0f6"); white.addColorStop(1, "#c3c8d8");
  ctx.beginPath(); ctx.arc(66, 62, 20.5, 0, 2 * Math.PI); ctx.fillStyle = white; ctx.fill(); ctx.clip();
  const seam = dx => `M${61 + dx} 41.5Q${71.5 + dx} 62 ${65.5 + dx} 82.5`;
  ctx.strokeStyle = "rgba(193,18,31,.55)"; ctx.lineWidth = 11; ctx.setLineDash([1, 2.4]); ctx.stroke(new Path2D(seam(0))); ctx.setLineDash([]);
  ctx.strokeStyle = "#c1121f"; ctx.lineWidth = 1.35; ctx.stroke(new Path2D(seam(-4) + seam(0) + seam(4))); ctx.restore();
  ctx.fillStyle = "#fff"; ctx.font = display(54); ctx.fillText(brand.toUpperCase(), 146, 114);
  ctx.fillStyle = HOT2; ctx.font = text(24, 600); ctx.textAlign = "right"; ctx.fillText(kicker.toUpperCase(), W - 70, 106); ctx.textAlign = "left";
  return 210;
}
const footer = (ctx, left) => { ctx.fillStyle = DIM; ctx.font = text(22); ctx.fillText(left, 70, H - 60); ctx.textAlign = "right"; ctx.fillText("An unofficial fan game", W - 70, H - 60); ctx.textAlign = "left"; };

export function drawPost(ctx, { m, st, label, colours, brand }) {
  let y = frame(ctx, `${brand} Live`, m.stage);
  ctx.fillStyle = "#fff"; ctx.font = display(104);
  for (const l of lines(ctx, st.headline.toUpperCase(), W - 140).slice(0, 4)) { y += 94; ctx.fillText(l, 70, y); }
  y += 56;
  const rows = m.innings.length, ph = 120 * rows + 70 + (st.moments.length ? 56 * st.moments.length + 10 : 0);
  cut(ctx, 70, y, W - 140, ph);
  const g = ctx.createLinearGradient(70, y, W - 70, y + ph); g.addColorStop(0, colours.a); g.addColorStop(1, colours.b); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip(); ctx.strokeStyle = "rgba(255,255,255,.09)"; ctx.lineWidth = 3;
  for (let x = -ph; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, y + ph); ctx.lineTo(x + ph * 0.55, y); ctx.stroke(); }
  ctx.restore();
  let ry = y + 40;
  for (const inn of m.innings) {
    ry += 92; ctx.globalAlpha = inn.team === m.winner ? 1 : 0.7; ctx.fillStyle = "#fff";
    ctx.font = display(72); ctx.fillText(label(inn.team).toUpperCase().slice(0, 16), 110, ry);
    ctx.textAlign = "right"; ctx.font = text(28, 600); ctx.fillText(`(${inn.overs})`, W - 110, ry);
    const ow = ctx.measureText(`(${inn.overs})`).width; ctx.font = display(96); ctx.fillText(`${inn.score}/${inn.wickets}`, W - 126 - ow, ry); ctx.textAlign = "left";
    ry += 28;
  }
  ctx.globalAlpha = 1; ry += 10;
  for (const x of st.moments) { ctx.font = text(30, 600); const w = ctx.measureText(x.text).width + 44; ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(110, ry, w, 44); ctx.fillStyle = "#ffd76a"; ctx.fillText(x.text, 132, ry + 32); ry += 56; }
  y += ph + 70;
  ctx.fillStyle = "#fff"; ctx.font = text(36);
  for (const l of lines(ctx, st.body, W - 140).slice(0, 3)) { ctx.fillText(l, 70, y); y += 50; }
  ctx.fillStyle = HOT2; ctx.font = text(36, 700); ctx.fillText(st.tag, 70, y + 8);
  y += 70;
  for (const r of st.replies) {   // the fans, if there is room left
    if (y > H - 220) break;
    ctx.fillStyle = "rgba(255,255,255,.16)"; ctx.fillRect(70, y, W - 140, 2); y += 54;
    ctx.fillStyle = "#fff"; ctx.font = text(30, 700); ctx.fillText(`${r.name}  ${r.who}`, 70, y);
    ctx.fillStyle = DIM; ctx.font = text(30); ctx.fillText(lines(ctx, r.text, W - 140)[0], 70, y + 44); y += 76;
  }
  footer(ctx, m.venue);
}

// cards: squad cards in batting order, each with its side's { ab, a, b }
export function drawSquad(ctx, { name, cards, g, brand, league = "IPL" }) {
  let y = frame(ctx, brand, `My all-time ${league} XI`);
  ctx.fillStyle = "#fff"; ctx.font = display(110); ctx.fillText(name.toUpperCase().slice(0, 18), 70, y + 60);
  ctx.fillStyle = hot(ctx, W - 300, W - 70); ctx.font = display(150); ctx.textAlign = "right"; ctx.fillText(g.letter, W - 70, y + 76);
  ctx.fillStyle = DIM; ctx.font = text(26, 600); ctx.fillText(`DRAFT GRADE · RATED ${g.avg}`, W - 70, y + 118); ctx.textAlign = "left";
  y += 150;
  cards.forEach((c, i) => {
    const ry = y + i * 76;
    ctx.fillStyle = "rgba(255,255,255,.07)"; cut(ctx, 70, ry, W - 140, 68, 16); ctx.fill();
    const gr = ctx.createLinearGradient(70, ry, 190, ry + 68); gr.addColorStop(0, c.a); gr.addColorStop(1, c.b);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(86, ry); ctx.lineTo(190, ry); ctx.lineTo(174, ry + 68); ctx.lineTo(70, ry + 68); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = display(50); ctx.textAlign = "center"; ctx.fillText(c.overall, 130, ry + 52); ctx.textAlign = "left";
    ctx.font = display(46, 800); ctx.fillText((c.full ?? c.name).toUpperCase().slice(0, 24), 216, ry + 50);
    ctx.fillStyle = DIM; ctx.font = text(26, 600); ctx.textAlign = "right"; ctx.fillText(`${c.ab} ${c.season} · ${c.role.toUpperCase()}`, W - 100, ry + 46); ctx.textAlign = "left";
  });
  footer(ctx, `Pick of the draft: ${g.steal.name} (${g.steal.overall})`);
}

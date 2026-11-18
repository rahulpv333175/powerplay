// Powerplay · IPL Auction System V5
// 1. Interactive 2026 Retention Chooser: customize your franchise retentions with real-time BCCI deduction slabs
// 2. Real-Time Multiplayer Auction Room: join via code or direct shareable link, in-room chat, instant franchise switching, retention selection, synchronized live bidding, and host controls
// 3. Expanded 2026 Active Pool: 379 modern IPL players (~350-370 in auction pool)
// 4. Legacy Legends Mode: all-time icons (Gayle, AB de Villiers, Kumble, Malinga, etc.) separated into their own mode

import {
  AUCTION_SETS,
  DEFAULT_FRANCHISES,
  AUCTION_PLAYERS,
  ALL_PLAYERS_2026,
  LEGACY_PLAYERS,
  AUCTION_MODES,
  MEGA_RETENTION_COSTS,
  MEGA_UNCAPPED_COST,
  FULL_PURSE,
  getNextBid,
  formatPurse,
  calculatePurse
} from "./auction-data.js";
import { SQUAD, MAX_OVERSEAS, MIN_BOWLERS, chemistry, shifts } from "./rules.mjs";

export function createAuction(ctx) {
  const {
    data,
    card,
    playerCard,
    icon,
    esc,
    place,
    side,
    nameParts,
    openSheet,
    closeSheet,
    inspect,
    render: parentRender,
    state: appState,
    sim,
    createSeason
  } = ctx;

  const SAVE_KEY = "powerplay_auction_v9";
  const BC_NAME = "powerplay_auction_room_v9";

  // Audio synthesizer for wooden gavel & auction blips
  let audioCtx = null;
  function playSound(type) {
    if (!session.sound) return;
    try {
      audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const t = audioCtx.currentTime;

      if (type === "gavel") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.12);
      } else if (type === "bid") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(540, t);
        osc.frequency.exponentialRampToValueAtTime(720, t + 0.08);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.08);
      } else if (type === "tick") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.04);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.04);
      } else if (type === "sold") {
        playSound("gavel");
        setTimeout(() => playSound("gavel"), 160);
      }
    } catch {}
  }

  // Toast notification for link sharing and quick alerts
  function showToast(msg) {
    if (typeof document === "undefined") return;
    try {
      let t = document.getElementById("auc-toast");
      if (!t) {
        t = document.createElement("div");
        t.id = "auc-toast";
        t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(0);background:#0f172a;color:#fff;border:1px solid var(--gold);padding:10px 20px;border-radius:999px;font:600 13px var(--text);box-shadow:0 8px 32px rgba(0,0,0,0.7);z-index:99999;pointer-events:none;transition:opacity 0.25s ease,transform 0.25s ease;";
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = "1";
      t.style.transform = "translateX(-50%) translateY(0)";
      clearTimeout(t._timer);
      t._timer = setTimeout(() => {
        t.style.opacity = "0";
        t.style.transform = "translateX(-50%) translateY(12px)";
      }, 3000);
    } catch {}
  }

  // Celebration Confetti on player sold
  function launchConfetti() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    try {
      let canvas = document.getElementById("auc-confetti-canvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "auc-confetti-canvas";
        canvas.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;";
        document.body.appendChild(canvas);
      }
      const ctx = canvas.getContext("2d");
      const width = canvas.width = window.innerWidth;
      const height = canvas.height = window.innerHeight;
      const colors = ["#ffc72c", "#ff4655", "#00d2ff", "#a855f7", "#10b981", "#ffffff", "#f97316"];
      const particles = Array.from({ length: 65 }, () => ({
        x: width * (0.35 + Math.random() * 0.3),
        y: height * 0.45,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 12 - 5,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        alpha: 1.0
      }));
      const startTime = Date.now();
      function draw() {
        const elapsed = Date.now() - startTime;
        if (elapsed > 2500) {
          ctx.clearRect(0, 0, width, height);
          canvas.remove();
          return;
        }
        ctx.clearRect(0, 0, width, height);
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.35;
          p.rotation += p.rotSpeed;
          p.alpha = Math.max(0, 1 - elapsed / 2500);
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
        requestAnimationFrame(draw);
      }
      requestAnimationFrame(draw);
    } catch {}
  }

  // Build mode initial setup
  function buildModeSetup(modeKey) {
    const franchises = JSON.parse(JSON.stringify(DEFAULT_FRANCHISES));

    if (modeKey === "legacy") {
      for (const code in franchises) {
        const f = franchises[code];
        f.retentions = [];
        f.squad = [];
        f.purse = FULL_PURSE;
        f.rtm = 6;
      }
      return {
        franchises,
        pool: JSON.parse(JSON.stringify(LEGACY_PLAYERS))
      };
    }

    if (modeKey === "full_2026" || modeKey === "full") {
      for (const code in franchises) {
        const f = franchises[code];
        f.retentions = [];
        f.squad = [];
        f.purse = FULL_PURSE;
        f.rtm = 6;
      }
      return {
        franchises,
        pool: JSON.parse(JSON.stringify(ALL_PLAYERS_2026))
      };
    }

    if (modeKey === "mega_2026" || modeKey === "mega") {
      const retainedHashes = new Set();
      for (const code in franchises) {
        const f = franchises[code];
        const sortedRets = [...f.retentions].sort((a, b) => (b.overall || 70) - (a.overall || 70)).slice(0, 6);
        let spent = 0;
        let cappedIdx = 0;
        const finalRets = [];

        sortedRets.forEach(r => {
          let cost = 18;
          if (r.uncapped) {
            cost = MEGA_UNCAPPED_COST;
          } else {
            cost = MEGA_RETENTION_COSTS[cappedIdx] || 11;
            cappedIdx++;
          }
          spent += cost;
          finalRets.push({ ...r, price: cost });
          if (r.key) retainedHashes.add(r.key.split(":")[0]);
        });

        f.retentions = finalRets;
        f.purse = +(FULL_PURSE - spent).toFixed(2);
        f.rtm = Math.max(0, 6 - finalRets.length);
        f.squad = finalRets.map(r => ({
          key: r.key,
          name: r.name,
          price: r.price,
          role: r.role,
          overseas: r.overseas,
          uncapped: r.uncapped,
          overall: r.overall,
          retention: true
        }));
      }

      const pool = ALL_PLAYERS_2026.filter(p => {
        const h = p.key ? p.key.split(":")[0] : "";
        return !retainedHashes.has(h);
      });

      return { franchises, pool: JSON.parse(JSON.stringify(pool)) };
    }

    // Default: IPL 2026/27 Retentions (Interactive customizable)
    const retainedKeys = new Set();
    for (const code in franchises) {
      const f = franchises[code];
      f.squad = f.retentions.map(r => {
        retainedKeys.add(r.key);
        return {
          key: r.key,
          name: r.name,
          price: r.price,
          role: r.role,
          overseas: r.overseas,
          uncapped: r.uncapped,
          overall: r.overall,
          retention: true
        };
      });
    }

    const pool = AUCTION_PLAYERS.filter(p => !retainedKeys.has(p.key));

    return {
      franchises,
      pool: JSON.parse(JSON.stringify(pool))
    };
  }

  function initSession(targetMode = null) {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch {}

    const hasM1 = saved?.pool?.some(p => p.category === "M1" || p.set?.includes("Marquee Set 1"));
    if (saved && saved.franchises && saved.pool && hasM1 && !targetMode) {
      if (!saved.bidTimer) saved.bidTimer = 10;
      return saved;
    }

    const mode = targetMode || (saved?.mode) || "retentions_2026";
    const setup = buildModeSetup(mode);

    return {
      mode,
      phase: targetMode ? "hub" : (saved?.phase || "hub"), // "hub" | "room" | "rtm" | "squad" | "summary" | "mode" | "mp-lobby" | "mp-hub"
      userTeam: saved?.userTeam || "CSK",
      franchises: setup.franchises,
      pool: setup.pool,
      lotIndex: 0,
      currentBid: setup.pool[0]?.basePrice || 2.0,
      leadingTeam: null,
      gavelCount: 0,
      history: [],
      autoBidMax: null,
      userPassed: false,
      speed: "normal",
      bidTimer: 10,
      sound: true,
      soldList: [],
      unsoldList: [],
      activeFilter: "ALL",
      playingXI: null,
      multiplayer: {
        active: false,
        code: "",
        playerId: "",
        room: null,
        chatOpen: false
      }
    };
  }

  let session = initSession();
  let timerId = null;
  let bidCountdownInterval = null;
  let aiBidTimeout = null;
  let bidTimeRemaining = session.bidTimer || 10;
  let bidStartTime = null;
  let bidDurationMs = 10000;
  let autoAdvanceTimer = null;
  let broadcastChannel = null;
  let pollAbortController = null;

  const TEAM_THEMES = {
    CSK: {
      primary: "#f5b000",
      secondary: "#004ba0",
      accent: "#fff3b0",
      glow: "rgba(245, 176, 0, 0.4)",
      onPrimary: "#070b1f",
      gradient: "linear-gradient(135deg, rgba(245, 176, 0, 0.28) 0%, rgba(0, 75, 160, 0.35) 60%, rgba(7, 11, 31, 0.98) 100%)"
    },
    SRH: {
      primary: "#ff6a00",
      secondary: "#1e1e1e",
      accent: "#ffe2c1",
      glow: "rgba(255, 106, 0, 0.4)",
      onPrimary: "#ffffff",
      gradient: "linear-gradient(135deg, rgba(255, 106, 0, 0.28) 0%, rgba(30, 30, 30, 0.5) 60%, rgba(7, 11, 31, 0.98) 100%)"
    },
    MI: {
      primary: "#0066cc",
      secondary: "#cca038",
      accent: "#b3deff",
      glow: "rgba(0, 102, 204, 0.4)",
      onPrimary: "#ffffff",
      gradient: "linear-gradient(135deg, rgba(0, 102, 204, 0.28) 0%, rgba(0, 43, 91, 0.6) 60%, rgba(7, 11, 31, 0.98) 100%)"
    },
    RCB: {
      primary: "#d61a2c",
      secondary: "#1a1a1a",
      accent: "#ffa3b0",
      glow: "rgba(214, 26, 44, 0.4)",
      onPrimary: "#ffffff",
      gradient: "linear-gradient(135deg, rgba(214, 26, 44, 0.28) 0%, rgba(20, 20, 20, 0.6) 60%, rgba(7, 11, 31, 0.98) 100%)"
    },
    KKR: {
      primary: "#6b21a8",
      secondary: "#cca038",
      accent: "#e8d8ff",
      glow: "rgba(107, 33, 168, 0.4)",
      onPrimary: "#ffffff",
      gradient: "linear-gradient(135deg, rgba(107, 33, 168, 0.28) 0%, rgba(35, 15, 60, 0.6) 60%, rgba(7, 11, 31, 0.98) 100%)"
    },
    RR: {
      primary: "#ea1a85",
      secondary: "#004ba0",
      accent: "#ffc0e0",
      glow: "rgba(234, 26, 133, 0.4)",
      onPrimary: "#ffffff",
      gradient: "linear-gradient(135deg, rgba(234, 26, 133, 0.28) 0%, rgba(0, 75, 160, 0.35) 60%, rgba(7, 11, 31, 0.98) 100%)"
    },
    DC: {
      primary: "#2563eb",
      secondary: "#d61a2c",
      accent: "#bfbfff",
      glow: "rgba(37, 99, 235, 0.4)",
      onPrimary: "#ffffff",
      gradient: "linear-gradient(135deg, rgba(37, 99, 235, 0.28) 0%, rgba(180, 20, 30, 0.3) 60%, rgba(7, 11, 31, 0.98) 100%)"
    },
    PBKS: {
      primary: "#dc2626",
      secondary: "#94a3b8",
      accent: "#ffb0b0",
      glow: "rgba(220, 38, 38, 0.4)",
      onPrimary: "#ffffff",
      gradient: "linear-gradient(135deg, rgba(220, 38, 38, 0.28) 0%, rgba(40, 10, 15, 0.6) 60%, rgba(7, 11, 31, 0.98) 100%)"
    },
    GT: {
      primary: "#1e3a8a",
      secondary: "#cca038",
      accent: "#c4d4ff",
      glow: "rgba(30, 58, 138, 0.45)",
      onPrimary: "#ffffff",
      gradient: "linear-gradient(135deg, rgba(30, 58, 138, 0.32) 0%, rgba(15, 23, 42, 0.8) 60%, rgba(7, 11, 31, 0.98) 100%)"
    },
    LSG: {
      primary: "#0284c7",
      secondary: "#ea580c",
      accent: "#cbe7ff",
      glow: "rgba(2, 132, 199, 0.4)",
      onPrimary: "#ffffff",
      gradient: "linear-gradient(135deg, rgba(2, 132, 199, 0.28) 0%, rgba(15, 30, 55, 0.7) 60%, rgba(7, 11, 31, 0.98) 100%)"
    }
  };

  function applyTeamTheme(teamCode) {
    const f = session.franchises?.[teamCode] || DEFAULT_FRANCHISES[teamCode] || DEFAULT_FRANCHISES.CSK;
    const theme = TEAM_THEMES[teamCode] || {
      primary: f?.a || "#f5b000",
      secondary: f?.b || "#123f92",
      accent: f?.c || "#fff3b0",
      glow: (f?.a || "#f5b000") + "40",
      onPrimary: "#ffffff",
      gradient: `linear-gradient(135deg, ${(f?.a || "#f5b000")}28 0%, ${(f?.b || "#123f92")}3d 60%, #070b1f 100%)`
    };
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.style.setProperty("--team-primary", theme.primary);
      document.documentElement.style.setProperty("--team-secondary", theme.secondary);
      document.documentElement.style.setProperty("--team-accent", theme.accent);
      document.documentElement.style.setProperty("--team-glow", theme.glow);
      document.documentElement.style.setProperty("--team-on-primary", theme.onPrimary);
      document.documentElement.style.setProperty("--team-gradient", theme.gradient);
    }
  }

  try {
    broadcastChannel = new BroadcastChannel(BC_NAME);
    broadcastChannel.onmessage = e => {
      if (session.multiplayer?.active && e.data?.code === session.multiplayer.code) {
        onRoomUpdated(e.data.room);
      }
    };
  } catch {}

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(session));
    } catch {}
  }

  function currentLot() {
    if (session.multiplayer?.active && session.multiplayer.room) {
      const r = session.multiplayer.room;
      return r.pool[r.lotIndex] || null;
    }
    return session.pool[session.lotIndex] || null;
  }

  function userFranchise() {
    if (session.multiplayer?.active && session.multiplayer.room) {
      const myPlayer = session.multiplayer.room.players.find(p => p.id === session.multiplayer.playerId);
      const team = myPlayer?.team || session.userTeam;
      return session.multiplayer.room.franchises[team] || session.franchises[team];
    }
    return session.franchises[session.userTeam];
  }

  function stopTimer() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (aiBidTimeout) {
      clearTimeout(aiBidTimeout);
      aiBidTimeout = null;
    }
    if (bidCountdownInterval) {
      clearInterval(bidCountdownInterval);
      bidCountdownInterval = null;
    }
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
  }

  let lastTickSecond = -1;
  function updateBidTimerDOM(fraction, secRemaining) {
    const isMp = session.multiplayer?.active;
    const mpRoom = session.multiplayer?.room;
    const duration = isMp && mpRoom?.bidTimer ? mpRoom.bidTimer : (session.bidTimer || 10);

    if (fraction === undefined) {
      secRemaining = bidTimeRemaining;
      fraction = Math.max(0, Math.min(1, secRemaining / duration));
    }

    // Audio tick on final 3 seconds (3s, 2s, 1s)
    if (secRemaining <= 3 && secRemaining > 0 && secRemaining !== lastTickSecond) {
      playSound("tick");
      lastTickSecond = secRemaining;
    } else if (secRemaining > 3) {
      lastTickSecond = -1;
    }

    const valEl = document.getElementById("auc-bid-timer-val");
    const clockTextEl = document.getElementById("auc-bid-clock-text");
    const barEl = document.getElementById("auc-bid-timer-bar");
    const pillEl = document.getElementById("auc-bid-timer-pill");

    if (valEl) valEl.textContent = `${secRemaining}s`;
    if (clockTextEl) clockTextEl.textContent = `${secRemaining}s`;

    if (barEl) {
      barEl.style.width = `${Math.max(0, Math.min(100, fraction * 100)).toFixed(1)}%`;
      barEl.classList.toggle("urgent", secRemaining <= 3);
      barEl.classList.toggle("warning", secRemaining > 3 && secRemaining <= 5);
    }
    if (pillEl) {
      pillEl.classList.toggle("urgent", secRemaining <= 3);
    }
  }

  function resetBidTimer() {
    lastTickSecond = -1;
    if (bidCountdownInterval) {
      clearInterval(bidCountdownInterval);
      bidCountdownInterval = null;
    }
    if (aiBidTimeout) {
      clearTimeout(aiBidTimeout);
      aiBidTimeout = null;
    }

    const isMp = session.multiplayer?.active;
    const mpRoom = session.multiplayer?.room;
    const duration = isMp && mpRoom?.bidTimer ? mpRoom.bidTimer : (session.bidTimer || 10);

    bidTimeRemaining = duration;
    bidStartTime = Date.now();
    bidDurationMs = duration * 1000;

    // Immediately snap progress bar to 100% width and clear warning/urgent states
    updateBidTimerDOM(1.0, duration);

    bidCountdownInterval = setInterval(() => {
      const isRoomPhase = (isMp && mpRoom ? mpRoom.phase : session.phase) === "room";
      const gCount = isMp && mpRoom ? mpRoom.gavelCount : session.gavelCount;
      const lot = currentLot();

      if (!lot || !isRoomPhase || gCount >= 3 || gCount === -1) {
        clearInterval(bidCountdownInterval);
        bidCountdownInterval = null;
        return;
      }

      const elapsed = Date.now() - bidStartTime;
      const remainingMs = Math.max(0, bidDurationMs - elapsed);
      const secRemaining = Math.ceil(remainingMs / 1000);
      const fraction = remainingMs / bidDurationMs;

      bidTimeRemaining = secRemaining;
      updateBidTimerDOM(fraction, secRemaining);

      if (remainingMs <= 0) {
        clearInterval(bidCountdownInterval);
        bidCountdownInterval = null;
        if (isMp) {
          const isHost = mpRoom?.players?.find(p => p.id === session.multiplayer.playerId)?.isHost;
          if (isHost) {
            mpAct("timeout");
          }
        } else {
          advanceGavelOnTimeout();
        }
      }
    }, 100);

    // Schedule AI counter-bid or multiplayer bot check
    if (isMp) {
      const isHost = mpRoom?.players?.find(p => p.id === session.multiplayer.playerId)?.isHost;
      if (isHost && mpRoom?.phase === "room" && mpRoom?.gavelCount < 3 && mpRoom?.gavelCount !== -1) {
        const delay = duration === 5 ? 1600 : 3500;
        aiBidTimeout = setTimeout(() => {
          mpAct("ai-check");
        }, delay);
      }
    } else {
      if (session.phase === "room" && session.gavelCount < 3 && session.gavelCount !== -1) {
        scheduleAiCounterBid();
      }
    }
  }

  function scheduleAiCounterBid() {
    if (aiBidTimeout) {
      clearTimeout(aiBidTimeout);
      aiBidTimeout = null;
    }
    const lot = currentLot();
    if (!lot || session.phase !== "room" || session.gavelCount >= 3 || session.gavelCount === -1) return;

    const nextBid = getNextBid(session.currentBid);

    // 1. Check user auto-bid first
    if (session.autoBidMax != null && session.autoBidMax >= nextBid && session.leadingTeam !== session.userTeam && !session.userPassed) {
      const user = userFranchise();
      if (user.purse >= nextBid && user.squad.length < 25 && (!lot.overseas || user.squad.filter(p => p.overseas).length < 8)) {
        aiBidTimeout = setTimeout(() => {
          if (session.phase !== "room" || session.gavelCount >= 3 || session.gavelCount === -1) return;
          if (session.leadingTeam === session.userTeam) return;
          placeBid(session.userTeam, nextBid);
          updateAuctionRoomDOM();
        }, 700);
        return;
      }
    }

    // 2. Evaluate AI franchises for counter-bid
    const candidates = [];
    for (const code in session.franchises) {
      if (code === session.userTeam) continue;
      if (code === session.leadingTeam) continue;
      const f = session.franchises[code];
      if (f.purse < nextBid || f.squad.length >= 25) continue;
      if (lot.overseas && f.squad.filter(p => p.overseas).length >= 8) continue;
      const valuation = calculateValuation(code, lot);
      if (valuation >= nextBid) {
        candidates.push({ code, valuation });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.valuation - a.valuation);
      const chosen = candidates[0].code;
      const duration = session.bidTimer || 10;
      const delay = session.speed === "fast" ? 500 : session.speed === "instant" ? 30 :
        (duration === 5 ? (1200 + Math.random() * 1200) : (2500 + Math.random() * 2500));

      aiBidTimeout = setTimeout(() => {
        if (session.phase !== "room" || session.gavelCount >= 3 || session.gavelCount === -1) return;
        placeBid(chosen, nextBid);
        updateAuctionRoomDOM();

        // Check user auto-bid counter
        const user = userFranchise();
        const uNext = getNextBid(nextBid);
        if (session.autoBidMax != null && session.autoBidMax >= uNext && session.leadingTeam !== session.userTeam && !session.userPassed && user.purse >= uNext) {
          setTimeout(() => {
            if (session.phase === "room" && session.leadingTeam !== session.userTeam && session.autoBidMax >= getNextBid(session.currentBid)) {
              placeBid(session.userTeam, getNextBid(session.currentBid));
              updateAuctionRoomDOM();
            }
          }, 700);
        }
      }, delay);
    }
  }

  function scheduleAutoAdvance() {
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = setTimeout(() => {
      autoAdvanceTimer = null;
      if (session.multiplayer?.active) {
        const isHost = session.multiplayer.room?.players?.find(p => p.id === session.multiplayer.playerId)?.isHost;
        if (isHost && session.multiplayer.room?.phase === "room") {
          mpAct("next-lot");
        }
      } else {
        if (session.phase === "room") {
          actions["auc-next-lot"]();
        }
      }
    }, 2500);
  }

  function advanceGavelOnTimeout() {
    const lot = currentLot();
    if (!lot) return;

    if (session.leadingTeam == null) {
      session.gavelCount = -1;
      session.history.unshift({
        type: "unsold",
        text: `❌ Mallika: ${lot.name} is UNSOLD at base price ${formatPurse(lot.basePrice || 2.0)}.`
      });
      session.unsoldList.push(lot);
      playSound("gavel");
      save();
      updateAuctionRoomDOM();
      scheduleAutoAdvance();
    } else {
      finalizeSale(lot, session.leadingTeam, session.currentBid);
      updateAuctionRoomDOM();
      scheduleAutoAdvance();
    }
  }

  function updateChatDOM(chat) {
    const chatContainer = document.getElementById("mp-room-chat-list") || document.getElementById("mp-lobby-chat-list");
    if (!chatContainer || !chat) return;
    const isAtBottom = (chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight) < 60;
    
    if (chatContainer.children.length !== chat.length) {
      chatContainer.innerHTML = chat.slice(-12).map(m => `
        <div class="feed-item chat-bubble" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:4px 8px;font-size:12px;">
          <div class="row between" style="width:100%;font-size:11px;">
            <span style="font-weight:700;color:${m.team ? "var(--gold)" : "var(--dim)"}">${m.team ? `[${m.team}] ` : ""}${esc(m.sender)}</span>
            <span class="muted" style="font-size:10px;">${m.time || ""}</span>
          </div>
          <span style="font-size:12px;word-break:break-word;">${esc(m.text)}</span>
        </div>
      `).join("");
      if (isAtBottom) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  }

  function updateAuctionRoomDOM() {
    const stage = document.querySelector(".auction-stage");
    if (!stage) {
      parentRender();
      return;
    }

    const lot = currentLot();
    if (!lot) {
      parentRender();
      return;
    }

    const user = userFranchise();
    const isMp = session.multiplayer?.active;
    const mpRoom = session.multiplayer?.room;
    const curBid = isMp && mpRoom ? mpRoom.currentBid : session.currentBid;
    const leadingTeam = isMp && mpRoom ? mpRoom.leadingTeam : session.leadingTeam;
    const gavelCount = isMp && mpRoom ? mpRoom.gavelCount : session.gavelCount;
    const historyList = isMp && mpRoom ? mpRoom.history : session.history;
    const nextBid = getNextBid(curBid);
    const isLeading = leadingTeam === user.code;
    const leadingF = leadingTeam ? (isMp ? mpRoom.franchises[leadingTeam] : session.franchises[leadingTeam]) : null;
    const isSold = gavelCount >= 3;
    const isUnsold = gavelCount === -1;

    // 1. Current bid amount
    const bidAmtEl = stage.querySelector(".current-bid-amount");
    if (bidAmtEl) bidAmtEl.textContent = formatPurse(curBid);

    // 2. Current bid leading team
    const bidTeamEl = stage.querySelector(".current-bid-team");
    if (bidTeamEl) {
      if (leadingF) {
        bidTeamEl.innerHTML = `
          <div class="bid-team-crest" style="background:${leadingF.a}">${leadingF.ab}</div>
          <div>
            <div class="row" style="gap:6px;align-items:center;">
              <b style="font-size:16px;color:#fff">${esc(leadingF.name)}</b>
              ${leadingF.code === user.code ? `<span class="badge ok" style="font-size:10px;">You</span>` :
                (isMp && mpRoom?.players?.find(p => p.team === leadingTeam)) ? `<span class="badge star" style="font-size:10px;">${esc(mpRoom.players.find(p => p.team === leadingTeam).name)}</span>` :
                (isMp ? `<span class="badge" style="font-size:10px;background:#334155;color:#cbd5e1;">🤖 AI Bot</span>` : "")}
            </div>
            <div class="muted" style="font-size:12px">${leadingF.code === user.code ? "🌟 You are leading the bid" : (isMp && mpRoom?.players?.find(p => p.team === leadingTeam) ? `👤 Human bidder is in the lead` : (isMp ? `🤖 Counter-bid by AI bot` : `In the lead`))}</div>
          </div>
        `;
      } else {
        bidTeamEl.innerHTML = `<span class="muted" style="font-size:14px">Opening at base price</span>`;
      }
    }

    // 3. Gavel icon and status ticker
    const gavelWrap = stage.querySelector(".gavel-icon-wrap");
    if (gavelWrap) gavelWrap.classList.toggle("strike", gavelCount > 0);

    const callTicker = stage.querySelector(".bid-call-ticker");
    if (callTicker) {
      callTicker.innerHTML = `
        <span>
          ${isSold ? `🔨 <b style="color:var(--win)">SOLD to ${leadingF?.name || leadingTeam} for ${formatPurse(curBid)}!</b>` :
            isUnsold ? `❌ <b style="color:var(--warn)">UNSOLD at ${formatPurse(lot.basePrice || 2.0)}</b>` :
            gavelCount === 2 ? `⚠️ Going twice at ${formatPurse(curBid)}...` :
            gavelCount === 1 ? `⏳ Going once at ${formatPurse(curBid)}...` :
            `🎯 Bidding is active. Next minimum bid: <b>${formatPurse(nextBid)}</b>`}
        </span>
        <span class="muted" style="font-size:12px">Purse left: <b style="color:var(--gold)">${formatPurse(user.purse)}</b></span>
      `;
    }

    // 4. Bidding controls
    const controlsBox = stage.querySelector(".bidding-controls");
    if (controlsBox) {
      if (isSold || isUnsold) {
        controlsBox.innerHTML = `
          <div class="row" style="justify-content:center;gap:12px;align-items:center;">
            <button class="paddle-btn-primary" data-action="auc-next-lot">${icon("skip-forward")} Next Player</button>
            <button class="btn ghost" data-action="auc-squad-view">${icon("users-three")} View Squad</button>
            <span class="muted" style="font-size:12px;">⏱️ Auto-advancing to next player in 2s...</span>
          </div>
        `;
      } else {
        const paddleBtn = controlsBox.querySelector(".paddle-btn-primary");
        if (paddleBtn) {
          paddleBtn.disabled = isLeading || user.purse < nextBid;
          paddleBtn.innerHTML = `${icon("gavel")} RAISE PADDLE · ${formatPurse(nextBid)}`;
        }
        const incBtns = controlsBox.querySelectorAll(".quick-inc-btn[data-inc]");
        incBtns.forEach(btn => {
          const inc = +btn.dataset.inc;
          btn.disabled = user.purse < curBid + inc;
        });

        // Update auto-bid panel
        const autoPanel = controlsBox.querySelector("#auc-autobid-panel");
        const activeInput = document.getElementById("auc-autobid-input");
        const isTyping = activeInput && document.activeElement === activeInput;
        if (autoPanel && !isTyping) {
          if (session.autoBidMax != null) {
            autoPanel.innerHTML = `
              <div class="row between" style="align-items:center;">
                <span class="autobid-active-pill">
                  🤖 Auto-Bid Active: Up to ₹${session.autoBidMax.toFixed(2)} Cr
                </span>
                <button type="button" class="btn ghost small" data-action="auc-cancel-autobid" style="color:var(--hot2);font-size:11px;padding:3px 8px;">✕ Cancel</button>
              </div>
            `;
          } else {
            autoPanel.innerHTML = `
              <div class="row between" style="align-items:center;flex-wrap:wrap;gap:6px;">
                <span class="muted" style="font-size:12px;font-weight:600;">🤖 Auto-Bid Ceiling:</span>
                <div class="row" style="gap:6px;align-items:center;">
                  <input type="number" id="auc-autobid-input" step="0.5" min="${nextBid}" max="${user.purse}" placeholder="₹ Cr"
                    style="width:80px;padding:5px 8px;background:var(--panel);border:1px solid var(--line);color:#fff;border-radius:6px;font-size:12px;"
                    onkeydown="if(event.key==='Enter') document.querySelector('[data-action=auc-set-autobid-btn]').click();" />
                  <button type="button" class="btn small" data-action="auc-set-autobid-btn" style="padding:4px 8px;font-size:11px;">Set</button>
                </div>
              </div>
              <div class="autobid-presets-row" style="margin-top:2px;">
                <button type="button" class="autobid-preset-btn" data-action="auc-preset-autobid" data-val="${(curBid + 2).toFixed(2)}">+₹2 Cr</button>
                <button type="button" class="autobid-preset-btn" data-action="auc-preset-autobid" data-val="${(curBid + 5).toFixed(2)}">+₹5 Cr</button>
                <button type="button" class="autobid-preset-btn" data-action="auc-preset-autobid" data-val="10.00">Max ₹10 Cr</button>
                <button type="button" class="autobid-preset-btn" data-action="auc-preset-autobid" data-val="15.00">Max ₹15 Cr</button>
              </div>
            `;
          }
        }
      }
    }

    // 5. Update Timer Display
    updateBidTimerDOM();

    // 6. Live Feed
    const feedListEl = stage.querySelector("#auc-feed-list");
    if (feedListEl) {
      if (isSold || isUnsold) {
        feedListEl.innerHTML = `
          <div class="feed-item sold-summary ${isSold ? 'sold' : 'unsold'}" style="padding:14px;background:rgba(255,255,255,0.04);border-radius:10px;border-left:4px solid ${isSold ? 'var(--win)' : 'var(--warn)'};">
            ${isSold ? `
              <div class="stack" style="gap:4px;">
                <span class="badge ok" style="align-self:flex-start;font-size:11px;">🔨 SOLD</span>
                <b style="font-size:15px;color:#fff">${esc(lot.name)} sold to <span style="color:var(--gold)">${esc(leadingF?.name || leadingTeam)}</span></b>
                <span style="font-size:13px;color:var(--win);font-weight:700;">Winning Bid: ${formatPurse(curBid)}</span>
                <span class="muted" style="font-size:11px;margin-top:4px;">⏱️ Moving to next player automatically...</span>
              </div>
            ` : `
              <div class="stack" style="gap:4px;">
                <span class="badge warn" style="align-self:flex-start;font-size:11px;">❌ UNSOLD</span>
                <b style="font-size:15px;color:#fff">${esc(lot.name)} remains unsold</b>
                <span class="muted" style="font-size:12px;">Base price was ${formatPurse(lot.basePrice || 2.0)}</span>
                <span class="muted" style="font-size:11px;margin-top:4px;">⏱️ Moving to next player automatically...</span>
              </div>
            `}
          </div>
        `;
      } else {
        feedListEl.innerHTML = historyList.map(item => `
          <div class="feed-item ${item.type}">
            <span>${item.type === "bid" ? icon("hand-pointing") : item.type === "sold" ? icon("check-circle") : icon("radio-button")}</span>
            <span>${esc(item.text)}</span>
          </div>
        `).join("");
      }
    }

    // 7. Chat update
    if (isMp && mpRoom) {
      updateChatDOM(mpRoom.chat);
    }

    // 8. User purse update
    const userPurseEl = stage.querySelector("#auc-user-purse");
    if (userPurseEl) userPurseEl.textContent = formatPurse(user.purse);
  }

  function renderRatingBadge(ovr) {
    const val = ovr || 75;
    let cls = "badge-tier-blue";
    if (val >= 90) cls = "badge-tier-gold";
    else if (val >= 85) cls = "badge-tier-purple";
    else if (val >= 80) cls = "badge-tier-green";
    return `<span class="rating-badge ${cls}">${val} <small>OVR</small></span>`;
  }

  // Calculate valuation for AI franchises
  function calculateValuation(teamCode, lot) {
    const f = session.franchises[teamCode];
    if (!f || f.purse <= 0) return 0;
    if (f.squad.length >= 25) return 0;
    if (lot.overseas && f.squad.filter(p => p.overseas).length >= 8) return 0;

    const slotsNeeded = Math.max(0, 18 - f.squad.length - 1);
    const minReserve = slotsNeeded * 0.30;
    const maxAvailable = f.purse - minReserve;
    if (maxAvailable <= 0.20) return 0;

    const ovr = lot.overall || 75;
    let baseVal = 2.0;

    if (ovr >= 92) baseVal = 18.0 + (ovr - 92) * 1.8;
    else if (ovr >= 88) baseVal = 12.0 + (ovr - 88) * 1.3;
    else if (ovr >= 84) baseVal = 8.0 + (ovr - 84) * 0.9;
    else if (ovr >= 80) baseVal = 5.0 + (ovr - 80) * 0.7;
    else if (ovr >= 75) baseVal = 2.8 + (ovr - 75) * 0.45;
    else if (ovr >= 70) baseVal = 1.2 + (ovr - 70) * 0.3;
    else baseVal = 0.3 + (ovr / 70) * 0.6;

    const bowlers = f.squad.filter(p => p.role === "bowler" || p.role === "all-rounder").length;
    const keepers = f.squad.filter(p => p.role === "batter" && p.name && (p.name.includes("Dhoni") || p.name.includes("Samson") || p.name.includes("Pooran") || p.name.includes("Pant") || p.name.includes("Rahul") || p.name.includes("Klaasen") || p.isWK)).length;

    let needMul = 1.0;
    if (lot.category === "WK" && keepers === 0) needMul *= 1.45;
    if ((lot.category === "FA" || lot.category === "SP") && bowlers < 5) needMul *= 1.35;
    if (lot.category === "AL") needMul *= 1.25;

    // Franchise Personalities
    if (teamCode === "PBKS" && f.purse > 50) needMul *= 1.25;
    if (teamCode === "CSK" && (lot.styles?.includes("Finisher") || lot.category === "SP")) needMul *= 1.2;
    if (teamCode === "MI" && (lot.category === "FA" || lot.styles?.includes("Hard Hitter"))) needMul *= 1.2;
    if (teamCode === "SRH" && (lot.styles?.includes("Aggressive") || lot.bat >= 85)) needMul *= 1.2;
    if (teamCode === "RCB" && lot.overall >= 85) needMul *= 1.2;

    const purseScale = Math.min(1.35, Math.max(0.65, f.purse / 50.0));
    let finalVal = baseVal * needMul * purseScale;
    finalVal = Math.min(finalVal, maxAvailable);
    return Math.max(lot.basePrice || 2.0, +finalVal.toFixed(2));
  }

  function scheduleNextTick() {
    // Single master shot-clock: AI counter-bids are driven by scheduleAiCounterBid()
    if (session.multiplayer?.active) {
      const isHost = session.multiplayer.room?.players.find(p => p.id === session.multiplayer.playerId)?.isHost;
      if (isHost && session.multiplayer.room?.phase === "room" && session.multiplayer.room?.gavelCount < 3 && session.multiplayer.room?.gavelCount !== -1) {
        if (!aiBidTimeout) {
          const duration = session.multiplayer.room.bidTimer || 10;
          aiBidTimeout = setTimeout(() => { mpAct("ai-check"); }, duration === 5 ? 1600 : 3500);
        }
      }
      return;
    }
    if (session.phase === "room" && session.gavelCount < 3 && session.gavelCount !== -1) {
      scheduleAiCounterBid();
    }
  }

  function auctionTick() {
    scheduleNextTick();
  }

  function placeBid(teamCode, amount) {
    session.currentBid = amount;
    session.leadingTeam = teamCode;
    session.gavelCount = 0;
    session.history.unshift({
      type: "bid",
      team: teamCode,
      amount,
      text: `${session.franchises[teamCode].name} bids ${formatPurse(amount)}!`
    });
    playSound("bid");
    resetBidTimer();
  }

  function finalizeSale(lot, winningTeam, price) {
    session.gavelCount = 3;
    const f = session.franchises[winningTeam];
    f.purse = +(f.purse - price).toFixed(2);
    const boughtItem = {
      key: lot.key,
      name: lot.name,
      price,
      role: lot.role,
      category: lot.category,
      overseas: lot.overseas,
      overall: lot.overall,
      team: winningTeam,
      retention: false
    };
    f.squad.push(boughtItem);
    session.soldList.push(boughtItem);
    session.history.unshift({
      type: "sold",
      text: `🔨 SOLD! ${lot.name} is acquired by ${f.name} for ${formatPurse(price)}!`
    });
    playSound("sold");
    launchConfetti();
    save();
    scheduleAutoAdvance();
  }

  function randomizeNextLot() {
    if (!session.pool || session.lotIndex >= session.pool.length - 1) return;
    const curLot = session.pool[session.lotIndex];
    const curSet = curLot?.set || curLot?.category || "";
    const remainingInSet = [];
    for (let i = session.lotIndex + 1; i < session.pool.length; i++) {
      const s = session.pool[i].set || session.pool[i].category || "";
      if (s === curSet) remainingInSet.push(i);
    }
    const nextIdx = session.lotIndex + 1;
    if (remainingInSet.length > 0) {
      const pick = remainingInSet[Math.floor(Math.random() * remainingInSet.length)];
      if (pick !== nextIdx) {
        const tmp = session.pool[nextIdx];
        session.pool[nextIdx] = session.pool[pick];
        session.pool[pick] = tmp;
      }
    } else if (nextIdx < session.pool.length) {
      const nextSet = session.pool[nextIdx].set || session.pool[nextIdx].category || "";
      const remainingInNextSet = [];
      for (let i = nextIdx; i < session.pool.length; i++) {
        const s = session.pool[i].set || session.pool[i].category || "";
        if (s === nextSet) remainingInNextSet.push(i);
      }
      if (remainingInNextSet.length > 0) {
        const pick = remainingInNextSet[Math.floor(Math.random() * remainingInNextSet.length)];
        if (pick !== nextIdx) {
          const tmp = session.pool[nextIdx];
          session.pool[nextIdx] = session.pool[pick];
          session.pool[pick] = tmp;
        }
      }
    }
  }

  function randomizeFirstLot() {
    if (!session.pool || session.pool.length <= 1) return;
    const firstSet = session.pool[0].set || session.pool[0].category || "";
    const inFirstSet = [];
    for (let i = 0; i < session.pool.length; i++) {
      const s = session.pool[i].set || session.pool[i].category || "";
      if (s === firstSet) inFirstSet.push(i);
    }
    if (inFirstSet.length > 1) {
      const pick = inFirstSet[Math.floor(Math.random() * inFirstSet.length)];
      if (pick !== 0) {
        const tmp = session.pool[0];
        session.pool[0] = session.pool[pick];
        session.pool[pick] = tmp;
      }
    }
  }

  function nextLot() {
    stopTimer();
    randomizeNextLot();
    session.lotIndex++;
    if (session.lotIndex >= session.pool.length) {
      session.phase = "summary";
      save();
      parentRender();
      return;
    }
    const lot = currentLot();
    session.currentBid = lot.basePrice || 2.0;
    session.leadingTeam = null;
    session.gavelCount = 0;
    session.history = [];
    session.autoBidMax = null;
    session.userPassed = false;
    session.phase = "room";
    save();
    parentRender();
    resetBidTimer();
    scheduleNextTick();
  }

  function buildPlayingXI(teamCode) {
    const f = session.franchises[teamCode];
    if (!f || !f.squad || f.squad.length === 0) return [];

    const sorted = [...f.squad].sort((a, b) => (b.overall || 70) - (a.overall || 70));
    const xi = [];
    let overseas = 0;

    const wk = sorted.find(p => p.role === "batter" && (!p.overseas || overseas < 4));
    if (wk) {
      xi.push(wk.key);
      if (wk.overseas) overseas++;
    }

    for (const p of sorted) {
      if (xi.length >= 12) break;
      if (xi.includes(p.key)) continue;
      if (p.overseas && overseas >= 4) continue;
      if (p.role === "bowler" || p.role === "all-rounder") {
        xi.push(p.key);
        if (p.overseas) overseas++;
      }
    }

    for (const p of sorted) {
      if (xi.length >= 12) break;
      if (xi.includes(p.key)) continue;
      if (p.overseas && overseas >= 4) continue;
      xi.push(p.key);
      if (p.overseas) overseas++;
    }

    return xi;
  }

  // --- MULTIPLAYER API & SYNCHRONIZATION ENGINE ---
  async function mpAct(action, payload = {}) {
    if (!session.multiplayer?.active) return;
    try {
      const res = await fetch("/api/auction/act", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: session.multiplayer.code,
          playerId: session.multiplayer.playerId,
          action,
          ...payload
        })
      });
      const data = await res.json();
      if (data.ok && data.room) {
        onRoomUpdated(data.room);
        broadcastChannel?.postMessage({ code: session.multiplayer.code, room: data.room });
      }
    } catch {}
  }

  function onRoomUpdated(room) {
    if (!room || !session.multiplayer?.active) return;
    const oldVersion = session.multiplayer.room?.version || 0;
    const oldBid = session.multiplayer.room?.currentBid || 0;
    const oldGavel = session.multiplayer.room?.gavelCount ?? 0;
    const oldLot = session.multiplayer.room?.lotIndex ?? -1;

    session.multiplayer.room = room;

    // Reset bid timer on bid change or lot change
    if (room.currentBid > oldBid || room.lotIndex !== oldLot) {
      resetBidTimer();
    }

    // Sound effects on incoming events
    if (room.currentBid > oldBid) {
      playSound("bid");
    }
    if (room.gavelCount >= 3 && oldGavel < 3) {
      playSound("sold");
      launchConfetti();
    } else if (room.gavelCount > 0 && room.gavelCount !== oldGavel) {
      playSound("gavel");
    }

    // Auto-advance UI phase based on multiplayer room phase
    let phaseChanged = false;
    if (room.phase === "room" && session.phase !== "room") {
      session.phase = "room";
      phaseChanged = true;
    } else if (room.phase === "squad" && session.phase !== "squad") {
      session.phase = "squad";
      phaseChanged = true;
    }

    // MULTIPLAYER AUTO-BID EVALUATION
    if (room.phase === "room" && room.gavelCount < 3 && room.gavelCount !== -1) {
      const myTeam = userFranchise().code;
      const nextBid = getNextBid(room.currentBid);
      if (session.autoBidMax != null && session.autoBidMax >= nextBid && room.leadingTeam !== myTeam && !session.userPassed) {
        const myF = userFranchise();
        if (myF.purse >= nextBid) {
          setTimeout(() => {
            if (session.multiplayer?.room?.leadingTeam !== myTeam && session.autoBidMax >= getNextBid(session.multiplayer.room.currentBid)) {
              mpAct("bid", { amount: getNextBid(session.multiplayer.room.currentBid) });
            }
          }, 350);
        }
      }
    }

    // MULTIPLAYER AUTO-ADVANCE AFTER SALE / UNSOLD (Host triggers next lot after 2.5s)
    const isHost = room.players.find(p => p.id === session.multiplayer.playerId)?.isHost;
    if (isHost && (room.gavelCount >= 3 || room.gavelCount === -1) && !autoAdvanceTimer) {
      scheduleAutoAdvance();
    }

    // In-place DOM update during live bidding rounds, full render only on phase/lot transition
    const stage = document.querySelector(".auction-stage");
    const lotChanged = oldLot !== room.lotIndex;

    if (stage && !phaseChanged && !lotChanged && session.phase === "room") {
      updateAuctionRoomDOM();
    } else {
      parentRender();
      if (session.phase === "room") {
        resetBidTimer();
      }
    }

    // Host schedules AI or next tick
    if (isHost && room.phase === "room" && room.gavelCount < 3 && room.gavelCount !== -1) {
      scheduleNextTick();
    }
  }

  async function startMpLongPoll(code) {
    if (pollAbortController) pollAbortController.abort();
    pollAbortController = new AbortController();

    while (session.multiplayer?.active && session.multiplayer.code === code) {
      const curVersion = session.multiplayer.room?.version || 0;
      try {
        const res = await fetch(`/api/auction/poll?code=${code}&version=${curVersion}`, {
          signal: pollAbortController.signal
        });
        if (!res.ok) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        const data = await res.json();
        if (data.room && session.multiplayer?.active) {
          onRoomUpdated(data.room);
        }
      } catch (err) {
        if (err.name === "AbortError") break;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  // Check URL hash for direct invite link (e.g. #auction-room=ABCD)
  function checkUrlInvite() {
    const hash = window.location.hash || "";
    const m = hash.match(/#auction-room=([A-Za-z0-9]{4,6})/i) || hash.match(/#auction=([A-Za-z0-9]{4,6})/i);
    if (m && m[1]) {
      const code = m[1].toUpperCase();
      setTimeout(() => {
        actions["auc-join-prompt"]({ code });
      }, 200);
    }
  }

  // --- ACTIONS ---
  const actions = {
    auction() {
      session.phase = session.phase === "room" ? "room" : "hub";
      appState().screen = "auction";
      parentRender();
      checkUrlInvite();
    },

    "auc-mode-screen"() {
      stopTimer();
      session.phase = "mode";
      save();
      parentRender();
    },

    "auc-select-mode"(el) {
      const modeKey = el.dataset.mode;
      if (!AUCTION_MODES[modeKey]) return;
      stopTimer();
      session = initSession(modeKey);
      session.phase = "hub";
      save();
      parentRender();
    },

    "auc-select-team"(el) {
      const code = el.dataset.code;
      session.userTeam = code;
      applyTeamTheme(code);
      if (session.multiplayer?.active) {
        if (session.multiplayer.room) {
          const myPlayer = session.multiplayer.room.players.find(p => p.id === session.multiplayer.playerId);
          if (myPlayer) myPlayer.team = code;
        }
        mpAct("switch-team", { team: code });
      }
      save();
      parentRender();
    },

    "auc-join-pick-team"(el) {
      const code = el.dataset.code;
      window._joinSelectedTeam = code;
      const input = document.getElementById("mp-join-team");
      if (input) input.value = code;
      document.querySelectorAll(".mp-team-pick-btn").forEach(btn => {
        const isMatch = btn.dataset.code === code;
        btn.classList.toggle("selected", isMatch);
        let check = btn.querySelector(".mp-pick-check");
        if (isMatch && !check) {
          const span = document.createElement("span");
          span.className = "mp-pick-check";
          span.textContent = "✓";
          btn.appendChild(span);
        } else if (!isMatch && check) {
          check.remove();
        }
      });
      applyTeamTheme(code);
    },

    // INTERACTIVE RETENTION CHOOSER MODAL (BCCI IPL Regulations)
    "auc-choose-retentions"() {
      const f = userFranchise();
      const roster = f.eligibleRoster || [];
      const currentKeys = new Set(f.retentions.map(r => r.key));

      window._activeRetKeys = new Set(currentKeys);

      window._toggleRetentionPlayer = function(key) {
        const player = roster.find(p => p.key === key);
        if (!player) return;

        if (window._activeRetKeys.has(key)) {
          window._activeRetKeys.delete(key);
        } else {
          if (window._activeRetKeys.size >= 6) {
            alert("Maximum 6 retentions allowed under BCCI regulations!");
            return;
          }
          let uncappedCount = 0;
          let cappedCount = 0;
          roster.forEach(p => {
            if (window._activeRetKeys.has(p.key)) {
              if (p.uncapped) uncappedCount++;
              else cappedCount++;
            }
          });
          if (player.uncapped && uncappedCount >= 2) {
            alert("Maximum 2 uncapped player retentions allowed under BCCI rules (at ₹4 Cr each)!");
            return;
          }
          if (!player.uncapped && cappedCount >= 5) {
            alert("Maximum 5 capped player retentions allowed under BCCI rules!");
            return;
          }
          window._activeRetKeys.add(key);
        }
        window._renderRetentionUI();
      };

      window._clearAllRetentions = function() {
        window._activeRetKeys.clear();
        window._renderRetentionUI();
      };

      window._selectTopRetentions = function() {
        window._activeRetKeys.clear();
        const capped = roster.filter(p => !p.uncapped).sort((a, b) => (b.overall || 75) - (a.overall || 75));
        const uncapped = roster.filter(p => p.uncapped).sort((a, b) => (b.overall || 75) - (a.overall || 75));
        capped.slice(0, 4).forEach(p => window._activeRetKeys.add(p.key));
        uncapped.slice(0, 1).forEach(p => window._activeRetKeys.add(p.key));
        window._renderRetentionUI();
      };

      window._renderRetentionUI = function() {
        const count = window._activeRetKeys.size;
        let spent = 0;

        const selectedCapped = [];
        const selectedUncapped = [];
        roster.forEach(p => {
          if (window._activeRetKeys.has(p.key)) {
            if (p.uncapped) selectedUncapped.push(p);
            else selectedCapped.push(p);
          }
        });

        selectedCapped.sort((a, b) => (b.overall || 75) - (a.overall || 75));
        selectedCapped.forEach((p, idx) => {
          const cost = MEGA_RETENTION_COSTS[idx] || 11.0;
          spent += cost;
        });
        selectedUncapped.forEach(() => {
          spent += MEGA_UNCAPPED_COST; // 4.0 Cr
        });

        const remainingPurse = +(120.0 - spent).toFixed(2);
        const rtm = Math.max(0, 6 - count);

        // Update header banner elements
        const countEl = document.getElementById("auc-ret-count-val");
        const spentEl = document.getElementById("auc-ret-spent-val");
        const purseEl = document.getElementById("auc-ret-purse-val");
        const rtmEl = document.getElementById("auc-ret-rtm-val");

        if (countEl) countEl.innerHTML = `${count} / 6 <small style="font-size:11px;color:var(--dim)">(${selectedCapped.length} Capped + ${selectedUncapped.length} Uncapped)</small>`;
        if (spentEl) spentEl.textContent = formatPurse(spent);
        if (purseEl) purseEl.textContent = formatPurse(remainingPurse);
        if (rtmEl) rtmEl.textContent = rtm;

        // Update card classes
        document.querySelectorAll(".ret-candidate-card").forEach(c => {
          const k = c.dataset.key;
          if (window._activeRetKeys.has(k)) {
            c.classList.add("selected");
            const chk = c.querySelector(".ret-check-circle");
            if (chk) chk.innerHTML = "✓";
          } else {
            c.classList.remove("selected");
            const chk = c.querySelector(".ret-check-circle");
            if (chk) chk.innerHTML = "";
          }
        });
      };

      openSheet(`
        <div class="row between" style="align-items:flex-start;">
          <div>
            <h2>${esc(f.name)} Retentions</h2>
            <p class="muted">BCCI Rules: Max 6 total (Max 5 Capped + Max 2 Uncapped @ ₹4 Cr). Unselected players enter the auction pool.</p>
          </div>
          <button class="btn icon ghost" data-action="close-sheet">${icon("x")}</button>
        </div>

        <!-- Live BCCI Deduction Calculation Banner -->
        <div class="ret-calculation-bar">
          <div class="ret-calc-item">
            <span class="muted">Retained</span>
            <b id="auc-ret-count-val" style="color:var(--gold)">${f.retentions.length} / 6</b>
          </div>
          <div class="ret-calc-item">
            <span class="muted">Total Cost</span>
            <b id="auc-ret-spent-val">${formatPurse(120 - f.purse)}</b>
          </div>
          <div class="ret-calc-item">
            <span class="muted">Purse Left</span>
            <b id="auc-ret-purse-val" style="color:var(--win)">${formatPurse(f.purse)}</b>
          </div>
          <div class="ret-calc-item">
            <span class="muted">RTM Cards</span>
            <b id="auc-ret-rtm-val">${f.rtm}</b>
          </div>
        </div>

        <!-- Quick Preset Controls -->
        <div class="row between" style="margin-top:10px;align-items:center;">
          <span class="muted" style="font-size:12px;">Click players to toggle retentions or use presets:</span>
          <div class="row" style="gap:8px;">
            <button type="button" class="btn ghost small" onclick="window._clearAllRetentions()" style="font-size:11px;padding:4px 8px;">
              🗑️ Clear All (0 Retained, ₹120 Cr)
            </button>
            <button type="button" class="btn ghost small" onclick="window._selectTopRetentions()" style="font-size:11px;padding:4px 8px;color:var(--gold);">
              ⭐ Retain Core Stars
            </button>
          </div>
        </div>

        <!-- Candidate Player Grid -->
        <div class="ret-candidate-grid" style="margin-top:14px;max-height:55vh;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:10px;padding-right:4px;">
          ${roster.map(p => {
            const isRetained = currentKeys.has(p.key);
            return `
              <div class="ret-candidate-card ${isRetained ? "selected" : ""}" data-key="${p.key}"
                onclick="window._toggleRetentionPlayer('${p.key}')">
                <div class="ret-check-circle">${isRetained ? "✓" : ""}</div>
                <div class="stack" style="gap:2px;flex:1;">
                  <div class="row" style="gap:6px;align-items:center;">
                    <b>${esc(p.name)}</b>
                    ${p.uncapped ? `<span class="badge" style="background:rgba(255,165,0,0.2);color:#ffa500;font-size:10px;padding:1px 6px;border-radius:4px;">Uncapped · ₹4 Cr</span>` : `<span class="badge" style="background:rgba(80,140,255,0.2);color:#82b1ff;font-size:10px;padding:1px 6px;border-radius:4px;">Capped</span>`}
                  </div>
                  <span class="muted" style="font-size:12px;">${p.role} · ${p.overseas ? "✈️ Overseas" : "🇮🇳 India"}</span>
                </div>
                ${renderRatingBadge(p.overall)}
              </div>
            `;
          }).join("")}
        </div>

        <div class="row" style="margin-top:18px;justify-content:space-between;align-items:center;">
          <span class="muted" style="font-size:12px;">Capped slabs: ₹18Cr, ₹14Cr, ₹11Cr, ₹18Cr, ₹14Cr · Uncapped: ₹4Cr flat (max 2)</span>
          <button class="btn primary" data-action="auc-save-retentions">Confirm & Lock Retentions</button>
        </div>
      `, `${f.name} Retentions`);

      return false;
    },

    "auc-save-retentions"() {
      const f = userFranchise();
      const roster = f.eligibleRoster || [];
      const chosenKeys = window._activeRetKeys || new Set();

      const selectedCapped = [];
      const selectedUncapped = [];
      roster.forEach(p => {
        if (chosenKeys.has(p.key)) {
          if (p.uncapped) selectedUncapped.push(p);
          else selectedCapped.push(p);
        }
      });
      selectedCapped.sort((a, b) => (b.overall || 75) - (a.overall || 75));

      const newRetentions = [];
      let spent = 0;

      selectedCapped.forEach((p, idx) => {
        const cost = MEGA_RETENTION_COSTS[idx] || 11.0;
        spent += cost;
        newRetentions.push({
          name: p.name,
          key: p.key,
          price: cost,
          overseas: p.overseas,
          role: p.role,
          uncapped: false,
          overall: p.overall
        });
      });

      selectedUncapped.slice(0, 2).forEach(p => {
        spent += MEGA_UNCAPPED_COST; // 4.0 Cr
        newRetentions.push({
          name: p.name,
          key: p.key,
          price: MEGA_UNCAPPED_COST,
          overseas: p.overseas,
          role: p.role,
          uncapped: true,
          overall: p.overall
        });
      });

      const remainingPurse = +(120.0 - spent).toFixed(2);
      const rtm = Math.max(0, 6 - newRetentions.length);

      f.retentions = newRetentions;
      f.purse = remainingPurse;
      f.rtm = rtm;
      f.squad = newRetentions.map(r => ({ ...r, retention: true }));

      // Update pool: all non-retained modern players enter the auction pool
      const allRetainedKeys = new Set();
      for (const code in session.franchises) {
        session.franchises[code].retentions.forEach(r => allRetainedKeys.add(r.key));
      }
      session.pool = ALL_PLAYERS_2026.filter(p => !allRetainedKeys.has(p.key));

      // Sync to multiplayer server if in multiplayer
      if (session.multiplayer?.active) {
        mpAct("set-retentions", {
          team: f.code,
          retentions: newRetentions,
          purse: remainingPurse,
          rtm
        });
      }

      closeSheet();
      save();
      parentRender();
    },

    // --- MULTIPLAYER ROOM ACTIONS ---
    "auc-multiplayer-hub"() {
      session.phase = "mp-hub";
      save();
      parentRender();
    },

    "auc-create-room"() {
      const playerName = document.getElementById("mp-host-name")?.value || "Host";
      const team = document.getElementById("mp-host-team")?.value || session.userTeam;

      fetch("/api/auction/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName,
          team,
          mode: session.mode,
          franchises: session.franchises,
          pool: session.pool,
          bidTimer: session.bidTimer || 10
        })
      })
      .then(r => r.json())
      .then(data => {
        if (data.code && data.room) {
          session.multiplayer = {
            active: true,
            code: data.code,
            playerId: data.playerId,
            room: data.room,
            chatOpen: false
          };
          session.userTeam = team;
          session.phase = "mp-lobby";
          save();
          parentRender();
          startMpLongPoll(data.code);
        }
      })
      .catch(() => alert("Failed to connect to multiplayer server."));
    },

    "auc-join-prompt"(opts = {}) {
      const code = opts.code || "";
      openSheet(`
        <div class="row between">
          <h2>Join Multiplayer Auction</h2>
          <button class="btn icon ghost" data-action="close-sheet">${icon("x")}</button>
        </div>
        <div class="stack" style="gap:14px;margin-top:16px;">
          <div class="stack" style="gap:6px;">
            <label style="font-size:13px;color:var(--dim);">Room Code:</label>
            <input type="text" id="mp-join-code" value="${esc(code)}" placeholder="e.g. ZSSF" maxlength="6"
              style="text-transform:uppercase;font-family:var(--display);font-size:24px;font-weight:800;letter-spacing:2px;padding:10px 14px;background:var(--panel);border:1px solid var(--line);color:var(--gold);border-radius:10px;" />
          </div>
          <div class="stack" style="gap:6px;">
            <label style="font-size:13px;color:var(--dim);">Your Name:</label>
            <input type="text" id="mp-join-name" value="Player" placeholder="Your name"
              style="padding:10px 14px;background:var(--panel);border:1px solid var(--line);color:#fff;border-radius:10px;font-size:15px;" />
          </div>
          <div class="stack" style="gap:6px;">
            <label style="font-size:13px;color:var(--dim);">Choose Preferred Franchise:</label>
            <div class="mp-team-picker-grid">
              ${Object.values(session.franchises).map(f => {
                const isSel = f.code === (window._joinSelectedTeam || session.userTeam || "CSK");
                return `
                  <button type="button" class="mp-team-pick-btn ${isSel ? "selected" : ""}"
                    data-action="auc-join-pick-team" data-code="${f.code}"
                    style="--team-c:${f.a};">
                    <span class="mp-pick-crest" style="background:${f.a};color:#fff;">${f.ab}</span>
                    <span class="mp-pick-name">${f.name}</span>
                    ${isSel ? `<span class="mp-pick-check">✓</span>` : ""}
                  </button>
                `;
              }).join("")}
            </div>
            <input type="hidden" id="mp-join-team" value="${window._joinSelectedTeam || session.userTeam || "CSK"}" />
          </div>
          <button class="btn primary big" data-action="auc-join-submit" style="margin-top:10px;">
            ${icon("sign-in")} Join Auction Room
          </button>
        </div>
      `, "Join Room");
    },

    "auc-join-submit"() {
      const code = document.getElementById("mp-join-code")?.value.trim().toUpperCase();
      const playerName = document.getElementById("mp-join-name")?.value.trim() || "Player";
      const team = document.getElementById("mp-join-team")?.value || "MI";

      if (!code) {
        alert("Please enter a valid room code.");
        return;
      }

      fetch("/api/auction/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, playerName, team })
      })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          alert(data.error);
          return;
        }
        if (data.room && data.playerId) {
          session.multiplayer = {
            active: true,
            code,
            playerId: data.playerId,
            room: data.room,
            chatOpen: false
          };
          const myTeam = data.room.players.find(p => p.id === data.playerId)?.team || team;
          session.userTeam = myTeam;
          session.phase = "mp-lobby";
          closeSheet();
          save();
          parentRender();
          startMpLongPoll(code);
        }
      })
      .catch(() => alert("Failed to connect to room. Check code and try again."));
    },

    "auc-copy-link"() {
      const code = session.multiplayer?.code;
      if (!code) return;
      const url = `${window.location.origin}/app/#auction-room=${code}`;
      const shareData = {
        title: "Join my IPL Mega Auction on Powerplay!",
        text: `Join Room ${code} for our live 2026 IPL Mega Auction!`,
        url: url
      };
      if (typeof navigator !== "undefined" && navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent || "")) {
        navigator.share(shareData).catch(() => {});
      } else if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          showToast(`📋 Invite link for Room ${code} copied!`);
        }).catch(() => {
          prompt("Copy this shareable link to send to friends:", url);
        });
      } else {
        prompt("Copy this shareable link to send to friends:", url);
      }
    },

    "auc-send-chat"() {
      const inp = document.getElementById("mp-chat-input");
      const text = inp?.value.trim();
      if (!text) return;
      mpAct("chat", { text });
      if (inp) inp.value = "";
    },

    "auc-mp-toggle-ready"() {
      const curReady = session.multiplayer.room?.players.find(p => p.id === session.multiplayer.playerId)?.ready;
      mpAct("ready", { ready: !curReady });
    },

    "auc-mp-start-auction"() {
      mpAct("start");
    },

    "auc-leave-room"() {
      if (!confirm("Leave this multiplayer room?")) return;
      if (pollAbortController) pollAbortController.abort();
      session.multiplayer = { active: false, code: "", playerId: "", room: null, chatOpen: false };
      session.phase = "hub";
      save();
      parentRender();
    },

    // --- LIVE ROOM BIDDING & TIMER CONTROLS ---
    "auc-start-room"() {
      if (session.lotIndex === 0 && session.leadingTeam == null) {
        randomizeFirstLot();
      }
      session.phase = "room";
      const lot = currentLot();
      if (lot && session.leadingTeam == null) {
        session.currentBid = lot.basePrice || 2.0;
        session.gavelCount = 0;
      }
      save();
      parentRender();
      resetBidTimer();
      scheduleNextTick();
    },

    "auc-set-bid-timer"(el) {
      const val = +el.dataset.timer || (session.bidTimer === 10 ? 5 : 10);
      session.bidTimer = val;
      if (session.multiplayer?.active) {
        mpAct("set-bid-timer", { timer: val });
      }
      save();
      parentRender();
    },

    "auc-toggle-bid-timer"() {
      const nextVal = (session.bidTimer || 10) === 10 ? 5 : 10;
      session.bidTimer = nextVal;
      if (session.multiplayer?.active) {
        mpAct("set-bid-timer", { timer: nextVal });
      }
      resetBidTimer();
      updateAuctionRoomDOM();
    },

    "auc-select-create-timer"(el) {
      const val = +el.dataset.timer || 10;
      session.bidTimer = val;
      parentRender();
    },

    "auc-bid"() {
      const lot = currentLot();
      if (!lot) return;
      const curBid = (session.multiplayer?.active && session.multiplayer.room) ? session.multiplayer.room.currentBid : session.currentBid;
      const nextBid = getNextBid(curBid);
      const user = userFranchise();
      if (user.purse < nextBid) return;

      if (session.multiplayer?.active) {
        mpAct("bid", { amount: nextBid });
        return;
      }

      placeBid(session.userTeam, nextBid);
      session.userPassed = false;
      updateAuctionRoomDOM();
      scheduleNextTick();
    },

    "auc-quick-bid"(el) {
      const inc = +el.dataset.inc;
      const lot = currentLot();
      if (!lot) return;
      const curBid = (session.multiplayer?.active && session.multiplayer.room) ? session.multiplayer.room.currentBid : session.currentBid;
      const newBid = +(curBid + inc).toFixed(2);
      const user = userFranchise();
      if (user.purse < newBid) return;

      if (session.multiplayer?.active) {
        mpAct("bid", { amount: newBid });
        return;
      }

      placeBid(session.userTeam, newBid);
      session.userPassed = false;
      updateAuctionRoomDOM();
      scheduleNextTick();
    },

    "auc-pass"() {
      session.userPassed = true;
      session.autoBidMax = null;
      updateAuctionRoomDOM();
      scheduleNextTick();
    },

    "auc-set-autobid-btn"() {
      const inp = document.getElementById("auc-autobid-input");
      const val = parseFloat(inp?.value);
      const user = userFranchise();
      const curBid = (session.multiplayer?.active && session.multiplayer.room) ? session.multiplayer.room.currentBid : session.currentBid;
      const nextBid = getNextBid(curBid);
      if (!isNaN(val) && val >= nextBid) {
        session.autoBidMax = Math.min(val, user.purse);
        session.userPassed = false;
        const leading = (session.multiplayer?.active && session.multiplayer.room) ? session.multiplayer.room.leadingTeam : session.leadingTeam;
        if (leading !== user.code && session.autoBidMax >= nextBid) {
          if (session.multiplayer?.active) {
            mpAct("bid", { amount: nextBid });
          } else {
            placeBid(session.userTeam, nextBid);
            scheduleNextTick();
          }
        }
        updateAuctionRoomDOM();
      }
    },

    "auc-preset-autobid"(el) {
      const val = parseFloat(el.dataset.val);
      const user = userFranchise();
      const curBid = (session.multiplayer?.active && session.multiplayer.room) ? session.multiplayer.room.currentBid : session.currentBid;
      const nextBid = getNextBid(curBid);
      if (!isNaN(val) && val >= nextBid) {
        session.autoBidMax = Math.min(val, user.purse);
        session.userPassed = false;
        const leading = (session.multiplayer?.active && session.multiplayer.room) ? session.multiplayer.room.leadingTeam : session.leadingTeam;
        if (leading !== user.code && session.autoBidMax >= nextBid) {
          if (session.multiplayer?.active) {
            mpAct("bid", { amount: nextBid });
          } else {
            placeBid(session.userTeam, nextBid);
            scheduleNextTick();
          }
        }
        updateAuctionRoomDOM();
      }
    },

    "auc-cancel-autobid"() {
      session.autoBidMax = null;
      updateAuctionRoomDOM();
    },

    "auc-auto-bid"(el) {
      const val = parseFloat(el.value);
      session.autoBidMax = isNaN(val) ? null : val;
      if (session.autoBidMax != null) {
        session.userPassed = false;
        scheduleNextTick();
      }
    },

    "auc-sim-lot"() {
      session.speed = "instant";
      scheduleNextTick();
    },

    "auc-next-lot"() {
      if (session.multiplayer?.active) {
        mpAct("next-lot");
        return;
      }
      nextLot();
    },

    "auc-skip-set"() {
      if (session.multiplayer?.active) {
        mpAct("skip-set");
        return;
      }

      const lot = currentLot();
      if (!lot) return;
      const currentSet = lot.set;

      let nextIndex = session.lotIndex + 1;
      while (nextIndex < session.pool.length && session.pool[nextIndex].set === currentSet) {
        nextIndex++;
      }

      if (nextIndex >= session.pool.length) {
        if (confirm(`You have reached the end of all sets. Would you like to conclude the auction now?`)) {
          actions["auc-end-auction"]();
          return;
        }
        return;
      }

      stopTimer();
      // Randomize the first draw of the newly opened set
      const nextSet = session.pool[nextIndex]?.set || session.pool[nextIndex]?.category || "";
      const remainingInNextSet = [];
      for (let i = nextIndex; i < session.pool.length; i++) {
        const s = session.pool[i].set || session.pool[i].category || "";
        if (s === nextSet) remainingInNextSet.push(i);
      }
      if (remainingInNextSet.length > 0) {
        const pick = remainingInNextSet[Math.floor(Math.random() * remainingInNextSet.length)];
        if (pick !== nextIndex) {
          const tmp = session.pool[nextIndex];
          session.pool[nextIndex] = session.pool[pick];
          session.pool[pick] = tmp;
        }
      }

      const nextLotItem = session.pool[nextIndex];
      session.lotIndex = nextIndex;
      session.currentBid = nextLotItem.basePrice || 2.0;
      session.leadingTeam = null;
      session.gavelCount = 0;
      session.history = [];
      session.autoBidMax = null;
      session.userPassed = false;
      session.history.unshift({
        type: "call",
        text: `⏩ Mallika: Skipped remainder of ${currentSet}. Now opening ${nextLotItem.set} with ${nextLotItem.name}!`
      });
      playSound("gavel");
      save();
      parentRender();
      scheduleNextTick();
    },

    "auc-end-auction"() {
      if (!confirm("End the auction now? Current rosters will be finalized, and any team with fewer than 12 players will be automatically filled from the remaining pool so you can play immediately.")) {
        return;
      }
      stopTimer();

      if (session.multiplayer?.active) {
        mpAct("end-auction");
        return;
      }

      const availablePlayers = session.pool.slice(session.lotIndex);
      for (const code in session.franchises) {
        const f = session.franchises[code];
        while (f.squad.length < 12 && availablePlayers.length > 0) {
          const p = availablePlayers.shift();
          if (p.overseas && f.squad.filter(s => s.overseas).length >= 8) continue;
          const cost = Math.min(f.purse, p.basePrice || 2.0);
          f.purse = +(f.purse - cost).toFixed(2);
          const bought = {
            key: p.key,
            name: p.name,
            price: cost,
            role: p.role,
            category: p.category,
            overseas: p.overseas,
            overall: p.overall,
            team: code,
            retention: false
          };
          f.squad.push(bought);
          session.soldList.push(bought);
        }
      }

      session.phase = "squad";
      session.playingXI = buildPlayingXI(session.userTeam);
      playSound("sold");
      save();
      parentRender();
    },

    "auc-hub"() {
      stopTimer();
      session.phase = "hub";
      save();
      parentRender();
    },

    "auc-squad-view"() {
      stopTimer();
      session.phase = "squad";
      const xi = buildPlayingXI(session.userTeam);
      session.playingXI = (xi && xi.length >= 12) ? xi : (data.teams[userFranchise().name] || xi);
      save();
      parentRender();
    },

    "auc-reset"() {
      if (!confirm("Reset auction? All bids and acquired squads will be restored.")) return;
      stopTimer();
      session = initSession(session.mode);
      save();
      parentRender();
    },

    "auc-toggle-sound"() {
      session.sound = !session.sound;
      save();
      parentRender();
    },

    "auc-speed"(el) {
      session.speed = el.dataset.speed;
      save();
      parentRender();
    },

    "auc-view-pool"() {
      window._activePoolCat = "ALL";
      const isMp = session.multiplayer?.active;
      const mpRoom = session.multiplayer?.room;
      const activePool = (isMp && mpRoom?.pool) ? mpRoom.pool : session.pool;
      const soldList = (isMp && mpRoom?.soldList) ? mpRoom.soldList : session.soldList;
      const unsoldList = (isMp && mpRoom?.unsoldList) ? mpRoom.unsoldList : session.unsoldList;
      const soldMap = new Map((soldList || []).map(s => [s.key, s]));
      const unsoldSet = new Set((unsoldList || []).map(u => u.key));
      const curLot = currentLot();

      window._filterPoolList = function(q, cat) {
        if (cat) window._activePoolCat = cat;
        const currentCat = window._activePoolCat || "ALL";
        const query = (q !== undefined ? q : (document.getElementById("auc-pool-search")?.value || "")).toLowerCase().trim();
        const rows = document.querySelectorAll(".pool-player-row");
        let visible = 0;
        rows.forEach(r => {
          const name = r.dataset.name || "";
          const role = r.dataset.role || "";
          const pCat = r.dataset.cat || "";
          const pSet = r.dataset.set || "";
          const matchText = !query || name.includes(query) || role.includes(query);
          const matchCat = currentCat === "ALL" ||
            pCat === currentCat ||
            pSet.toLowerCase().includes(currentCat.toLowerCase()) ||
            (currentCat === "M1" && (pCat === "M1" || pSet.includes("Marquee Set 1"))) ||
            (currentCat === "M2" && (pCat === "M2" || pSet.includes("Marquee Set 2"))) ||
            (currentCat === "UNCAPPED" && (pCat.startsWith("U") || pSet.toLowerCase().includes("uncapped")));
          if (matchText && matchCat) {
            r.style.display = "flex";
            visible++;
          } else {
            r.style.display = "none";
          }
        });

        document.querySelectorAll(".pool-cat-chip").forEach(ch => {
          if (ch.dataset.cat === currentCat) {
            ch.classList.add("active");
          } else {
            ch.classList.remove("active");
          }
        });

        const countEl = document.getElementById("auc-pool-count");
        if (countEl) countEl.textContent = visible;
      };

      openSheet(`
        <div class="row between">
          <div>
            <h2>Auction Players Pool & Ratings</h2>
            <p class="muted">Showing <b id="auc-pool-count" style="color:var(--gold)">${activePool.length}</b> of <b>${activePool.length}</b> players in auction pool</p>
          </div>
          <button class="btn icon ghost" data-action="close-sheet">${icon("x")}</button>
        </div>

        <div class="stack" style="gap:12px;margin-top:14px">
          <input type="text" id="auc-pool-search" placeholder="Search by player name or role (e.g. Pant, Iyer, Rahul, spinner)..."
            style="width:100%;padding:10px 14px;background:var(--panel);border:1px solid var(--line);color:#fff;border-radius:10px;font-size:14px;"
            oninput="window._filterPoolList(this.value, null)" />

          <div class="chips-scroll-row" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;">
            ${[
              ["ALL", "All Sets"],
              ["M1", "Marquee 1"],
              ["M2", "Marquee 2"],
              ["BA1", "Batters"],
              ["WK1", "WKs"],
              ["AL1", "All-Rounders"],
              ["FA1", "Fast Bowlers"],
              ["SP1", "Spinners"],
              ["UNCAPPED", "Uncapped Sets"]
            ].map(([c, label]) => `
              <button class="chip pool-cat-chip ${c === "ALL" ? "active" : ""}" data-cat="${c}"
                onclick="window._filterPoolList(undefined, '${c}')">
                ${label}
              </button>
            `).join("")}
          </div>

          <div class="panel" style="padding:10px 14px;background:rgba(255,215,106,0.08);border:1px solid rgba(255,215,106,0.25);border-radius:10px;font-size:12px;color:var(--gold);line-height:1.4;">
            🎲 <b>BCCI Mystery Gavel Draw</b>: Each player from the active set is rolled at random when the gavel drops! Draw sequence is completely unpredictable to preserve auction room suspense.
          </div>

          <div style="max-height:60vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px;">
            ${(() => {
              const setOrder = ["M1", "M2", "BA1", "WK1", "AL1", "FA1", "SP1", "UBA1", "UWK1", "UAL1", "UFA1", "USP1"];
              const sorted = [...activePool].sort((a, b) => {
                const catA = a.category || "BA1", catB = b.category || "BA1";
                const idxA = setOrder.indexOf(catA), idxB = setOrder.indexOf(catB);
                if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
                return a.name.localeCompare(b.name);
              });

              return sorted.map((p, idx) => {
                let statusHtml = `<span class="badge" style="font-size:11px;background:rgba(255,255,255,0.06);color:var(--dim);">🎲 Mystery Roll</span>`;
                if (curLot && curLot.key === p.key) {
                  statusHtml = `<span class="badge star" style="font-size:11px;background:rgba(255,215,106,0.2);color:var(--gold);">🔴 Active on Podium</span>`;
                } else if (soldMap.has(p.key)) {
                  const s = soldMap.get(p.key);
                  statusHtml = `<span class="badge ok" style="font-size:11px;">Sold: ${esc(s.team)} (${formatPurse(s.price)})</span>`;
                } else if (unsoldSet.has(p.key)) {
                  statusHtml = `<span class="badge warn" style="font-size:11px;">Unsold</span>`;
                }

                return `
                  <div class="result-row pool-player-row"
                    data-name="${esc(p.name.toLowerCase())}"
                    data-role="${esc(p.role.toLowerCase())}"
                    data-cat="${p.category || ''}"
                    data-set="${esc(p.set || '')}"
                    style="padding:10px 14px;border-radius:10px;display:flex;align-items:center;justify-content:space-between;">
                    <span class="row" style="gap:12px;align-items:center;">
                      <span class="badge" style="width:32px;text-align:center;">${idx + 1}</span>
                      <span class="stack" style="gap:2px;">
                        <b>${esc(p.name)}</b>
                        <span class="muted" style="font-size:12px">${p.role} · ${p.overseas ? "✈️ Overseas" : "🇮🇳 India"} · <b style="color:var(--gold)">${esc(p.set || p.category)}</b></span>
                      </span>
                    </span>
                    <span class="row" style="gap:12px;align-items:center;">
                      ${statusHtml}
                      <span class="muted" style="font-size:12px">Base: <b>${formatPurse(p.basePrice || 2.0)}</b></span>
                      <span class="badge" style="background:rgba(255,255,255,0.06);color:var(--dim);font-size:11px;">★ Scouted</span>
                    </span>
                  </div>
                `;
              }).join("");
            })()}
          </div>
        </div>
      `, "Auction Pool");

      return false;
    },

    "auc-view-franchises"() {
      openSheet(`
        <div class="row between">
          <h2>IPL Franchises Live Dashboard</h2>
          <button class="btn icon ghost" data-action="close-sheet">${icon("x")}</button>
        </div>
        <div style="overflow-x:auto;margin-top:14px;">
          <table class="franchise-leaderboard-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Purse Left</th>
                <th>Squad</th>
                <th>Overseas</th>
                <th>RTM</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(session.franchises).map(f => `
                <tr class="${f.code === session.userTeam ? "active-user" : ""}">
                  <td>
                    <span class="row" style="gap:8px;align-items:center;">
                      <span class="retention-pill star" style="background:${f.a};color:#fff">${f.ab}</span>
                      <b>${esc(f.name)}</b>
                    </span>
                  </td>
                  <td><b style="color:var(--gold)">${formatPurse(f.purse)}</b></td>
                  <td>${f.squad.length} / 25</td>
                  <td>${f.squad.filter(p => p.overseas).length} / 8</td>
                  <td>${f.rtm}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        <div class="row" style="margin-top:20px;justify-content:center">
          <button class="btn ghost" data-action="close-sheet">Close</button>
        </div>
      `, "Franchises Status");
      return false;
    },

    "auc-play-tournament"() {
      const user = userFranchise();
      const xiCandidates = buildPlayingXI(session.userTeam);
      const xi = session.playingXI || (xiCandidates && xiCandidates.length >= 12 ? xiCandidates : data.teams[user.name]) || [];

      if (xi.length < 12) {
        alert("Please assemble at least 12 players in your squad before starting the tournament!");
        return false;
      }

      const overseasCount = xi.map(k => card(k)).filter(c => c && c.overseas).length;
      if (overseasCount > 4) {
        alert(`Your Playing XI has ${overseasCount} overseas players! Official IPL limit is maximum 4.`);
        return false;
      }

      const userVenue = user.venue || "Wankhede, Mumbai";
      const userObj = {
        name: user.name,
        players: xi,
        venue: userVenue,
        chem: chemistry(xi.map(k => card(k))),
        shift: shifts(xi.map(k => card(k))),
        away: { players: xi, shift: shifts(xi.map(k => card(k))) }
      };

      const opponents = Object.values(session.franchises)
        .filter(f => f.code !== session.userTeam)
        .map(f => {
          let oppXI = buildPlayingXI(f.code);
          if (oppXI.length < 12) {
            oppXI = data.teams[f.name] || oppXI;
          }
          return {
            name: f.name,
            players: oppXI,
            venue: f.venue || "Motera, Ahmedabad"
          };
        });

      const ast = appState();
      ast.screen = "season";
      ast.name = user.name;
      ast.venue = userVenue;
      ast.order = xi;
      ast.opponents = opponents.map(o => o.name);
      ast.seasonSeed = Math.floor(Math.random() * 1000000);
      ast.played = 0;
      ast.tab = "table";

      window._auctionTournamentTeams = [userObj, ...opponents];
      parentRender();
    }
  };

  // --- SCREENS ---
  const screens = {
    // 0. Auction Mode Selector Screen
    mode() {
      return `
        <div class="auction-hub" style="max-width:960px;">
          <div class="auction-hero" style="text-align:center;">
            <span class="auction-badge">${icon("gavel")} IPL Auction 2026</span>
            <h1>Select Your <em>Auction Format</em></h1>
            <p>Customize retentions under official BCCI regulations, start a fresh draft, or play with all-time cricket legends.</p>
          </div>

          <div class="mode-selection-grid">
            <!-- Mode 1: 2026 Official Retentions -->
            <div class="mode-card ${session.mode === "retentions_2026" ? "selected" : ""}" data-action="auc-select-mode" data-mode="retentions_2026">
              <div class="mode-card-header">
                <div class="mode-icon-circle gold">${icon("shield-check")}</div>
                <div class="mode-title-block">
                  <span class="badge star">Customizable 2026</span>
                  <h3>IPL 2026 Retentions</h3>
                </div>
              </div>
              <p class="mode-desc">Choose your franchise retentions! Pick up to 6 players from your team roster under official BCCI deduction slabs. Real 2026 players in the auction pool.</p>
              <div class="mode-stats-row">
                <div class="mode-stat-pill"><b>Custom</b> Retentions</div>
                <div class="mode-stat-pill"><b>~350</b> Pool Size</div>
                <div class="mode-stat-pill"><b>2026</b> Stars</div>
              </div>
              <button class="btn ${session.mode === "retentions_2026" ? "primary" : "ghost"} full" data-action="auc-select-mode" data-mode="retentions_2026">
                ${session.mode === "retentions_2026" ? "Selected (Continue)" : "Select 2026 Retentions"}
              </button>
            </div>

            <!-- Mode 2: 2026 Mega Auction -->
            <div class="mode-card ${session.mode === "mega_2026" ? "selected" : ""}" data-action="auc-select-mode" data-mode="mega_2026">
              <div class="mode-card-header">
                <div class="mode-icon-circle purple">${icon("crown")}</div>
                <div class="mode-title-block">
                  <span class="badge">BCCI Regulation</span>
                  <h3>2026 Mega Auction (Max 6)</h3>
                </div>
              </div>
              <p class="mode-desc">Classic IPL mega auction structure. Each franchise retains up to 6 players from 2026 squads under BCCI salary slabs (18/14/11/18/14/4). Non-retained enter the pool.</p>
              <div class="mode-stats-row">
                <div class="mode-stat-pill"><b>Max 6</b> Retentions</div>
                <div class="mode-stat-pill"><b>BCCI</b> Slabs</div>
                <div class="mode-stat-pill"><b>Dynamic</b> RTM</div>
              </div>
              <button class="btn ${session.mode === "mega_2026" ? "primary" : "ghost"} full" data-action="auc-select-mode" data-mode="mega_2026">
                ${session.mode === "mega_2026" ? "Selected (Continue)" : "Select 2026 Mega"}
              </button>
            </div>

            <!-- Mode 3: 2026 Full Auction -->
            <div class="mode-card ${session.mode === "full_2026" ? "selected" : ""}" data-action="auc-select-mode" data-mode="full_2026">
              <div class="mode-card-header">
                <div class="mode-icon-circle blue">${icon("lightning")}</div>
                <div class="mode-title-block">
                  <span class="badge ok">Clean Slate</span>
                  <h3>2026 Full Auction (No Retentions)</h3>
                </div>
              </div>
              <p class="mode-desc">Zero retentions! Every single 2026 IPL player — Virat Kohli, Jasprit Bumrah, Heinrich Klaasen, Kagiso Rabada, Shubman Gill — enters the pool with full ₹120.00 Cr purses.</p>
              <div class="mode-stats-row">
                <div class="mode-stat-pill"><b>0</b> Retentions</div>
                <div class="mode-stat-pill"><b>379</b> 2026 Players</div>
                <div class="mode-stat-pill"><b>₹120 Cr</b> All Teams</div>
              </div>
              <button class="btn ${session.mode === "full_2026" ? "primary" : "ghost"} full" data-action="auc-select-mode" data-mode="full_2026">
                ${session.mode === "full_2026" ? "Selected (Continue)" : "Select 2026 Full"}
              </button>
            </div>

            <!-- Mode 4: Legacy Legends Auction -->
            <div class="mode-card ${session.mode === "legacy" ? "selected" : ""}" data-action="auc-select-mode" data-mode="legacy">
              <div class="mode-card-header">
                <div class="mode-icon-circle gold">${icon("trophy")}</div>
                <div class="mode-title-block">
                  <span class="badge star">All-Time Greats</span>
                  <h3>Legacy Legends Auction</h3>
                </div>
              </div>
              <p class="mode-desc">Historic IPL superstars separate from 2026 mode! Draft Chris Gayle, AB de Villiers, Anil Kumble, Lasith Malinga, Jacques Kallis, Suresh Raina, Dale Steyn, and more.</p>
              <div class="mode-stats-row">
                <div class="mode-stat-pill"><b>All-Time</b> Legends</div>
                <div class="mode-stat-pill"><b>Gayle / ABD</b></div>
                <div class="mode-stat-pill"><b>₹120 Cr</b> Purse</div>
              </div>
              <button class="btn ${session.mode === "legacy" ? "primary" : "ghost"} full" data-action="auc-select-mode" data-mode="legacy">
                ${session.mode === "legacy" ? "Selected (Continue)" : "Select Legacy Mode"}
              </button>
            </div>
          </div>

          <div class="row" style="justify-content:center;margin-top:12px;">
            <button class="btn ghost" data-action="auc-hub">${icon("arrow-left")} Back to Hub</button>
          </div>
        </div>
      `;
    },

    // 1. Hub Screen
    hub() {
      const user = userFranchise();
      const modeInfo = AUCTION_MODES[session.mode] || AUCTION_MODES.retentions_2026;

      return `
        <div class="auction-hub">
          <div class="auction-hero">
            <div class="row between" style="align-items:flex-start;">
              <span class="auction-badge">${icon("gavel")} IPL Auction · <b style="color:#fff">${modeInfo.name}</b></span>
              <div class="row" style="gap:8px;">
                <button class="btn primary small" data-action="auc-multiplayer-hub" style="font-size:13px;padding:6px 14px;border-radius:999px;">
                  ${icon("users-three")} Play with Friends
                </button>
                <button class="btn ghost small" data-action="auc-mode-screen" style="font-size:12px;padding:6px 12px;border-radius:999px;">
                  ${icon("arrows-clockwise")} Switch Mode
                </button>
              </div>
            </div>
            <h1>Command Your Franchise in the <em>Auction Room</em></h1>
            <p>${modeInfo.desc}</p>
            <div class="row" style="gap:12px;flex-wrap:wrap">
              <button class="btn primary big" data-action="auc-start-room">${icon("play")} Enter Auction Room</button>
              <button class="btn ghost" data-action="auc-choose-retentions" style="color:var(--gold);border-color:rgba(255,215,106,0.4)">
                ${icon("sparkle")} Choose Retentions (${user.retentions.length})
              </button>
              <button class="btn ghost" data-action="auc-view-pool">${icon("magnifying-glass")} Pool & Ratings (${session.pool.length})</button>
              <button class="btn ghost" data-action="auc-squad-view">${icon("users-three")} View Squad (${user.squad.length})</button>
              <button class="btn ghost" data-action="auc-reset" style="color:var(--hot2)">${icon("arrow-counter-clockwise")} Reset</button>
            </div>
            <div class="row" style="gap:8px;align-items:center;margin-top:10px;">
              <span class="muted" style="font-size:12px;font-weight:600;">⏱️ Bid Clock:</span>
              <button type="button" class="btn small ${(session.bidTimer || 10) === 10 ? 'primary' : 'ghost'}" data-action="auc-set-bid-timer" data-timer="10">10 Seconds (Standard)</button>
              <button type="button" class="btn small ${(session.bidTimer || 10) === 5 ? 'primary' : 'ghost'}" data-action="auc-set-bid-timer" data-timer="5">5 Seconds (Blitz)</button>
            </div>
          </div>

          <div class="stack" style="gap:12px">
            <div class="row between">
              <div>
                <h2>Choose Your Franchise</h2>
                <p class="muted" style="font-size:13px">Managing: <b style="color:var(--gold)">${esc(user.name)}</b> · Purse: <b>${formatPurse(user.purse)}</b> · RTMs: <b>${user.rtm}</b></p>
              </div>
              <button class="btn ghost" data-action="auc-view-franchises">${icon("table")} All 10 Teams</button>
            </div>

            <div class="franchise-grid">
              ${Object.values(session.franchises).map(f => `
                <div class="franchise-card ${f.code === session.userTeam ? "selected" : ""}" data-action="auc-select-team" data-code="${f.code}">
                  <div class="franchise-card-header">
                    <div class="franchise-crest" style="background:${f.a};color:#fff">${f.ab}</div>
                    <div class="franchise-name-block">
                      <h3>${esc(f.name)}</h3>
                      <span>${esc(f.venue.split(",")[0])}</span>
                    </div>
                  </div>
                  <div class="franchise-stats">
                    <div class="franchise-stat-item">
                      <b>${formatPurse(f.purse)}</b>
                      <span>Purse Left</span>
                    </div>
                    <div class="franchise-stat-item">
                      <b>${f.rtm}</b>
                      <span>RTM Cards</span>
                    </div>
                    <div class="franchise-stat-item">
                      <b>${f.retentions.length}</b>
                      <span>Retained</span>
                    </div>
                  </div>
                  <div class="franchise-retentions-summary">
                    ${f.retentions.length === 0 ? `<span class="muted" style="font-size:11px;">0 retentions (Full 120 Cr purse)</span>` :
                      f.retentions.slice(0, 3).map(r => `
                        <span class="retention-pill ${r.price >= 15 ? "star" : ""}">
                          ${esc(r.name.split(" ").slice(-1)[0])} · ${r.role === "bowler" ? "Bowler" : r.role === "all-rounder" ? "All-Rounder" : "Batter"}
                        </span>
                      `).join("")}
                    ${f.retentions.length > 3 ? `<span class="retention-pill">+${f.retentions.length - 3} more</span>` : ""}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `;
    },

    // 2. Multiplayer Hub Screen (Create or Join)
    "mp-hub"() {
      return `
        <div class="auction-hub" style="max-width:800px;">
          <div class="auction-hero" style="text-align:center;">
            <span class="auction-badge">${icon("users-three")} Real-Time Multiplayer Auction</span>
            <h1>Play With <em>Your Friends</em></h1>
            <p>Host an auction room or join your friends' room. Pick your franchise, choose your retentions, chat, and battle in real-time live bidding wars!</p>
          </div>

          <div class="mode-selection-grid" style="grid-template-columns:1fr 1fr;">
            <!-- Create Room -->
            <div class="mode-card selected">
              <div class="mode-card-header">
                <div class="mode-icon-circle gold">${icon("plus-circle")}</div>
                <div class="mode-title-block">
                  <span class="badge star">Host</span>
                  <h3>Create Auction Room</h3>
                </div>
              </div>
              <p class="mode-desc">Create a room, choose format, and share the 4-letter code or invite link with friends.</p>
              <div class="stack" style="gap:10px;margin-top:6px;">
                <input type="text" id="mp-host-name" value="Host" placeholder="Your Name"
                  style="padding:8px 12px;background:var(--panel);border:1px solid var(--line);color:#fff;border-radius:8px;font-size:14px;" />
                <label style="font-size:12px;color:var(--dim);margin-top:2px;">Select Your Franchise:</label>
                <div class="mp-team-picker-grid">
                  ${Object.values(session.franchises).map(f => {
                    const isSel = f.code === session.userTeam;
                    return `
                      <button type="button" class="mp-team-pick-btn ${isSel ? "selected" : ""}"
                        data-action="auc-select-team" data-code="${f.code}"
                        style="--team-c:${f.a};">
                        <span class="mp-pick-crest" style="background:${f.a};color:#fff;">${f.ab}</span>
                        <span class="mp-pick-name">${f.name}</span>
                        ${isSel ? `<span class="mp-pick-check">✓</span>` : ""}
                      </button>
                    `;
                  }).join("")}
                </div>
                <input type="hidden" id="mp-host-team" value="${session.userTeam}" />
                <label style="font-size:12px;color:var(--dim);margin-top:4px;">Bid Clock Timer:</label>
                <div class="row" style="gap:8px;">
                  <button type="button" class="btn small ${(session.bidTimer || 10) === 10 ? 'primary' : 'ghost'}" data-action="auc-select-create-timer" data-timer="10">⏱️ 10s (Standard)</button>
                  <button type="button" class="btn small ${(session.bidTimer || 10) === 5 ? 'primary' : 'ghost'}" data-action="auc-select-create-timer" data-timer="5">⚡ 5s (Blitz)</button>
                </div>
                <button class="btn primary full" data-action="auc-create-room" style="margin-top:6px;">
                  ${icon("play")} Create Room
                </button>
              </div>
            </div>

            <!-- Join Room -->
            <div class="mode-card">
              <div class="mode-card-header">
                <div class="mode-icon-circle blue">${icon("sign-in")}</div>
                <div class="mode-title-block">
                  <span class="badge ok">Join</span>
                  <h3>Join Friend's Room</h3>
                </div>
              </div>
              <p class="mode-desc">Enter the room code shared by your friend, or click their invite link to jump in directly.</p>
              <div class="stack" style="gap:10px;margin-top:6px;">
                <button class="btn ghost full big" data-action="auc-join-prompt" style="padding:14px;font-size:16px;">
                  ${icon("key")} Enter Room Code
                </button>
              </div>
            </div>
          </div>

          <div class="row" style="justify-content:center;margin-top:12px;">
            <button class="btn ghost" data-action="auc-hub">${icon("arrow-left")} Back to Single Player</button>
          </div>
        </div>
      `;
    },

    // 3. Multiplayer Lobby Screen
    "mp-lobby"() {
      const room = session.multiplayer.room;
      if (!room) return screens.hub();

      const myId = session.multiplayer.playerId;
      const me = room.players.find(p => p.id === myId) || { name: "You", team: session.userTeam, isHost: false, ready: false };
      const isHost = me.isHost;
      const myFranchise = room.franchises[me.team] || session.franchises[me.team];
      const takenTeams = new Map(room.players.map(p => [p.team, p]));

      return `
        <div class="auction-hub" style="max-width:960px;">
          <!-- Room Header Bar -->
          <div class="auction-hero" style="padding:20px 24px;">
            <div class="row between" style="flex-wrap:wrap;gap:12px;align-items:center;">
              <div>
                <span class="auction-badge">${icon("users-three")} Multiplayer Room · <b style="color:#fff">${room.code}</b></span>
                <h1 style="font-size:28px;margin:4px 0 0;">Lobby · <em>${AUCTION_MODES[room.mode]?.name || "IPL Auction"}</em></h1>
              </div>
              <div class="row" style="gap:8px;">
                <button class="btn primary small" data-action="auc-copy-link" style="border-radius:999px;">
                  ${icon("copy")} Copy Invite Link
                </button>
                <button class="btn ghost small" data-action="auc-leave-room" style="color:var(--hot2);border-radius:999px;">
                  Leave
                </button>
              </div>
            </div>
          </div>

          <div class="mp-lobby-grid">
            <!-- Left: Players & Franchise Selection -->
            <div class="stack" style="gap:16px;">
              <!-- Room Lineup Breakdown Banner -->
              <div class="row between" style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:12px;padding:12px 16px;align-items:center;">
                <div class="row" style="gap:8px;align-items:center;">
                  <span class="badge star" style="font-size:12px;">👥 ${room.players.length} Human Players</span>
                  <span class="badge ok" style="font-size:12px;">🤖 ${Math.max(0, 10 - room.players.length)} AI Teams</span>
                </div>
                <span class="muted" style="font-size:12px;">10 IPL Franchises Total</span>
              </div>

              <!-- Connected Human Players -->
              <div class="podium-box" style="padding:18px;">
                <div class="row between" style="align-items:center;border-bottom:1px solid var(--line);padding-bottom:10px;">
                  <h3>Human Managers (${room.players.length})</h3>
                  <span class="badge ${me.ready ? "ok" : "star"}">${me.ready ? "✓ Ready" : "Choosing"}</span>
                </div>

                <div class="stack" style="gap:8px;margin-top:12px;">
                  ${room.players.map(p => {
                    const f = room.franchises[p.team];
                    return `
                      <div class="result-row" style="padding:10px 14px;border-radius:10px;align-items:center;">
                        <span class="row" style="gap:10px;align-items:center;">
                          <span class="retention-pill star" style="background:${f?.a || "#123f92"};color:#fff">${f?.ab || p.team}</span>
                          <b>${esc(p.name)}</b>
                          ${p.isHost ? `<span class="badge star" style="font-size:10px;">Host</span>` : ""}
                          ${p.id === myId ? `<span class="badge ok" style="font-size:10px;">You</span>` : ""}
                        </span>
                        <span class="row" style="gap:8px;align-items:center;">
                          <span class="muted" style="font-size:12px">${f?.retentions?.length || 0} Retained</span>
                          <span class="badge ${p.ready ? "ok" : ""}">${p.ready ? "✓ Ready" : "In Lobby"}</span>
                          <span class="muted" style="font-size:12px">${formatPurse(f?.purse || 120)}</span>
                        </span>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>

              <!-- Franchise Selection & Status -->
              <div class="podium-box" style="padding:18px;">
                <div class="row between" style="align-items:center;border-bottom:1px solid var(--line);padding-bottom:10px;">
                  <div>
                    <h3>10 IPL Franchises (Human vs AI)</h3>
                    <span class="muted" style="font-size:12px;">Click any unclaimed franchise to manage it</span>
                  </div>
                </div>

                <div class="mp-lobby-teams-grid">
                  ${Object.values(room.franchises).map(f => {
                    const claimed = takenTeams.get(f.code);
                    const isMine = me.team === f.code;
                    return `
                      <button type="button" class="mp-lobby-team-card ${isMine ? "selected" : ""} ${claimed && !isMine ? "claimed" : ""}"
                        ${claimed && !isMine ? "disabled" : ""}
                        data-action="auc-select-team" data-code="${f.code}"
                        style="--t-color:${f.a};">
                        <span class="mp-card-crest" style="background:${f.a};color:#fff">${f.ab}</span>
                        <div class="mp-card-info">
                          <b class="mp-card-name">${f.name}</b>
                          <span class="mp-card-sub">${formatPurse(f.purse)} · ${f.retentions?.length || 0} Retained</span>
                        </div>
                        <div class="mp-card-badge-wrap">
                          ${isMine ? `<span class="badge ok" style="font-weight:700">✓ You</span>` :
                            claimed ? `<span class="badge star" style="font-size:11px;">👤 ${esc(claimed.name)}</span>` :
                            `<span class="badge" style="background:rgba(255,255,255,0.08);color:var(--dim);font-size:11px;">🤖 AI</span>`}
                        </div>
                      </button>
                    `;
                  }).join("")}
                </div>
              </div>

              <!-- Retentions & Ready Bar -->
              <div class="podium-box" style="padding:18px;">
                <div class="row between" style="align-items:flex-start;flex-wrap:wrap;gap:12px;">
                  <div>
                    <span class="muted" style="font-size:12px">Your Team: <b style="color:#fff">${myFranchise.name}</b></span>
                    <div style="font-size:15px;margin-top:2px;">Purse: <b style="color:var(--gold)">${formatPurse(myFranchise.purse)}</b> · Retained: <b>${myFranchise.retentions?.length || 0} / 6</b></div>
                    <p class="muted" style="font-size:11px;margin:4px 0 0;max-width:380px;">
                      ✨ You choose ALL retentions for your team (0-6). The other ${Math.max(0, 10 - room.players.length)} AI teams will auto-select retentions on start.
                    </p>
                  </div>
                  <div class="row" style="gap:10px;align-items:center;">
                    <button class="btn ghost" data-action="auc-choose-retentions" style="color:var(--gold);border-color:rgba(255,215,106,0.4);">
                      ${icon("sparkle")} Choose Retentions (${myFranchise.retentions?.length || 0})
                    </button>
                    <button class="btn ${me.ready ? "ghost" : "primary"}" data-action="auc-mp-toggle-ready">
                      ${me.ready ? "✓ Ready" : "Set Ready"}
                    </button>
                  </div>
                </div>

                ${isHost ? `
                  <div class="row between" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px;align-items:center;flex-wrap:wrap;gap:8px;">
                    <div class="row" style="gap:8px;align-items:center;">
                      <span class="muted" style="font-size:12px;font-weight:600;">⏱️ Bid Clock:</span>
                      <button type="button" class="btn small ${(room.bidTimer || 10) === 10 ? 'primary' : 'ghost'}" data-action="auc-set-bid-timer" data-timer="10">10 Seconds (Standard)</button>
                      <button type="button" class="btn small ${(room.bidTimer || 10) === 5 ? 'primary' : 'ghost'}" data-action="auc-set-bid-timer" data-timer="5">5 Seconds (Blitz)</button>
                    </div>
                    <span class="muted" style="font-size:11px;">Current: <b>${room.bidTimer || 10}s per bid</b></span>
                  </div>
                  <div class="row" style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px;justify-content:space-between;align-items:center;">
                    <span class="muted" style="font-size:12px;">${room.players.length} human player(s) · AI plays remaining ${10 - room.players.length} team(s)</span>
                    <button class="btn primary big" data-action="auc-mp-start-auction" style="font-size:16px;padding:12px 24px;">
                      ${icon("play")} Launch Live Auction
                    </button>
                  </div>
                ` : `
                  <p class="muted" style="text-align:center;font-size:13px;margin:12px 0 0;">Waiting for Host (${esc(room.players.find(p => p.isHost)?.name || "Host")}) to start the auction... (Bid Timer: <b>${room.bidTimer || 10}s</b>)</p>
                `}
              </div>
            </div>

            <!-- Right: Real-Time In-Room Chat -->
            <div class="feed-box" style="height:auto;max-height:560px;">
              <div class="feed-header">
                <span>Room Live Chat</span>
                <span class="badge ok">${room.code}</span>
              </div>
              <div class="feed-list" id="mp-lobby-chat-list" style="flex:1;min-height:300px;max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
                ${room.chat.map(m => `
                  <div class="feed-item" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:6px 10px;">
                    <div class="row between" style="width:100%;font-size:11px;">
                      <span style="font-weight:700;color:${m.team ? "var(--gold)" : "var(--dim)"}">${m.team ? `[${m.team}] ` : ""}${esc(m.sender)}</span>
                      <span class="muted">${m.time}</span>
                    </div>
                    <span style="font-size:13px;word-break:break-word;">${esc(m.text)}</span>
                  </div>
                `).join("")}
              </div>
              <div class="row" style="gap:8px;margin-top:10px;">
                <input type="text" id="mp-chat-input" placeholder="Chat with room..."
                  style="flex:1;padding:8px 12px;background:var(--panel);border:1px solid var(--line);color:#fff;border-radius:8px;font-size:13px;"
                  onkeydown="if(event.key==='Enter') document.querySelector('[data-action=auc-send-chat]').click();" />
                <button class="btn primary small" data-action="auc-send-chat">Send</button>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    // 4. Live Auction Room (Supports both Single Player & Multiplayer!)
    room() {
      const lot = currentLot();
      if (!lot) return screens.summary();

      const user = userFranchise();
      const isMp = session.multiplayer?.active;
      const mpRoom = session.multiplayer?.room;
      const curBid = isMp && mpRoom ? mpRoom.currentBid : session.currentBid;
      const leadingTeam = isMp && mpRoom ? mpRoom.leadingTeam : session.leadingTeam;
      const gavelCount = isMp && mpRoom ? mpRoom.gavelCount : session.gavelCount;
      const historyList = isMp && mpRoom ? mpRoom.history : session.history;
      const nextBid = getNextBid(curBid);
      const isLeading = leadingTeam === user.code;
      const leadingF = leadingTeam ? (isMp ? mpRoom.franchises[leadingTeam] : session.franchises[leadingTeam]) : null;
      const isSold = gavelCount >= 3;
      const isUnsold = gavelCount === -1;
      const isHost = !isMp || (isMp && mpRoom?.players?.find(p => p.id === session.multiplayer.playerId)?.isHost);
      const c = card(lot.key);

      // Squad limits and overseas safety checks
      const userSquad = user?.squad || [];
      const overseasCount = userSquad.filter(p => p.overseas).length;
      const isOverseasCapped = lot.overseas && overseasCount >= 8;
      const isSquadCapped = userSquad.length >= 25;
      const neededSlots = Math.max(0, 18 - userSquad.length - 1);
      const minReserve = +(neededSlots * 0.30).toFixed(2);
      const isPurseShort = (user.purse - nextBid) < minReserve;
      const cannotBid = isLeading || user.purse < nextBid || isOverseasCapped || isSquadCapped;

      return `
        <div class="auction-stage">
          <div class="stage-main">
            <!-- Podium Header with Timer & Controls -->
            <div class="podium-box">
              <div class="podium-header">
                <div class="auctioneer-info">
                  <div class="gavel-icon-wrap ${gavelCount > 0 ? "strike" : ""}">${icon("gavel")}</div>
                  <div class="auctioneer-status">
                    <h4>Mallika Sagar · Auctioneer</h4>
                    <span>Lot #${(isMp ? mpRoom.lotIndex : session.lotIndex) + 1} of ${(isMp ? mpRoom.pool : session.pool).length} · <b style="color:var(--gold)">${esc(lot.set)}</b></span>
                  </div>
                </div>
                <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center;">
                  <div class="bid-timer-pill ${bidTimeRemaining <= 3 ? "urgent" : ""}" id="auc-bid-timer-pill">
                    ⏱️ <b id="auc-bid-timer-val">${bidTimeRemaining}s</b>
                  </div>
                  ${isHost ? `
                    <button class="host-ctrl-btn" data-action="auc-toggle-bid-timer" title="Toggle between 10s and 5s timer">⏱️ ${session.bidTimer || 10}s</button>
                  ` : ""}
                  <button class="host-ctrl-btn" data-action="auc-skip-set" title="Skip remaining players in this set">⏩ Skip Set</button>
                  <button class="host-ctrl-btn danger" data-action="auc-end-auction" title="End auction & proceed to squad">🏁 End Auction</button>
                  <button class="btn icon ghost" data-action="auc-view-pool" title="View Full Pool & Ratings">${icon("list")}</button>
                  <button class="btn icon ghost" data-action="auc-toggle-sound" title="Toggle Sound">${icon(session.sound ? "speaker-high" : "speaker-slash")}</button>
                  <button class="btn icon ghost" data-action="auc-view-franchises" title="Franchises Status">${icon("chart-bar")}</button>
                  <button class="btn icon ghost" data-action="${isMp ? "auc-leave-room" : "auc-hub"}" title="Exit">${icon("x")}</button>
                </div>
              </div>

              <!-- Live Countdown Progress Bar & Shot Clock -->
              <div class="bid-timer-container">
                <div class="bid-timer-row">
                  <span class="bid-clock-label">⏱️ BID SHOT CLOCK</span>
                  <span class="bid-clock-countdown" id="auc-bid-clock-text">${bidTimeRemaining}s</span>
                </div>
                <div class="bid-timer-bar">
                  <div class="bid-timer-bar-fill ${bidTimeRemaining <= 3 ? "urgent" : bidTimeRemaining <= 5 ? "warning" : ""}" id="auc-bid-timer-bar"
                    style="width:${((bidTimeRemaining / (isMp && mpRoom?.bidTimer ? mpRoom.bidTimer : (session.bidTimer || 10))) * 100).toFixed(1)}%"></div>
                </div>
              </div>

              <!-- Live Bid Display -->
              <div class="bid-spotlight">
                <div>
                  <span class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Current High Bid</span>
                  <div class="current-bid-amount">${formatPurse(curBid)}</div>
                </div>
                <div class="current-bid-team">
                  ${leadingF ? `
                    <div class="bid-team-crest" style="background:${leadingF.a}">${leadingF.ab}</div>
                    <div>
                      <div class="row" style="gap:6px;align-items:center;">
                        <b style="font-size:16px;color:#fff">${esc(leadingF.name)}</b>
                        ${leadingF.code === user.code ? `<span class="badge ok" style="font-size:10px;">You</span>` :
                          (isMp && mpRoom?.players?.find(p => p.team === leadingTeam)) ? `<span class="badge star" style="font-size:10px;">${esc(mpRoom.players.find(p => p.team === leadingTeam).name)}</span>` :
                          (isMp ? `<span class="badge" style="font-size:10px;background:#334155;color:#cbd5e1;">🤖 AI Bot</span>` : "")}
                      </div>
                      <div class="muted" style="font-size:12px">${leadingF.code === user.code ? "🌟 You are leading the bid" : (isMp && mpRoom?.players?.find(p => p.team === leadingTeam) ? `👤 Human bidder is in the lead` : (isMp ? `🤖 Counter-bid by AI bot` : `In the lead`))}</div>
                    </div>
                  ` : `
                    <span class="muted" style="font-size:14px">Opening at base price</span>
                  `}
                </div>
              </div>

              <!-- Gavel Status Bar -->
              <div class="bid-call-ticker">
                <span>
                  ${isSold ? `🔨 <b style="color:var(--win)">SOLD to ${leadingF?.name || leadingTeam} for ${formatPurse(curBid)}!</b>` :
                    isUnsold ? `❌ <b style="color:var(--warn)">UNSOLD at ${formatPurse(lot.basePrice || 2.0)}</b>` :
                    gavelCount === 2 ? `⚠️ Going twice at ${formatPurse(curBid)}...` :
                    gavelCount === 1 ? `⏳ Going once at ${formatPurse(curBid)}...` :
                    `🎯 Bidding is active. Next minimum bid: <b>${formatPurse(nextBid)}</b>`}
                </span>
                <span class="muted" style="font-size:12px">Purse left: <b style="color:var(--gold)">${formatPurse(user.purse)}</b></span>
              </div>
            </div>

            <!-- Player Spotlight Card with Hidden Scores (Scouted Profile) -->
            <div class="player-spotlight-card">
              <div class="spotlight-card-left">
                ${c ? playerCard(c) : `
                  <div class="fc gold">
                    <span class="fc-ovr">★</span>
                    <b>${esc(lot.name)}</b>
                  </div>
                `}
              </div>
              <div class="spotlight-details">
                <span class="spotlight-set-tag">${icon("tag")} ${lot.category} · ${lot.overseas ? "✈️ Overseas" : "🇮🇳 India"} · ${lot.isLegacy ? "🌟 Legacy Legend" : "2026 IPL Player"}</span>
                <div class="row between" style="align-items:center;">
                  <h2>${esc(lot.name)}</h2>
                  <span class="spotlight-confidential-badge">${icon("shield-star")} Scouted Talent · Rating Hidden</span>
                </div>
                <div class="row" style="gap:8px;flex-wrap:wrap">
                  <span class="spotlight-prev-team ${lot.prevTeam ? "rtm-alert" : ""}">
                    ${lot.prevTeam ? `Ex-${esc(lot.prevTeam)} · RTM Eligible` : "Open Pool"}
                  </span>
                  <span class="spotlight-prev-team">Base Price: <b>${formatPurse(lot.basePrice || 2.0)}</b></span>
                </div>
                <div class="spotlight-stats-row">
                  <div class="spotlight-stat">
                    <b style="color:var(--team-primary, var(--gold))">${lot.set}</b>
                    <span>Auction Set</span>
                  </div>
                  <div class="spotlight-stat">
                    <b style="color:#fff">${lot.role?.toUpperCase()}</b>
                    <span>Role</span>
                  </div>
                  <div class="spotlight-stat">
                    <b style="color:var(--win)">${lot.styles?.[0] || (lot.category === "WK" ? "Wicketkeeper" : "Match Winner")}</b>
                    <span>Playstyle</span>
                  </div>
                  <div class="spotlight-stat">
                    <b style="color:var(--team-accent, #fff)">${lot.overseas ? "Overseas" : "Indian National"}</b>
                    <span>Category</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- User Bidding Controls -->
            <div class="bidding-controls">
              ${isSold || isUnsold ? `
                <div class="row" style="justify-content:center;gap:12px;align-items:center;">
                  <button class="paddle-btn-primary" data-action="auc-next-lot">${icon("skip-forward")} Next Player</button>
                  <button class="btn ghost" data-action="auc-squad-view">${icon("users-three")} View Squad</button>
                  <span class="muted" style="font-size:12px;">⏱️ Auto-advancing to next player in 2s...</span>
                </div>
              ` : `
                ${isOverseasCapped ? `
                  <div class="alert-pill danger" style="padding:6px 12px;border-radius:8px;background:rgba(239,68,68,0.15);border:1px solid #ef4444;color:#fca5a5;font-size:12px;text-align:center;margin-bottom:8px;">
                    ⚠️ Overseas limit reached (${overseasCount}/8). You cannot bid on overseas players.
                  </div>
                ` : lot.overseas && overseasCount === 7 ? `
                  <div class="alert-pill warning" style="padding:6px 12px;border-radius:8px;background:rgba(234,179,8,0.15);border:1px solid #eab308;color:#fef08a;font-size:12px;text-align:center;margin-bottom:8px;">
                    ⚠️ Final Overseas Slot: Winning this lot reaches your 8 overseas player cap.
                  </div>
                ` : isSquadCapped ? `
                  <div class="alert-pill danger" style="padding:6px 12px;border-radius:8px;background:rgba(239,68,68,0.15);border:1px solid #ef4444;color:#fca5a5;font-size:12px;text-align:center;margin-bottom:8px;">
                    ⚠️ Maximum squad size reached (${userSquad.length}/25 players).
                  </div>
                ` : isPurseShort && !isLeading ? `
                  <div class="alert-pill warning" style="padding:5px 10px;border-radius:8px;background:rgba(245,158,11,0.15);border:1px solid #f59e0b;color:#fde68a;font-size:11px;text-align:center;margin-bottom:8px;">
                    ⚠️ Purse Warning: Need ₹${minReserve.toFixed(2)} Cr reserve to reach minimum 18 players.
                  </div>
                ` : ""}

                <button class="paddle-btn-primary" data-action="auc-bid" ${cannotBid ? "disabled" : ""}>
                  ${icon("gavel")} RAISE PADDLE · ${formatPurse(nextBid)}
                </button>

                <div class="quick-increments-row">
                  <button class="quick-inc-btn" data-action="auc-quick-bid" data-inc="0.20" ${cannotBid || user.purse < curBid + 0.20 ? "disabled" : ""}>+20 Lakh</button>
                  <button class="quick-inc-btn" data-action="auc-quick-bid" data-inc="0.50" ${cannotBid || user.purse < curBid + 0.50 ? "disabled" : ""}>+50 Lakh</button>
                  <button class="quick-inc-btn" data-action="auc-quick-bid" data-inc="1.00" ${cannotBid || user.purse < curBid + 1.00 ? "disabled" : ""}>+1.00 Crore</button>
                  <button class="quick-inc-btn" data-action="auc-pass" style="color:var(--hot2)">Pass</button>
                </div>

                <!-- Rich Interactive Auto-Bid Controls -->
                <div class="autobid-container" id="auc-autobid-panel">
                  ${session.autoBidMax != null ? `
                    <div class="row between" style="align-items:center;">
                      <span class="autobid-active-pill">
                        🤖 Auto-Bid Active: Up to ₹${session.autoBidMax.toFixed(2)} Cr
                      </span>
                      <button type="button" class="btn ghost small" data-action="auc-cancel-autobid" style="color:var(--hot2);font-size:11px;padding:3px 8px;">✕ Cancel</button>
                    </div>
                  ` : `
                    <div class="row between" style="align-items:center;flex-wrap:wrap;gap:6px;">
                      <span class="muted" style="font-size:12px;font-weight:600;">🤖 Auto-Bid Ceiling:</span>
                      <div class="row" style="gap:6px;align-items:center;">
                        <input type="number" id="auc-autobid-input" step="0.5" min="${nextBid}" max="${user.purse}" placeholder="₹ Cr"
                          style="width:80px;padding:5px 8px;background:var(--panel);border:1px solid var(--line);color:#fff;border-radius:6px;font-size:12px;"
                          onkeydown="if(event.key==='Enter') document.querySelector('[data-action=auc-set-autobid-btn]').click();" />
                        <button type="button" class="btn small" data-action="auc-set-autobid-btn" style="padding:4px 8px;font-size:11px;">Set</button>
                      </div>
                    </div>
                    <div class="autobid-presets-row" style="margin-top:2px;">
                      <button type="button" class="autobid-preset-btn" data-action="auc-preset-autobid" data-val="${(curBid + 2).toFixed(2)}">+₹2 Cr</button>
                      <button type="button" class="autobid-preset-btn" data-action="auc-preset-autobid" data-val="${(curBid + 5).toFixed(2)}">+₹5 Cr</button>
                      <button type="button" class="autobid-preset-btn" data-action="auc-preset-autobid" data-val="10.00">Max ₹10 Cr</button>
                      <button type="button" class="autobid-preset-btn" data-action="auc-preset-autobid" data-val="15.00">Max ₹15 Cr</button>
                    </div>
                  `}
                </div>
              `}
            </div>
          </div>

          <!-- Bidding History & Live Chat Sidebar -->
          <div class="stage-sidebar">
            <!-- Feed Box -->
            <div class="feed-box">
              <div class="feed-header">
                <span>Auction Live Feed</span>
                <span class="badge ok">${isMp ? `ROOM ${mpRoom.code}` : session.speed.toUpperCase()}</span>
              </div>
              <div class="feed-list" id="auc-feed-list">
                ${isSold || isUnsold ? `
                  <div class="feed-item sold-summary ${isSold ? 'sold' : 'unsold'}" style="padding:14px;background:rgba(255,255,255,0.04);border-radius:10px;border-left:4px solid ${isSold ? 'var(--win)' : 'var(--warn)'};">
                    ${isSold ? `
                      <div class="stack" style="gap:4px;">
                        <span class="badge ok" style="align-self:flex-start;font-size:11px;">🔨 SOLD</span>
                        <b style="font-size:15px;color:#fff">${esc(lot.name)} sold to <span style="color:var(--gold)">${esc(leadingF?.name || leadingTeam)}</span></b>
                        <span style="font-size:13px;color:var(--win);font-weight:700;">Winning Bid: ${formatPurse(curBid)}</span>
                        <span class="muted" style="font-size:11px;margin-top:4px;">⏱️ Moving to next player automatically...</span>
                      </div>
                    ` : `
                      <div class="stack" style="gap:4px;">
                        <span class="badge warn" style="align-self:flex-start;font-size:11px;">❌ UNSOLD</span>
                        <b style="font-size:15px;color:#fff">${esc(lot.name)} remains unsold</b>
                        <span class="muted" style="font-size:12px;">Base price was ${formatPurse(lot.basePrice || 2.0)}</span>
                        <span class="muted" style="font-size:11px;margin-top:4px;">⏱️ Moving to next player automatically...</span>
                      </div>
                    `}
                  </div>
                ` : `
                  ${historyList.map(item => `
                    <div class="feed-item ${item.type}">
                      <span>${item.type === "bid" ? icon("hand-pointing") : item.type === "sold" ? icon("check-circle") : icon("radio-button")}</span>
                      <span>${esc(item.text)}</span>
                    </div>
                  `).join("")}
                `}
              </div>
            </div>

            ${isMp ? `
              <!-- Multiplayer In-Auction Chat -->
              <div class="feed-box" style="padding:12px;">
                <div class="row between" style="align-items:center;border-bottom:1px solid var(--line);padding-bottom:6px;">
                  <span style="font-size:13px;font-weight:700;">Room Chat</span>
                  <span class="badge star" style="font-size:10px;">${mpRoom.players.length} online</span>
                </div>
                <div id="mp-room-chat-list" style="max-height:150px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;margin-top:6px;">
                  ${mpRoom.chat.slice(-12).map(m => `
                    <div class="feed-item chat-bubble" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:4px 8px;font-size:12px;">
                      <div class="row between" style="width:100%;font-size:11px;">
                        <span style="font-weight:700;color:${m.team ? "var(--gold)" : "var(--dim)"}">${m.team ? `[${m.team}] ` : ""}${esc(m.sender)}</span>
                        <span class="muted" style="font-size:10px;">${m.time || ""}</span>
                      </div>
                      <span style="font-size:12px;word-break:break-word;">${esc(m.text)}</span>
                    </div>
                  `).join("")}
                </div>
                <div class="row" style="gap:6px;margin-top:8px;">
                  <input type="text" id="mp-chat-input" placeholder="Chat..."
                    style="flex:1;padding:6px 8px;background:var(--panel);border:1px solid var(--line);color:#fff;border-radius:6px;font-size:12px;"
                    onkeydown="if(event.key==='Enter') document.querySelector('[data-action=auc-send-chat]').click();" />
                  <button class="btn primary small" data-action="auc-send-chat">Send</button>
                </div>
              </div>
            ` : ""}

            <!-- Mini User Status Card -->
            <div class="podium-box" style="padding:16px;">
              <div class="row between">
                <span class="muted" style="font-size:13px">${user.name}</span>
                <span class="badge star">${user.ab}</span>
              </div>
              <div class="row between" style="margin-top:8px">
                <span>Purse Remaining:</span>
                <b id="auc-user-purse" style="color:var(--gold);font-size:16px">${formatPurse(user.purse)}</b>
              </div>
              <div class="row between" style="margin-top:4px">
                <span>Squad Count:</span>
                <b>${user.squad.length} / 25 players</b>
              </div>
              <div class="row between" style="margin-top:4px">
                <span>Overseas Count:</span>
                <b>${user.squad.filter(p => p.overseas).length} / 8 max</b>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    // 5. Squad & Playing XI Assembly
    squad() {
      const user = userFranchise();
      const xiCandidates = buildPlayingXI(session.userTeam);
      const xi = session.playingXI || (xiCandidates && xiCandidates.length >= 12 ? xiCandidates : data.teams[user.name]) || [];
      const overseasXI = xi.map(k => card(k)).filter(c => c && c.overseas).length;

      return `
        <div class="auction-hub">
          <div class="row between">
            <div>
              <h1>${esc(user.name)} Assembled Squad</h1>
              <p class="muted">Total Players: <b>${user.squad.length}</b> · Remaining Purse: <b style="color:var(--gold)">${formatPurse(user.purse)}</b> · Overseas in XI: <b style="color:${overseasXI > 4 ? "var(--hot2)" : "var(--win)"}">${overseasXI} / 4</b></p>
            </div>
            <div class="row" style="gap:10px">
              <button class="btn primary big" data-action="auc-play-tournament">${icon("trophy")} Play IPL Tournament</button>
              <button class="btn ghost" data-action="auc-start-room">${icon("gavel")} Auction Room</button>
              <button class="btn ghost" data-action="auc-hub">Hub</button>
            </div>
          </div>

          <!-- Playing XI Banner -->
          <div class="podium-box">
            <div class="row between">
              <h3>Matchday Playing XI & Impact Player (12 Players)</h3>
              <span class="badge ${overseasXI <= 4 ? "ok" : "uncapped"}">${overseasXI} / 4 Overseas</span>
            </div>
            <div class="stack" style="gap:8px;margin-top:10px">
              ${xi.map((key, i) => {
                const c = card(key);
                if (!c) return "";
                return `
                  <div class="result-row" style="padding:10px 14px;">
                    <span class="row" style="gap:12px;align-items:center;">
                      <b style="color:var(--gold);width:24px">${i + 1}</b>
                      <b>${esc(c.name)}</b>
                      <span class="muted">${c.role} · ${c.overseas ? "✈️ Overseas" : "🇮🇳 India"}</span>
                    </span>
                    <span class="row" style="gap:12px;align-items:center;">
                      ${renderRatingBadge(c.overall)}
                    </span>
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <!-- Complete Auction Purchases Table -->
          <div class="stack" style="gap:12px">
            <h2>Complete Squad Roster (${user.squad.length} Players)</h2>
            <div style="overflow-x:auto">
              <table class="franchise-leaderboard-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Acquisition</th>
                    <th>Cost</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  ${user.squad.map(p => `
                    <tr>
                      <td><b>${esc(p.name)}</b></td>
                      <td>${p.role}</td>
                      <td>${p.overseas ? "✈️ Overseas" : "🇮🇳 India"}</td>
                      <td><span class="retention-pill ${p.retention ? "star" : ""}">${p.retention ? "Retention" : "Auction Buy"}</span></td>
                      <td><b style="color:var(--gold)">${formatPurse(p.price)}</b></td>
                      <td>${renderRatingBadge(p.overall)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    },

    // 6. Post-Auction Summary & Records
    summary() {
      const topBuys = [...session.soldList].sort((a, b) => b.price - a.price).slice(0, 10);
      return `
        <div class="auction-hub">
          <div class="auction-hero">
            <span class="auction-badge">${icon("trophy")} Auction Complete</span>
            <h1>The Hammer Has Fallen!</h1>
            <p>All sets and lots have concluded. All 10 franchises have finalized their rosters for the upcoming IPL tournament season.</p>
            <div class="row" style="gap:12px">
              <button class="btn primary big" data-action="auc-squad-view">${icon("users-three")} Manage Squad & Play Season</button>
              <button class="btn ghost" data-action="auc-hub">${icon("house")} Auction Hub</button>
            </div>
          </div>

          <div class="stack" style="gap:14px">
            <h2>Top Buys of the Auction</h2>
            <div class="stack" style="gap:8px">
              ${topBuys.map((b, i) => `
                <div class="result-row" style="padding:12px 16px;">
                  <span class="row" style="gap:12px;align-items:center;">
                    <span class="badge ${i < 3 ? "star" : ""}">${i + 1}</span>
                    <b>${esc(b.name)}</b>
                    <span class="muted">${session.franchises[b.team]?.name || b.team}</span>
                  </span>
                  <span class="row" style="gap:14px;align-items:center;">
                    ${renderRatingBadge(b.overall)}
                    <b style="color:var(--gold);font-size:18px">${formatPurse(b.price)}</b>
                  </span>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `;
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("auc-autobid-input", e => {
      actions["auc-auto-bid"]({ value: e.detail });
    });

    // Mobile App Switch & Sleep Resilience: Auto-reconnect on visibility and focus
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && session.multiplayer?.active && session.multiplayer?.code) {
        fetch(`/api/auction/room?code=${session.multiplayer.code}`)
          .then(res => res.json())
          .then(data => {
            if (data.room) {
              onMultiplayerUpdate(data.room);
              startMpLongPoll(session.multiplayer.code);
            }
          })
          .catch(() => {});
      }
    });

    if (typeof window !== "undefined") {
      window.addEventListener("focus", () => {
        if (session.multiplayer?.active && session.multiplayer?.code) {
          fetch(`/api/auction/room?code=${session.multiplayer.code}`)
            .then(res => res.json())
            .then(data => {
              if (data.room) onMultiplayerUpdate(data.room);
            })
            .catch(() => {});
        }
      });
    }
  }

  // Watch URL hash for direct invite link on startup
  checkUrlInvite();

  return {
    screen() {
      applyTeamTheme(session.userTeam);
      if (typeof document !== "undefined") {
        document.body.classList.add("in-auction");
        const dockEl = document.querySelector(".dock");
        if (dockEl) {
          dockEl.style.setProperty("display", "none", "important");
          dockEl.classList.add("auction-hidden");
        }
      }
      return screens[session.phase] ? screens[session.phase]() : screens.hub();
    },
    actions,
    get where() {
      return session.phase === "room" ? "IPL Auction · Live Room" :
             session.phase === "mp-lobby" ? `IPL Auction · Room ${session.multiplayer?.code || ""}` :
             session.phase === "mp-hub" ? "IPL Auction · Multiplayer" :
             session.phase === "squad" ? "IPL Auction · Squad" :
             session.phase === "mode" ? "IPL Auction · Select Mode" :
             session.phase === "summary" ? "IPL Auction · Records" :
             "IPL Auction 2026";
    }
  };
}

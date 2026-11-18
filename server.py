import http.server
import socketserver
import mimetypes
import json
import os
import time
import uuid
import random
import string
import threading
import gzip
from urllib.parse import urlparse, parse_qs

mimetypes.init()
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/javascript', '.mjs')
mimetypes.add_type('application/json', '.json')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('font/woff2', '.woff2')
mimetypes.add_type('image/svg+xml', '.svg')

PORT = int(os.environ.get("PORT", 3000))

# Supabase Auth configuration (Optional).
# To enable Google OAuth for your own domain, set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.
# When not set, the app runs completely standalone with local profiles and real-time multiplayer display names.
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "").strip()

CONFIG_DATA = {
    "supabase": {
        "url": SUPABASE_URL,
        "key": SUPABASE_KEY
    } if (SUPABASE_URL and SUPABASE_KEY) else None,
    "settings": {
        "rules": {},
        "clocks": {},
        "engine": {},
        "ratings": {
            "0184dc35:2008": {"bat": 80},
            "0184dc35:2009": {"bat": 78},
            "0184dc35:2010": {"bat": 82},
            "0184dc35:2011": {"bat": 81},
            "0184dc35:2012": {"bat": 80}
        }
    },
    "email": bool(os.environ.get("EMAIL_SIGNIN", False))
}

# In-Memory Multiplayer Auction Rooms
AUCTION_ROOMS = {}
ROOMS_LOCK = threading.Lock()

MEGA_SLABS = [18.0, 14.0, 11.0, 18.0, 14.0]

def get_next_bid(current_bid):
    if current_bid < 1.0:
        return round(current_bid + 0.05, 2)
    elif current_bid < 2.0:
        return round(current_bid + 0.10, 2)
    elif current_bid < 5.0:
        return round(current_bid + 0.20, 2)
    else:
        return round(current_bid + 0.50, 2)

def calculate_ai_valuation(f, lot):
    if not f or f.get("purse", 0) <= 0:
        return 0.0
    squad = f.get("squad", [])
    if len(squad) >= 25:
        return 0.0
    if lot.get("overseas") and len([p for p in squad if p.get("overseas")]) >= 8:
        return 0.0

    slots_needed = max(0, 18 - len(squad) - 1)
    min_reserve = slots_needed * 0.30
    max_available = f.get("purse", 0) - min_reserve
    if max_available <= 0.20:
        return 0.0

    ovr = lot.get("overall") or 75
    base_price = float(lot.get("basePrice", 2.0))

    if ovr >= 92:
        base_val = 18.0 + (ovr - 92) * 1.8
    elif ovr >= 88:
        base_val = 12.0 + (ovr - 88) * 1.3
    elif ovr >= 84:
        base_val = 8.0 + (ovr - 84) * 0.9
    elif ovr >= 80:
        base_val = 5.0 + (ovr - 80) * 0.7
    elif ovr >= 75:
        base_val = 2.8 + (ovr - 75) * 0.45
    elif ovr >= 70:
        base_val = 1.2 + (ovr - 70) * 0.3
    else:
        base_val = 0.3 + (ovr / 70.0) * 0.6

    bowlers = len([p for p in squad if p.get("role") in ("bowler", "all-rounder")])
    keepers = len([p for p in squad if any(k in p.get("name", "") for k in ("Dhoni", "Samson", "Pant", "Rahul", "Pooran", "Klaasen")) or p.get("isWK")])

    need_mul = 1.0
    cat = lot.get("category", "")
    if cat == "WK" and keepers == 0:
        need_mul *= 1.45
    if cat in ("FA", "SP") and bowlers < 5:
        need_mul *= 1.35
    if cat == "AL":
        need_mul *= 1.25

    code = f.get("code", "")
    if code == "PBKS" and f.get("purse", 0) > 50:
        need_mul *= 1.25
    if code == "CSK" and (lot.get("styles") and "Finisher" in lot.get("styles") or cat == "SP"):
        need_mul *= 1.2
    if code == "MI" and (cat == "FA" or (lot.get("styles") and "Hard Hitter" in lot.get("styles"))):
        need_mul *= 1.2
    if code == "SRH" and (lot.get("bat", 0) >= 85):
        need_mul *= 1.2
    if code == "RCB" and ovr >= 85:
        need_mul *= 1.2

    purse_scale = min(1.35, max(0.65, f.get("purse", 0) / 50.0))
    final_val = base_val * need_mul * purse_scale
    final_val = min(final_val, max_available)
    return max(base_price, round(final_val, 2))

def generate_room_code():
    chars = string.ascii_uppercase + string.digits
    for _ in range(20):
        code = "".join(random.choices(chars, k=4))
        if code not in AUCTION_ROOMS:
            return code
    return str(random.randint(1000, 9999))

def serialize_room(room):
    # Returns clean JSON-serializable room representation (omitting lock/condition)
    return {
        "code": room["code"],
        "hostId": room["hostId"],
        "mode": room["mode"],
        "phase": room["phase"],
        "players": room["players"],
        "franchises": room["franchises"],
        "pool": room["pool"],
        "lotIndex": room["lotIndex"],
        "currentBid": room["currentBid"],
        "leadingTeam": room["leadingTeam"],
        "leadingPlayer": room["leadingPlayer"],
        "gavelCount": room["gavelCount"],
        "history": room["history"],
        "chat": room["chat"],
        "soldList": room["soldList"],
        "unsoldList": room["unsoldList"],
        "version": room["version"],
        "bidTimer": room.get("bidTimer", 10),
        "timerStart": room.get("timerStart", time.time()),
        "speed": room.get("speed", "normal")
    }

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        if hasattr(self, 'path') and self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        else:
            self.send_header('Cache-Control', 'public, max-age=3600')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path in ('/health', '/api/health'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            with ROOMS_LOCK:
                active_rooms = len(AUCTION_ROOMS)
            self.wfile.write(json.dumps({
                "status": "healthy",
                "app": "Powerplay",
                "version": "2026.1",
                "rooms": active_rooms,
                "timestamp": int(time.time())
            }).encode('utf-8'))
            return

        if path == '/api/config':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(CONFIG_DATA).encode('utf-8'))
            return

        # Multiplayer Auction: Get Room State
        if path == '/api/auction/room':
            code = query.get('code', [''])[0].upper().strip()
            with ROOMS_LOCK:
                room = AUCTION_ROOMS.get(code)
            if not room:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Room '{code}' not found."}).encode('utf-8'))
                return
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            with room["cond"]:
                data = serialize_room(room)
            self.wfile.write(json.dumps({"room": data}).encode('utf-8'))
            return

        # Multiplayer Auction: Long-Polling State Synchronization (Sub-millisecond wake-up)
        if path == '/api/auction/poll':
            code = query.get('code', [''])[0].upper().strip()
            client_version = int(query.get('version', [0])[0])
            with ROOMS_LOCK:
                room = AUCTION_ROOMS.get(code)
            if not room:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Room '{code}' not found."}).encode('utf-8'))
                return

            with room["cond"]:
                # If current version is already greater than client's, return immediately
                if room["version"] > client_version:
                    data = serialize_room(room)
                else:
                    # Wait up to 20 seconds for room state update
                    room["cond"].wait(timeout=20.0)
                    data = serialize_room(room)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"room": data, "version": data["version"]}).encode('utf-8'))
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/auction/'):
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length) if content_length > 0 else b'{}'
            try:
                body = json.loads(body_bytes.decode('utf-8'))
            except:
                body = {}

            # 1. CREATE AUCTION ROOM
            if path == '/api/auction/create':
                code = generate_room_code()
                player_id = str(uuid.uuid4())[:8]
                player_name = body.get("playerName", "Host").strip() or "Host"
                player_team = body.get("team", "CSK")
                mode = body.get("mode", "retentions_2026")
                franchises = body.get("franchises", {})
                pool = body.get("pool", [])

                room = {
                    "code": code,
                    "hostId": player_id,
                    "mode": mode,
                    "phase": "lobby",
                    "players": [
                        {
                            "id": player_id,
                            "name": player_name,
                            "team": player_team,
                            "isHost": True,
                            "ready": True
                        }
                    ],
                    "franchises": franchises,
                    "pool": pool,
                    "lotIndex": 0,
                    "currentBid": pool[0].get("basePrice", 2.0) if pool else 2.0,
                    "bidTimer": int(body.get("bidTimer", 10)),
                    "timerStart": time.time(),
                    "leadingTeam": None,
                    "leadingPlayer": None,
                    "gavelCount": 0,
                    "history": [],
                    "chat": [
                        {
                            "sender": "System",
                            "team": "",
                            "text": f"Room {code} created! Share this code or the link with your friends.",
                            "time": time.strftime("%H:%M")
                        }
                    ],
                    "soldList": [],
                    "unsoldList": [],
                    "version": 1,
                    "cond": threading.Condition()
                }

                with ROOMS_LOCK:
                    AUCTION_ROOMS[code] = room

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "code": code,
                    "playerId": player_id,
                    "room": serialize_room(room)
                }).encode('utf-8'))
                return

            # 2. JOIN AUCTION ROOM
            if path == '/api/auction/join':
                code = body.get("code", "").upper().strip()
                player_name = body.get("playerName", "Player").strip() or "Player"
                player_team = body.get("team", "MI")

                with ROOMS_LOCK:
                    room = AUCTION_ROOMS.get(code)
                if not room:
                    self.send_response(404)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": f"Auction room '{code}' not found."}).encode('utf-8'))
                    return

                with room["cond"]:
                    player_id = str(uuid.uuid4())[:8]
                    # Check if requested team is already taken; if so pick first untaken franchise
                    taken_teams = {p["team"] for p in room["players"]}
                    assigned_team = player_team
                    if assigned_team in taken_teams:
                        all_teams = list(room["franchises"].keys())
                        for t in all_teams:
                            if t not in taken_teams:
                                assigned_team = t
                                break

                    new_player = {
                        "id": player_id,
                        "name": player_name,
                        "team": assigned_team,
                        "isHost": False,
                        "ready": False
                    }
                    room["players"].append(new_player)
                    room["chat"].append({
                        "sender": "System",
                        "team": "",
                        "text": f"{player_name} joined managing {assigned_team}!",
                        "time": time.strftime("%H:%M")
                    })
                    room["version"] += 1
                    room["cond"].notify_all()
                    data = serialize_room(room)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "playerId": player_id,
                    "room": data
                }).encode('utf-8'))
                return

            # 3. AUCTION ROOM ACTION
            if path == '/api/auction/act':
                code = body.get("code", "").upper().strip()
                player_id = body.get("playerId", "")
                action = body.get("action", "")

                with ROOMS_LOCK:
                    room = AUCTION_ROOMS.get(code)
                if not room:
                    self.send_response(404)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": f"Room '{code}' not found."}).encode('utf-8'))
                    return

                with room["cond"]:
                    player = next((p for p in room["players"] if p["id"] == player_id), None)
                    if not player and action not in ("ping",):
                        self.send_response(403)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": "Player not in room."}).encode('utf-8'))
                        return

                    # ACTION: CHAT
                    if action == "chat":
                        msg_text = body.get("text", "").strip()
                        if msg_text:
                            room["chat"].append({
                                "sender": player["name"],
                                "team": player["team"],
                                "text": msg_text,
                                "time": time.strftime("%H:%M")
                            })
                            room["version"] += 1
                            room["cond"].notify_all()

                    # ACTION: SWITCH TEAM
                    elif action == "switch-team":
                        target_team = body.get("team", "")
                        taken_teams = {p["team"] for p in room["players"] if p["id"] != player_id}
                        if target_team in room["franchises"] and target_team not in taken_teams:
                            old_team = player["team"]
                            player["team"] = target_team
                            room["chat"].append({
                                "sender": "System",
                                "team": "",
                                "text": f"{player['name']} switched to {target_team}.",
                                "time": time.strftime("%H:%M")
                            })
                            room["version"] += 1
                            room["cond"].notify_all()

                    # ACTION: CHOOSE RETENTIONS
                    elif action == "set-retentions":
                        team = body.get("team", player["team"])
                        retentions = body.get("retentions", [])
                        purse = body.get("purse", 120.0)
                        rtm = body.get("rtm", 6)
                        if team in room["franchises"]:
                            f = room["franchises"][team]
                            f["retentions"] = retentions
                            f["purse"] = purse
                            f["rtm"] = rtm
                            f["squad"] = [
                                {
                                    "key": r["key"],
                                    "name": r["name"],
                                    "price": r["price"],
                                    "role": r.get("role", "batter"),
                                    "overseas": r.get("overseas", False),
                                    "overall": r.get("overall", 75),
                                    "retention": True
                                }
                                for r in retentions
                            ]
                            room["chat"].append({
                                "sender": "System",
                                "team": "",
                                "text": f"{player['name']} confirmed {len(retentions)} retentions for {team} (Purse: ₹{purse} Cr).",
                                "time": time.strftime("%H:%M")
                            })
                            room["version"] += 1
                            room["cond"].notify_all()

                    # ACTION: TOGGLE READY
                    elif action == "ready":
                        is_ready = bool(body.get("ready", True))
                        player["ready"] = is_ready
                        room["version"] += 1
                        room["cond"].notify_all()

                    # ACTION: START AUCTION (Host only)
                    elif action in ("start", "start-auction"):
                        if player["isHost"]:
                            room["phase"] = "room"
                            human_teams = {p["team"] for p in room["players"]}
                            ai_teams = [t for t in room["franchises"].keys() if t not in human_teams]

                            # ONLY for AI teams: auto-select retentions (Never retain M1/M2 marquee superstars)
                            marquee_keys = {p.get("key") for p in room.get("pool", []) if p.get("category") in ("M1", "M2")}
                            for t in ai_teams:
                                f = room["franchises"][t]
                                roster = [p for p in f.get("eligibleRoster", []) if p.get("key") not in marquee_keys]
                                if roster:
                                    sorted_roster = sorted(roster, key=lambda x: x.get("overall", 75), reverse=True)
                                    num_to_retain = min(4, len(sorted_roster))
                                    chosen = sorted_roster[:num_to_retain]
                                    ai_retentions = []
                                    spent = 0.0
                                    capped_idx = 0
                                    uncapped_count = 0
                                    for p in chosen:
                                        is_uncapped = bool(p.get("uncapped"))
                                        if is_uncapped and uncapped_count < 2:
                                            cost = 4.0
                                            uncapped_count += 1
                                        else:
                                            cost = MEGA_SLABS[capped_idx] if capped_idx < len(MEGA_SLABS) else 11.0
                                            capped_idx += 1
                                            is_uncapped = False
                                        spent += cost
                                        ai_retentions.append({
                                            "name": p.get("name"),
                                            "key": p.get("key"),
                                            "price": cost,
                                            "overseas": p.get("overseas", False),
                                            "role": p.get("role", "batter"),
                                            "uncapped": is_uncapped,
                                            "overall": p.get("overall", 75),
                                            "retention": True
                                        })
                                    f["retentions"] = ai_retentions
                                    f["purse"] = round(120.0 - spent, 2)
                                    f["rtm"] = max(0, 6 - len(ai_retentions))
                                    f["squad"] = [r for r in ai_retentions]

                            # For human teams: KEEP USER-CHOSEN RETENTIONS AS-IS!

                            # Exclude all retained players from room pool
                            all_retained_keys = set()
                            for t, f in room["franchises"].items():
                                for r in f.get("retentions", []):
                                    if r.get("key"):
                                        all_retained_keys.add(r["key"])

                            room["pool"] = [p for p in room["pool"] if p.get("key") not in all_retained_keys]

                            # Randomize the first draw of the opening set
                            if room["pool"]:
                                first_set = room["pool"][0].get("set", "") or room["pool"][0].get("category", "")
                                first_set_indices = [
                                    i for i in range(len(room["pool"]))
                                    if (room["pool"][i].get("set", "") or room["pool"][i].get("category", "")) == first_set
                                ]
                                if len(first_set_indices) > 1:
                                    pick_idx = random.choice(first_set_indices)
                                    room["pool"][0], room["pool"][pick_idx] = room["pool"][pick_idx], room["pool"][0]

                            room["lotIndex"] = 0
                            if room["pool"]:
                                room["currentBid"] = room["pool"][0].get("basePrice", 2.0)
                            room["leadingTeam"] = None
                            room["leadingPlayer"] = None
                            room["gavelCount"] = 0
                            room["timerStart"] = time.time()
                            room["history"] = []

                            human_summary = ", ".join([f"{p['name']} ({p['team']})" for p in room["players"]])
                            ai_summary = ", ".join(ai_teams) if ai_teams else "None"
                            room["chat"].append({
                                "sender": "System",
                                "team": "",
                                "text": f"🔨 Live Auction launched! {len(human_teams)} Human Teams ({human_summary}) vs {len(ai_teams)} AI Teams ({ai_summary}). {len(room['pool'])} players in pool.",
                                "time": time.strftime("%H:%M")
                            })
                            room["version"] += 1
                            room["cond"].notify_all()

                    # ACTION: PLACE BID (Resets the 10-second timer to 100% for everyone)
                    elif action == "bid":
                        amount = round(float(body.get("amount", room["currentBid"] + 0.2)), 2)
                        f = room["franchises"].get(player["team"])
                        if f and f["purse"] >= amount and room["phase"] == "room" and room["gavelCount"] < 3:
                            room["currentBid"] = amount
                            room["leadingTeam"] = player["team"]
                            room["leadingPlayer"] = player["name"]
                            room["gavelCount"] = 0
                            room["timerStart"] = time.time()
                            room["history"].insert(0, {
                                "type": "bid",
                                "team": player["team"],
                                "amount": amount,
                                "text": f"🌟 {f['name']} ({player['name']}) bids ₹{amount:.2f} Cr!"
                            })
                            room["version"] += 1
                            room["cond"].notify_all()

                    # ACTION: AI BOT CHECK (Triggered during countdown to place realistic AI counter-bids)
                    elif action == "ai-check":
                        if player["isHost"] and room["phase"] == "room" and room["gavelCount"] < 3 and room["gavelCount"] != -1:
                            lot = room["pool"][room["lotIndex"]] if room["lotIndex"] < len(room["pool"]) else None
                            if lot:
                                human_teams = {p["team"] for p in room["players"]}
                                ai_teams = [t for t in room["franchises"].keys() if t not in human_teams]
                                next_bid = get_next_bid(room["currentBid"]) if room["leadingTeam"] else room["currentBid"]

                                ai_candidates = []
                                for t in ai_teams:
                                    if t == room["leadingTeam"]:
                                        continue
                                    f = room["franchises"].get(t)
                                    if not f or f.get("purse", 0) < next_bid:
                                        continue
                                    if len(f.get("squad", [])) >= 25:
                                        continue
                                    if lot.get("overseas") and len([p for p in f.get("squad", []) if p.get("overseas")]) >= 8:
                                        continue
                                    val = calculate_ai_valuation(f, lot)
                                    if val >= next_bid:
                                        ai_candidates.append((t, f, val))

                                if ai_candidates:
                                    ai_candidates.sort(key=lambda x: x[2], reverse=True)
                                    chosen_t, chosen_f, chosen_val = ai_candidates[0]

                                    room["currentBid"] = next_bid
                                    room["leadingTeam"] = chosen_t
                                    room["leadingPlayer"] = f"AI Bot ({chosen_t})"
                                    room["gavelCount"] = 0
                                    room["timerStart"] = time.time()
                                    room["history"].insert(0, {
                                        "type": "bid",
                                        "team": chosen_t,
                                        "amount": next_bid,
                                        "text": f"🤖 {chosen_f['name']} (AI) bids ₹{next_bid:.2f} Cr!"
                                    })
                                    room["version"] += 1
                                    room["cond"].notify_all()

                    # ACTION: TIMEOUT / TICK - When 10s countdown completes, immediately finalize sale or unsold!
                    elif action in ("timeout", "tick"):
                        if player["isHost"] and room["phase"] == "room":
                            lot = room["pool"][room["lotIndex"]] if room["lotIndex"] < len(room["pool"]) else None
                            if lot and room["gavelCount"] < 3 and room["gavelCount"] != -1:
                                if room["leadingTeam"] is None:
                                    room["gavelCount"] = -1
                                    room["unsoldList"].append(lot)
                                    room["history"].insert(0, {
                                        "type": "unsold",
                                        "text": f"❌ {lot['name']} is UNSOLD at ₹{lot.get('basePrice', 2.0):.2f} Cr."
                                    })
                                else:
                                    # Immediate SALE!
                                    room["gavelCount"] = 3
                                    f = room["franchises"][room["leadingTeam"]]
                                    f["purse"] = round(f["purse"] - room["currentBid"], 2)
                                    bought = {
                                        "key": lot["key"],
                                        "name": lot["name"],
                                        "price": room["currentBid"],
                                        "role": lot.get("role", "batter"),
                                        "overall": lot.get("overall", 75),
                                        "overseas": lot.get("overseas", False),
                                        "team": room["leadingTeam"],
                                        "retention": False
                                    }
                                    f.setdefault("squad", []).append(bought)
                                    room["soldList"].append(bought)
                                    winner_label = room.get("leadingPlayer") or f["name"]
                                    room["history"].insert(0, {
                                        "type": "sold",
                                        "text": f"🔨 SOLD! {lot['name']} acquired by {f['name']} ({winner_label}) for ₹{room['currentBid']:.2f} Cr!"
                                    })
                                room["version"] += 1
                                room["cond"].notify_all()

                    # ACTION: SET BID TIMER (Host only: 10s or 5s)
                    elif action == "set-bid-timer":
                        if player["isHost"]:
                            timer_val = int(body.get("timer", 10))
                            room["bidTimer"] = 5 if timer_val == 5 else 10
                            room["history"].insert(0, {
                                "type": "call",
                                "text": f"⏱️ Host updated bid clock to {room['bidTimer']} seconds."
                            })
                            room["chat"].append({
                                "sender": "System",
                                "team": "",
                                "text": f"⏱️ Bid clock set to {room['bidTimer']}s per bid.",
                                "time": time.strftime("%H:%M")
                            })
                            room["version"] += 1
                            room["cond"].notify_all()

                    # ACTION: NEXT LOT
                    elif action == "next-lot":
                        if player["isHost"]:
                            # Randomize next lot from current set or opening draw of next set
                            if room["lotIndex"] < len(room["pool"]) - 1:
                                cur_set = room["pool"][room["lotIndex"]].get("set", "") or room["pool"][room["lotIndex"]].get("category", "")
                                rem_indices = [
                                    i for i in range(room["lotIndex"] + 1, len(room["pool"]))
                                    if (room["pool"][i].get("set", "") or room["pool"][i].get("category", "")) == cur_set
                                ]
                                next_idx = room["lotIndex"] + 1
                                if rem_indices:
                                    pick_idx = random.choice(rem_indices)
                                    if pick_idx != next_idx:
                                        room["pool"][next_idx], room["pool"][pick_idx] = room["pool"][pick_idx], room["pool"][next_idx]
                                elif next_idx < len(room["pool"]):
                                    next_set = room["pool"][next_idx].get("set", "") or room["pool"][next_idx].get("category", "")
                                    rem_next_indices = [
                                        i for i in range(next_idx, len(room["pool"]))
                                        if (room["pool"][i].get("set", "") or room["pool"][i].get("category", "")) == next_set
                                    ]
                                    if rem_next_indices:
                                        pick_idx = random.choice(rem_next_indices)
                                        if pick_idx != next_idx:
                                            room["pool"][next_idx], room["pool"][pick_idx] = room["pool"][pick_idx], room["pool"][next_idx]

                            room["lotIndex"] += 1
                            if room["lotIndex"] >= len(room["pool"]):
                                room["phase"] = "summary"
                            else:
                                nxt = room["pool"][room["lotIndex"]]
                                room["currentBid"] = nxt.get("basePrice", 2.0)
                                room["leadingTeam"] = None
                                room["leadingPlayer"] = None
                                room["gavelCount"] = 0
                                room["timerStart"] = time.time()
                                room["history"] = []
                            room["version"] += 1
                            room["cond"].notify_all()

                    # ACTION: SKIP SET
                    elif action == "skip-set":
                        if player["isHost"] and room["lotIndex"] < len(room["pool"]):
                            cur_set = room["pool"][room["lotIndex"]].get("set", "") or room["pool"][room["lotIndex"]].get("category", "")
                            nxt_idx = room["lotIndex"] + 1
                            while nxt_idx < len(room["pool"]) and (room["pool"][nxt_idx].get("set", "") or room["pool"][nxt_idx].get("category", "")) == cur_set:
                                nxt_idx += 1
                            if nxt_idx >= len(room["pool"]):
                                room["phase"] = "summary"
                            else:
                                # Randomize opening draw of the target set
                                next_set = room["pool"][nxt_idx].get("set", "") or room["pool"][nxt_idx].get("category", "")
                                rem_next_indices = [
                                    i for i in range(nxt_idx, len(room["pool"]))
                                    if (room["pool"][i].get("set", "") or room["pool"][i].get("category", "")) == next_set
                                ]
                                if rem_next_indices:
                                    pick_idx = random.choice(rem_next_indices)
                                    if pick_idx != nxt_idx:
                                        room["pool"][nxt_idx], room["pool"][pick_idx] = room["pool"][pick_idx], room["pool"][nxt_idx]

                                room["lotIndex"] = nxt_idx
                                nxt = room["pool"][nxt_idx]
                                room["currentBid"] = nxt.get("basePrice", 2.0)
                                room["leadingTeam"] = None
                                room["leadingPlayer"] = None
                                room["gavelCount"] = 0
                                room["timerStart"] = time.time()
                                room["history"] = []
                                room["chat"].append({
                                    "sender": "System",
                                    "team": "",
                                    "text": f"Host skipped remainder of {cur_set}. Now opening {nxt.get('set', 'Next Set')}.",
                                    "time": time.strftime("%H:%M")
                                })
                            room["version"] += 1
                            room["cond"].notify_all()

                    # ACTION: END AUCTION
                    elif action == "end-auction":
                        if player["isHost"]:
                            # Auto-fill squads to 12
                            avail = room["pool"][room["lotIndex"]:]
                            for c, f in room["franchises"].items():
                                f.setdefault("squad", [])
                                while len(f["squad"]) < 12 and avail:
                                    p = avail.pop(0)
                                    cost = min(f["purse"], p.get("basePrice", 2.0))
                                    f["purse"] = round(f["purse"] - cost, 2)
                                    b = {
                                        "key": p["key"],
                                        "name": p["name"],
                                        "price": cost,
                                        "role": p.get("role", "batter"),
                                        "overall": p.get("overall", 75),
                                        "overseas": p.get("overseas", False),
                                        "team": c,
                                        "retention": False
                                    }
                                    f["squad"].append(b)
                                    room["soldList"].append(b)
                            room["phase"] = "squad"
                            room["chat"].append({
                                "sender": "System",
                                "team": "",
                                "text": "🏁 Auction concluded by Host! Squads finalized.",
                                "time": time.strftime("%H:%M")
                            })
                            room["version"] += 1
                            room["cond"].notify_all()

                    data = serialize_room(room)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "room": data}).encode('utf-8'))
                return

        if path.startswith('/api/'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{}')
            return

        super().do_POST()

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == "__main__":
    with ThreadedTCPServer(("", PORT), Handler) as httpd:
        print(f"Serving Powerplay & Real-Time Multiplayer Auction at http://localhost:{PORT}")
        httpd.serve_forever()

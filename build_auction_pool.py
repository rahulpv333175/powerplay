import json

with open('sim/data.json', 'r', encoding='utf-8') as f:
    cards = json.load(f)['cards']

# Helper to find best card key for a player
def find_card(name):
    # Try exact match on full or name
    candidates = []
    for k, c in cards.items():
        full = c.get('full', '')
        short = c.get('name', '')
        if name.lower() == full.lower() or name.lower() == short.lower():
            candidates.append((k, c))
    if not candidates:
        for k, c in cards.items():
            full = c.get('full', '')
            short = c.get('name', '')
            if name.lower() in full.lower() or name.lower() in short.lower():
                candidates.append((k, c))
    if not candidates:
        return None
    # Pick the latest season
    candidates.sort(key=lambda x: (x[1].get('season', 0), x[1].get('overall') or 0), reverse=True)
    return candidates[0]

# List of prominent auction targets with (Name, PrevTeam, BasePriceCr, RoleCategory)
targets = [
    # Marquee Set 1
    ("Rishabh Pant", "Delhi Capitals", 2.0, "WK", "M1"),
    ("Shreyas Iyer", "Kolkata Knight Riders", 2.0, "BA", "M1"),
    ("KL Rahul", "Lucknow Super Giants", 2.0, "WK", "M1"),
    ("Mitchell Starc", "Kolkata Knight Riders", 2.0, "FA", "M1"),
    ("Arshdeep Singh", "Punjab Kings", 2.0, "FA", "M1"),
    ("Jos Buttler", "Rajasthan Royals", 2.0, "WK", "M1"),
    ("Mohammed Shami", "Gujarat Titans", 2.0, "FA", "M1"),
    ("David Miller", "Gujarat Titans", 2.0, "BA", "M1"),
    ("Kagiso Rabada", "Punjab Kings", 2.0, "FA", "M1"),
    ("Liam Livingstone", "Punjab Kings", 2.0, "AL", "M1"),

    # Marquee Set 2
    ("Mohammed Siraj", "Royal Challengers Bengaluru", 2.0, "FA", "M2"),
    ("Yuzvendra Chahal", "Rajasthan Royals", 2.0, "SP", "M2"),
    ("Ravichandran Ashwin", "Rajasthan Royals", 2.0, "SP", "M2"),
    ("Devon Conway", "Chennai Super Kings", 2.0, "BA", "M2"),
    ("Venkatesh Iyer", "Kolkata Knight Riders", 2.0, "AL", "M2"),
    ("Quinton de Kock", "Lucknow Super Giants", 2.0, "WK", "M2"),
    ("Bhuvneshwar Kumar", "Sunrisers Hyderabad", 2.0, "FA", "M2"),
    ("Glenn Maxwell", "Royal Challengers Bengaluru", 2.0, "AL", "M2"),
    ("Faf du Plessis", "Royal Challengers Bengaluru", 2.0, "BA", "M2"),
    ("Ishan Kishan", "Mumbai Indians", 2.0, "WK", "M2"),

    # Capped Batters (BA1)
    ("David Warner", "Delhi Capitals", 2.0, "BA", "BA1"),
    ("Kane Williamson", "Gujarat Titans", 2.0, "BA", "BA1"),
    ("Ajinkya Rahane", "Chennai Super Kings", 1.5, "BA", "BA1"),
    ("Rahul Tripathi", "Sunrisers Hyderabad", 2.0, "BA", "BA1"),
    ("Devdutt Padikkal", "Lucknow Super Giants", 2.0, "BA", "BA1"),
    ("Steve Smith", "Delhi Capitals", 2.0, "BA", "BA1"),
    ("Tim David", "Mumbai Indians", 2.0, "BA", "BA1"),
    ("Manish Pandey", "Kolkata Knight Riders", 1.0, "BA", "BA1"),
    ("Prithvi Shaw", "Delhi Capitals", 1.5, "BA", "BA1"),
    ("Karun Nair", "Lucknow Super Giants", 0.5, "BA", "BA1"),

    # Capped Wicketkeepers (WK1)
    ("Phil Salt", "Kolkata Knight Riders", 2.0, "WK", "WK1"),
    ("Jonny Bairstow", "Punjab Kings", 2.0, "WK", "WK1"),
    ("Jitesh Sharma", "Punjab Kings", 1.0, "WK", "WK1"),
    ("Rahmanullah Gurbaz", "Kolkata Knight Riders", 2.0, "WK", "WK1"),
    ("KS Bharat", "Kolkata Knight Riders", 0.75, "WK", "WK1"),
    ("Anuj Rawat", "Royal Challengers Bengaluru", 0.3, "WK", "WK1"),
    ("Sam Billings", "Kolkata Knight Riders", 1.0, "WK", "WK1"),
    ("Matthew Wade", "Gujarat Titans", 1.0, "WK", "WK1"),

    # Capped All-rounders (AL1)
    ("Marcus Stoinis", "Lucknow Super Giants", 2.0, "AL", "AL1"),
    ("Sam Curran", "Punjab Kings", 2.0, "AL", "AL1"),
    ("Washington Sundar", "Sunrisers Hyderabad", 2.0, "AL", "AL1"),
    ("Mitchell Marsh", "Delhi Capitals", 2.0, "AL", "AL1"),
    ("Krunal Pandya", "Lucknow Super Giants", 2.0, "AL", "AL1"),
    ("Marco Jansen", "Sunrisers Hyderabad", 2.0, "AL", "AL1"),
    ("Wanindu Hasaranga", "Sunrisers Hyderabad", 2.0, "AL", "AL1"),
    ("Glenn Phillips", "Sunrisers Hyderabad", 1.5, "AL", "AL1"),
    ("Deepak Hooda", "Lucknow Super Giants", 1.0, "AL", "AL1"),
    ("Shardul Thakur", "Chennai Super Kings", 2.0, "AL", "AL1"),
    ("Swapnil Singh", "Royal Challengers Bengaluru", 0.3, "AL", "AL1"),

    # Capped Fast Bowlers (FA1)
    ("Trent Boult", "Rajasthan Royals", 2.0, "FA", "FA1"),
    ("Josh Hazlewood", "Royal Challengers Bengaluru", 2.0, "FA", "FA1"),
    ("Anrich Nortje", "Delhi Capitals", 2.0, "FA", "FA1"),
    ("T Natarajan", "Sunrisers Hyderabad", 2.0, "FA", "FA1"),
    ("Khaleel Ahmed", "Delhi Capitals", 2.0, "FA", "FA1"),
    ("Harshal Patel", "Punjab Kings", 2.0, "FA", "FA1"),
    ("Prasidh Krishna", "Rajasthan Royals", 2.0, "FA", "FA1"),
    ("Avesh Khan", "Rajasthan Royals", 2.0, "FA", "FA1"),
    ("Deepak Chahar", "Chennai Super Kings", 2.0, "FA", "FA1"),
    ("Mukesh Kumar", "Delhi Capitals", 2.0, "FA", "FA1"),
    ("Lockie Ferguson", "Royal Challengers Bengaluru", 2.0, "FA", "FA1"),
    ("Gerald Coetzee", "Mumbai Indians", 1.5, "FA", "FA1"),
    ("Umesh Yadav", "Gujarat Titans", 1.0, "FA", "FA1"),
    ("Alzarri Joseph", "Royal Challengers Bengaluru", 1.0, "FA", "FA1"),
    ("Tushar Deshpande", "Chennai Super Kings", 1.0, "FA", "FA1"),

    # Capped Spinners (SP1)
    ("Noor Ahmad", "Gujarat Titans", 2.0, "SP", "SP1"),
    ("Maheesh Theekshana", "Chennai Super Kings", 2.0, "SP", "SP1"),
    ("Rahul Chahar", "Punjab Kings", 1.0, "SP", "SP1"),
    ("Adam Zampa", "Rajasthan Royals", 2.0, "SP", "SP1"),
    ("Karn Sharma", "Royal Challengers Bengaluru", 0.5, "SP", "SP1"),
    ("Mujeeb Ur Rahman", "Kolkata Knight Riders", 2.0, "SP", "SP1"),
    ("Suyash Sharma", "Kolkata Knight Riders", 0.3, "SP", "SP1"),
    ("Piyush Chawla", "Mumbai Indians", 0.5, "SP", "SP1"),
    ("Amit Mishra", "Lucknow Super Giants", 0.5, "SP", "SP1"),

    # Uncapped Stars (U1)
    ("Angkrish Raghuvanshi", "Kolkata Knight Riders", 0.3, "BA", "U1"),
    ("Nehal Wadhera", "Mumbai Indians", 0.3, "BA", "U1"),
    ("Ashutosh Sharma", "Punjab Kings", 0.3, "BA", "U1"),
    ("Sameer Rizvi", "Chennai Super Kings", 0.3, "BA", "U1"),
    ("Rasikh Salam", "Delhi Capitals", 0.3, "FA", "U1"),
    ("Vaibhav Arora", "Kolkata Knight Riders", 0.3, "FA", "U1"),
    ("Kumar Kushagra", "Delhi Capitals", 0.3, "WK", "U1"),
    ("Robin Minz", "Gujarat Titans", 0.3, "WK", "U1"),
    ("Yash Dhull", "Delhi Capitals", 0.3, "BA", "U1"),
    ("Naman Dhir", "Mumbai Indians", 0.3, "AL", "U1"),
    ("Tanush Kotian", "Rajasthan Royals", 0.3, "AL", "U1"),
    ("Kartik Tyagi", "Gujarat Titans", 0.3, "FA", "U1"),
    ("Akash Madhwal", "Mumbai Indians", 0.3, "FA", "U1"),
    ("Simarjeet Singh", "Chennai Super Kings", 0.3, "FA", "U1"),
    ("Manav Suthar", "Gujarat Titans", 0.3, "SP", "U1")
]

matched = []
unmatched = []
for name, prev_team, base_price, role, set_code in targets:
    res = find_card(name)
    if res:
        k, c = res
        matched.append({
            "key": k,
            "name": c.get('full') or c['name'],
            "shortName": c['name'],
            "role": c['role'],
            "category": role,
            "overseas": c.get('overseas', False),
            "country": c.get('country', 'India'),
            "overall": c.get('overall', 75),
            "bat": c.get('bat', 50),
            "bowl": c.get('bowl', 50),
            "prevTeam": prev_team,
            "basePrice": base_price,
            "set": set_code,
            "styles": c.get('styles', [])
        })
    else:
        unmatched.append(name)

print(f"Matched: {len(matched)}, Unmatched: {len(unmatched)}")
if unmatched:
    print("Unmatched:", unmatched)

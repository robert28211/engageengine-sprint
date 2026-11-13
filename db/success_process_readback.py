"""Read the PLP success line and verdicts back from D1 and check every stored
number against the client's _activity.md (the record they were loaded from)."""
import json, os, re, subprocess, sys

CID = "client-1779886732403-kjn1sl5yb"
SQL = (
    "SELECT 'line' t, scope k, line_text v, status s, COALESCE(approved_by,'') a, '' r, "
    "json_object('start',start_value,'target',target_value,'bar',cpl_bar,'actual',cpl_actual,'bench',benchmark_value) m "
    f"FROM client_success_line WHERE client_id='{CID}' "
    "UNION ALL SELECT subject_type, subject_name, verdict, status, COALESCE(approved_by,''), recheck_date, metrics "
    f"FROM client_verdicts WHERE client_id='{CID}' AND period='2026-11'"
)
out = subprocess.run(
    ["npx", "wrangler", "d1", "execute", "command-center", "--remote", "--yes", "--json", "--command", SQL],
    capture_output=True, text=True, cwd="/Users/robbiebutt/Desktop/engageengine-sprint")
txt = out.stdout[out.stdout.index("["):]
rows = json.loads(txt)[0]["results"]
act = open(os.path.expanduser(
    "~/Library/Mobile Documents/iCloud~md~obsidian/Documents/EngageEngine/Clients/Punch List Pros/_activity.md"
)).read().replace(",", "")


def leaves(o):
    if isinstance(o, dict):
        for v in o.values():
            yield from leaves(v)
    elif isinstance(o, (int, float)):
        yield o


def found(f):
    if f < 1:
        return f"{round(f * 100)}%" in act
    cands = {"%g" % f, "%.2f" % f, "%.1f" % f, str(int(f)) if f == int(f) else "%g" % f}
    return any(re.search(r"(?<![\d.])" + re.escape(c) + r"(?![\d])", act) for c in cands)


miss = 0
for r in rows:
    nums = list(leaves(json.loads(r["m"])))
    absent = [n for n in nums if n is not None and not found(float(n))]
    miss += len(absent)
    print(r["t"].ljust(9), str(r["k"])[:36].ljust(36), str(r["v"])[:20].ljust(20), r["s"].ljust(9),
          r["a"].ljust(7), r["r"], "| numbers", len(nums), "| not in record:", absent)
print("ROWS", len(rows), "| NUMBERS NOT FOUND IN RECORD:", miss)
sys.exit(1 if miss else 0)

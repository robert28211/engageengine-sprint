"""Each statement below must be REFUSED by the database. Prints PASS when it is."""
import subprocess

CID = "client-1779886732403-kjn1sl5yb"
CASES = {
    "verdict with no recheck date":
        f"INSERT INTO client_verdicts (client_id,period,subject_type,subject_key,verdict) VALUES ('{CID}','2026-11','service','meta','fix')",
    "campaign given a line status":
        f"INSERT INTO client_verdicts (client_id,period,subject_type,subject_key,verdict,recheck_date) VALUES ('{CID}','2026-11','service','meta','on_track','2026-12-12')",
    "second live verdict for the same subject and month":
        f"INSERT INTO client_verdicts (client_id,period,subject_type,subject_key,verdict,recheck_date) VALUES ('{CID}','2026-11','service','seo','keep','2026-12-12')",
    "second approved line for the same scope":
        f"INSERT INTO client_success_line (client_id,scope,line_text,unit,target_value,target_date,status) VALUES ('{CID}','Google Ads, Columbia','x','jobs',9,'2027-01-01','approved')",
}
bad = 0
for name, sql in CASES.items():
    r = subprocess.run(["npx", "wrangler", "d1", "execute", "command-center", "--remote", "--yes", "--command", sql],
                       capture_output=True, text=True, cwd="/Users/robbiebutt/Desktop/engageengine-sprint")
    out = r.stdout + r.stderr
    refused = ("constraint" in out.lower()) or ("SQLITE" in out)
    bad += 0 if refused else 1
    why = next((l.strip() for l in out.splitlines() if "constraint" in l.lower() or "SQLITE" in l), "ACCEPTED")
    print("PASS" if refused else "FAIL", "|", name, "|", why[:110])
print("FAILED:", bad)

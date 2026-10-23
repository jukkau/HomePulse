import json, os
from collections import Counter, defaultdict

with open(os.path.join(os.environ["TEMP"], "eslint-out.json"), encoding="utf-8-sig") as f:
    data = json.load(f)

targets = {"no-unsafe-assignment", "no-unsafe-argument", "no-unsafe-return", "no-unused-vars", "no-duplicate-type-constituents"}
cnt = Counter()
byfile = defaultdict(int)
rows = []
for r in data:
    fp = r["filePath"].split("homepulse")[-1]
    for m in r.get("messages", []):
        rid = m.get("ruleId", "") or ""
        t = rid.split("/")[-1]
        if t in targets:
            cnt[t] += 1
            byfile[fp] += 1
            rows.append((fp, m["line"], t))
print("TOTAL:", sum(cnt.values()))
for k, v in cnt.items():
    print(k, v)
print("--- by file ---")
for k, v in sorted(byfile.items()):
    print(v, k)

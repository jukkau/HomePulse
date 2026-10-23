import json, os, sys

target = sys.argv[1] if len(sys.argv) > 1 else ""
with open(os.path.join(os.environ["TEMP"], "eslint-out.json"), encoding="utf-8-sig") as f:
    data = json.load(f)

for r in data:
    fp = r["filePath"].split("homepulse")[-1]
    if target and target not in fp:
        continue
    for m in r.get("messages", []):
        rid = (m.get("ruleId") or "").split("/")[-1]
        if rid in ("no-unsafe-assignment", "no-unsafe-return"):
            print(f'{fp}  {m["line"]}:{m["column"]}  {rid}  {m["message"]}')

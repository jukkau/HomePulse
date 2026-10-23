import json, os, sys

target = sys.argv[1] if len(sys.argv) > 1 else ""
with open(os.path.join(os.environ["TEMP"], "eslint-out.json"), encoding="utf-8-sig") as f:
    data = json.load(f)

targets = {"no-unsafe-assignment", "no-unsafe-argument", "no-unsafe-return", "no-unused-vars", "no-duplicate-type-constituents"}
for r in data:
    fp = r["filePath"].split("homepulse")[-1]
    if target and target not in fp:
        continue
    msgs = [m for m in r.get("messages", []) if (m.get("ruleId", "") or "").split("/")[-1] in targets]
    if msgs:
        print("=" * 10, fp)
        for m in msgs:
            print(f'  {m["line"]}:{m["column"]}  {(m.get("ruleId") or "").split("/")[-1]}  {m["message"][:80]}')

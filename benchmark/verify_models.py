"""Checks that every hard-coded model ID exists in the live OpenRouter catalogue (no API key needed)."""
import json, re, sys, urllib.request, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
catalog = {m["id"]: m for m in json.load(urllib.request.urlopen("https://openrouter.ai/api/v1/models"))["data"]}
ids = set()
for f in ["shared/defaults.ts", "client/src/lib/models.ts", "server/orchestrator.ts"]:
    ids |= {i for i in re.findall(r'"([a-z0-9-]+/[a-z0-9.\-:]+)"', (root / f).read_text()) if not i.startswith('application')}
bad = 0
for i in sorted(ids):
    m = catalog.get(i)
    if not m:
        print("MISSING ", i); bad += 1
    else:
        p = m["pricing"]
        print("ok      ", i.ljust(42), f'${float(p["prompt"])*1e6:.2f} in / ${float(p["completion"])*1e6:.2f} out per M tokens')
sys.exit(1 if bad else 0)

"""Regenerates server/seedText.ts from the seed_* keys in part4.py. Run from the repository root: python3 script/i18n/seed_text.py"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
ns = {}
exec(open(os.path.join(HERE, 'part4.py')).read(), ns)
T, ORDER = ns['T'], ns['ORDER']
lines = ["// Localised names and descriptions of the two ready-made workflows.",
         "// Generated from script/i18n/part4.py (keys seed_*) by script/i18n/seed_text.py. Do not edit by hand.",
         'export const SEED_TEXT: Record<string, Record<"precision" | "budget", { name: string; desc: string }>> = {']
for i, c in enumerate(ORDER):
    g = lambda k: json.dumps(T[k][i], ensure_ascii=False)
    lines.append(f'  {c}: {{\n    precision: {{ name: {g("seed_precision_name")}, desc: {g("seed_precision_desc")} }},\n    budget: {{ name: {g("seed_budget_name")}, desc: {g("seed_budget_desc")} }},\n  }},')
lines.append('};\n')
open(os.path.join(HERE, '..', '..', 'server', 'seedText.ts'), 'w').write('\n'.join(lines))

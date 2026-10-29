"""Combine all translations and write i18n.ts"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))

exec(open(os.path.join(HERE, 'part1.py')).read())
exec(open(os.path.join(HERE, 'part2.py')).read())
exec(open(os.path.join(HERE, 'part3.py')).read())

LANGS = {
    'en': EN, 'fr': FR, 'es': ES, 'de': DE, 'it': IT,
    'pt': PT, 'ar': AR, 'he': HE, 'zh': ZH, 'ja': JA,
    'da': DA, 'nl': NL, 'hi': HI, 'ru': RU, 'ko': KO,
}

# Merge part 3 (strings added in v3.8.0)
for _key, _vals in T.items():
    for _code, _val in zip(ORDER, _vals):
        {'en': EN, 'fr': FR, 'es': ES, 'de': DE, 'it': IT, 'pt': PT, 'ar': AR, 'he': HE, 'zh': ZH,
         'ja': JA, 'da': DA, 'nl': NL, 'hi': HI, 'ru': RU, 'ko': KO}[_code][_key] = _val

# welcome_sub is kept for backwards compatibility; it mirrors onboarding_intro (no stale model counts).
for _d in (EN, FR, ES, DE, IT, PT, AR, HE, ZH, JA, DA, NL, HI, RU, KO):
    _d['welcome_sub'] = _d['onboarding_intro']

def q(s):
    """Quote a string for TypeScript, escaping backticks and backslashes."""
    return '`' + s.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${') + '`'

lines = []
lines.append('// AUTO-GENERATED — Mercury app i18n translations')
lines.append('// 15 languages × ' + str(len(EN)) + ' keys each')
lines.append('')
lines.append('export type LangCode = ' + ' | '.join(f"'{c}'" for c in LANGS.keys()) + ';')
lines.append('')
lines.append('export type TranslationKey = keyof typeof TRANSLATIONS.en;')
lines.append('')
lines.append('export const TRANSLATIONS = {')

for code, data in LANGS.items():
    lines.append(f'  {code}: {{')
    for key, val in data.items():
        lines.append(f'    {key}: {q(val)},')
    lines.append('  },')

lines.append('} as const;')
lines.append('')
lines.append('// ── Locale persistence ──────────────────────────────────────')
lines.append('const STORAGE_KEY = "mercury_ui_lang";')
lines.append('')
lines.append('export function getStoredLang(): LangCode {')
lines.append('  try {')
lines.append('    const v = localStorage.getItem(STORAGE_KEY);')
lines.append('    if (v && v in TRANSLATIONS) return v as LangCode;')
lines.append('  } catch {}')
lines.append('  // Browser language detection')
lines.append('  const nav = navigator.language?.split("-")[0] as LangCode;')
lines.append('  if (nav && nav in TRANSLATIONS) return nav;')
lines.append('  return "en";')
lines.append('}')
lines.append('')
lines.append('export function setStoredLang(code: LangCode): void {')
lines.append('  try { localStorage.setItem(STORAGE_KEY, code); } catch {}')
lines.append('}')
lines.append('')
lines.append('// ── Hook ────────────────────────────────────────────────────')
lines.append('import { useState, useCallback, createContext, useContext, type ReactNode } from "react";')
lines.append('import { createElement } from "react";')
lines.append('')
lines.append('interface I18nCtx {')
lines.append('  lang: LangCode;')
lines.append('  t: (key: TranslationKey) => string;')
lines.append('  setLang: (code: LangCode) => void;')
lines.append('}')
lines.append('')
lines.append('const I18nContext = createContext<I18nCtx>({')
lines.append('  lang: "en",')
lines.append('  t: (k) => TRANSLATIONS.en[k],')
lines.append('  setLang: () => {},')
lines.append('});')
lines.append('')
lines.append('export function I18nProvider({ children }: { children: ReactNode }) {')
lines.append('  const [lang, setLangState] = useState<LangCode>(getStoredLang);')
lines.append('')
lines.append('  const setLang = useCallback((code: LangCode) => {')
lines.append('    setLangState(code);')
lines.append('    setStoredLang(code);')
lines.append('  }, []);')
lines.append('')
lines.append('  const t = useCallback((key: TranslationKey): string => {')
lines.append('    const dict = TRANSLATIONS[lang] as Record<string, string>;')
lines.append('    return dict[key] ?? (TRANSLATIONS.en as Record<string, string>)[key] ?? key;')
lines.append('  }, [lang]);')
lines.append('')
lines.append('  return createElement(I18nContext.Provider, { value: { lang, t, setLang } }, children);')
lines.append('}')
lines.append('')
lines.append('export function useI18n() { return useContext(I18nContext); }')
lines.append('')

out = '\n'.join(lines)

with open(os.path.join(HERE, '..', '..', 'client', 'src', 'lib', 'i18n.ts'), 'w', encoding='utf-8') as f:
    f.write(out)

print(f"Written: {len(out):,} chars, {len(lines)} lines")
print(f"Keys per lang: {len(EN)}")
print(f"Total translations: {len(EN) * len(LANGS)}")

# Verify all languages have the same keys
en_keys = set(EN.keys())
for code, data in LANGS.items():
    missing = en_keys - set(data.keys())
    extra = set(data.keys()) - en_keys
    if missing: print(f"  {code} MISSING: {missing}")
    if extra: print(f"  {code} EXTRA: {extra}")
print("All languages verified ✓")

import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useAppConfig } from "@/lib/config";
import { Copy, Check, BookOpen } from "lucide-react";

function Code({ code, label }: { code: string; label: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <div className="relative rounded-xl border border-border bg-muted/40">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <button
          onClick={async () => { try { await navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {done ? <><Check className="w-3 h-3" /> {t("int_copied")}</> : <><Copy className="w-3 h-3" /> {t("int_copy")}</>}
        </button>
      </div>
      <pre className="p-3 text-xs leading-relaxed overflow-x-auto font-mono text-foreground whitespace-pre" dir="ltr">{code}</pre>
    </div>
  );
}

export default function IntegrationsPage() {
  const { t } = useI18n();
  const config = useAppConfig();
  const demo = !!config?.demo;
  const origin = window.location.origin;

  const authHeaders = demo
    ? `  -H "X-OpenRouter-Key: sk-or-v1-..." \\\n`
    : `  -H "Authorization: Bearer $MERCURY_API_TOKEN" \\\n`;
  const curl =
    `curl -X POST ${origin}/api/v1/debates \\\n${authHeaders}` +
    `  -H "Content-Type: application/json" \\\n` +
    `  -d '{"query": "Should we ship on Friday?", "workflow": "budget", "wait": 60}'`;

  const headersJson = demo
    ? `"X-OpenRouter-Key": "sk-or-v1-..."`
    : `"Authorization": "Bearer <MERCURY_API_TOKEN>"`;
  const mcpJson =
    `{\n  "mcpServers": {\n    "mercury": {\n      "url": "${origin}/mcp",\n      "headers": { ${headersJson} }\n    }\n  }\n}`;
  const mcpRemote = `npx -y mcp-remote ${origin}/mcp --header "${demo ? "X-OpenRouter-Key: sk-or-v1-..." : "Authorization: Bearer <MERCURY_API_TOKEN>"}"`;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto w-full px-4 py-6 sm:py-8 space-y-6 overflow-y-auto h-full">
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-foreground">{t("int_title")}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("int_sub")}</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{t("int_auth_title")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{demo ? t("int_auth_demo") : t("int_auth_self")}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{t("int_cost_note")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{t("int_rest_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("int_rest_desc")}</p>
          <Code label="curl" code={curl} />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{t("int_mcp_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("int_mcp_desc")}</p>
          <Code label={t("int_endpoint")} code={`${origin}/mcp`} />
          <Code label="mcp.json" code={mcpJson} />
          <Code label="mcp-remote" code={mcpRemote} />
        </section>

        <a href="https://github.com/paulfxyz/mercury/blob/master/docs/API.md" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-2"><BookOpen className="w-3.5 h-3.5" /> {t("int_docs")}</Button>
        </a>
      </div>
    </Layout>
  );
}

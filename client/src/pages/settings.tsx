import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/App";
import { useSessionKey } from "@/App";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Eye, EyeOff, Sun, Moon, Trash2, CheckCircle2, ExternalLink,
  ChevronDown, ChevronUp, Unlink, KeyRound, Sparkles, Plus,
  Star, StarOff, Clock, Server, Check,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface SavedKey { id: string; label: string; masked: string; isPrimary: number; createdAt: number; }

// ─── Add Key Form ────────────────────────────────────────────
function AddKeyForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [show, setShow] = useState(false);

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/keys", {
      value: value.trim(),
      label: label.trim() || undefined,
      isPrimary: false,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: t("toast_key_added") });
      onDone();
    },
    onError: () => toast({ title: t("toast_key_add_error"), variant: "destructive" }),
  });

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <p className="text-xs font-medium text-foreground">{t("add_key_new")}</p>
      <Input
        type={show ? "text" : "password"}
        placeholder="sk-or-v1-…"
        value={value}
        onChange={e => setValue(e.target.value)}
        className="font-mono text-sm"
        autoFocus
      />
      <div className="flex gap-2">
        <Input
          placeholder={t("label_placeholder_settings")}
          value={label}
          onChange={e => setLabel(e.target.value)}
          className="text-sm flex-1"
        />
        <button
          onClick={() => setShow(!show)}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onDone} className="flex-1">{t("btn_cancel")}</Button>
        <Button
          size="sm"
          onClick={() => addMutation.mutate()}
          disabled={value.trim().length < 10 || addMutation.isPending}
          className="flex-1"
        >
          {addMutation.isPending ? t("btn_saving") : t("btn_add_key")}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { theme, set: setTheme } = useTheme();
  const { sessionKey, setKey: setSessionKey } = useSessionKey();
  const { toast } = useToast();
  const [showDanger, setShowDanger] = useState(false);
  const [addingKey, setAddingKey] = useState(false);
  const [sessionInput, setSessionInput] = useState("");
  const [showSessionInput, setShowSessionInput] = useState(false);
  const [showSessionVal, setShowSessionVal] = useState(false);

  const { data: keysData, isLoading: keysLoading } = useQuery<{ keys: SavedKey[]; hasLegacyKey: boolean }>({
    queryKey: ["/api/keys"],
    staleTime: 0,
  });

  const primaryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/keys/${id}/primary`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: t("toast_primary_updated") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/keys/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: t("toast_key_removed") });
    },
    onError: () => toast({ title: t("toast_key_remove_error"), variant: "destructive" }),
  });

  const migratesMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/keys/migrate-legacy"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      toast({ title: t("toast_migrated") });
    },
  });

  const clearSessionsMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/sessions"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: t("toast_history_deleted_title"), description: t("toast_history_deleted_desc") });
    },
  });

  const savedKeys = keysData?.keys ?? [];
  const hasLegacyKey = keysData?.hasLegacyKey ?? false;

  return (
    <Layout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-6 pb-12 space-y-5">

          {/* Header */}
          <div>
            <h1 className="text-base font-semibold text-foreground">{t("settings_title")}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{t("settings_sub")}</p>
          </div>

          {/* ── API Keys ─────────────────────────────────────── */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{t("api_keys_heading")}</span>
              </div>
              <button
                onClick={() => setAddingKey(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {t("add_key_btn")}
              </button>
            </div>

            <div className="p-4 space-y-4">

              {/* Legacy key migration banner */}
              {hasLegacyKey && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{t("legacy_key_title")}</p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">{t("legacy_key_desc")}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => migratesMutation.mutate()} className="flex-shrink-0 text-xs h-7">
                    {migratesMutation.isPending ? t("btn_migrating") : t("btn_migrate")}
                  </Button>
                </div>
              )}

              {/* Saved keys list */}
              {keysLoading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <div key={i} className="h-14 skeleton rounded-lg" />)}
                </div>
              ) : savedKeys.length === 0 && !hasLegacyKey ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">{t("no_keys")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("no_keys_sub")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedKeys.map(k => (
                    <div key={k.id} className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all",
                      k.isPrimary ? "border-foreground/30 bg-accent/20" : "border-border"
                    )}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{k.label}</p>
                          {k.isPrimary === 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-foreground text-background font-semibold">
                              {t("primary_badge")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{k.masked}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {k.isPrimary !== 1 && (
                          <button
                            onClick={() => primaryMutation.mutate(k.id)}
                            disabled={primaryMutation.isPending}
                            title={t("set_as_primary")}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            <StarOff className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {k.isPrimary === 1 && (
                          <span className="p-1.5 text-amber-500" title={t("primary_key")}>
                            <Star className="w-3.5 h-3.5 fill-current" />
                          </span>
                        )}
                        <button
                          onClick={() => confirm(t("confirm_remove_key")) && deleteMutation.mutate(k.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add key form */}
              {addingKey && <AddKeyForm onDone={() => setAddingKey(false)} />}

            </div>
          </div>

          {/* ── Session Key ──────────────────────────────────── */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{t("session_key_heading")}</span>
              </div>
              {sessionKey && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  {t("session_key_active")}
                </span>
              )}
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("session_key_desc")}
              </p>
              {sessionKey ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-900/20">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">{t("session_key_is_active")}</p>
                    <p className="text-xs text-green-700/80 dark:text-green-400/80 font-mono mt-0.5">
                      {sessionKey.slice(0, 10)}••••••••{sessionKey.slice(-4)}
                    </p>
                  </div>
                  <button
                    onClick={() => { setSessionKey(null); toast({ title: "Session key cleared." }); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Unlink className="w-3.5 h-3.5" /> {t("btn_clear")}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {!showSessionInput ? (
                    <button
                      onClick={() => setShowSessionInput(true)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="w-4 h-4" /> {t("btn_use_session_key")}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          type={showSessionVal ? "text" : "password"}
                          placeholder="sk-or-v1-…"
                          value={sessionInput}
                          onChange={e => setSessionInput(e.target.value)}
                          className="pr-10 font-mono text-sm"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === "Enter" && sessionInput.trim().length > 10) {
                              setSessionKey(sessionInput.trim());
                              setSessionInput("");
                              setShowSessionInput(false);
                              toast({ title: t("toast_session_key_title"), description: "Cleared when you close this tab." });
                            }
                          }}
                        />
                        <button
                          onClick={() => setShowSessionVal(!showSessionVal)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showSessionVal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setShowSessionInput(false); setSessionInput(""); }} className="flex-1">{t("btn_cancel")}</Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSessionKey(sessionInput.trim());
                            setSessionInput("");
                            setShowSessionInput(false);
                            toast({ title: t("toast_session_key_title"), description: "Cleared when you close this tab." });
                          }}
                          disabled={sessionInput.trim().length < 10}
                          className="flex-1"
                        >
                          {t("btn_activate")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Appearance ──────────────────────────────────── */}
          <div className="border border-border rounded-xl p-4 bg-card space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{t("appearance_heading")}</h2>
            <div className="grid grid-cols-2 gap-2">
              {(["light", "dark"] as const).map(th => (
                <button
                  key={th}
                  data-testid={`btn-${th}-mode`}
                  onClick={() => setTheme(th)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all",
                    theme === th
                      ? "border-foreground bg-accent text-foreground font-medium"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  {th === "light" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {th === "light" ? t("theme_light") : t("theme_dark")}
                  {theme === th && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* ── About ───────────────────────────────────────── */}
          <div className="border border-border rounded-xl p-4 bg-card space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{t("about_heading")}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("about_version")}</span>
                <span className="font-mono text-xs text-foreground">{__APP_VERSION__}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("about_powered")}</span>
                <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-foreground flex items-center gap-1 hover:opacity-70 transition-opacity">
                  OpenRouter <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("about_source")}</span>
                <a href="https://github.com/paulfxyz/mercury" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-foreground flex items-center gap-1 hover:opacity-70 transition-opacity">
                  github.com/paulfxyz/mercury <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* ── Danger zone ─────────────────────────────────── */}
          <div className="border border-destructive/30 rounded-xl p-4 space-y-3">
            <button
              onClick={() => setShowDanger(!showDanger)}
              className="w-full flex items-center justify-between text-sm font-semibold text-destructive"
            >
              {t("danger_zone")}
              {showDanger ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showDanger && (
              <div className="space-y-3 pt-1 border-t border-destructive/20">
                <div className="flex items-start justify-between gap-4 pt-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("delete_inquiries_title")}</p>
                    <p className="text-xs text-muted-foreground">{t("delete_inquiries_desc")}</p>
                  </div>
                  <Button
                    data-testid="btn-delete-all-sessions"
                    variant="destructive"
                    size="sm"
                    onClick={() => confirm(t("confirm_delete_all")) && clearSessionsMutation.mutate()}
                    disabled={clearSessionsMutation.isPending}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    {clearSessionsMutation.isPending ? t("btn_deleting") : t("btn_delete_all")}
                  </Button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}

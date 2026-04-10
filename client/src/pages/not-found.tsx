import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";

export default function NotFoundPage() {
  const [, navigate] = useLocation();
  const { t } = useI18n();

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold text-foreground">{t("not_found_title")}</h1>
      <p className="text-sm text-muted-foreground">{t("not_found_sub")}</p>
      <button
        onClick={() => navigate("/chat")}
        className="text-sm underline underline-offset-2 text-foreground hover:opacity-70 transition-opacity"
      >
        {t("btn_go_home")}
      </button>
    </div>
  );
}

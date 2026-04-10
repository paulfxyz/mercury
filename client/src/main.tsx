import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider } from "@/lib/i18n";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);

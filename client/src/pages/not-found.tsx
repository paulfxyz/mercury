import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
      <div className="text-6xl font-display font-900 text-primary/20">404</div>
      <div className="text-lg font-semibold">Page not found</div>
      <button
        onClick={() => navigate("/")}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all"
      >
        Back to Mercury
      </button>
    </div>
  );
}

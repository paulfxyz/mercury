import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
      <span className="text-4xl select-none">☿</span>
      <h1 className="text-lg font-semibold text-foreground">Page not found</h1>
      <p className="text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
      <Link href="/chat">
        <a className="text-sm text-foreground underline underline-offset-2 hover:opacity-70 transition-opacity">
          Go to chat
        </a>
      </Link>
    </div>
  );
}

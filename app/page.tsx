// app/page.tsx
// Temporary landing page placeholder — replaced in Phase 5 (UI Polish)

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center space-y-3">
        <h1 className="text-5xl font-bold text-brand-gold tracking-tight">
          Watch Party
        </h1>
        <p className="text-brand-muted text-lg max-w-md">
          Watch movies, shows, and videos together with friends and family —
          in real time.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <a href="/dashboard" className="btn-primary text-center">
          Get Started
        </a>
        <a href="/auth/signin" className="btn-ghost text-center">
          Sign In
        </a>
      </div>

      {/* Phase badge — remove before launch */}
      <span className="text-xs text-brand-muted border border-brand-border rounded-full px-3 py-1">
        Phase 1 — Foundation ✓
      </span>
    </main>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            M
          </span>
          <div>
            <p className="text-sm font-medium text-slate-900">Money Calendar</p>
            <p className="text-xs text-slate-500">Budget First Financial Routine</p>
          </div>
        </div>
      </div>
    </header>
  );
}

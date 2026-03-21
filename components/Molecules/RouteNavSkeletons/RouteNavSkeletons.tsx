/** Layout-shaped placeholders for route `loading.tsx` — less jarring than a full-page spinner. */
export function PerfumeRouteSkeleton() {
  return (
    <div
      className="inner-container min-h-screen py-6"
      aria-busy="true"
      aria-label="Loading perfume"
    >
      <div className="animate-pulse space-y-10">
        <div className="mx-auto h-[min(42vh,22rem)] max-w-4xl rounded-2xl bg-white/10" />
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="h-40 rounded-lg border border-noir-gold/25 bg-white/5" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="h-56 rounded-lg bg-white/5 lg:col-span-1" />
            <div className="h-56 rounded-lg bg-white/5 lg:col-span-2" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ExchangeRouteSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading exchange">
      <div className="title-banner animate-pulse">
        <div className="mx-auto h-32 max-w-xl rounded-lg bg-white/10" />
      </div>
      <div className="inner-container py-6">
        <div className="mx-auto mb-6 h-12 max-w-md rounded-md bg-white/10" />
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i}>
              <div className="h-72 rounded-lg border border-noir-gold/20 bg-white/5" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

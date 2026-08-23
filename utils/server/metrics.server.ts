/**
 * Lightweight production metrics helpers (structured logs + optional in-memory rollups).
 * Safe for serverless — no Redis required.
 */

type MetricTags = Record<string, string | number | boolean | undefined>

const timings: Array<{ name: string; ms: number; at: number }> = []
const counters = new Map<string, number>()

const MAX_TIMINGS = 500

export const recordTiming = (name: string, ms: number, tags?: MetricTags): void => {
  timings.push({ name, ms, at: Date.now() })
  if (timings.length > MAX_TIMINGS) timings.shift()
  console.info(
    JSON.stringify({
      type: "metric_timing",
      name,
      ms: Math.round(ms),
      ...(tags ?? {}),
    })
  )
}

export const incrementCounter = (name: string, by = 1, tags?: MetricTags): void => {
  counters.set(name, (counters.get(name) ?? 0) + by)
  console.info(
    JSON.stringify({
      type: "metric_counter",
      name,
      by,
      total: counters.get(name),
      ...(tags ?? {}),
    })
  )
}

export const withTiming = async <T>(
  name: string,
  fn: () => Promise<T>,
  tags?: MetricTags
): Promise<T> => {
  const start = Date.now()
  try {
    return await fn()
  } finally {
    recordTiming(name, Date.now() - start, tags)
  }
}

export const getMetricsSnapshot = () => {
  const byName = new Map<string, number[]>()
  for (const t of timings) {
    const arr = byName.get(t.name) ?? []
    arr.push(t.ms)
    byName.set(t.name, arr)
  }
  const summaries: Record<string, { count: number; p50: number; p95: number; max: number }> = {}
  for (const [name, values] of byName) {
    const sorted = [...values].sort((a, b) => a - b)
    const pct = (p: number) =>
      sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0
    summaries[name] = {
      count: sorted.length,
      p50: pct(50),
      p95: pct(95),
      max: sorted[sorted.length - 1] ?? 0,
    }
  }
  return {
    timings: summaries,
    counters: Object.fromEntries(counters),
  }
}

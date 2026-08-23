/**
 * Performance monitoring types for the dashboard (navigation timing, web vitals).
 */

export interface CoreWebVitals {
  lcp: number
  /** Legacy alias; prefer `inp` when available */
  fid: number
  /** Interaction to Next Paint (replaces FID) */
  inp: number
  cls: number
  fcp: number
  ttfb: number
  tti: number
}

export interface PerformanceMetrics {
  dns: number
  tcp: number
  ttfb: number
  domContentLoaded: number
  loadComplete: number
}

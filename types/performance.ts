/**
 * Performance monitoring types for the dashboard (navigation timing, web vitals).
 */

export interface CoreWebVitals {
  lcp: number
  fid: number
  cls: number
  fcp: number
  tti: number
}

export interface PerformanceMetrics {
  dns: number
  tcp: number
  ttfb: number
  domContentLoaded: number
  loadComplete: number
}

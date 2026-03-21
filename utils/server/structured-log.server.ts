import { headers } from "next/headers"

export type StructuredLogLevel = "info" | "warn" | "error"

/**
 * Best-effort correlation ID from middleware-injected header (request scope only).
 */
export async function getRequestCorrelationId(): Promise<string | undefined> {
  try {
    const h = await headers()
    return h.get("x-correlation-id")?.trim() || undefined
  } catch {
    return undefined
  }
}

/**
 * Single-line JSON log for aggregation (e.g. Pino/Datadog/Loki). Includes correlationId when in a request.
 */
export async function structuredLog(
  level: StructuredLogLevel,
  message: string,
  fields: Record<string, unknown> = {}
): Promise<void> {
  const correlationId = await getRequestCorrelationId()
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(correlationId ? { correlationId } : {}),
    ...fields,
  }
  const line = JSON.stringify(entry)
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

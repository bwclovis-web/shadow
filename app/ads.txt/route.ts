import { buildAdsTxtLine, getAdSenseClientId } from "@/utils/ads/should-show-ads"

export const runtime = "nodejs"

/**
 * Served whenever a publisher ID is configured, independent of
 * NEXT_PUBLIC_ADSENSE_ENABLED — AdSense checks ads.txt during site approval.
 */
export const GET = () => {
  const line = buildAdsTxtLine(getAdSenseClientId())
  if (!line) {
    return new Response("Not found", { status: 404 })
  }

  return new Response(`${line}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  })
}

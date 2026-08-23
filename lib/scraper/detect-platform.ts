/**
 * Platform / captcha / selector detection from a collection URL (HTTP probe).
 * Pure helpers are exported for fixture-based unit tests (no network).
 */

import type { DiscoveryMode } from "@/types/scraper"

export type DetectedPlatform = "shopify" | "woocommerce" | "etsy" | "wix" | "unknown"

export type SelectorPack = {
  productLinkSelector: string
  nameSelector: string
  descriptionSelector: string
  imageSelector: string
  notesSelector?: string
}

export const SHOPIFY_SELECTOR_PACK: SelectorPack = {
  productLinkSelector: "a[href*='/products/']",
  nameSelector: "h1",
  // Damask Haus uses .product-description; Dawn-like themes use .product__description / .rte
  descriptionSelector: ".product-description, .product__description, .rte",
  imageSelector: ".product__media img",
}

export const WOOCOMMERCE_SELECTOR_PACK: SelectorPack = {
  productLinkSelector: "a[href*='/product/']",
  nameSelector: "h1.product_title, .product_title, h1",
  descriptionSelector:
    ".woocommerce-product-details__short-description, #tab-description, .woocommerce-Tabs-panel--description",
  imageSelector:
    ".woocommerce-product-gallery__image img, .woocommerce-product-gallery img, img.wp-post-image",
}

export const ETSY_SELECTOR_PACK: SelectorPack = {
  productLinkSelector: "a[href*='/listing/']",
  nameSelector: "h1[data-buy-box-listing-title], h1",
  descriptionSelector: "[data-id='description-text'], #wt-content-toggle-product-details-read-more",
  imageSelector: "img[data-carousel-first-image], ul[data-carousel-pagination] img, img",
}

/** Wix Stores — /product-page/{slug}; notes often live in the product description text. */
export const WIX_SELECTOR_PACK: SelectorPack = {
  productLinkSelector: "a[href*='/product-page/']",
  nameSelector: "h1, [data-hook='ProductTitle'], [data-hook='product-title']",
  descriptionSelector:
    "[data-hook='description'], [data-hook='product-description'], [data-hook='InfoSection.Description'], [data-hook='content-viewer']",
  imageSelector:
    "[data-hook='main-media-image'] img, [data-hook='product-image'] img, img[data-hook='wow-image'], .gallery-item img",
  // Prefer description-scoped notes; body is gallery-prone on Wix.
  notesSelector: undefined,
}

export const selectorPackForPlatform = (platform: DetectedPlatform): SelectorPack => {
  if (platform === "shopify") return SHOPIFY_SELECTOR_PACK
  if (platform === "woocommerce") return WOOCOMMERCE_SELECTOR_PACK
  if (platform === "etsy") return ETSY_SELECTOR_PACK
  if (platform === "wix") return WIX_SELECTOR_PACK
  return SHOPIFY_SELECTOR_PACK
}

export const discoveryModeForPlatform = (platform: DetectedPlatform): DiscoveryMode => {
  if (platform === "shopify") return "shopify"
  if (platform === "woocommerce") return "woocommerce"
  if (platform === "etsy") return "auto"
  if (platform === "wix") return "sitemap"
  return "auto"
}

export const isCaptchaOrBlockedHtml = (html: string, statusCode?: number): boolean => {
  if (statusCode === 202 || statusCode === 403 || statusCode === 503) return true
  const body = (html ?? "").toLowerCase()
  if (!body) return false
  return (
    body.includes("sgcaptcha") ||
    body.includes(".well-known/sgcaptcha") ||
    body.includes("cf-challenge") ||
    body.includes("cf_chl") ||
    body.includes("just a moment") ||
    body.includes("checking your browser") ||
    body.includes("attention required") ||
    body.includes("access denied") ||
    body.includes("captcha")
  )
}

export const detectPlatformFromSignals = (opts: {
  host: string
  html?: string
  productsJsonOk?: boolean
  wooStoreApiOk?: boolean
}): DetectedPlatform => {
  const host = opts.host.toLowerCase()
  if (host.includes("etsy.com")) return "etsy"
  if (opts.productsJsonOk) return "shopify"
  if (opts.wooStoreApiOk) return "woocommerce"
  const html = (opts.html ?? "").toLowerCase()
  // Wix before Woo: "product" appears in /product-page/ and can confuse loose HTML checks.
  if (
    html.includes("wix.com website builder") ||
    html.includes("static.wixstatic.com") ||
    html.includes("static.parastorage.com") ||
    html.includes("x-wix-request-id") ||
    html.includes("/product-page/") ||
    html.includes("wix-essential-viewer-model")
  ) {
    return "wix"
  }
  if (
    html.includes("cdn.shopify.com") ||
    html.includes("shopify.theme") ||
    html.includes("shopify-section") ||
    html.includes("/products.json")
  ) {
    return "shopify"
  }
  if (
    html.includes("woocommerce") ||
    html.includes("wp-content/plugins/woocommerce") ||
    html.includes("wc-block") ||
    html.includes("product-type-simple")
  ) {
    return "woocommerce"
  }
  return "unknown"
}

export const extractSuggestedSiteName = (html: string): string | null => {
  const og =
    html.match(
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    )?.[1] ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
    )?.[1]
  if (og?.trim()) return og.trim()
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
  if (!title?.trim()) return null
  return title
    .replace(/\s*[|\-–—].*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || null
}

/** True when plain text looks like a labeled Head/Heart/Base (or Top/Mid/Base) pyramid. */
export const htmlHasLabeledNotePyramid = (html: string): boolean => {
  const t = html.replace(/<[^>]+>/g, " ")
  const hasOpen = /\b(?:head|top|opening)\s+notes?\s*:/i.test(t)
  const hasHeart = /\b(?:heart|middle|mid|core)\s+notes?\s*:/i.test(t)
  const hasBase = /\bbase\s+notes?\s*:/i.test(t)
  return hasOpen && hasHeart && hasBase
}

export type ScraperDetectResult = {
  ok: true
  platform: DetectedPlatform
  platformHint: DetectedPlatform
  discoveryMode: DiscoveryMode
  baseUrl: string
  needsHeaded: boolean
  needsEtsyHeaded: boolean
  suggestedHouseName: string | null
  selectors: SelectorPack
  notesSelector?: string
  captchaDetected: boolean
  warnings: string[]
}

export type ScraperDetectError = {
  ok: false
  error: string
}

const FETCH_TIMEOUT_MS = 12_000

const fetchText = async (
  url: string,
  signal?: AbortSignal,
): Promise<{ status: number; text: string; ok: boolean }> => {
  const { safeFetchText } = await import("@/utils/server/safe-fetch-url.server")
  return safeFetchText(url, {
    signal,
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: 2 * 1024 * 1024,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ShadowScraperDetect/1.0; +https://theshadow.club)",
      Accept: "text/html,application/json,*/*",
    },
  })
}

export const detectScraperFromCollectionUrl = async (
  collectionUrl: string,
  options?: { sampleProductUrl?: string; signal?: AbortSignal },
): Promise<ScraperDetectResult | ScraperDetectError> => {
  const { validateSafeHttpUrl } = await import("@/utils/server/safe-fetch-url.server")
  const safeUrl = await validateSafeHttpUrl(collectionUrl)
  if (!safeUrl.ok) {
    return { ok: false, error: safeUrl.error }
  }
  const parsed = safeUrl.url

  const origin = parsed.origin
  const host = parsed.hostname
  const warnings: string[] = []

  let html = ""
  let htmlStatus = 0
  let captchaDetected = false

  try {
    const page = await fetchText(collectionUrl, options?.signal)
    html = page.text
    htmlStatus = page.status
    if (isCaptchaOrBlockedHtml(html, page.status)) {
      captchaDetected = true
      warnings.push("Collection URL looks captcha/bot-blocked — enable Open visible browser.")
    }
  } catch {
    warnings.push("Could not fetch collection page HTML (network error).")
  }

  let productsJsonOk = false
  let wooStoreApiOk = false

  if (!captchaDetected || host.includes("etsy.com")) {
    try {
      const pj = await fetchText(`${origin}/products.json?limit=1`, options?.signal)
      if (pj.ok && /"products"\s*:/.test(pj.text)) productsJsonOk = true
    } catch {
      /* ignore */
    }
    try {
      const woo = await fetchText(`${origin}/wp-json/wc/store/products?per_page=1`, options?.signal)
      if (woo.ok && /^\s*\[/.test(woo.text)) wooStoreApiOk = true
    } catch {
      /* ignore */
    }
  }

  const platform = detectPlatformFromSignals({
    host,
    html,
    productsJsonOk,
    wooStoreApiOk,
  })

  const needsEtsyHeaded = platform === "etsy" || host.includes("etsy.com")
  const needsHeaded =
    captchaDetected ||
    needsEtsyHeaded ||
    isCaptchaOrBlockedHtml(html, htmlStatus) ||
    /artisticfragrances\.com/i.test(host)

  const selectors = selectorPackForPlatform(platform)
  // Never set notesSelector to "body" — document-wide textContent includes Shopify
  // gallery zoom a11y chrome (Esc / arrow keys). Prefer description pack + product JSON.
  const notesSelector: string | undefined = undefined

  const sampleUrl = options?.sampleProductUrl?.trim()
  if (sampleUrl && /^https?:\/\//i.test(sampleUrl)) {
    try {
      const pdp = await fetchText(sampleUrl, options?.signal)
      if (!isCaptchaOrBlockedHtml(pdp.text, pdp.status) && htmlHasLabeledNotePyramid(pdp.text)) {
        warnings.push(
          "Sample PDP has a labeled Head/Heart/Base pyramid — notes come from product description / Shopify JSON (not body).",
        )
      }
    } catch {
      warnings.push("Sample product URL could not be fetched.")
    }
  }

  const suggestedHouseName = html ? extractSuggestedSiteName(html) : null

  return {
    ok: true,
    platform,
    platformHint: platform,
    discoveryMode: discoveryModeForPlatform(platform),
    baseUrl: origin,
    needsHeaded,
    needsEtsyHeaded,
    suggestedHouseName,
    selectors,
    notesSelector,
    captchaDetected,
    warnings,
  }
}

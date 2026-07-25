import { describe, expect, it } from "vitest"

import {
  detectPlatformFromSignals,
  extractSuggestedSiteName,
  htmlHasLabeledNotePyramid,
  isCaptchaOrBlockedHtml,
  selectorPackForPlatform,
} from "./detect-platform"

describe("detect-platform", () => {
  it("detects Shopify from products.json signal", () => {
    expect(
      detectPlatformFromSignals({ host: "shop.example.com", productsJsonOk: true }),
    ).toBe("shopify")
  })

  it("detects WooCommerce from store API signal", () => {
    expect(
      detectPlatformFromSignals({ host: "brand.example.com", wooStoreApiOk: true }),
    ).toBe("woocommerce")
  })

  it("detects Etsy from host", () => {
    expect(detectPlatformFromSignals({ host: "www.etsy.com" })).toBe("etsy")
  })

  it("detects Shopify from HTML markers", () => {
    expect(
      detectPlatformFromSignals({
        host: "example.com",
        html: '<script src="https://cdn.shopify.com/s/files/1/theme.js"></script>',
      }),
    ).toBe("shopify")
  })

  it("detects WooCommerce from HTML markers", () => {
    expect(
      detectPlatformFromSignals({
        host: "example.com",
        html: '<body class="woocommerce-page"><div class="woocommerce"></div></body>',
      }),
    ).toBe("woocommerce")
  })

  it("flags SiteGround captcha HTML", () => {
    expect(isCaptchaOrBlockedHtml("<html>sgcaptcha challenge</html>", 202)).toBe(true)
  })

  it("extracts og:site_name", () => {
    expect(
      extractSuggestedSiteName(
        '<html><meta property="og:site_name" content="Milano Fragranze" /></html>',
      ),
    ).toBe("Milano Fragranze")
  })

  it("detects labeled note pyramid in HTML", () => {
    expect(
      htmlHasLabeledNotePyramid(
        "<p>Head Notes: bergamot</p><p>Heart Notes: rose</p><p>Base Notes: musk</p>",
      ),
    ).toBe(true)
    expect(htmlHasLabeledNotePyramid("<p>A lovely scent with bergamot.</p>")).toBe(false)
  })

  it("detects Wix from HTML markers", () => {
    expect(
      detectPlatformFromSignals({
        host: "www.aoeperfumery.com",
        html: '<meta name="generator" content="Wix.com Website Builder"/><a href="/product-page/continue">',
      }),
    ).toBe("wix")
  })

  it("returns Wix selector pack for wix", () => {
    const pack = selectorPackForPlatform("wix")
    expect(pack.productLinkSelector).toContain("/product-page/")
  })

  it("returns Woo selector pack for woocommerce", () => {
    const pack = selectorPackForPlatform("woocommerce")
    expect(pack.productLinkSelector).toContain("/product/")
  })
})

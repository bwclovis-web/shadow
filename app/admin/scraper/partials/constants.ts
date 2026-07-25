export const SCRAPER_SAVED_RESULT_KEY = "scraper-last-result"

export const SHOPIFY_DEFAULTS = {
  productLinkSelector: "a[href*='/products/']",
  nameSelector: "h1",
  descriptionSelector: ".product-description, .product__description, .rte",
  imageSelector: ".product__media img",
}

export const WOOCOMMERCE_DEFAULTS = {
  productLinkSelector: "a[href*='/product/']",
  nameSelector: "h1.product_title, .product_title, h1",
  descriptionSelector:
    ".woocommerce-product-details__short-description, #tab-description, .woocommerce-Tabs-panel--description",
  imageSelector:
    ".woocommerce-product-gallery__image img, .woocommerce-product-gallery img, img.wp-post-image",
}

export const ETSY_DEFAULTS = {
  productLinkSelector: "a[href*='/listing/']",
  nameSelector: "h1[data-buy-box-listing-title], h1",
  descriptionSelector: "[data-id='description-text'], #wt-content-toggle-product-details-read-more",
  imageSelector: "ul[data-carousel-pagination] img, img[data-carousel-first-image], img",
}

export const WIX_DEFAULTS = {
  productLinkSelector: "a[href*='/product-page/']",
  nameSelector: "h1, [data-hook='ProductTitle'], [data-hook='product-title']",
  descriptionSelector:
    "[data-hook='description'], [data-hook='product-description'], [data-hook='InfoSection.Description'], [data-hook='content-viewer']",
  imageSelector:
    "[data-hook='main-media-image'] img, [data-hook='product-image'] img, img[data-hook='wow-image'], .gallery-item img",
}

export const SECTION_CLASS =
  "flex flex-col gap-4 rounded-lg border border-border p-4 bg-noir-dark border-noir-gold text-noir-gold-100"

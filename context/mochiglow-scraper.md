# Mochiglow scraper

## 2026-08-22 — First CSV review

Reviewed `perfumes_mochiglow.csv` (18 rows). Recurring failures:

- **Non-perfume SKUs** came through: gift card (`/products/mochiglow-gift-card`), Teddy Bear wax warmer, and **Oopsie / old formula** leftover bottles. The old gift-card URL regex only matched slugs that *started* with `gift-card`.
- **Titles** on reviewed EDPs were Judge.me chrome (`Customer Reviews Based On Reviews Write A Review % % %…`) instead of `Cereal Milk Perfume`. That also blocked noir because the name no longer matched the PDP slug.
- **Notes** on leftover PDPs were theme classes (`no-js`, `article`, `pagetransition`). Pandan Coconut uses unlabeled `Fragrance Notes` with **pipe** separators (`pandan leaf | creamy coconut milk | sweet lemongrass`) and was exported empty. Jasmine Green Tea leaked `which is`.

Adjustments: skip gift-card / wax-warmer / oopsie by URL and name; fall back to the URL slug when the title is a reviews widget; strip leading/trailing catalog `Perfume`; treat those CSS tokens as artifacts; parse pipe-separated Fragrance Notes and stop at Scent Strength / How To Use.

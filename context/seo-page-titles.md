# SEO page titles

## 2026-07-25 — Strip brand from page titles (use root template)

Root layout uses `title.template: "%s | perfumer's hollow"`. Page/i18n titles previously embedded the brand, causing double branding in the document title (e.g. `Sign In - perfumer's hollow | perfumer's hollow`).

**Convention:** page titles are brand-free page names only; brand comes from the template. `buildPageMetadata` / `brandPageTitle` still brand OG/Twitter titles (template does not apply there).

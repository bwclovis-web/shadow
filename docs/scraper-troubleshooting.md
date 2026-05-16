# Scraper troubleshooting

## `net::ERR_CONNECTION_RESET` when loading pages (e.g. Lush)

**Symptom:** The scraper logs something like:

```
Collecting links from: https://www.lush.com/us/en_us/c/cruelty-free-perfume?page=3
Error loading page: Message: unknown error: net::ERR_CONNECTION_RESET
(Session info: chrome=...)
```

**Cause:** The site (or your network) is resetting the TCP connection. Common reasons:

1. **Bot/automation detection** — The site detects headless Chrome or automated traffic and closes the connection.
2. **Rate limiting** — Too many requests in a short time; the server resets the connection instead of returning a 429.
3. **Network/firewall** — Corporate or ISP blocking, or unstable connection.

### What to do in `scraper/run_scraper.py`

1. **Add retries with backoff**  
   When `driver.get(url)` raises (or the page fails to load), retry 2–3 times with increasing delays (e.g. 5s, 15s, 30s) before moving on or failing.

2. **Slow down between collection URLs**  
   Add a delay (e.g. 3–10 seconds) between each collection URL. The API can pass `delayBetweenUrlsMs` in the JSON config; use it in the Python script between `driver.get(collection_url)` calls.

3. **Use a realistic User-Agent**  
   Set Chrome/Chromedriver to use a recent, real browser User-Agent string so the site is less likely to treat the client as a bot.

4. **Reduce headless detection**  
   - Use Chrome options such as `--disable-blink-features=AutomationControlled`, and avoid `excludeSwitches: ['enable-automation']` only if you need it.
   - Consider running in **headed mode** for difficult sites (e.g. a `lushHeaded` or `headed` flag in the config), so you can solve CAPTCHAs or see what the site is doing. The API already supports `etsyHeaded` for Etsy; the same pattern can be used for Lush.

5. **Optional: use undetected-chromedriver**  
   For sites that aggressively block Selenium, [undetected-chromedriver](https://github.com/ultrafunkamsterdam/undetected-chromedriver) can help. It’s a separate dependency and only worth adding if the above isn’t enough.

6. **Respect the site**  
   Keep delays and concurrency conservative. If the site keeps resetting, increase the delay between URLs or run during off-peak times.

### Config options passed to the Python script

The run route sends a JSON object to `run_scraper.py` on stdin. You can extend the script to use:

- **`delayBetweenUrlsMs`** (optional) — Milliseconds to wait between loading each collection URL. Use this to throttle requests (e.g. 5000 for 5 seconds).
- **`retryAttempts`** (optional) — Number of retries for each page load (e.g. 3). Implement in Python with backoff.
- **`etsyHeaded`** — Already supported; opens a visible browser for Etsy. The same idea can be used for other sites (e.g. Lush) by adding a `headed` or site-specific flag and opening a visible window when set.

If these keys are missing from the JSON, use sensible defaults (e.g. no delay, 1 attempt).

---

## Not getting all the pages / missing products

**Symptom:** The scraper returns fewer products than expected, or only from the first few collection URLs.

**Checks:**

1. **Collection URL count** — Under the Collection URLs field, the UI shows “X collection URL(s) — all will be visited”. Confirm this matches the number of listing pages you expect (e.g. one line per page: page 1, page 2, page 3). You can paste one URL per line or comma-separated; only lines starting with `http://` or `https://` are used.

2. **Timeouts / connection resets** — If some collection pages never load, you’ll see “Warning: timed out waiting for product links” or `ERR_CONNECTION_RESET` for those URLs. Use **Delay between collection URLs (ms)** (e.g. 5000) and **Retry attempts per page** (e.g. 3) so the Python script retries and waits between URLs. Implement `delayBetweenUrlsMs` and `retryAttempts` in `run_scraper.py` (see above).

3. **Product link selector** — The scraper waits for links matching your **Product link selector**. If the selector doesn’t match the site’s URLs, you get “timed out waiting for product links”. The script now tries a fallback when the primary times out (e.g. `a[href*='/product/']` if you used `a[href*='/products/']`). For **thoo.it** and similar WooCommerce-style sites, product URLs are `/product/...` (singular). You can set the selector to `a[href*='/product/']` explicitly, or leave the default and let the fallback run.

4. **403 Forbidden** — If the site returns **403 Forbidden** (e.g. **thoo.it**), you’ll see a message and 0 product links. First enable **Open visible browser** and run again. If you still get 403 (the site blocks all WebDriver), install **undetected-chromedriver** and run again with **Open visible browser** checked. Run locally (e.g. `npm run dev`).  
   **Installing undetected-chromedriver:** The API runs the scraper with the same Python as the launcher: on Windows it uses `py -3`, so install with **`py -3 -m pip install undetected-chromedriver`** (not plain `pip`, so the package is installed for the same interpreter the scraper uses). If you still see "undetected-chromedriver not installed", set **`SCRAPER_PYTHON`** to the full path of the Python executable that has the package (e.g. `C:\Python314\python.exe`).

3. **Pagination** — The scraper does not auto-follow “Next” links. Add every listing page URL explicitly (e.g. `...?page=1`, `...?page=2`, `...?page=3`).

---

## Missing notes (description inside tab containers)

**Symptom:** The scraper finds the product but note extraction returns few or no notes; the notes are in a tab (e.g. “Ingredients”, “Details”) that isn’t the default visible one.

**Cause:** The description selector targets a tab container. Selenium’s `.text` only returns **visible** text, so content in hidden tab panels was skipped.

**Fix:** The scraper now uses `textContent` for the description element (and fallbacks), so all descendant text is captured including hidden tab panels. Point the **Description selector** at the tab container (or the wrapper that holds all tab panels). Re-run the scrape; notes from every panel should be included.

---

## Request / route timeout

**Symptom:** The scrape stops after about 1–2 minutes with “timeout” or “connection closed”, or the stream ends without a result.

**Cause:** The API route has a maximum duration (e.g. 5 minutes on this app). If the run takes longer (many collection URLs + many products + note extraction), the platform kills the request.

**What to do:**

1. **Run in smaller batches** — Use fewer collection URLs per run (e.g. 2–4 pages), then run again for more pages.
2. **Run locally** — Use `npm run dev` and trigger the scrape from localhost; the dev server may allow longer runs than a deployed environment.
3. **Increase timeout** — The route uses `maxDuration` (seconds). On Vercel Pro you can raise it up to 800 in `app/api/admin/scraper/run/route.ts` if you need longer runs.

---

## Note extraction pipeline (Node / LangGraph)

Admin scraper settings map to `lib/scraper/notes-graph.ts` after Python returns raw items.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_NOTES_PIPELINE_MODEL` | Default OpenAI model for extraction, merge, and translate (e.g. `gpt-4o-mini`). |
| `OPENAI_NOTES_PIPELINE_NOIR_MODEL` | Model for film-noir descriptions; defaults to the extraction model. |
| `OPENAI_NOTES_PIPELINE_TIMEOUT_MS` | Per-request LLM timeout (ms). |
| `NOTES_PIPELINE_CONCURRENCY` | Parallel Phase-1 workers (1–32). |

### Inference mode

- **Standard** — May infer notes from product name / encyclopedia fallback when the page has no merchant list.
- **Strict** — Skips encyclopedia fallback; name-only extraction is literal-only. Some rows may have empty notes (`_noteSource: empty` in preview).

### Preview: `_noteSource` and `batchWarnings`

Records may include `_noteSource` (`labeled_list`, `pdp_bootstrap`, `llm_description`, `llm_name_literal`, `llm_name_inferred`, `empty`). **Admin preview only** — stripped before DB import.

`batchWarnings` surfaces batch-level uniformity (e.g. many products sharing the same notes); check before importing.

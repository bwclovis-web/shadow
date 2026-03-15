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

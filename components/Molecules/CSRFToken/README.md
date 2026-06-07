# CSRF protection

This app uses the **double-submit cookie** pattern. The token is stored in a `_csrf` cookie and must be echoed on mutating requests via the `x-csrf-token` header or a `_csrf` form field.

## How tokens are issued

[`proxy.ts`](../../../proxy.ts) (Next.js middleware) sets the `_csrf` cookie when it is missing:

- `httpOnly: false` — **intentional**; client JavaScript must read the cookie to attach the token to `fetch` and `FormData` requests.
- `sameSite: "lax"`
- `secure: true` in production
- `maxAge`: 7 days

Server-side validation lives in [`utils/server/csrf.server.ts`](../../../utils/server/csrf.server.ts) (`requireCSRF`). API routes and server actions compare the cookie value to the submitted token using timing-safe comparison.

## XSS dependency

Because the cookie is readable by script, **XSS in the app could exfiltrate the CSRF token**. Mitigations:

- Sanitize user-generated HTML (see `utils/sanitize.ts`).
- Avoid `dangerouslySetInnerHTML` except for trusted content.
- Keep dependencies patched; CSP where practical.

CSRF tokens protect against cross-site request forgery; they do not replace XSS prevention.

## Components

### `CSRFToken`

Hidden input for HTML forms:

```tsx
import { CSRFToken } from "@/components/Molecules/CSRFToken"

<form method="POST">
  <CSRFToken />
  <button type="submit">Submit</button>
</form>
```

### `CSRFProtectedForm`

Form wrapper that injects the token automatically.

### `CSRFTokenProvider`

Optional context provider for apps that centralize token state.

## Hooks

### `useCSRF` (preferred)

```tsx
import { useCSRF } from "@/hooks/useCSRF"

const { addToHeaders, submitForm } = useCSRF()

await submitForm("/api/ratings", formData)
```

### `useCSRFToken`

Same API when used inside `CSRFTokenProvider`.

## Client utilities

[`lib/api-client.ts`](../../../lib/api-client.ts) exports shared helpers used by mutations and upload code:

- `getCSRFFromCookie()` — parse `_csrf` from `document.cookie`
- `getCsrfHeaders()` — `{ "x-csrf-token": token }` or `{}`
- `postFormWithCsrf(url, formData)` — POST with token in header and body
- `apiFetch` — JSON fetch with credentials

## Server integration summary

| Layer | Role |
|-------|------|
| `proxy.ts` | Issue `_csrf` cookie (readable by client) |
| `utils/server/csrf.server.ts` | Validate cookie vs header/body on server |
| `lib/api-client.ts` / `useCSRF` | Attach token from cookie on client |

Protected routes include `/api/*` mutations and server actions that call `requireCSRF`.

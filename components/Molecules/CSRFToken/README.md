# CSRF Token Components

This directory contains components and hooks for CSRF (Cross-Site Request Forgery) protection in the application.

## Components

### `CSRFToken`

A simple component that renders a hidden input field with the CSRF token.

```tsx
import { CSRFToken } from '~/components/Molecules/CSRFToken'

// In a form
<form method="POST">
  <CSRFToken />
  <input type="text" name="username" />
  <button type="submit">Submit</button>
</form>

// With custom name
<form method="POST">
  <CSRFToken name="custom_csrf" />
  <input type="text" name="username" />
  <button type="submit">Submit</button>
</form>
```

### `CSRFProtectedForm`

A form wrapper that automatically includes CSRF protection.

```tsx
import { CSRFProtectedForm } from "~/components/Molecules/CSRFToken"
;<CSRFProtectedForm method="POST" action="/api/submit">
  <input type="text" name="username" />
  <button type="submit">Submit</button>
</CSRFProtectedForm>
```

### `CSRFTokenProvider`

A context provider for CSRF token management across the app.

```tsx
import { CSRFTokenProvider } from "~/components/Molecules/CSRFToken"

function App() {
  return <CSRFTokenProvider>{/* Your app components */}</CSRFTokenProvider>
}
```

## Hooks

### `useCSRF`

Hook for accessing CSRF token and utilities.

```tsx
import { useCSRF } from "~/hooks/useCSRF"

function MyComponent() {
  const { csrfToken, addToFormData, addToHeaders, submitForm } = useCSRF()

  const handleSubmit = async (formData: FormData) => {
    // Automatically includes CSRF token
    const response = await submitForm("/api/submit", formData)
  }

  const handleFetch = async () => {
    const headers = addToHeaders({ "Content-Type": "application/json" })
    const response = await fetch("/api/data", { headers })
  }
}
```

### `useCSRFToken`

Hook for accessing CSRF context (must be used within CSRFTokenProvider).

```tsx
import { useCSRFToken } from "~/components/Molecules/CSRFToken"

function MyComponent() {
  const { csrfToken, addToFormData } = useCSRFToken()
  // Same API as useCSRF
}
```

## Server Integration

The CSRF protection works with the server-side middleware in `api/server.js`:

- CSRF tokens are automatically generated and set as HTTP-only cookies
- The `csrfMiddleware` validates tokens on protected routes
- Protected routes: `/auth/*` and `/api/*` (with some exclusions)

## Security Features

- **HTTP-Only Cookies**: Tokens stored securely in cookies
- **SameSite Protection**: `lax` SameSite policy
- **Secure in Production**: HTTPS-only cookies in production
- **24-hour Expiry**: Tokens expire after 24 hours
- **Timing-Safe Validation**: Prevents timing attacks
- **Multiple Input Methods**: Header (`x-csrf-token`) and form field (`_csrf`)

## Usage Examples

### Basic Form Protection

```tsx
import { CSRFToken } from "~/components/Molecules/CSRFToken"
;<form method="POST" action="/api/ratings">
  <CSRFToken />
  <input type="hidden" name="perfumeId" value="123" />
  <input type="number" name="rating" min="1" max="5" />
  <button type="submit">Rate</button>
</form>
```

### API Request Protection

```tsx
import { useCSRF } from "~/hooks/useCSRF"

function RatingComponent() {
  const { submitForm } = useCSRF()

  const handleRating = async (perfumeId: string, rating: number) => {
    const formData = new FormData()
    formData.append("perfumeId", perfumeId)
    formData.append("rating", rating.toString())

    const response = await submitForm("/api/ratings", formData)
    // CSRF token automatically included
  }
}
```

### Custom Headers

```tsx
import { useCSRF } from "~/hooks/useCSRF"

function ApiComponent() {
  const { addToHeaders } = useCSRF()

  const fetchData = async () => {
    const headers = addToHeaders({
      "Content-Type": "application/json",
    })

    const response = await fetch("/api/data", {
      method: "POST",
      headers,
      body: JSON.stringify({ data: "example" }),
    })
  }
}
```

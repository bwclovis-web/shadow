# TanStack Query in this codebase

Query functions, query key factories, and mutation helpers for TanStack Query v5. Hooks live in `hooks/`; this directory holds the fetch layer and cache keys.

## Layout

```
lib/queries/
  ├── houses.ts
  ├── perfumes.ts
  ├── reviews.ts
  ├── user.ts
  ├── compare.ts
  ├── dataQuality.ts
  ├── tags.ts
  ├── traderFeedback.ts
  ├── create-letter-paginated-query.ts
  └── README.md

lib/mutations/
  ├── wishlist.ts
  ├── perfumes.ts
  ├── houses.ts
  ├── follow.ts
  ├── ratings.ts
  └── ...

hooks/
  ├── usePerfume.ts
  ├── useTrader.ts
  ├── useInfinitePerfumes.ts
  └── ...

lib/api-client.ts   # apiFetch, getCsrfHeaders, uploadImage
lib/queryClient.ts  # QueryClient defaults and retry config
```

## Query key pattern

Keys use a hierarchical factory so related cache entries can be invalidated together:

```typescript
export const queryKeys = {
  houses: {
    all: ["houses"] as const,
    lists: () => [...queryKeys.houses.all, "list"] as const,
    list: (filters: HouseFilters) => [...queryKeys.houses.lists(), filters] as const,
    detail: (slug: string) => [...queryKeys.houses.all, "detail", slug] as const,
  },
}
```

Principles:

1. Start with a stable base key (`["houses"]`).
2. Nest with the spread operator for predictable invalidation.
3. Include every filter in the key so cache entries do not collide.
4. Use `as const` for type-safe keys.

## Query functions

Query functions are plain async fetchers. Prefer `apiFetch` from `lib/api-client.ts` when you need consistent error handling and CSRF on mutations; simple GETs may use `fetch` directly.

```typescript
import { apiFetch } from "@/lib/api-client"

export const getPerfumeBySlug = async (slug: string): Promise<PerfumeResponse> =>
  apiFetch(`/api/perfumes/${slug}`)
```

Letter-paginated catalog queries (`houses.ts`, `perfumes.ts`) share `createLetterPaginatedQuery` in `create-letter-paginated-query.ts`.

## Hooks

Hooks wrap `useQuery` / `useMutation` and live in `hooks/`, not in `lib/queries/`.

```typescript
export const usePerfume = (slug: string, initialData?: unknown) =>
  useQuery({
    queryKey: queryKeys.perfumes.detail(slug),
    queryFn: () => getPerfumeBySlug(slug),
    initialData,
    initialDataUpdatedAt: initialData != null ? Date.now() : undefined,
    staleTime: 5 * 60 * 1000,
    enabled: !!slug,
  })
```

## SSR hydration (Next.js App Router)

Server components fetch data in `page.tsx` and pass it as props to client components. Client hooks accept that data as `initialData` so the first render has no loading flash.

```typescript
// app/compare/page.tsx (server)
const initialCompareData = await getComparePayload(initialUrlIds)

return (
  <ComparePageClient
    initialUrlIds={initialUrlIds}
    initialCompareData={initialCompareData}
  />
)

// ComparePageClient.tsx (client)
const { data } = useComparePayload(orderedIds, { initialData: initialCompareData })
```

Set `initialDataUpdatedAt` when seeding from the server so TanStack Query knows the data is fresh for `staleTime`.

Root layout also prefetches unread counts and alerts server-side and passes them into `UserAlertsProvider` — see `app/layout.tsx`.

## Mutations

Mutations live in `lib/mutations/`. Use `getCsrfHeaders()` from `lib/api-client.ts` for state-changing requests:

```typescript
import { getCsrfHeaders } from "@/lib/api-client"

const response = await fetch("/api/wishlist", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
  body: JSON.stringify(payload),
  credentials: "include",
})
```

Mutation hooks should invalidate related query keys on success:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.user.wishlist(userId) })
}
```

## Cache invalidation

Invalidate by scope:

```typescript
// All houses
queryClient.invalidateQueries({ queryKey: queryKeys.houses.all })

// One detail page
queryClient.invalidateQueries({ queryKey: queryKeys.houses.detail(slug) })
```

On logout, clear user-scoped cache entries (see `LogoutButton`).

## Adding a new resource

1. Add query keys and fetchers in `lib/queries/<resource>.ts`.
2. Add mutation helpers in `lib/mutations/<resource>.ts` if needed.
3. Export a hook from `hooks/use<Resource>.ts`.
4. Optionally prefetch in the matching `page.tsx` and pass `initialData` to the client.

## References

- [TanStack Query docs](https://tanstack.com/query/latest)
- [Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys)

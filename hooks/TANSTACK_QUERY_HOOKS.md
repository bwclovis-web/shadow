# TanStack Query Hooks Documentation

This document provides usage examples and documentation for all TanStack Query hooks in the application.

## Table of Contents

- [Basic Query Hooks](#basic-query-hooks)
- [Infinite Query Hooks](#infinite-query-hooks)
- [Hydration Hooks](#hydration-hooks)
- [Hook Patterns](#hook-patterns)

## Basic Query Hooks

### useHouses

Fetches houses with filtering and sorting options.

```typescript
import { useHouses } from "~/hooks/useHouses"

function HousesList() {
  const { data: houses, isLoading, error } = useHouses({
    houseType: "niche",
    sortBy: "name-asc",
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      {houses?.map(house => (
        <div key={house.id}>{house.name}</div>
      ))}
    </div>
  )
}
```

**Parameters:**
- `filters` (optional): `HouseFilters` object with:
  - `houseType?: string` - Filter by house type ("all", "niche", "designer", etc.)
  - `sortBy?: string` - Sort option ("name-asc", "name-desc", "created-desc", etc.)
  - `page?: number` - Page number for pagination
  - `limit?: number` - Items per page

**Returns:**
- `data`: Array of houses
- `isLoading`: Boolean indicating initial load
- `isFetching`: Boolean indicating any fetch (including background)
- `error`: Error object if query failed
- `refetch`: Function to manually refetch

### useHousesByLetter

Fetches houses filtered by a specific letter.

```typescript
import { useHousesByLetter } from "~/hooks/useHousesByLetter"

function HousesByLetter({ letter }: { letter: string }) {
  const { data: houses, isLoading } = useHousesByLetter(letter, "all")

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      {houses?.map(house => (
        <div key={house.id}>{house.name}</div>
      ))}
    </div>
  )
}
```

**Parameters:**
- `letter`: Single letter (A-Z) to filter by
- `houseType` (optional): House type filter (default: "all")

### usePerfumesByLetter

Fetches perfumes filtered by a specific letter.

```typescript
import { usePerfumesByLetter } from "~/hooks/usePerfumesByLetter"

function PerfumesByLetter({ letter }: { letter: string }) {
  const { data: perfumes, isLoading } = usePerfumesByLetter(letter, "all")

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      {perfumes?.map(perfume => (
        <div key={perfume.id}>{perfume.name}</div>
      ))}
    </div>
  )
}
```

## Infinite Query Hooks

### useInfinitePerfumesByHouse

Fetches perfumes for a house with infinite scroll pagination.

```typescript
import { useInfinitePerfumesByHouse } from "~/hooks/useInfinitePerfumes"

function PerfumeList({ houseSlug }: { houseSlug: string }) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfinitePerfumesByHouse({
    houseSlug,
    pageSize: 9,
    initialData: [],
  })

  // Flatten pages
  const perfumes = data?.pages.flatMap(page => page.perfumes || []) || []

  return (
    <div>
      {perfumes.map(perfume => (
        <div key={perfume.id}>{perfume.name}</div>
      ))}
      
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  )
}
```

**Parameters:**
- `houseSlug`: House slug identifier
- `pageSize` (optional): Number of items per page (default: 9)
- `initialData` (optional): Initial data from server loader

**Returns:**
- `data`: Object with `pages` array containing paginated results
- `fetchNextPage`: Function to load next page
- `hasNextPage`: Boolean indicating if more pages available
- `isFetchingNextPage`: Boolean indicating if next page is loading

### useInfinitePerfumesByLetter

Fetches perfumes by letter with infinite scroll pagination.

```typescript
import { useInfinitePerfumesByLetter } from "~/hooks/useInfinitePerfumes"

function PerfumesList({ letter }: { letter: string }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
  } = useInfinitePerfumesByLetter({
    letter,
    houseType: "all",
    pageSize: 16,
  })

  const perfumes = data?.pages.flatMap(page => page.perfumes || []) || []

  return (
    <div>
      {perfumes.map(perfume => (
        <div key={perfume.id}>{perfume.name}</div>
      ))}
      
      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>Load More</button>
      )}
    </div>
  )
}
```

### useInfiniteHouses

Fetches houses with infinite scroll pagination.

```typescript
import { useInfiniteHouses } from "~/hooks/useInfiniteHouses"

function HousesList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteHouses({
    letter: "A",
    houseType: "niche",
    pageSize: 16,
  })

  const houses = data?.pages.flatMap(page => page.houses || []) || []

  return (
    <div>
      {houses.map(house => (
        <div key={house.id}>{house.name}</div>
      ))}
      
      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>Load More</button>
      )}
    </div>
  )
}
```

## Hydration Hooks

### usePerfume

Hydrates perfume query with server-rendered data.

```typescript
import { useLoaderData } from "react-router"
import { usePerfume } from "~/hooks/usePerfume"

export async function loader({ params }: LoaderFunctionArgs) {
  const perfume = await getPerfumeBySlug(params.perfumeSlug)
  return { perfume }
}

export default function PerfumePage() {
  const loaderData = useLoaderData<typeof loader>()
  const { perfume: initialPerfume } = loaderData

  // Hydrate with server data, then use client-side caching
  const { data: perfume, isLoading } = usePerfume(
    initialPerfume.slug,
    initialPerfume
  )

  if (isLoading) return <div>Loading...</div>

  return <div>{perfume.name}</div>
}
```

**Benefits:**
- Initial render uses server data (no loading state)
- Subsequent navigations use cached data
- Background refetching keeps data fresh

### useHouse

Hydrates house query with server-rendered data.

```typescript
import { useLoaderData } from "react-router"
import { useHouse } from "~/hooks/useHouse"

export async function loader({ params }: LoaderFunctionArgs) {
  const house = await getHouseBySlug(params.houseSlug)
  return { house }
}

export default function HousePage() {
  const loaderData = useLoaderData<typeof loader>()
  const { house: initialHouse } = loaderData

  const { data: house } = useHouse(initialHouse.slug, initialHouse)

  return <div>{house.name}</div>
}
```

### useTrader

Hydrates trader (user) query with server-rendered data.

```typescript
import { useLoaderData } from "react-router"
import { useTrader } from "~/hooks/useTrader"

export async function loader({ params }: LoaderFunctionArgs) {
  const trader = await getTraderById(params.id)
  return { trader }
}

export default function TraderPage() {
  const loaderData = useLoaderData<typeof loader>()
  const { trader: initialTrader } = loaderData

  const { data: trader } = useTrader(initialTrader.id, initialTrader)

  return <div>{trader.username}</div>
}
```

## Hook Patterns

### Error Handling Pattern

```typescript
import { useQueryError } from "~/hooks/useQueryError"
import ErrorDisplay from "~/components/Containers/ErrorDisplay"

function MyComponent() {
  const { data, isLoading, error, refetch } = useHouses({})
  const { hasError, errorDisplayProps } = useQueryError(
    { data, isLoading, error, refetch },
    { title: "Failed to load houses" }
  )

  if (hasError) {
    return <ErrorDisplay {...errorDisplayProps} />
  }

  if (isLoading) return <div>Loading...</div>

  return <div>{/* render data */}</div>
}
```

### Loading State Pattern

```typescript
function MyComponent() {
  const { data, isLoading, isFetching } = useHouses({})

  // Show loading indicator for initial load
  if (isLoading) return <div>Loading...</div>

  // Show subtle indicator for background refetch
  return (
    <div>
      {isFetching && <div className="text-xs">Updating...</div>}
      {/* render data */}
    </div>
  )
}
```

### Refetch Pattern

```typescript
function MyComponent() {
  const { data, refetch, isFetching } = useHouses({})

  return (
    <div>
      <button onClick={() => refetch()} disabled={isFetching}>
        {isFetching ? "Refreshing..." : "Refresh"}
      </button>
      {/* render data */}
    </div>
  )
}
```

### Conditional Query Pattern

```typescript
function MyComponent({ userId }: { userId?: string }) {
  // Query only runs when userId is provided
  const { data } = useUserAlerts(userId || "", !!userId)

  if (!userId) return <div>Please log in</div>

  return <div>{/* render alerts */}</div>
}
```

## Best Practices

1. **Always handle loading and error states**
2. **Use hydration hooks for SSR data**
3. **Flatten infinite query pages** for rendering
4. **Use error handling utilities** for consistent UX
5. **Provide sensible defaults** for optional parameters
6. **Document hook usage** with JSDoc comments

## See Also

- [Query Functions Documentation](../lib/queries/README.md)
- [Mutation Patterns Documentation](../lib/queries/README.md#mutation-patterns)
- [TanStack Query Documentation](https://tanstack.com/query/latest)


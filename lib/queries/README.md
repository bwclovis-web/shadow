# TanStack Query Documentation

This directory contains query functions and query key factories for TanStack Query (React Query) v5. This documentation provides patterns, best practices, and examples for working with queries and mutations in this codebase.

## Table of Contents

- [Query Key Patterns](#query-key-patterns)
- [Query Functions](#query-functions)
- [Mutation Patterns](#mutation-patterns)
- [Hydration Strategy](#hydration-strategy)
- [Cache Invalidation Patterns](#cache-invalidation-patterns)
- [Best Practices](#best-practices)

## Query Key Patterns

### Hierarchical Structure

Query keys use a hierarchical structure that enables efficient cache invalidation:

```typescript
export const queryKeys = {
  houses: {
    all: ["houses"] as const,
    lists: () => [...queryKeys.houses.all, "list"] as const,
    list: (filters: HouseFilters) => [...queryKeys.houses.lists(), filters] as const,
    details: () => [...queryKeys.houses.all, "detail"] as const,
    detail: (slug: string) => [...queryKeys.houses.details(), slug] as const,
    byLetter: (letter: string, houseType: string) => 
      [...queryKeys.houses.all, "byLetter", letter, houseType] as const,
  },
}
```

### Key Principles

1. **Base Keys**: Always start with a base key (e.g., `["houses"]`)
2. **Hierarchical Nesting**: Use spread operator to build nested keys
3. **Type Safety**: Use `as const` for type safety
4. **Inclusion of Filters**: Include all relevant filters in the key to ensure proper cache separation

### Examples

```typescript
// List query with filters
queryKeys.houses.list({ houseType: "niche", sortBy: "name-asc" })
// Returns: ["houses", "list", { houseType: "niche", sortBy: "name-asc" }]

// Detail query
queryKeys.houses.detail("house-slug")
// Returns: ["houses", "detail", "house-slug"]

// Letter-based query
queryKeys.houses.byLetter("A", "all")
// Returns: ["houses", "byLetter", "A", "all"]
```

### Benefits

- **Easy Invalidation**: Invalidate all houses queries with `queryKeys.houses.all`
- **Selective Invalidation**: Invalidate specific subsets (lists, details, etc.)
- **Type Safety**: TypeScript ensures correct key usage
- **Consistency**: Same pattern across all resource types

## Query Functions

### Structure

Query functions are pure async functions that fetch data from the API:

```typescript
export async function getHousesByLetter(
  letter: string,
  houseType: string = "all"
): Promise<any[]> {
  // Validate input
  if (!letter || !/^[A-Za-z]$/.test(letter)) {
    throw new Error("Valid letter parameter is required (single letter A-Z)")
  }

  // Build URL
  const params = new URLSearchParams({
    letter: letter.toUpperCase(),
    houseType,
  })

  // Fetch data
  const response = await fetch(`/api/houses-by-letter?${params}`)

  // Handle errors
  if (!response.ok) {
    throw new Error(`Failed to fetch houses by letter: ${response.statusText}`)
  }

  // Parse and validate response
  const data: HousesByLetterResponse = await response.json()
  if (!data.success) {
    throw new Error("Failed to fetch houses by letter")
  }

  // Return data
  return data.houses || []
}
```

### Best Practices

1. **Input Validation**: Always validate inputs before making API calls
2. **Error Handling**: Throw meaningful errors that can be caught by error boundaries
3. **Response Validation**: Check response structure and success status
4. **Type Safety**: Use TypeScript interfaces for request/response types
5. **Default Values**: Provide sensible defaults for optional parameters

## Mutation Patterns

### Basic Mutation Structure

Mutations follow a consistent pattern with optimistic updates and error rollback:

```typescript
export function useToggleWishlist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: wishlistAction,
    onMutate: async (variables) => {
      // 1. Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: [...] })

      // 2. Snapshot previous values
      const previousData = queryClient.getQueryData([...])

      // 3. Optimistically update cache
      queryClient.setQueryData([...], (old) => {
        // Update logic
      })

      // 4. Return context for rollback
      return { previousData }
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousData) {
        queryClient.setQueryData([...], context.previousData)
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [...] })
    },
  })
}
```

### Optimistic Updates

Optimistic updates provide instant UI feedback:

```typescript
onMutate: async (variables) => {
  // Cancel any outgoing refetches
  await queryClient.cancelQueries({ queryKey: queryKeys.user.wishlist(userId) })

  // Snapshot the previous value
  const previousWishlist = queryClient.getQueryData(queryKeys.user.wishlist(userId))

  // Optimistically update
  queryClient.setQueryData(queryKeys.user.wishlist(userId), (old: any) => {
    // Add or remove item optimistically
    return updatedWishlist
  })

  return { previousWishlist }
}
```

### Error Rollback

Always rollback optimistic updates on error:

```typescript
onError: (error, variables, context) => {
  // Rollback to previous state
  if (context?.previousWishlist) {
    queryClient.setQueryData(queryKeys.user.wishlist(userId), context.previousWishlist)
  }
}
```

### Cache Invalidation After Mutations

Invalidate related queries after successful mutations:

```typescript
onSuccess: (data, variables) => {
  // Invalidate affected queries
  queryClient.invalidateQueries({ queryKey: queryKeys.user.wishlist(userId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.perfumes.detail(perfumeId) })
}
```

## Hydration Strategy

### Overview

Hydration allows us to use server-side rendered data (from React Router loaders) as initial data for TanStack Query, providing both SSR benefits and client-side caching.

### Pattern

```typescript
// In a route component
export default function PerfumePage() {
  const loaderData = useLoaderData<typeof loader>()
  const { perfume: initialPerfume } = loaderData

  // Hydrate query with loader data
  const { data: perfume } = usePerfume(
    initialPerfume.slug,
    initialPerfume // Initial data from server
  )

  // Component now has access to cached, refetchable data
  return <div>{perfume.name}</div>
}
```

### Hook Implementation

```typescript
export function usePerfume(slug: string, initialData?: any) {
  return useQuery({
    queryKey: queryKeys.perfumes.detail(slug),
    queryFn: () => getPerfumeBySlug(slug),
    initialData, // Server-rendered data
    initialDataUpdatedAt: Date.now(), // Mark as fresh
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
```

### Benefits

- **SSR Performance**: Initial render uses server data (no loading state)
- **Client-side Caching**: Subsequent navigations use cached data
- **Background Refetching**: Data stays fresh with background updates
- **Best of Both Worlds**: SSR speed + SPA caching

## Cache Invalidation Patterns

### Using Cache Management Utilities

Use the centralized cache management utilities for consistent invalidation:

```typescript
import { 
  invalidateCacheByResource, 
  clearCacheByResource,
  clearPerfumeCache,
  clearHouseCache 
} from "~/lib/utils/cacheManagement"

// Invalidate (mark as stale, will refetch on next use)
invalidateCacheByResource("perfumes")

// Clear (remove from cache entirely)
clearCacheByResource("perfumes")

// Clear specific resource
clearPerfumeCache("perfume-id")
clearHouseCache("house-slug")
```

### After Mutations

Always invalidate related queries after mutations:

```typescript
onSuccess: () => {
  // Option 1: Use utility functions
  invalidateCacheByResource("perfumes")
  
  // Option 2: Direct invalidation
  queryClient.invalidateQueries({ 
    queryKey: queryKeys.perfumes.all 
  })
}
```

### Selective Invalidation

Invalidate specific query subsets:

```typescript
// Invalidate all list queries
queryClient.invalidateQueries({ 
  queryKey: queryKeys.houses.lists() 
})

// Invalidate specific detail query
queryClient.invalidateQueries({ 
  queryKey: queryKeys.houses.detail(slug) 
})
```

### On Logout

Clear all user-specific cache:

```typescript
import { clearCacheOnLogout } from "~/lib/utils/cacheManagement"

clearCacheOnLogout() // Clears user data and invalidates public data
```

## Best Practices

### Query Functions

1. **Always validate inputs** before making API calls
2. **Throw meaningful errors** that include context
3. **Use TypeScript interfaces** for type safety
4. **Handle edge cases** (empty arrays, null responses, etc.)
5. **Normalize data** before returning (consistent structure)

### Query Keys

1. **Use hierarchical structure** for easy invalidation
2. **Include all filters** in the key
3. **Keep keys consistent** across similar resources
4. **Use `as const`** for type safety

### Mutations

1. **Always implement optimistic updates** for better UX
2. **Rollback on error** to maintain data consistency
3. **Invalidate related queries** after successful mutations
4. **Cancel outgoing refetches** in `onMutate` to prevent race conditions

### Hooks

1. **Export hooks** from dedicated hook files
2. **Use descriptive names** (e.g., `useHouses`, not `useQuery`)
3. **Provide sensible defaults** for optional parameters
4. **Document hook usage** with JSDoc comments

### Error Handling

1. **Use error boundaries** for query errors
2. **Provide retry logic** where appropriate
3. **Show user-friendly error messages**
4. **Log errors** for debugging

### Performance

1. **Use `staleTime`** to control refetch frequency
2. **Use `gcTime`** to control cache retention
3. **Implement prefetching** for better perceived performance
4. **Use `refetchInterval`** strategically for real-time data

## File Structure

```
app/lib/queries/
  ├── houses.ts          # House queries and query keys
  ├── perfumes.ts        # Perfume queries and query keys
  ├── reviews.ts         # Review queries and query keys
  ├── user.ts            # User queries and query keys
  ├── dataQuality.ts     # Data quality queries and query keys
  ├── tags.ts            # Tag queries and query keys
  └── README.md          # This file

app/lib/mutations/
  ├── wishlist.ts        # Wishlist mutations
  ├── reviews.ts         # Review mutations
  ├── ratings.ts         # Rating mutations
  ├── houses.ts          # House mutations
  ├── perfumes.ts        # Perfume mutations
  └── tags.ts            # Tag mutations

app/hooks/
  ├── useHouses.ts       # House query hooks
  ├── usePerfumes.ts     # Perfume query hooks
  ├── useInfinitePerfumes.ts  # Infinite scroll hooks
  └── ...
```

## Examples

### Creating a New Query

```typescript
// 1. Define query keys
export const queryKeys = {
  products: {
    all: ["products"] as const,
    lists: () => [...queryKeys.products.all, "list"] as const,
    list: (filters: ProductFilters) => 
      [...queryKeys.products.lists(), filters] as const,
    detail: (id: string) => 
      [...queryKeys.products.all, "detail", id] as const,
  },
}

// 2. Create query function
export async function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const params = new URLSearchParams(filters)
  const response = await fetch(`/api/products?${params}`)
  if (!response.ok) throw new Error("Failed to fetch products")
  const data = await response.json()
  return data.products || []
}

// 3. Create hook
export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: () => getProducts(filters),
    staleTime: 5 * 60 * 1000,
  })
}
```

### Creating a New Mutation

```typescript
// 1. Create mutation function
async function createProduct(data: ProductData): Promise<Product> {
  const response = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error("Failed to create product")
  return response.json()
}

// 2. Create mutation hook
export function useCreateProduct() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      // Invalidate product queries
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.products.all 
      })
    },
  })
}
```

## Additional Resources

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [Query Key Factory Pattern](https://tkdodo.eu/blog/effective-react-query-keys)


'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useState } from 'react'

import ModalRouteCleanup from '@/components/Molecules/ModalRouteCleanup/ModalRouteCleanup'
import { useCompareStore } from '@/hooks/compareStore'
import { useTokenRefresh } from '@/hooks/useTokenRefresh'

const CompareTray = dynamic(
  () =>
    import('@/components/Molecules/CompareTray/CompareTray').then(
      (mod) => mod.CompareTray
    ),
  { ssr: false }
)

const ReactQueryDevtools = dynamic(
  () =>
    import('@tanstack/react-query-devtools').then((mod) => mod.ReactQueryDevtools),
  { ssr: false }
)

const LazyCompareTray = () => {
  const itemCount = useCompareStore((s) => s.items.length)
  if (itemCount === 0) return null
  return <CompareTray />
}

type ProvidersProps = {
  children: React.ReactNode
  /** When false, skips /api/auth/refresh (avoids 401 noise for logged-out visitors). */
  enableTokenRefresh?: boolean
}

export function Providers({
  children,
  enableTokenRefresh = false,
}: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient())
  useTokenRefresh(enableTokenRefresh)

  return (
    <QueryClientProvider client={queryClient}>
      <ModalRouteCleanup />
      {children}
      <LazyCompareTray />
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
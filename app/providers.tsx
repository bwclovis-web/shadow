'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useState } from 'react'

import { CompareTray } from '@/components/Molecules/CompareTray/CompareTray'
import ModalRouteCleanup from '@/components/Molecules/ModalRouteCleanup/ModalRouteCleanup'
import { TokenRefresh } from '@/components/TokenRefresh'

const ReactQueryDevtools = dynamic(
  () =>
    import('@tanstack/react-query-devtools').then((mod) => mod.ReactQueryDevtools),
  { ssr: false }
)

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <TokenRefresh />
      <ModalRouteCleanup />
      {children}
      <CompareTray />
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
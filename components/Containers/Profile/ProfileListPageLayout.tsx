"use client"

import type { ReactNode } from "react"

import { VooDooLink } from "@/components/Atoms/Button/VooDooLink"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"

type ProfileListPageLayoutProps<T> = {
  bannerImage: string
  heading: string
  subheading: string
  backHref: string
  backLabel: string
  items: T[]
  emptyMessage: string
  actionState?: { success: boolean; message: string } | null
  renderItem: (item: T) => ReactNode
}

export const ProfileListPageLayout = <T,>({
  bannerImage,
  heading,
  subheading,
  backHref,
  backLabel,
  items,
  emptyMessage,
  actionState,
  renderItem,
}: ProfileListPageLayoutProps<T>) => (
  <main id="main-content">
    <TitleBanner image={bannerImage} heading={heading} subheading={subheading}>
      <VooDooLink
        url={backHref}
        variant="link"
        size="sm"
        prefetch
        transitionVariant="detail-to-list"
      >
        {backLabel}
      </VooDooLink>
    </TitleBanner>

    <PageWrapper>
      {actionState ? (
        <div
          className={`mb-6 rounded-md border p-4 ${
            actionState.success
              ? "border-green-500/50 bg-green-900/20 text-green-300"
              : "border-red-400/50 bg-red-900/20 text-red-300"
          }`}
        >
          {actionState.message}
        </div>
      ) : null}

      {items.length === 0 ? (
        <h2 className="py-12 text-center text-noir-gold-100/80">{emptyMessage}</h2>
      ) : (
        <ul className="space-y-4">{items.map(renderItem)}</ul>
      )}
    </PageWrapper>
  </main>
)

export default ProfileListPageLayout

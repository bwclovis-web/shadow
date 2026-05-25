"use client"

import { useTransitionRouter } from "next-view-transitions"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import PerfumeIcons from "@/components/Containers/Perfume/PerfumeIcons"
import PerfumeNotes from "@/components/Containers/Perfume/PerfumeNotes"
import PerfumeRatingSystem from "@/components/Containers/Perfume/PerfumeRatingSystem"
import PerfumeSeasonVote from "@/components/Containers/Perfume/PerfumeSeasonVote"
import type {
  PerfumeDetailAverageRatingsProp,
  PerfumeDetailSeasonAggregatesProp,
  PerfumeDetailUserRatingsProp,
  PerfumeDetailUserSeasonVoteProp,
} from "@/components/Containers/Perfume/perfume-detail-types"
import { HeroHeader } from "@/components/Molecules/HeroHeader"
import ReviewSection from "@/components/Organisms/ReviewSection"
import { HOUSE_DETAIL_PATH, THE_ARCHIVE_PATH } from "@/constants/routes"
import { usePerfume } from "@/hooks/usePerfume"
import { useSessionStore } from "@/hooks/sessionStore"
import { useDeletePerfume } from "@/lib/mutations/perfumes"
import type { RecommendationPerfume } from "@/services/recommendations"
import {
  perfumeImageTransitionName,
  perfumeTitleTransitionName,
} from "@/utils/view-transition-names"

import { RelatedArticlesSection } from "@/components/Containers/Blog/RelatedArticlesSection"
import FollowButton from "@/components/Containers/Follow/FollowButton"
import SimilarPerfumesCarousel from "@/components/Containers/Recommendations/SimilarPerfumesCarousel"
import type { ArticleListItem } from "@/lib/sanity/types"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import { setRouteTransitionVariant } from "@/utils/route-transitions"

type PerfumeDetailClientProps = {
  initialPerfume: Awaited<ReturnType<typeof import("@/models/perfume.server").getPerfumeBySlug>> & { id: string }
  user: { id: string; role?: string } | null
  isInUserWishlist: boolean
  userRatings: PerfumeDetailUserRatingsProp
  averageRatings: PerfumeDetailAverageRatingsProp
  seasonAggregates: PerfumeDetailSeasonAggregatesProp
  userSeasonVote: PerfumeDetailUserSeasonVoteProp
  userReview: unknown
  reviewsData: unknown
  reviewsPageSize: number
  similarPerfumes: RecommendationPerfume[]
  relatedArticles: ArticleListItem[]
  initialFollowing?: boolean
  selectedLetter: string | null
}

const PerfumeDetailClient = ({
  initialPerfume,
  user,
  isInUserWishlist,
  userRatings,
  averageRatings,
  seasonAggregates,
  userSeasonVote,
  userReview,
  reviewsData,
  reviewsPageSize,
  similarPerfumes,
  relatedArticles,
  initialFollowing = false,
  selectedLetter,
}: PerfumeDetailClientProps) => {
  const { data: perfume } = usePerfume(initialPerfume.slug, initialPerfume)
  const router = useTransitionRouter()
  const t = useTranslations("singlePerfume")
  const { closeModal } = useSessionStore()
  const deletePerfume = useDeletePerfume()

  const handleDelete = () => {
    if (!perfume) return
    const archivePath = selectedLetter
      ? `${THE_ARCHIVE_PATH}/${selectedLetter.toLowerCase()}`
      : THE_ARCHIVE_PATH

    // Optimistic redirect: navigate immediately instead of waiting for API response.
    closeModal()
    if (typeof window !== "undefined" && window.history.length > 1) {
      setRouteTransitionVariant("detail-to-list")
      router.back()
    } else {
      setRouteTransitionVariant("detail-to-list")
      router.push(archivePath)
    }

    deletePerfume.mutate(
      { perfumeId: perfume.id },
      {
        onError: (error) => {
          console.error("Failed to delete perfume:", error)
          alert("Failed to delete perfume. Please try again.")
        },
      }
    )
  }

  const handleBack = () => {
    setRouteTransitionVariant("detail-to-list")
    if (selectedLetter) {
      router.push(`${THE_ARCHIVE_PATH}/${selectedLetter.toLowerCase()}`)
    } else {
      router.push(THE_ARCHIVE_PATH)
    }
  }

  if (!perfume) {
    return <div className="p-4">Perfume not found</div>
  }

  return (
    <main id="main-content" className="relative z-10 min-h-screen">
      <HeroHeader
        title={perfume.name}
        image={perfume.image ?? undefined}
        imageAlt={perfume.name}
        transitionKey={perfume.id}
        viewTransitionName={perfumeImageTransitionName(perfume.id)}
      >
        <h1
          className="capitalize"
          style={
            {
              viewTransitionName: perfumeTitleTransitionName(perfume.id),
            } as React.CSSProperties
          }
        >
          {perfume.name}
        </h1>
        <p className="text-lg tracking-wide mt-2 text-noir-gold-500">
          {t("subheading")}
          <PrefetchLink
            className="text-blue-200 hover:underline font-semibold underline"
            href={`${HOUSE_DETAIL_PATH}/${perfume.perfumeHouse?.slug}`}
          >
            {perfume.perfumeHouse?.name}
          </PrefetchLink>
        </p>
      </HeroHeader>

    <PageWrapper> 
      <div className="flex flex-col gap-6 mx-auto items-center">
        <div className="w-full flex justify-end px-2">
          <FollowButton
            targetType="perfume"
            targetId={perfume.id}
            initialFollowing={initialFollowing}
            viewerId={user?.id ?? null}
          />
        </div>
        <div className="w-full flex flex-col lg:flex-row gap-4">
          {user && (
            <PerfumeIcons
              perfume={perfume}
              handleDelete={handleDelete}
              userRole={user.role ?? "user"}
              isInWishlist={isInUserWishlist}
            />
          )}
          <div
            className={`bg-white/5 ${user ? "lg:w-5/6" : "md:w-full"} border-4 noir-border relative shadow-lg text-noir-gold-500`}
          >
            <PerfumeNotes
              perfumeNotesOpen={perfume.perfumeNotesOpen}
              perfumeNotesHeart={perfume.perfumeNotesHeart}
              perfumeNotesClose={perfume.perfumeNotesClose}
            />
            <p className="p-4 mb-14 font-light">{perfume.description}</p>
            <Button
              onClick={handleBack}
              variant="primary"
              background="gold"
              size="sm"
              className="gap-2 max-w-max absolute bottom-4 left-4 z-20"
              aria-label={
                selectedLetter
                  ? `Back to perfumes starting with ${selectedLetter}`
                  : "Back to Perfumes"
              }
            >
              ← Back {selectedLetter ? `to ${selectedLetter}` : "to Perfumes"}
            </Button>
          </div>
        </div>

        <div className="w-full flex flex-col lg:flex-row gap-4 items-start justify-center">
          <aside className="noir-border relative w-full lg:w-1/4 text-center space-y-6 py-4 px-2">
            <PerfumeRatingSystem
              perfumeId={perfume.id}
              userId={user?.id ?? "anonymous"}
              userRatings={userRatings}
              averageRatings={averageRatings}
            />
            <PerfumeSeasonVote
              perfumeId={perfume.id}
              userId={user?.id ?? "anonymous"}
              userSeasonVote={userSeasonVote}
              seasonAggregates={seasonAggregates}
            />
          </aside>
          <div className="noir-border relative w-full lg:w-3/4 p-4">
            <ReviewSection
              perfumeId={perfume.id}
              currentUserId={user?.id}
              currentUserRole={user?.role}
              canCreateReview={!!user && (user.role === "admin" || user.role === "editor")}
              existingUserReview={userReview as never}
              initialReviewsData={reviewsData as never}
              pageSize={reviewsPageSize}
            />
          </div>
        </div>

        {similarPerfumes.length > 0 && (
          <SimilarPerfumesCarousel
            similarPerfumes={similarPerfumes}
            selectedLetter={selectedLetter}
          />
        )}
        <RelatedArticlesSection articles={relatedArticles} />
      </div>
      </PageWrapper>
    </main>
  )
}

export default PerfumeDetailClient

"use client"

import Image from "next/image"
import { Link } from "next-view-transitions"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import PerfumeIcons from "@/components/Containers/Perfume/PerfumeIcons"
import PerfumeNotes from "@/components/Containers/Perfume/PerfumeNotes"
import PerfumeRatingSystem from "@/components/Containers/Perfume/PerfumeRatingSystem"
import type {
  PerfumeDetailAverageRatingsProp,
  PerfumeDetailUserRatingsProp,
} from "@/components/Containers/Perfume/perfume-detail-types"
import { HeroHeader } from "@/components/Molecules/HeroHeader"
import ReviewSection from "@/components/Organisms/ReviewSection"
import { HOUSE_DETAIL_PATH } from "@/constants/routes"
import { usePerfume } from "@/hooks/usePerfume"
import { useSessionStore } from "@/hooks/sessionStore"
import { useDeletePerfume } from "@/lib/mutations/perfumes"
import { validImageRegex } from "@/utils/styleUtils"

const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"

const VAULT_PATH = "/the-vault"

type SimilarPerfume = {
  id: string
  name: string
  slug: string
  image?: string | null
  perfumeHouse?: { name: string; slug: string } | null
}

type PerfumeDetailClientProps = {
  initialPerfume: Awaited<ReturnType<typeof import("@/models/perfume.server").getPerfumeBySlug>> & { id: string }
  user: { id: string; role?: string } | null
  isInUserWishlist: boolean
  userRatings: PerfumeDetailUserRatingsProp
  averageRatings: PerfumeDetailAverageRatingsProp
  userReview: unknown
  reviewsData: unknown
  reviewsPageSize: number
  similarPerfumes: SimilarPerfume[]
  selectedLetter: string | null
}

const PerfumeDetailClient = ({
  initialPerfume,
  user,
  isInUserWishlist,
  userRatings,
  averageRatings,
  userReview,
  reviewsData,
  reviewsPageSize,
  similarPerfumes,
  selectedLetter,
}: PerfumeDetailClientProps) => {
  const { data: perfume } = usePerfume(initialPerfume.slug, initialPerfume)
  const router = useRouter()
  const t = useTranslations("singlePerfume")
  const tHouse = useTranslations("singleHouse")
  const { closeModal } = useSessionStore()
  const deletePerfume = useDeletePerfume()

  const handleDelete = () => {
    if (!perfume) return
    const vaultPath = selectedLetter ? `${VAULT_PATH}/${selectedLetter.toLowerCase()}` : VAULT_PATH

    // Optimistic redirect: navigate immediately instead of waiting for API response.
    closeModal()
    router.push(vaultPath)

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
    if (selectedLetter) {
      router.push(`${VAULT_PATH}/${selectedLetter.toLowerCase()}`)
    } else {
      router.push(VAULT_PATH)
    }
  }

  if (!perfume) {
    return <div className="p-4">Perfume not found</div>
  }

  return (
    <section className="relative z-10 min-h-screen">
      <HeroHeader
        title={perfume.name}
        image={perfume.image ?? undefined}
        imageAlt={perfume.name}
        transitionKey={perfume.id}
        viewTransitionName={`perfume-image-${perfume.id}`}
      >
        <h1 className="capitalize">{perfume.name}</h1>
        <p className="text-lg tracking-wide mt-2 text-noir-gold-500">
          {t("subheading")}
          <Link
            className="text-blue-200 hover:underline font-semibold underline"
            href={`${HOUSE_DETAIL_PATH}/${perfume.perfumeHouse?.slug}`}
          >
            {perfume.perfumeHouse?.name}
          </Link>
        </p>
      </HeroHeader>

      <div className="flex flex-col gap-20 mx-auto inner-container items-center">
        <div className="w-full flex flex-col lg:flex-row gap-4 max-w-6xl">
          {user && (
            <PerfumeIcons
              perfume={perfume}
              handleDelete={handleDelete}
              userRole={user.role ?? "user"}
              isInWishlist={isInUserWishlist}
            />
          )}
          <div
            className={`bg-white/5 ${user ? "lg:w-3/4" : "md:w-full"} border-4 noir-border relative shadow-lg text-noir-gold-500`}
          >
            <PerfumeNotes
              perfumeNotesOpen={perfume.perfumeNotesOpen}
              perfumeNotesHeart={perfume.perfumeNotesHeart}
              perfumeNotesClose={perfume.perfumeNotesClose}
            />
            <p className="p-4 mb-14">{perfume.description}</p>
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
          <div className="noir-border relative w-full lg:w-1/3">
            <PerfumeRatingSystem
              perfumeId={perfume.id}
              userId={user?.id ?? "anonymous"}
              userRatings={userRatings}
              averageRatings={averageRatings}
            />
          </div>
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
          <div className="w-full max-w-6xl">
            <h2 className="text-center mb-4 text-noir-gold-500">
              {t("similarPerfumes", { defaultValue: "Similar perfumes" })}
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-4 gap-4 p-2">
              {similarPerfumes.map((similar) => (
                <li key={similar.id}>
                  <Link
                    href={`/perfume/${similar.slug}${selectedLetter ? `?letter=${selectedLetter}` : ""}`}
                    className="block p-2 h-full noir-border relative w-full transition-colors duration-300 ease-in-out hover:bg-white/5"
                  >
                    <h3 className="text-center block text-sm tracking-wide py-2 font-semibold text-noir-gold leading-tight capitalize line-clamp-2">
                      {similar.name}
                    </h3>
                    <Image
                      src={
                        (!validImageRegex.test(similar.image ?? "") ? similar.image : null) ??
                        BOTTLE_PLACEHOLDER
                      }
                      alt={tHouse("perfumeBottleAltText", { name: similar.name })}
                      priority={false}
                      width={128}
                      height={128}
                      quality={75}
                      className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-lg mb-2 mx-auto dark:brightness-90"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                      style={{ viewTransitionName: `perfume-image-${similar.id}` } as React.CSSProperties}
                    />
                    {similar.perfumeHouse && (
                      <p className="text-center text-xs text-noir-gold-500/80 truncate">
                        {similar.perfumeHouse.name}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

export default PerfumeDetailClient

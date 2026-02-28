"use client"

import { useState, useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import Link from "next/link"
import { useParams } from "next/navigation"

import SearchInput from "@/components/Molecules/SearchInput/SearchInput"
import AddToCollectionModal from "@/components/Organisms/AddToCollectionModal"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import { validImageRegex } from "@/utils/styleUtils"

const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"
const USER_PERFUMES_API = "/api/user-perfumes"

/** User perfume as passed from server (createdAt serialized as string). */
export type UserPerfumeForClient = {
  id: string
  userId: string
  perfumeId: string
  amount: string
  available: string | null
  price: string | null
  placeOfPurchase: string | null
  tradePrice: string | null
  tradePreference: string | null
  tradeOnly: boolean | null
  type: string | null
  createdAt: string
  perfume: {
    id: string
    name: string
    slug: string
    image: string | null
    description: string | null
    perfumeHouse: {
      id: string
      name: string
      slug: string
    } | null
  }
  _count: { comments: number }
}

type MyScentsPageClientProps = {
  userPerfumes: UserPerfumeForClient[]
  bannerImage: string
}

const groupByPerfumeId = (
  list: UserPerfumeForClient[]
): Record<string, UserPerfumeForClient> =>
  list.reduce((acc, up) => {
    if (!acc[up.perfumeId]) {
      acc[up.perfumeId] = up
    } else {
      const existing = acc[up.perfumeId]
      if (
        new Date(up.createdAt).getTime() < new Date(existing.createdAt).getTime()
      ) {
        acc[up.perfumeId] = up
      }
    }
    return acc
  }, {} as Record<string, UserPerfumeForClient>)

const serializeUserPerfume = (up: Record<string, unknown>): UserPerfumeForClient => {
  const createdAt = up.createdAt
  const createdAtStr =
    typeof createdAt === "string"
      ? createdAt
      : createdAt instanceof Date
        ? createdAt.toISOString()
        : ""
  return {
    ...up,
    createdAt: createdAtStr,
    available: up.available ?? null,
    price: up.price ?? null,
    placeOfPurchase: up.placeOfPurchase ?? null,
    tradePrice: up.tradePrice ?? null,
    tradePreference: up.tradePreference ?? null,
    tradeOnly: up.tradeOnly ?? null,
    type: up.type ?? null,
  } as UserPerfumeForClient
}

const MyScentsPageClient = ({
  userPerfumes: initialUserPerfumes,
  bannerImage,
}: MyScentsPageClientProps) => {
  const params = useParams()
  const userSlug = params?.userSlug as string
  const [userPerfumes, setUserPerfumes] = useState<UserPerfumeForClient[]>(initialUserPerfumes)
  const [searchQuery, setSearchQuery] = useState("")
  const t = useTranslations("myScents")

  useEffect(() => {
    setUserPerfumes(initialUserPerfumes)
  }, [initialUserPerfumes])

  const refreshCollection = useCallback(async () => {
    const res = await fetch(USER_PERFUMES_API, { credentials: "include" })
    if (!res.ok) return
    const data = await res.json().catch(() => ({}))
    if (!data?.success || !Array.isArray(data.userPerfumes)) return
    setUserPerfumes(data.userPerfumes.map(serializeUserPerfume))
  }, [])

  const grouped = groupByPerfumeId(userPerfumes)
  const uniquePerfumes = Object.values(grouped)

  const filteredPerfumes =
    !searchQuery.trim()
      ? uniquePerfumes
      : uniquePerfumes.filter((up) =>
          up.perfume.name.toLowerCase().includes(searchQuery.toLowerCase())
        )

  const basePath = userSlug ? `/${userSlug}/profile/my-scents` : "/profile/my-scents"

  return (
    <section>
      <TitleBanner
        imagePos="object-bottom"
        image={bannerImage}
        heading={t("heading")}
        subheading={t("subheading")}
      >
        <AddToCollectionModal onAddedToCollection={refreshCollection} />
      </TitleBanner>
      <div className="noir-border relative inner-container mx-auto text-center flex flex-col items-center justify-center gap-4 p-4 my-6">
        <h2 className="mb-2">{t("collection.heading")}</h2>
        {uniquePerfumes.length > 0 && (
          <div className="w-full mb-4">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t("search.placeholder")}
            />
          </div>
        )}
        {uniquePerfumes.length === 0 ? (
          <div>
            <p className="text-noir-gold-100 text-xl">
              {t("collection.empty.heading")}
            </p>
            <p className="text-noir-gold-500 italic">
              {t("collection.empty.subheading")}
            </p>
          </div>
        ) : filteredPerfumes.length === 0 ? (
          <div className="animate-fade-in">
            <p className="text-noir-gold-100 text-xl">
              {t("search.noResults")}
            </p>
            <p className="text-noir-gold-500 italic">
              {t("search.tryDifferent")}
            </p>
          </div>
        ) : (
          <div className="animate-fade-in">
            <ul className="w-full animate-fade-in grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[auto-fill_minmax(900px,1fr)] gap-4">
              {filteredPerfumes.map((userPerfume) => {
                const { perfume } = userPerfume
                const imageSrc =
                  perfume.image && !validImageRegex.test(perfume.image)
                    ? perfume.image
                    : BOTTLE_PLACEHOLDER
                return (
                  <li
                    key={userPerfume.id}
                    className="flex flex-col items-center justify-center border-4 border-double border-noir-gold p-1"
                  >
                    <Link
                      href={`${basePath}/${userPerfume.id}`}
                      className="block"
                    >
                      <Image
                        src={imageSrc}
                        alt={perfume.name ?? "Perfume Bottle"}
                        priority={false}
                        width={192}
                        height={192}
                        quality={75}
                        className="w-48 h-48 object-cover rounded-lg mb-2 mx-auto dark:brightness-90"
                        sizes="(max-width: 768px) 50vw, 33vw"
                        style={
                          {
                            viewTransitionName: `perfume-image-${perfume.id}`,
                          } as React.CSSProperties
                        }
                      />
                      <span className="text-noir-gold">{perfume.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

export default MyScentsPageClient

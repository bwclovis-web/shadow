"use client"

import { useTranslations } from "next-intl"
import { FaArrowRight } from "react-icons/fa6"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import ActivityFeedSection from "@/components/Containers/Exchange/ActivityFeedSection"
import HomeListingCard from "@/components/Containers/Home/HomeListingCard"
import { THE_EXCHANGE_PATH } from "@/constants/routes"
import type { FollowedActivityItem } from "@/models/activity-feed.server"
import type { HomeListing } from "@/types/home-listing"

type HomeLatestListingsProps = {
  listings: HomeListing[]
  followedItems: FollowedActivityItem[]
}

const HomeLatestListings = ({
  listings,
  followedItems,
}: HomeLatestListingsProps) => {
  const t = useTranslations("home.galleryWalk.latest")

  return (
    <section
      className="bg-noir-black py-5 lg:py-6"
      aria-labelledby="home-latest-listings-heading"
    >
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h2
              id="home-latest-listings-heading"
              className="!text-[clamp(1.625rem,2.1vw,1.875rem)] !font-semibold"
            >
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-noir-light/75">{t("description")}</p>
          </div>
          <PrefetchLink
            href={THE_EXCHANGE_PATH}
            className="inline-flex items-center gap-2 text-sm font-medium text-noir-gold hover:text-noir-gold-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold"
          >
            {t("viewAll")}
            <FaArrowRight aria-hidden className="h-3 w-3" />
          </PrefetchLink>
        </div>

        {listings.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[75rem]:grid-cols-4 min-[75rem]:gap-5">
            {listings.map(listing => (
              <li key={listing.id} className="flex">
                <HomeListingCard listing={listing} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="border border-noir-gold/30 bg-noir-dark/55 px-4 py-5 text-sm text-noir-light/80">
            {t("empty")}{" "}
            <PrefetchLink
              href={THE_EXCHANGE_PATH}
              className="text-noir-gold underline-offset-4 hover:underline"
            >
              {t("visitExchange")}
            </PrefetchLink>
          </p>
        )}

        {followedItems.length > 0 ? (
          <ActivityFeedSection
            listings={[]}
            followedItems={followedItems}
            variant="compact"
            className="mt-5 border border-noir-gold/30 bg-noir-dark/55 p-4"
          />
        ) : null}
      </div>
    </section>
  )
}

export default HomeLatestListings

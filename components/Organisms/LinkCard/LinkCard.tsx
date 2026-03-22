import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { PerfumeCompareToggle } from "@/components/Molecules/PerfumeCompareToggle/PerfumeCompareToggle"
import { HOUSE_DETAIL_PATH, PERFUME_PATH } from "@/constants/routes"
import { normalizeRemoteImageSrc, validImageRegex } from "@/utils/styleUtils"
import Image from "next/image"

interface LinkCardProps {
  data: {
    id: string
    name: string
    slug: string
    image?: string
    type?: string
    perfumeHouse?: { name: string } | null
  }
  type: "house" | "perfume"
  children?: React.ReactNode
  selectedLetter?: string | null
  sourcePage?: string
  /** Overrides image `alt` (defaults to `data.name`). */
  imageAlt?: string
  imagePriority?: boolean
}

const LinkCard = ({
  data,
  type,
  children,
  selectedLetter,
  sourcePage,
  imageAlt,
  imagePriority = false,
}: LinkCardProps) => {
  const alt = imageAlt ?? data.name
  const basePath = type === "house" ? HOUSE_DETAIL_PATH : PERFUME_PATH
  const cardImage = normalizeRemoteImageSrc(data.image)
  const href = selectedLetter
    ? `${basePath}/${data.slug}?letter=${selectedLetter}`
    : `${basePath}/${data.slug}`

  return (
    <div className="relative w-full h-full min-h-72 group noir-border overflow-hidden transition-all duration-300 ease-in-out bg-noir-dark/70 backdrop-blur-sm">
      <PrefetchLink
        href={href}
        prefetch={false}
        className="flex flex-col overflow-hidden justify-between items-center group transition-all duration-300 ease-in-out"
      >
        <div className="text-center relative z-10 bg-noir-dark/50 backdrop-blur-sm w-full p-4">
          <h2 className="text-wrap wrap-break-word card-title ">{data.name}</h2>
          {data?.perfumeHouse?.name && (
            <p className="text-md font-semibold text-noir-gold-100">
              {data.perfumeHouse.name}
            </p>
          )}
          
        </div>
        <div className="absolute h-full w-full rounded-lg">
          {cardImage && !validImageRegex.test(cardImage) ? (
            <Image
              src={cardImage}
              alt={alt}
              width={400}
              height={400}
              priority={imagePriority}
              quality={75}
              className="w-full mask-radial-at-center mask-radial-from-10% mask-radial-to-75%                                                        
            transition-all duration-500 ease-in-out scale-150 h-full aspect-square object-fill object-center
            filter grayscale-100 group-hover:grayscale-0 group-hover:scale-110 group-hover:mask-radial-from-30% group-hover:mask-radial-to-100%"
              sizes="(max-width: 640px) 70vw, (max-width: 1024px) 25vw, 20vw"
              style={{ viewTransitionName: `perfume-image-${data.id}` } as React.CSSProperties}
            />
          ) : (
            <Image
              src={type === "house" ? "/images/house-soon.webp" : "/images/single-bottle.webp"}
              alt={alt}
              width={400}
              height={400}
              priority={imagePriority}
              quality={75}
              className="w-full object-fill mask-radial-at-center mask-radial-from-10% mask-radial-to-75%                                                        
            transition-all duration-500 ease-in-out scale-120 h-full aspect-square
            filter grayscale-100 group-hover:grayscale-0 group-hover:scale-100 group-hover:mask-radial-from-30% group-hover:mask-radial-to-100%"
              sizes="(max-width: 640px) 70vw, (max-width: 1024px) 25vw, 30vw"
              style={{ viewTransitionName: `perfume-image-${data.id}` } as React.CSSProperties}
            />
          )}
          {data.type && (
            <p className="text-sm absolute bottom-6 right-2 bg-noir-gold dark:bg-noir-gold/80 border rounded-sm text-noir-black px-2 py-1 capitalize font-bold border-noir-dark">
              {data.type}
            </p>
          )}
        </div>
      </PrefetchLink>
      {type === "perfume" && (
        <PerfumeCompareToggle
          item={{
            id: data.id,
            slug: data.slug,
            name: data.name,
            image: data.image,
          }}
        />
      )}
      {children && (
        <div className="absolute bottom-0 left-0 right-0 bg-noir-dark/80 p-2 border-t border-noir-gold">
          {children}
        </div>
      )}
    </div>
  )
}

export default LinkCard

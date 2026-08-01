import { type ReactNode } from "react"
import Image from "next/image"

import { normalizeRemoteImageSrc } from "@/utils/styleUtils"

interface TitleBannerProps {
  image: string
  heading: string
  subheading?: string
  children?: ReactNode
  imagePos?: "object-center" | "object-top" | "object-bottom"
  flipImage?: boolean
}

const TitleBanner = ({
  image,
  heading,
  subheading,
  children,
  imagePos = "object-center",
  flipImage,
}: TitleBannerProps) => {
  const bannerSrc = normalizeRemoteImageSrc(image) ?? image
  /** Public-folder paths skip the optimizer so replaced banner files show up without clearing `.next/cache`. */
  const isPublicStaticAsset =
    bannerSrc.startsWith("/") && !bannerSrc.startsWith("//")

  return (
    <header className="relative w-full title-banner flex items-end py-6 justify-center mb-20 md:mb-0">
      <div className="absolute inset-0 bg-noir-black/40 mask-t-from-5% mask-t-to-100% mask md:mb-0"></div>
      <Image
        src={bannerSrc}
        alt=""
        width={1200}
        height={600}
        priority={true}
        quality={70}
        unoptimized={isPublicStaticAsset}
        className={`w-full h-full object-cover ${imagePos} ${
          flipImage ? "scale-x-[-1]" : ""
        } mb-2 filter brightness-[1.2] sepia-[0.2] mix-blend-screen mt-12 md:mt-0 rounded-lg absolute top-0 left-0 right-0 z-0`}
        sizes="100vw"
      />
      <div className="relative z-10 w-full max-w-max p-2 top-20 md:top-0 md:px-8 rounded-lg md:py-4 text-noir-gold text-center text-shadow-lg text-shadow-noir-black bg-noir-black/40 backdrop-blur-sm">
        <h1 className="text-shadow-lg text-shadow-noir-black/90">{heading}</h1>
        {subheading && <p className="subtitle-sm mt-2">{subheading}</p>}
        {children && <div className="p-2">{children}</div>}
      </div>
    </header>
  )
}

export default TitleBanner

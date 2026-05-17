import Image from "next/image"

import { getInitials } from "@/utils/trader-profile"
import { normalizeRemoteImageSrc } from "@/utils/styleUtils"

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
} as const

type TraderAvatarProps = {
  displayName: string
  avatarImage?: string | null
  size?: keyof typeof SIZE_CLASSES
  className?: string
}

const TraderAvatar = ({
  displayName,
  avatarImage,
  size = "md",
  className = "",
}: TraderAvatarProps) => {
  const sizeClass = SIZE_CLASSES[size]
  const src = avatarImage ? normalizeRemoteImageSrc(avatarImage) : null
  const initials = getInitials(displayName)

  if (src) {
    return (
      <span
        className={`relative inline-flex shrink-0 overflow-hidden rounded-full border border-noir-gold/50 bg-noir-dark ${sizeClass} ${className}`}
      >
        <Image
          src={src}
          alt=""
          fill
          className="object-cover"
          sizes={size === "lg" ? "64px" : size === "md" ? "40px" : "32px"}
        />
      </span>
    )
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-noir-gold/50 bg-noir-gold/20 font-semibold text-noir-gold ${sizeClass} ${className}`}
      aria-hidden
    >
      {initials}
    </span>
  )
}

export default TraderAvatar

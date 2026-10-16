"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { FaUserCheck, FaUserPlus } from "react-icons/fa6"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { Button } from "@/components/Atoms/Button/Button"
import { useJoinCta } from "@/components/Containers/SignupAvailability"
import { useFollowMutation, type FollowTargetType } from "@/lib/mutations/follow"
import { trackJoinCtaClick } from "@/utils/analytics/track-join-cta"

type FollowButtonProps = {
  targetType: FollowTargetType
  targetId: string
  initialFollowing: boolean
  viewerId: string | null
  className?: string
}

const FollowButton = ({
  targetType,
  targetId,
  initialFollowing,
  viewerId,
  className,
}: FollowButtonProps) => {
  const t = useTranslations("follow")
  const tJoin = useTranslations("join")
  const joinCta = useJoinCta()
  const followMutation = useFollowMutation()
  const [following, setFollowing] = useState(initialFollowing)

  if (!viewerId) {
    return (
      <PrefetchLink
        href={joinCta.href}
        className={className}
        onClick={() => trackJoinCtaClick("follow", joinCta.freeOpen)}
      >
        <Button variant="secondary" size="sm" type="button">
          {tJoin(joinCta.followKey)}
        </Button>
      </PrefetchLink>
    )
  }

  if (targetType === "user" && targetId === viewerId) {
    return null
  }

  const handleClick = () => {
    const action = following ? "unfollow" : "follow"
    followMutation.mutate(
      { targetType, targetId, action },
      {
        onSuccess: result => {
          if (result.success && result.data) {
            setFollowing(result.data.following)
          }
        },
      }
    )
  }

  return (
    <Button
      variant={following ? "secondary" : "primary"}
      size="sm"
      className={className}
      onClick={handleClick}
      disabled={followMutation.isPending}
      leftIcon={
        following ? (
          <FaUserCheck className="h-4 w-4" aria-hidden />
        ) : (
          <FaUserPlus className="h-4 w-4" aria-hidden />
        )
      }
    >
      {following ? t("following") : t("follow")}
    </Button>
  )
}

export default FollowButton

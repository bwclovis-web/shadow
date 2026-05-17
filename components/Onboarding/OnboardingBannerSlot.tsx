import OnboardingBanner from "@/components/Onboarding/OnboardingBanner"
import { getOnboardingState } from "@/models/onboarding.server"

type OnboardingBannerSlotProps = {
  userId: string
}

const OnboardingBannerSlot = async ({ userId }: OnboardingBannerSlotProps) => {
  try {
    const state = await getOnboardingState(userId)
    if (!state?.showBanner) return null
    return (
      <div
        className="sticky top-[var(--spacing-site-header-mobile)] z-25 mt-[var(--spacing-site-header-mobile)] w-full border-b border-noir-gold/40 bg-noir-dark shadow-lg lg:top-[var(--spacing-site-header-desktop)] lg:mt-[var(--spacing-site-header-desktop)]"
      >
        <OnboardingBanner state={state} />
      </div>
    )
  } catch (error) {
    console.error("OnboardingBannerSlot failed:", error)
    return null
  }
}

export default OnboardingBannerSlot

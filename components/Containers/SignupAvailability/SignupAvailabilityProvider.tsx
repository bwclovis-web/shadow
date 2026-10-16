"use client"

import { createContext, type ReactNode, useContext } from "react"

import {
  CLOSED_SIGNUP_AVAILABILITY,
  getJoinCta,
  type JoinCta,
  type SignupAvailability,
} from "@/utils/membership/signup-availability"

const SignupAvailabilityContext = createContext<SignupAvailability>(
  CLOSED_SIGNUP_AVAILABILITY
)

type SignupAvailabilityProviderProps = {
  availability: SignupAvailability
  children: ReactNode
}

export const SignupAvailabilityProvider = ({
  availability,
  children,
}: SignupAvailabilityProviderProps) => (
  <SignupAvailabilityContext.Provider value={availability}>
    {children}
  </SignupAvailabilityContext.Provider>
)

export type UseJoinCtaResult = SignupAvailability & JoinCta

/** Join CTA target + translation keys; switches automatically once free spots run out. */
export const useJoinCta = (): UseJoinCtaResult => {
  const availability = useContext(SignupAvailabilityContext)
  return { ...availability, ...getJoinCta(availability.freeOpen) }
}

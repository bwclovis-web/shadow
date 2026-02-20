import React, { useEffect, useRef, useState } from "react"

import BottleAccents from "./BottleAccents"
import NoirGradients from "./NoirGradients"
import NoirShadows from "./NoirShadows"
import OverallBottle from "./OverallBottle"
import PerfumeBottle from "./PerfumeBottle"

interface NoirIconProps {
  filled: boolean
  category: string
  animated?: boolean
  rating?: number
}

const NoirIcon = ({
  filled,
  category,
  animated = false,
  rating = 1,
}: NoirIconProps) => {
  const liquidRef = useRef<SVGRectElement>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Lazy load GSAP and animate
  useEffect(() => {
    if (!isClient || category !== "overall" || !liquidRef.current) {
      return
    }

    const loadAnimations = async () => {
      const { gsap } = await import("gsap")
      if (liquidRef.current) {
        animateLiquid(gsap, liquidRef.current, filled, rating)
      }
    }

    loadAnimations()
  }, [filled, rating, category, isClient])

  const animateLiquid = (
    gsap: any,
    element: SVGRectElement,
    isFilled: boolean,
    currentRating: number
  ) => {
    // Clear any previous animations to prevent conflicts
    gsap.killTweensOf(element)

    if (isFilled) {
      // Calculate fill percentage based on rating (1-5)
      const fillPercentage = (currentRating / 5) * 100
      const maxHeight = 18 // Bottle internal height
      const fillHeight = (maxHeight * fillPercentage) / 100
      const bottomY = 26 // Bottom of the bottle interior

      // Animate liquid filling from bottom up
      gsap.fromTo(
        element,
        {
          opacity: 0,
          attr: { height: 0, y: bottomY }, // Start at bottom
        },
        {
          opacity: 0.85,
          attr: { height: fillHeight, y: bottomY - fillHeight }, // Fill upward
          duration: 1.2,
          ease: "power3.out",
          delay: 0.2,
        }
      )
    } else {
      // Smooth liquid draining animation
      gsap.to(element, {
        opacity: 0,
        attr: { height: 0, y: 26 },
        duration: 0.5,
        ease: "power2.in",
      })
    }
  }

  if (category === "overall") {
    return (
      <svg
        viewBox="0 0 30 40"
        className="w-full h-full transition-all duration-300"
        pointerEvents="none"
      >
        <NoirGradients filled={filled} category={category} />
        <NoirShadows category={category} animated={animated && isClient} />
        <OverallBottle filled={filled} rating={rating} liquidRef={liquidRef} />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 30 40"
      className="w-full h-full transition-all duration-300"
      pointerEvents="none"
    >
      <NoirGradients filled={filled} category={category} />
      <NoirShadows category={category} animated={animated && isClient} />
      <PerfumeBottle filled={filled} category={category} />
      {filled && <BottleAccents category={category} />}
    </svg>
  )
}

export default NoirIcon

"use client"

import { type ReactNode, useEffect, useRef } from "react"

interface TitleBannerAnimatorProps {
  children: ReactNode
}

/**
 * Client-only wrapper that runs GSAP entrance animations on .hero-image, .hero-title, .subtitle-sm.
 * Keeps the client boundary minimal so TitleBanner can stay a server component.
 */
export default function TitleBannerAnimator({ children }: TitleBannerAnimatorProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const runAnimations = async () => {
      const { gsap } = await import("gsap")
      const el = containerRef.current
      if (!el) return

      gsap.fromTo(
        el.querySelector(".hero-image"),
        {
          filter: "contrast(0) brightness(0.1)",
          opacity: 0,
        },
        {
          filter: "contrast(1.4) brightness(1)",
          opacity: 1,
          duration: 2,
        }
      )
      gsap.from(el.querySelector(".hero-title"), {
        opacity: 0,
        y: 50,
        duration: 1.2,
        ease: "power2.out",
      })
      gsap.fromTo(
        el.querySelector(".subtitle-sm"),
        {
          opacity: 0,
          filter: "blur(6px)",
          y: 20,
        },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          duration: 2,
          delay: 1.2,
          ease: "power3.out",
        }
      )
    }

    requestAnimationFrame(() => {
      runAnimations()
    })
  }, [])

  return (
    <div ref={containerRef} className="contents">
      {children}
    </div>
  )
}

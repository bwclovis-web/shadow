"use client"

import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import Select from "@/components/Atoms/Select"
import SearchBar from "@/components/Organisms/SearchBar"
import { useMounted } from "@/hooks/useMounted"

type Feature = Awaited<ReturnType<typeof import("@/models/feature.server").getAllFeatures>>[number]

interface HomeClientProps {
  features: Feature[]
  counts: { users: number; houses: number; perfumes: number }
}

export default function HomeClient({ features, counts }: HomeClientProps) {
  const [searchType, setSearchType] = useState<"perfume-house" | "perfume">("perfume")
  const container = useRef<HTMLDivElement>(null)
  const tHome = useTranslations("home")
  const tComponents = useTranslations("components.search")
  const mounted = useMounted()

  // Lazy load GSAP animations after component mounts
  useEffect(() => {
    const loadAnimations = async () => {
      const [{ gsap }] = await Promise.all([
        import("gsap"),
        import("@gsap/react"),
      ])

      if (!container.current) return

      gsap.from(".hero-title", {
        opacity: 0,
        y: 50,
        duration: 1.2,
        ease: "power2.out",
      })
      gsap.fromTo(
        ".subtitle",
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
      loadAnimations()
    })
  }, [])

  const handleSelectType = (evt: ChangeEvent<HTMLSelectElement>) => {
    setSearchType(evt.target.value as "perfume-house" | "perfume")
  }

  const data = [
    {
      id: "perfume-house",
      name: mounted ? tHome("radio.houses") : "home.radio.houses",
      label: mounted ? tHome("radio.houses") : "home.radio.houses",
    },
    {
      id: "perfume",
      name: mounted ? tHome("radio.perfumes") : "home.radio.perfumes",
      label: mounted ? tHome("radio.perfumes") : "home.radio.perfumes",
    },
  ]

  return (
    <div className="relative z-10 top-0 pb-20 md:pb-0">
      <div
        className="flex flex-col gap-8 items-center md:justify-center min-h-screen px-4 relative bg-noir-gold-500/30"
        ref={container}
      >
        <img
          src="/images/landing.png"
          alt=""
          width={1200}
          height={800}
          fetchPriority="high"
          loading="eager"
          className="absolute object-cover w-full h-full filter grayscale-100% sepia-[0.5] mix-blend-multiply hero-image"
        />
        <div className="absolute inset-0 bg-noir-black/85 mask-radial-from-10% mask-radial-to-74% md:mask-radial-from-25% md:mask-radial-to-44%" />
        <section className="text-noir-gold relative z-10 flex flex-col items-center gap-4 pt-40 md:pt-0">
          <div className="text-shadow-lg/90 text-shadow-noir-black text-center">
            <h1 className="hero-title">
              {mounted ? tHome("heading") : "home.heading"}
            </h1>
            <p className="subtitle opacity-0">
              {mounted ? tHome("subheading") : "home.subheading"}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8 mt-4 mb-6">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-noir-gold">
                {counts.users.toLocaleString("en-US")}
              </div>
              <div className="text-sm md:text-base text-noir-gold/80">
                {mounted
                  ? tHome("stats.users")
                  : "home.stats.users"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-noir-gold">
                {counts.houses.toLocaleString("en-US")}
              </div>
              <div className="text-sm md:text-base text-noir-gold/80">
                {mounted
                  ? tHome("stats.houses")
                  : "home.stats.houses"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-noir-gold">
                {counts.perfumes.toLocaleString("en-US")}
              </div>
              <div className="text-sm md:text-base text-noir-gold/80">
                {mounted
                  ? tHome("stats.perfumes")
                  : "home.stats.perfumes"}
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse md:flex-row items-baseline justify-start w-full max-w-4xl mt-6 gap-4 md:gap-0">
            <Select
              size="expanded"
              value={searchType}
              action={handleSelectType}
              selectId="search-type"
              selectData={data}
              ariaLabel={
                mounted ? tComponents("ariaLabel") : "components.search.ariaLabel"
              }
            />
            <SearchBar
              searchType={searchType}
              variant="home"
              className="mt-2 md:mt-8 w-full"
            />
          </div>
        </section>
      </div>
    </div>
  )
}

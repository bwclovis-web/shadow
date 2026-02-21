"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import AlphabeticalNav from "@/components/Organisms/AlphabeticalNav"
import DataDisplaySection from "@/components/Organisms/DataDisplaySection"

export default function HousesListClient() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const letterParam = searchParams.get("letter")
  const selectedLetter =
    letterParam && /^[A-Za-z]$/.test(letterParam)
      ? letterParam.toUpperCase()
      : null

  const [houses, setHouses] = useState<Array<{ id: string; name: string; slug: string; image?: string; type?: string }>>([])
  const [isLoading, setIsLoading] = useState(!!selectedLetter)

  useEffect(() => {
    if (!selectedLetter) {
      setHouses([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    fetch(`/api/houses-by-letter?letter=${selectedLetter}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.houses)) {
          setHouses(data.houses)
        } else {
          setHouses([])
        }
      })
      .catch(() => setHouses([]))
      .finally(() => setIsLoading(false))
  }, [selectedLetter])

  const handleLetterSelect = (letter: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (letter) {
      params.set("letter", letter)
    } else {
      params.delete("letter")
    }
    const query = params.toString()
    router.push(query ? `/houses?${query}` : "/houses")
  }

  return (
    <section className="relative z-10 my-4">
      <div className="inner-container">
        <h1 className="font-headline text-noir-gold text-center text-3xl md:text-4xl mb-4">
          {tNav("houses")}
        </h1>
        <p className="text-noir-gold/80 text-center mb-8">
          {tDataDisplay("heading", { itemName: "houses" })}
        </p>
      </div>

      <AlphabeticalNav
        selectedLetter={selectedLetter}
        onLetterSelect={handleLetterSelect}
        prefetchType="houses"
      />

      <DataDisplaySection
        data={houses}
        isLoading={isLoading}
        type="house"
        selectedLetter={selectedLetter}
        sourcePage="houses"
      />
    </section>
  )
}

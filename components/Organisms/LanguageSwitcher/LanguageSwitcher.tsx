"use client"

import { type ChangeEvent, useTransition } from "react"
import { useLocale } from "next-intl"
import { useRouter } from "next/navigation"

import Select from "@/components/Atoms/Select/Select"
import { setLocale } from "@/lib/actions/locale"

const languageOptions = [
  { id: "en", label: "English", name: "en" },
  { id: "es", label: "Español", name: "es" },
  { id: "fr", label: "Français", name: "fr" },
  { id: "it", label: "Italiano", name: "it" },
]

const LanguageSwitcher = () => {
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleLanguageChange = (evt: ChangeEvent<HTMLSelectElement>) => {
    const newLocale = evt.target.value
    startTransition(async () => {
      await setLocale(newLocale)
      router.refresh()
    })
  }

  return (
    <Select
      selectId="language-switcher"
      selectData={languageOptions}
      defaultId={locale}
      action={handleLanguageChange}
      ariaLabel="Select Language"
      size="compact"
    />
  )
}

export default LanguageSwitcher

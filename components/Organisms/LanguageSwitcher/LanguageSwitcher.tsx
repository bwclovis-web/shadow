import { type ChangeEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import Select from "@/components/Atoms/Select/Select"

const LanguageSwitcher = () => {
  const { i18n } = useTranslation()
  // Use local state to track selected language for immediate UI updates
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language)

  // Sync local state with i18n.language when it changes (e.g., from external sources)
  useEffect(() => {
    setSelectedLanguage(i18n.language)
  }, [i18n.language])

  const languageOptions = [
    { id: "en", label: "English", name: "en" },
    { id: "es", label: "Español", name: "es" },
    { id: "fr", label: "Français", name: "fr" },
    { id: "it", label: "Italiano", name: "it" },
  ]

  const handleLanguageChange = (evt: ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = evt.target.value
    // Update local state immediately for responsive UI
    setSelectedLanguage(newLanguage)
    // Change the actual language
    i18n.changeLanguage(newLanguage)
  }

  return (
    <Select
      selectId="language-switcher"
      selectData={languageOptions}
      defaultId={selectedLanguage}
      action={handleLanguageChange}
      ariaLabel="Select Language"
      size="compact"
    />
  )
}

export default LanguageSwitcher

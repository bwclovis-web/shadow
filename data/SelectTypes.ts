export const houseTypes = [
  { id: "niche", name: "niche", label: "Niche" },
  { id: "designer", name: "designer", label: "Designer" },
  { id: "celebrity", name: "celebrity", label: "Celebrity" },
  { id: "indie", name: "indie", label: "Indie" },
  { id: "middle-eastern", name: "middle-eastern", label: "Middle Eastern" },
  { id: "drugstore", name: "drugstore", label: "Mainstream/Mass Market" },
]

export const perfumeTypes = [
  { id: "eauDeParfum", name: "eauDeParfum", label: "Eau de Parfum" },
  { id: "eauDeToilette", name: "eauDeToilette", label: "Eau de Toilette" },
  { id: "eauDeCologne", name: "eauDeCologne", label: "Eau de Cologne" },
  { id: "parfum", name: "parfum", label: "Parfum" },
  { id: "cologne", name: "cologne", label: "Cologne" },
  {
    id: "extraitDeParfum",
    name: "extraitDeParfum",
    label: "Extrait de Parfum",
  },
  { id: "extraitOil", name: "extraitOil", label: "Extrait Oil" },
  { id: "waterMist", name: "waterMist", label: "Water Mist" },
  { id: "ipmSpray", name: "ipmSpray", label: "IPM Spray" },
]

export const getPerfumeTypeLabel = (typeName: string | undefined): string | undefined => {
  if (!typeName) {
    return undefined
  }

  const perfumeType = perfumeTypes.find(type => type.name === typeName)
  return perfumeType?.label
}

const fields = [
  "id",
  "name",
  "description",
  "image",
  "website",
  "country",
  "founded",
  "type",
  "email",
  "phone",
  "address",
  "createdAt",
  "updatedAt",
]

const csvHeaders = [
  "id",
  "name",
  "description",
  "image",
  "website",
  "country",
  "founded",
  "type",
  "email",
  "phone",
  "address",
  "createdAt",
  "updatedAt",
]

type House = {
  [key: string]: unknown
  id?: string
  name?: string
  type?: string
  address?: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

const getTypeField = (house: House): string =>
  typeof house.type !== "string" && house.name ? (house.name ?? "") : (house.type ?? "")

const getAddressField = (house: House): string =>
  typeof house.address !== "string" && house.address
    ? (house.address ?? "")
    : (house.type ?? "")

const getDateField = (value: string | Date | undefined): string => {
  if (!value) {
    return ""
  }
  return typeof value === "string" ? value : new Date(value).toISOString()
}

const formatField = (field: string, house: House): string => {
  let val = ""
  switch (field) {
    case "id":
      val = house.id ?? ""
      break
    case "type":
      val = getTypeField(house)
      break
    case "address":
      val = getAddressField(house)
      break
    case "createdAt":
      val = getDateField(house.createdAt)
      break
    case "updatedAt":
      val = getDateField(house.updatedAt)
      break
    default:
      if (Object.prototype.hasOwnProperty.call(house, field)) {
        val = String(house[field] ?? "")
      }
      break
  }
  return `"${String(val).replace(/"/g, '""')}"`
}

export type DownloadCsvHandlers = {
  onEmpty?: () => void
  onError?: (message: string) => void
}

export const handleDownloadCSV = async (handlers?: DownloadCsvHandlers) => {
  try {
    const res = await fetch("/api/data-quality-houses")
    const response = await res.json()

    const houses = Array.isArray(response) ? response : response.houses || []

    if (houses.length === 0) {
      handlers?.onEmpty?.()
      return
    }

    const rows = [csvHeaders]

    for (const house of houses) {
      rows.push(fields.map(field => formatField(field, house as House)))
    }

    const csvContent = rows.map(row => row.join(",")).join("\r\n")

    const BOM = "\uFEFF"
    const csvWithBOM = BOM + csvContent

    const blob = new Blob([csvWithBOM], {
      type: "text/csv;charset=utf-8;",
    })

    const timestamp = new Date().toISOString().split("T")[0]
    const filename = `perfume_houses_${timestamp}.csv`

    const url = URL.createObjectURL(blob)
    const aTag = document.createElement("a")
    aTag.href = url
    aTag.download = filename
    aTag.style.display = "none"
    document.body.appendChild(aTag)
    aTag.click()
    document.body.removeChild(aTag)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error("Error downloading CSV:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    handlers?.onError?.(errorMessage)
  }
}

export default handleDownloadCSV

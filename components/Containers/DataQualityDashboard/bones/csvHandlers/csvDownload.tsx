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

// CSV headers that match the field names for proper parsing
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
  [key: string]: any
  id?: string
  name?: string
  type?: string
  address?: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

const getTypeField = (house: House): string => typeof house.type !== "string" && house.name ? house.name ?? "" : house.type ?? ""

const getAddressField = (house: House): string => typeof house.address !== "string" && house.address
    ? house.address ?? ""
    : house.type ?? ""

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
        val = house[field] ?? ""
      }
      break
  }
  // Escape quotes and wrap in quotes (Excel compatible)
  return `"${String(val).replace(/"/g, '""')}"`
}
// eslint-disable-next-line max-statements
export const handleDownloadCSV = async () => {
  try {
    const res = await fetch("/api/data-quality-houses")
    const response = await res.json()

    // The API returns houses directly, not wrapped in a 'houses' property
    const houses = Array.isArray(response) ? response : response.houses || []

    if (houses.length === 0) {
      alert("No houses found to export. Please check if there are houses in the database.")
      return
    }

    // Start with proper CSV headers
    const rows = [csvHeaders]

    // Add data rows
    for (const house of houses) {
      rows.push(fields.map(field => formatField(field, house)))
    }

    // Join rows with proper line endings
    const csvContent = rows.map(row => row.join(",")).join("\r\n")

    // Add BOM for proper UTF-8 encoding in Excel
    const BOM = "\uFEFF"
    const csvWithBOM = BOM + csvContent

    // Create blob with proper MIME type
    const blob = new Blob([csvWithBOM], {
      type: "text/csv;charset=utf-8;",
    })

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0]
    const filename = `perfume_houses_${timestamp}.csv`

    // Create download link
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
    alert(`Failed to download CSV: ${errorMessage}`)
  }
}

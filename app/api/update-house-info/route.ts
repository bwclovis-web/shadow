import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import Papa from "papaparse"

import { migrateHouseImageToR2 } from "@/lib/r2-migrate"
import { prisma } from "@/lib/db"
import { createUrlSlug } from "@/utils/slug"
import { sanitizeText } from "@/utils/server/sanitize.server"
import { revalidateHouseDataCache } from "@/utils/server/revalidate-catalog-cache.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

const VALID_HOUSE_TYPES = [
  "niche",
  "designer",
  "indie",
  "celebrity",
  "drugstore",
] as const

const EXPECTED_HEADERS = [
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
] as const

type RowResult = { status: "updated" | "error"; message?: string }

function validateRow(row: Record<string, string>, rowIndex: number): string | null {
  const id = row.id?.trim()
  if (!id) return `Row ${rowIndex + 1}: id is required`

  const name = row.name?.trim() ?? ""
  if (name.length < 2) return `Row ${rowIndex + 1}: name must be at least 2 characters`
  if (name.length > 200) return `Row ${rowIndex + 1}: name must be at most 200 characters`

  const type = row.type?.trim()
  if (type && !VALID_HOUSE_TYPES.includes(type as (typeof VALID_HOUSE_TYPES)[number])) {
    return `Row ${rowIndex + 1}: invalid type "${type}"`
  }

  const email = row.email?.trim() ?? ""
  if (email.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return `Row ${rowIndex + 1}: invalid email`
  }

  const website = row.website?.trim() ?? ""
  if (website.length > 0) {
    try {
      new URL(website)
    } catch {
      return `Row ${rowIndex + 1}: invalid website URL`
    }
  }

  return null
}

export const POST = async (request: NextRequest) => {
  try {
    await requireCSRF(request)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  const text = await request.text()
  if (!text.trim()) {
    return NextResponse.json({ error: "Empty CSV body" }, { status: 400 })
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: h => h.trim(),
  })

  if (parsed.errors.length > 0) {
    const msg = parsed.errors.map(e => e.message).join("; ")
    return NextResponse.json({ error: `CSV parse error: ${msg}` }, { status: 400 })
  }

  const rows = parsed.data.filter(r => Object.keys(r).some(k => (r[k] ?? "").trim() !== ""))

  if (rows.length === 0) {
    return NextResponse.json({ error: "No data rows in CSV" }, { status: 400 })
  }

  const headers = parsed.meta.fields ?? []
  const missingHeaders = EXPECTED_HEADERS.filter(h => !headers.includes(h))
  if (missingHeaders.length > 0) {
    return NextResponse.json(
      {
        error: `CSV must include columns: ${missingHeaders.join(", ")}`,
      },
      { status: 400 }
    )
  }

  const results: RowResult[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const err = validateRow(row, i)
    if (err) {
      results.push({ status: "error", message: err })
      continue
    }

    const id = row.id!.trim()
    const existing = await prisma.perfumeHouse.findUnique({ where: { id } })
    if (!existing) {
      results.push({ status: "error", message: `Row ${i + 1}: house id not found` })
      continue
    }

    const name = sanitizeText(row.name)
    const typeRaw = row.type?.trim()
    const type =
      typeRaw && VALID_HOUSE_TYPES.includes(typeRaw as (typeof VALID_HOUSE_TYPES)[number])
        ? (typeRaw as (typeof VALID_HOUSE_TYPES)[number])
        : existing.type

    try {
      const imageVal = (row.image ?? "").trim()
      await prisma.perfumeHouse.update({
        where: { id },
        data: {
          name,
          slug: createUrlSlug(name),
          description: sanitizeText(row.description ?? ""),
          image: row.image ?? "",
          website: row.website ?? "",
          country: row.country ?? "",
          founded: row.founded ?? "",
          type,
          email: row.email ?? "",
          phone: row.phone ?? "",
          address: row.address ?? "",
        },
      })

      if (imageVal) {
        await migrateHouseImageToR2(id, imageVal, { prismaClient: prisma })
      }

      results.push({ status: "updated" })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        results.push({
          status: "error",
          message: `Row ${i + 1}: duplicate name or slug`,
        })
      } else {
        results.push({
          status: "error",
          message: `Row ${i + 1}: ${e instanceof Error ? e.message : String(e)}`,
        })
      }
    }
  }

  const anyUpdated = results.some(r => r.status === "updated")
  if (anyUpdated) {
    revalidateHouseDataCache()
  }

  return NextResponse.json({ results })
}

export const GET = () =>
  NextResponse.json({ error: "Method not allowed" }, { status: 405 })

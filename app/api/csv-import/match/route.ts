import { NextRequest, NextResponse } from "next/server"

import { CSV_IMPORT_MAX_ROWS } from "@/lib/csv-import-user"
import {
  type CatalogPerfume,
  matchCsvRowsAgainstCatalog,
  parseCsvMatchRequestRows,
} from "@/lib/csv-import-match"
import { prisma } from "@/lib/db"
import { validateRateLimit } from "@/utils/api-validation.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"

const CSV_MATCH_RATE_LIMIT_MAX = 10
const CSV_MATCH_RATE_LIMIT_WINDOW_MS = 60 * 1000

const NAME_SCOPED_CATALOG_CAP = 500

const perfumeSelect = {
  id: true,
  name: true,
  perfumeHouse: { select: { name: true } },
} as const

const toCatalogPerfumes = (
  rows: { id: string; name: string; perfumeHouse: { name: string } | null }[]
): CatalogPerfume[] =>
  rows
    .filter((p): p is typeof p & { perfumeHouse: { name: string } } => !!p.perfumeHouse?.name)
    .map(p => ({
      id: p.id,
      name: p.name,
      houseName: p.perfumeHouse.name,
    }))

export const POST = async (request: NextRequest) => {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status ?? 401 }
      )
    }

    const body = await request.json().catch(() => null)
    await requireCSRFForJsonBody(request, body)

    try {
      validateRateLimit(
        `csv-import-match:user:${authResult.user!.id}`,
        CSV_MATCH_RATE_LIMIT_MAX,
        CSV_MATCH_RATE_LIMIT_WINDOW_MS
      )
    } catch (rateLimitResponse) {
      if (rateLimitResponse instanceof Response) {
        return rateLimitResponse
      }
      throw rateLimitResponse
    }

    const parsed = parseCsvMatchRequestRows(body)
    if ("error" in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const { rows } = parsed
    const houses = [
      ...new Set(rows.map(r => r.house.trim()).filter(Boolean)),
    ]
    const noHouseNames = [
      ...new Set(
        rows.filter(r => !r.house.trim()).map(r => r.perfumeName.trim()).filter(Boolean)
      ),
    ]

    const [houseScopedRaw, nameScopedRaw] = await Promise.all([
      houses.length > 0
        ? prisma.perfume.findMany({
            where: {
              perfumeHouse: {
                name: { in: houses, mode: "insensitive" },
              },
            },
            select: perfumeSelect,
            take: CSV_IMPORT_MAX_ROWS * 20,
          })
        : Promise.resolve([]),
      noHouseNames.length > 0
        ? prisma.perfume.findMany({
            where: {
              OR: noHouseNames.map(name => ({
                name: { contains: name, mode: "insensitive" as const },
              })),
            },
            select: perfumeSelect,
            take: NAME_SCOPED_CATALOG_CAP,
          })
        : Promise.resolve([]),
    ])

    const houseScopedCatalog = toCatalogPerfumes(houseScopedRaw)
    const nameScopedCatalog = toCatalogPerfumes(nameScopedRaw)
    const matches = matchCsvRowsAgainstCatalog(
      rows,
      houseScopedCatalog,
      nameScopedCatalog
    )

    return NextResponse.json({ success: true, matches })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("[api/csv-import/match]", error)
    return NextResponse.json(
      { success: false, error: "Failed to match rows against catalog" },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { getAvailablePerfumesForDecanting } from "@/models/perfume.server"

export async function GET() {
  try {
    const availablePerfumes = await getAvailablePerfumesForDecanting()
    return NextResponse.json(
      {
        success: true,
        perfumes: availablePerfumes,
        count: availablePerfumes.length,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
          "X-Data-Size": JSON.stringify(availablePerfumes).length.toString(),
        },
      }
    )
  } catch (error) {
    console.error("[api/available-perfumes]", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch available perfumes" },
      { status: 500 }
    )
  }
}

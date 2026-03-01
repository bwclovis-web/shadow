import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"

export const GET = async () => {
  try {
    const houses = await prisma.perfumeHouse.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        website: true,
        country: true,
        founded: true,
        type: true,
        email: true,
        phone: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(houses)
  } catch (error) {
    console.error("[api/data-quality-houses]", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load houses",
      },
      { status: 500 }
    )
  }
}

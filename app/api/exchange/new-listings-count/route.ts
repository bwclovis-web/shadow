import { NextRequest, NextResponse } from "next/server"

import { getNewListingsSinceCount } from "@/models/activity-feed.server"

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DAYS_IN_WEEK = 7

export const GET = async (request: NextRequest) => {
  const sinceParam = request.nextUrl.searchParams.get("since")
  let since: Date

  if (sinceParam) {
    since = new Date(sinceParam)
    if (Number.isNaN(since.getTime())) {
      return NextResponse.json({ error: "Invalid since" }, { status: 400 })
    }
  } else {
    since = new Date(Date.now() - DAYS_IN_WEEK * MS_PER_DAY)
  }

  try {
    const count = await getNewListingsSinceCount(since)
    return NextResponse.json({ count })
  } catch (error) {
    console.error("Failed to load new listings count:", error)
    return NextResponse.json(
      { error: "Failed to load new listings count" },
      { status: 500 }
    )
  }
}

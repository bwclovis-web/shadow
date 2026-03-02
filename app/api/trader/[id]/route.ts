import { NextRequest, NextResponse } from "next/server"

import { getTraderById } from "@/models/user.server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Trader ID is required" }, { status: 400 })
  }
  try {
    const trader = await getTraderById(id)
    if (!trader) {
      return NextResponse.json({ error: "Trader not found" }, { status: 404 })
    }
    return NextResponse.json({ trader })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch trader"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

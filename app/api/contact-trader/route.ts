import { NextRequest, NextResponse } from "next/server"

import { createContactMessage } from "@/models/contactMessage.server"
import { createUserAlert } from "@/models/user-alerts.server"
import type { AlertType } from "@/types/database"
import { ContactTraderSchema } from "@/utils/validation/formValidationSchemas"
import { parseFormData } from "@/utils/server/api-route-helpers.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { createSuccessResponse } from "@/utils/response.server"
import { prisma } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status ?? 401 }
      )
    }

    const formData = await parseFormData(request)
    await requireCSRF(request, formData)

    const raw = {
      recipientId: formData.get("recipientId"),
      subject: formData.get("subject"),
      message: formData.get("message"),
    }

    const parsed = ContactTraderSchema.safeParse({
      recipientId: raw.recipientId ?? "",
      subject: raw.subject ?? undefined,
      message: raw.message ?? "",
    })

    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const message =
        first.message?.[0] ?? first.recipientId?.[0] ?? first.subject?.[0] ?? "Validation failed"
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      )
    }

    const { recipientId, subject, message } = parsed.data

    const created = await createContactMessage({
      senderId: authResult.user!.id,
      recipientId,
      subject: subject?.trim() || null,
      message: message.trim(),
    })

    const sender = await prisma.user.findUnique({
      where: { id: authResult.user!.id },
      select: { username: true, firstName: true, lastName: true },
    })
    const senderName =
      sender?.firstName && sender?.lastName
        ? `${sender.firstName} ${sender.lastName}`.trim()
        : sender?.username ?? "Someone"

    await createUserAlert(
      recipientId,
      null,
      "new_trader_message" as AlertType,
      `New message from ${senderName}`,
      subject?.trim() ? `${subject.slice(0, 60)}${subject.length > 60 ? "…" : ""}` : message.trim().slice(0, 80),
      { messageId: created.id, senderId: authResult.user!.id }
    )

    return createSuccessResponse({
      message: "Message sent successfully",
    })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      )
    }
    const msg =
      error instanceof Error ? error.message : "Failed to send message"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

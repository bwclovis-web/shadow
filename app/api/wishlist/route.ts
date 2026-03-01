import { NextRequest, NextResponse } from "next/server"
import {
  addToWishlist,
  removeFromWishlist,
  updateWishlistVisibility,
} from "@/models/wishlist.server"
import { processDecantInterestAlerts } from "@/utils/alert-processors"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { ErrorHandler } from "@/utils/errorHandling"
import { validationError } from "@/utils/errorHandling.patterns"
import { WishlistActionSchema } from "@/utils/validation/formValidationSchemas"
import { validateFormData } from "@/utils/validation"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    await requireCSRF(request, formData)
    const validation = validateFormData(WishlistActionSchema, formData)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: "Validation failed", errors: validation.errors }, { status: 400 })
    }
    const { perfumeId, action: actionType, isPublic } = validation.data!
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status ?? 401 })
    }
    const userId = authResult.user!.id

    if (actionType === "add") {
      const result = await addToWishlist(userId, perfumeId, isPublic ?? false)
      if (isPublic) {
        try {
          await processDecantInterestAlerts(perfumeId, userId, true)
        } catch (_) {}
      }
      return NextResponse.json(result)
    }
    if (actionType === "remove") {
      const result = await removeFromWishlist(userId, perfumeId)
      return NextResponse.json(result)
    }
    if (actionType === "updateVisibility") {
      if (isPublic === undefined) {
        throw validationError("isPublic is required for updateVisibility action", { field: "isPublic", action: "updateVisibility" })
      }
      const result = await updateWishlistVisibility(userId, perfumeId, isPublic)
      if (isPublic) {
        try {
          await processDecantInterestAlerts(perfumeId, userId, true)
        } catch (_) {}
      }
      return NextResponse.json(result)
    }
    throw validationError("Invalid action type", { actionType, validActions: ["add", "remove", "updateVisibility"] })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 })
    }
    const appError = ErrorHandler.handle(error, { api: "wishlist", route: "api/wishlist" })
    return NextResponse.json({ success: false, error: appError.userMessage }, { status: 500 })
  }
}

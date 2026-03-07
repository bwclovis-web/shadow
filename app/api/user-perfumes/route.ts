import { NextRequest, NextResponse } from "next/server"
import { getAllPerfumes } from "@/models/perfume.server"
import {
  addPerfumeComment,
  addUserPerfume,
  createDestashEntry,
  deletePerfumeComment,
  getCommentsByUserPerfumeId,
  getUserPerfumes,
  removeUserPerfume,
  updateAvailableAmount,
  updatePerfumeComment,
} from "@/models/user.server"
import { processWishlistAvailabilityAlerts } from "@/utils/alert-processors"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { ErrorHandler } from "@/utils/errorHandling"

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status ?? 401 })
    }
    const userPerfumes = await getUserPerfumes(authResult.user!.id)
    const allPerfumes = await getAllPerfumes()
    return NextResponse.json({ success: true, userPerfumes, allPerfumes })
  } catch (error) {
    const appError = ErrorHandler.handle(error, { api: "user-perfumes", action: "loader" })
    return NextResponse.json({ success: false, error: appError.userMessage }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status ?? 401 })
    }
    const user = authResult.user!
    const formData = await request.formData()
    await requireCSRF(request, formData)
    const perfumeId = (formData.get("perfumeId") as string)?.trim()
    const actionType = formData.get("action") as string
    const userPerfumeId = (formData.get("userPerfumeId") as string)?.trim()

    if (!actionType) {
      return NextResponse.json({ success: false, error: "Action is required" }, { status: 400 })
    }
    const needsPerfumeId = ["add", "decant", "create-decant"].includes(actionType)
    const needsUserPerfumeId = ["remove", "get-comments", "add-comment", "decant"].includes(actionType)
    if (needsPerfumeId && !perfumeId) {
      return NextResponse.json({ success: false, error: "Perfume ID is required for this action" }, { status: 400 })
    }
    if (needsUserPerfumeId && !userPerfumeId && !perfumeId) {
      return NextResponse.json({ success: false, error: "User Perfume ID or Perfume ID is required" }, { status: 400 })
    }

    const amount = formData.get("amount") as string | undefined
    const comment = formData.get("comment") as string | undefined
    const isPublic = formData.get("isPublic") === "true"
    const commentId = (formData.get("commentId") as string)?.trim()
    const tradePrice = formData.get("tradePrice") as string | undefined
    const tradePreference = formData.get("tradePreference") as string | undefined
    const tradeOnly = formData.get("tradeOnly") === "true"

    let result: unknown
    switch (actionType) {
      case "add": {
        const price = formData.get("price") as string | undefined
        const placeOfPurchase = formData.get("placeOfPurchase") as string | undefined
        const perfumeType = (formData.get("type") as string)?.trim() || undefined
        result = await addUserPerfume({
          userId: user.id,
          perfumeId,
          amount,
          price,
          placeOfPurchase,
          type: perfumeType,
        })
        if (amount && parseFloat(amount) > 0) {
          try {
            await processWishlistAvailabilityAlerts(perfumeId, user.id)
          } catch (_) {}
        }
        break
      }
      case "remove":
        result = await removeUserPerfume(user.id, userPerfumeId || perfumeId)
        break
      case "decant": {
        result = await updateAvailableAmount({
          userId: user.id,
          userPerfumeId: userPerfumeId || perfumeId!,
          availableAmount: amount ?? "0",
          tradePrice,
          tradePreference,
          tradeOnly,
        })
        if (amount && parseFloat(amount) > 0 && perfumeId) {
          try {
            await processWishlistAvailabilityAlerts(perfumeId, user.id)
          } catch (_) {}
        }
        break
      }
      case "create-decant": {
        if (!perfumeId) {
          return NextResponse.json({ success: false, error: "Perfume ID is required" }, { status: 400 })
        }
        const availableAmount = (formData.get("amount") as string) ?? "0"
        result = await createDestashEntry({
          userId: user.id,
          perfumeId,
          available: availableAmount,
          tradePrice,
          tradePreference: tradePreference || "cash",
          tradeOnly,
        })
        if (availableAmount && parseFloat(availableAmount) > 0) {
          try {
            await processWishlistAvailabilityAlerts(perfumeId, user.id)
          } catch (_) {}
        }
        break
      }
      case "add-comment": {
        if (!comment || !userPerfumeId) {
          return NextResponse.json({ success: false, error: "Comment and userPerfumeId are required" }, { status: 400 })
        }
        result = await addPerfumeComment({
          userId: user.id,
          perfumeId,
          comment,
          isPublic,
          userPerfumeId,
        })
        break
      }
      case "toggle-comment-visibility": {
        if (!commentId) {
          return NextResponse.json({ success: false, error: "Comment ID is required" }, { status: 400 })
        }
        result = await updatePerfumeComment({ userId: user.id, commentId, isPublic })
        break
      }
      case "delete-comment": {
        if (!commentId) {
          return NextResponse.json({ success: false, error: "Comment ID is required" }, { status: 400 })
        }
        result = await deletePerfumeComment(user.id, commentId)
        break
      }
      case "get-comments": {
        if (!userPerfumeId) {
          return NextResponse.json({ success: false, error: "User Perfume ID is required" }, { status: 400 })
        }
        const comments = await getCommentsByUserPerfumeId(userPerfumeId)
        result = { success: true, comments }
        break
      }
      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 })
    }
    const appError = ErrorHandler.handle(error, { api: "user-perfumes", action: "action" })
    return NextResponse.json({ success: false, error: appError.userMessage }, { status: 500 })
  }
}

import { prisma } from "@/lib/db"
import { sanitizeText } from "@/utils/server/sanitize.server"
import { findUserPerfume, getUserPerfumeById } from "./user-inventory.server"


interface AddCommentParams {
  userId: string
  perfumeId: string
  comment: string
  isPublic?: boolean
  userPerfumeId: string
}

export const addPerfumeComment = async ({
  userId,
  perfumeId,
  comment,
  isPublic = false,
  userPerfumeId,
}: AddCommentParams) => {
  try {
    const listing = await getUserPerfumeById(userPerfumeId)
    if (!listing || listing.userId !== userId) {
      return {
        success: false,
        error: "You can only comment on your own listings",
      }
    }

    const resolvedPerfumeId = perfumeId || listing.perfumeId
    if (perfumeId && listing.perfumeId !== perfumeId) {
      return {
        success: false,
        error: "Listing does not match the selected perfume",
      }
    }

    const sanitizedComment = sanitizeText(comment)
    if (!sanitizedComment) {
      return { success: false, error: "Comment cannot be empty" }
    }

    const userComment = await prisma.userPerfumeComment.create({
      data: {
        userId,
        perfumeId: resolvedPerfumeId,
        userPerfumeId,
        comment: sanitizedComment,
        isPublic,
      },
      include: {
        perfume: true,
        userPerfume: true,
      },
    })

    return { success: true, userComment }
  } catch (error) {
     
    console.error("Error adding comment to perfume:", error)
    return { success: false, error: "Failed to add comment to perfume" }
  }
}

interface UpdateCommentParams {
  userId: string
  commentId: string
  comment?: string
  isPublic?: boolean
}

// Helper function to find a user's comment
const findUserComment = async (commentId: string) =>
  // Note: After running npx prisma generate, this will be available
  prisma.userPerfumeComment.findUnique({
    where: { id: commentId },
  })

// Helper function to perform the comment update
const performCommentUpdate = async (commentId: string, updateData: any) =>
  // Note: After running npx prisma generate, this will be available
  prisma.userPerfumeComment.update({
    where: { id: commentId },
    data: updateData,
    include: {
      perfume: true,
    },
  })

// Helper function to validate comment ownership
const validateCommentOwnership = (comment: any, userId: string) => {
  if (!comment) {
    return { isValid: false, error: "Comment not found" }
  }

  if (comment.userId !== userId) {
    return { isValid: false, error: "You can only update your own comments" }
  }

  return { isValid: true }
}

// Prepare update data for a comment
const prepareCommentUpdateData = (comment?: string, isPublic?: boolean) => {
  const updateData: any = {}

  if (comment !== undefined) {
    updateData.comment = comment
  }

  if (isPublic !== undefined) {
    updateData.isPublic = isPublic
  }

  return updateData
}

export const updatePerfumeComment = async ({
  userId,
  commentId,
  comment,
  isPublic,
}: UpdateCommentParams) => {
  try {
    // Find and validate the comment
    const existingComment = await findUserComment(commentId)
    const validation = validateCommentOwnership(existingComment, userId)

    if (!validation.isValid) {
      return { success: false, error: validation.error }
    }

    // Prepare and perform the update
    const updateData = prepareCommentUpdateData(comment, isPublic)
    const updatedComment = await performCommentUpdate(commentId, updateData)

    return { success: true, userComment: updatedComment }
  } catch (error) {
     
    console.error("Error updating perfume comment:", error)
    return { success: false, error: "Failed to update perfume comment" }
  }
}

export const deletePerfumeComment = async (userId: string, commentId: string) => {
  try {
    // Find the comment
    const existingComment = await findUserComment(commentId)
    const validation = validateCommentOwnership(existingComment, userId)

    if (!validation.isValid) {
      return { success: false, error: validation.error }
    }

    // Delete the comment
    await prisma.userPerfumeComment.delete({
      where: { id: commentId },
    })

    return { success: true }
  } catch (error) {
     
    console.error("Error deleting perfume comment:", error)
    return { success: false, error: "Failed to delete perfume comment" }
  }
}

export const getUserPerfumeComments = async (userId: string, perfumeId: string) => {
  try {
    // Find the user perfume first
    const existingPerfume = await findUserPerfume(userId, perfumeId)

    if (!existingPerfume) {
      return { success: false, error: "Perfume not found in your collection" }
    }

    // Get user's comments for a specific perfume
    const comments = await prisma.userPerfumeComment.findMany({
      where: {
        userPerfumeId: existingPerfume.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return { success: true, comments }
  } catch (error) {
     
    console.error("Error fetching user perfume comments:", error)
    return { success: false, error: "Failed to fetch comments" }
  }
}

// Get comments for a specific userPerfumeId (for when we know the exact destash)
export const getCommentsByUserPerfumeId = async (
  userPerfumeId: string,
  options?: { publicOnly?: boolean }
) => {
  try {
    const comments = await prisma.userPerfumeComment.findMany({
      where: {
        userPerfumeId,
        ...(options?.publicOnly ? { isPublic: true } : {}),
      },
      select: {
        id: true,
        userId: true,
        perfumeId: true,
        userPerfumeId: true,
        comment: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return comments
  } catch (error) {
    console.error("Error fetching comments by userPerfumeId:", error)
    return []
  }
}

export const getPublicPerfumeComments = async (perfumeId: string) => {
  try {
    // Get all public comments for a specific perfume
    const comments = await prisma.userPerfumeComment.findMany({
      where: {
        perfumeId,
        isPublic: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        userPerfume: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return { success: true, comments }
  } catch (error) {
     
    console.error("Error fetching public perfume comments:", error)
    return { success: false, error: "Failed to fetch public comments" }
  }
}

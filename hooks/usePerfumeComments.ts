import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { useCSRF } from "~/hooks/useCSRF"
import type { UserPerfumeI } from "~/types"
import type { Comment } from "~/types/comments"
import { createTemporaryComment } from "~/utils/comment-utils"
import { assertExists } from "~/utils/errorHandling.patterns"
import { safeAsync } from "~/utils/errorHandling.patterns"
import { commentSchemas, sanitizeString } from "~/utils/validation"

interface UsePerfumeCommentsOptions {
  userPerfume: UserPerfumeI
  onCommentAdded?: (comment: Comment) => void
  onCommentSuccess?: () => void // Callback to revalidate data after successful comment
}

export const usePerfumeComments = ({ userPerfume, onCommentAdded, onCommentSuccess }: UsePerfumeCommentsOptions) => {
  const { t } = useTranslation()
  const { submitForm } = useCSRF()
  const [comments, setComments] = useState<Comment[]>([])

  // Initialize comments from userPerfume
  // Also watch for changes to userPerfume.id to handle when switching between destashes
  // Use JSON.stringify to ensure we detect changes even if array reference is the same
  const commentsKey = userPerfume.comments ? JSON.stringify(userPerfume.comments.map(c => c.id).sort()) : 'empty'
  useEffect(() => {
    if (userPerfume.comments) {
      // Filter comments to only include those for this specific userPerfumeId
      const filteredComments = userPerfume.comments.filter(
        comment => comment.userPerfumeId === userPerfume.id
      )
      setComments(filteredComments)
    } else {
      setComments([])
    }
  }, [commentsKey, userPerfume.id, userPerfume.comments])

  // Get unique modal ID for this userPerfume
  const uniqueModalId = `add-scent-${userPerfume.id}`

  // Get perfume and userPerfume IDs with validation
  const getIds = () => {
    const perfumeId = assertExists(
      userPerfume.perfumeId || userPerfume.perfume?.id,
      "Perfume ID",
      { userPerfumeId: userPerfume.id }
    )
    const userPerfumeId = assertExists(userPerfume.id, "User Perfume ID", {
      perfumeId,
    })
    return { perfumeId, userPerfumeId }
  }

  /**
   * Add a new comment
   */
  const addComment = async (commentText: string, isPublic: boolean) => {
    const sanitizedComment = sanitizeString(commentText)
    const { perfumeId, userPerfumeId } = getIds()
    const validationData = {
      perfumeId,
      userPerfumeId,
      comment: sanitizedComment,
      isPublic,
    }

    const validationResult = commentSchemas.create.safeParse(validationData)

    if (!validationResult.success) {
      const errorMessage =
        validationResult.error.errors[0]?.message || "Invalid comment data"
      alert(errorMessage)
      return { success: false, error: errorMessage }
    }

    // Add temporary comment to UI immediately
    const tempComment = createTemporaryComment(sanitizedComment, isPublic, userPerfumeId)
    setComments(prev => [tempComment, ...prev])
    
    if (onCommentAdded) {
      onCommentAdded(tempComment)
    }

    // Create form data with validated data
    const formData = new FormData()
    formData.append("action", "add-comment")
    formData.append("perfumeId", validationResult.data.perfumeId)
    formData.append("userPerfumeId", validationResult.data.userPerfumeId)
    formData.append(
      "isPublic",
      validationResult.data.isPublic?.toString() || "false"
    )
    formData.append("comment", validationResult.data.comment)

    // Use safeAsync for error handling
    const [error, response] = await safeAsync(() => submitForm("/api/user-perfumes", formData))

    if (error) {
      console.error("Error submitting comment:", error)
      // Remove the temporary comment on error
      setComments(prev => prev.filter(c => c.id !== tempComment.id))
      alert(t("comments.error", "Error submitting comment. Please try again."))
      return { success: false, error: "Error submitting comment" }
    }

    const [jsonError, result] = await safeAsync(() => response.json())

    if (jsonError) {
      console.error("Error parsing response:", jsonError)
      // Remove the temporary comment on error
      setComments(prev => prev.filter(c => c.id !== tempComment.id))
      alert(t("comments.error", "Error processing response. Please try again."))
      return { success: false, error: "Error processing response" }
    }

    if (result.success) {
      // Replace temporary comment with real comment from server
      if (result.userComment) {
        setComments(prev => prev.map(c => 
          c.id === tempComment.id 
            ? {
                id: result.userComment.id,
                userId: result.userComment.userId,
                perfumeId: result.userComment.perfumeId,
                userPerfumeId: result.userComment.userPerfumeId,
                comment: result.userComment.comment,
                isPublic: result.userComment.isPublic,
                createdAt: result.userComment.createdAt,
                updatedAt: result.userComment.updatedAt,
              }
            : c
        ))
      }
      
      // Trigger revalidation callback if provided
      if (onCommentSuccess) {
        onCommentSuccess()
      }
      return { success: true }
    } else {
      console.error("Failed to add comment:", result.error)
      // Remove the temporary comment on error
      setComments(prev => prev.filter(c => c.id !== tempComment.id))
      alert(`${t("comments.failed", "Failed to add comment")}: ${result.error}`)
      return { success: false, error: result.error }
    }
  }

  /**
   * Toggle comment visibility (public/private)
   */
  const toggleCommentVisibility = async (commentId: string, currentIsPublic: boolean) => {
    // Don't allow toggling temporary comments
    if (commentId.startsWith('temp-')) {
      console.warn('Cannot toggle visibility of temporary comment. Please wait for it to save.')
      return { success: false, error: 'Comment is still being saved' }
    }

    // Optimistically update UI
    setComments(prevComments => prevComments.map(comment => comment.id === commentId
          ? { ...comment, isPublic: !currentIsPublic }
          : comment))

    const { perfumeId, userPerfumeId } = getIds()

    const formData = new FormData()
    formData.append("action", "toggle-comment-visibility")
    formData.append("commentId", commentId)
    formData.append("perfumeId", perfumeId)
    formData.append("userPerfumeId", userPerfumeId)
    formData.append("isPublic", (!currentIsPublic).toString())

    // Use safeAsync for error handling
    const [error, response] = await safeAsync(() => submitForm("/api/user-perfumes", formData))

    if (error) {
      console.error("Error toggling comment visibility:", error)
      // Revert the UI change on error
      setComments(prevComments => prevComments.map(comment => comment.id === commentId
            ? { ...comment, isPublic: currentIsPublic }
            : comment))
      return { success: false, error: "Error toggling comment visibility" }
    }

    const [jsonError, result] = await safeAsync(() => response.json())

    if (jsonError || !result.success) {
      console.error(
        "Failed to toggle comment visibility:",
        jsonError || result.error
      )
      // Revert the UI change on error
      setComments(prevComments => prevComments.map(comment => comment.id === commentId
            ? { ...comment, isPublic: currentIsPublic }
            : comment))
      return { success: false, error: jsonError || result.error }
    }

    return { success: true }
  }

  /**
   * Delete a comment
   */
  const deleteComment = async (commentId: string) => {
    // Don't allow deleting temporary comments
    if (commentId.startsWith('temp-')) {
      console.warn('Cannot delete temporary comment. Please wait for it to save.')
      return { success: false, error: 'Comment is still being saved' }
    }

    const originalComments = [...comments]
    // Optimistically remove from UI
    setComments(prev => prev.filter(comment => comment.id !== commentId))

    const { perfumeId, userPerfumeId } = getIds()

    const formData = new FormData()
    formData.append("action", "delete-comment")
    formData.append("commentId", commentId)
    formData.append("perfumeId", perfumeId)
    formData.append("userPerfumeId", userPerfumeId)

    // Use safeAsync for error handling
    const [error, response] = await safeAsync(() => submitForm("/api/user-perfumes", formData))

    if (error) {
      console.error("Error deleting comment:", error)
      setComments(originalComments)
      alert(t("comments.deleteError", "Error deleting comment"))
      return { success: false, error: "Error deleting comment" }
    }

    const [jsonError, result] = await safeAsync(() => response.json())

    if (jsonError || !result.success) {
      console.error("Failed to delete comment:", jsonError || result.error)
      setComments(originalComments)
      alert(`${t("comments.deleteFailed", "Failed to delete comment")}: ${
          result?.error || "Unknown error"
        }`)
      return { success: false, error: jsonError || result.error }
    }

    return { success: true }
  }

  return {
    comments,
    uniqueModalId,
    addComment,
    toggleCommentVisibility,
    deleteComment,
  }
}


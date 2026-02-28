import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"

import { useCSRF } from "@/hooks/useCSRF"
import type { UserPerfumeI } from "@/types"
import type { Comment } from "@/types/comments"
import { createTemporaryComment } from "@/utils/comment-utils"
import { assertExists } from "@/utils/errorHandling.patterns"
import { safeAsync } from "@/utils/errorHandling.patterns"
import { commentSchemas, sanitizeString } from "@/utils/validation"

interface UsePerfumeCommentsOptions {
  userPerfume: UserPerfumeI
  onCommentAdded?: (comment: Comment) => void
  onCommentSuccess?: () => void // Callback to revalidate data after successful comment
}

export const usePerfumeComments = ({ userPerfume, onCommentAdded, onCommentSuccess }: UsePerfumeCommentsOptions) => {
  const t = useTranslations("myScents.comments")
  const { submitForm } = useCSRF()
  const [comments, setComments] = useState<Comment[]>([])

  // Initialize comments from userPerfume
  // Also watch for changes to userPerfume.id to handle when switching between destashes
  const commentsKey = useMemo(
    () =>
      userPerfume.comments
        ? JSON.stringify(userPerfume.comments.map(c => c.id).sort())
        : "empty",
    [userPerfume.comments]
  )

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
    onCommentAdded?.(tempComment)

    const removeTempComment = (): void =>
      setComments(prev => prev.filter(c => c.id !== tempComment.id))

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
      removeTempComment()
      alert(t("error"))
      return { success: false, error: "Error submitting comment" }
    }

    const [jsonError, result] = await safeAsync(() => response.json())

    if (jsonError) {
      console.error("Error parsing response:", jsonError)
      removeTempComment()
      alert(t("error"))
      return { success: false, error: "Error processing response" }
    }

    if (result.success) {
      if (result.userComment) {
        const serverComment = result.userComment as Comment
        setComments(prev =>
          prev.map(c => (c.id === tempComment.id ? serverComment : c))
        )
      }
      onCommentSuccess?.()
      return { success: true }
    } else {
      console.error("Failed to add comment:", result.error)
      removeTempComment()
      alert(`${t("failed")}: ${result.error}`)
      return { success: false, error: result.error }
    }
  }

  /**
   * Toggle comment visibility (public/private)
   */
  const toggleCommentVisibility = async (
    commentId: string,
    currentIsPublic: boolean
  ) => {
    if (commentId.startsWith("temp-")) {
      console.warn(
        "Cannot toggle visibility of temporary comment. Please wait for it to save."
      )
      return { success: false, error: "Comment is still being saved" }
    }

    setComments(prev =>
      prev.map(c =>
        c.id === commentId ? { ...c, isPublic: !currentIsPublic } : c
      )
    )

    const revertVisibility = (): void =>
      setComments(prev =>
        prev.map(c =>
          c.id === commentId ? { ...c, isPublic: currentIsPublic } : c
        )
      )

    const { perfumeId, userPerfumeId } = getIds()
    const formData = new FormData()
    formData.append("action", "toggle-comment-visibility")
    formData.append("commentId", commentId)
    formData.append("perfumeId", perfumeId)
    formData.append("userPerfumeId", userPerfumeId)
    formData.append("isPublic", (!currentIsPublic).toString())

    const [error, response] = await safeAsync(() =>
      submitForm("/api/user-perfumes", formData)
    )

    if (error) {
      console.error("Error toggling comment visibility:", error)
      revertVisibility()
      return { success: false, error: "Error toggling comment visibility" }
    }

    const [jsonError, result] = await safeAsync(() => response.json())

    if (jsonError || !result.success) {
      console.error(
        "Failed to toggle comment visibility:",
        jsonError || result.error
      )
      revertVisibility()
      return { success: false, error: jsonError || result.error }
    }

    return { success: true }
  }

  /**
   * Delete a comment
   */
  const deleteComment = async (commentId: string) => {
    if (commentId.startsWith("temp-")) {
      console.warn(
        "Cannot delete temporary comment. Please wait for it to save."
      )
      return { success: false, error: "Comment is still being saved" }
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
      alert(t("deleteError"))
      return { success: false, error: "Error deleting comment" }
    }

    const [jsonError, result] = await safeAsync(() => response.json())

    if (jsonError || !result.success) {
      console.error("Failed to delete comment:", jsonError || result.error)
      setComments(originalComments)
      alert(`${t("deleteFailed")}: ${result?.error ?? "Unknown error"}`)
      return { success: false, error: jsonError || result.error }
    }

    onCommentSuccess?.()
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


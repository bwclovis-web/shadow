import type { Comment } from "@/types/comments"

type CommentFormParams = {
  commentText?: string
  commentId?: string
  perfumeId: string
  userPerfumeId: string
  isPublic?: boolean
}

const appendCommentData = (formData: FormData, params: CommentFormParams): void => {
  if (params.commentText) formData.append("comment", params.commentText)
  if (params.commentId) formData.append("commentId", params.commentId)
  formData.append("perfumeId", params.perfumeId)
  formData.append("userPerfumeId", params.userPerfumeId)
  if (params.isPublic !== undefined) formData.append("isPublic", String(params.isPublic))
}

export const createCommentFormData = (
  action: "add-comment" | "toggle-comment-visibility" | "delete-comment",
  params: CommentFormParams,
  csrfToken?: string
): FormData => {
  const formData = new FormData()
  appendCommentData(formData, params)
  formData.append("action", action)
  if (csrfToken) formData.append("_csrf", csrfToken)
  return formData
}

export const createTemporaryComment = (
  commentText: string,
  isPublic: boolean,
  userPerfumeId?: string
): Comment => {
  const now = new Date().toISOString()
  return {
    id: `temp-${userPerfumeId ?? "unknown"}-${Date.now()}`,
    userId: "temp-user",
    perfumeId: "temp-perfume",
    userPerfumeId: userPerfumeId ?? "temp-user-perfume",
    comment: commentText,
    createdAt: now,
    updatedAt: now,
    isPublic,
  }
}

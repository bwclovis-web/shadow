import type { UserPerfumeI } from "~/types"

export interface Comment {
  id: string
  userId: string
  perfumeId: string
  userPerfumeId: string
  comment: string
  isPublic: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export interface CommentsModalProps {
  perfume: UserPerfumeI
  onCommentAdded?: (comment: Comment) => void
  addComment?: (commentText: string, isPublic: boolean) => Promise<{ success: boolean; error?: string }>
}

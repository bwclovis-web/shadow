/**
 * Database model types based on Prisma schema
 * These types provide type safety for database operations
 */

import type {
  AlertType,
  HouseType,
  PerfumeType,
  PendingSubmissionStatus,
  PendingSubmissionType,
  TradePreference,
  UserRole,
} from "@prisma/client"

// Base database models
export interface User {
  id: string
  email: string
  password: string
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  createdAt: Date
  updatedAt: Date
  role: UserRole
  UserPerfume: UserPerfume[]
  userPerfumeComments: UserPerfumeComment[]
  UserPerfumeRating: UserPerfumeRating[]
  UserPerfumeReview: UserPerfumeReview[]
  UserPerfumeWishlist: UserPerfumeWishlist[]
  wishlistNotifications: WishlistNotification[]
  userAlerts: UserAlert[]
  alertPreferences?: UserAlertPreferences | null
}

export interface PerfumeHouse {
  id: string
  name: string
  slug: string
  description?: string | null
  image?: string | null
  website?: string | null
  country?: string | null
  founded?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  type: HouseType
  createdAt: Date
  updatedAt: Date
  perfumes: Perfume[]
}

export interface Perfume {
  id: string
  name: string
  slug: string
  description?: string | null
  image?: string | null
  perfumeHouseId?: string | null
  createdAt: Date
  updatedAt: Date
  perfumeHouse?: PerfumeHouse | null
  // New junction table relation (Phase 5 migration)
  perfumeNoteRelations?: Array<{
    id: string
    perfumeId: string
    noteId: string
    noteType: "open" | "heart" | "base"
    createdAt: Date
    note?: PerfumeNotes
  }>
  // Display format (transformed from junction table)
  perfumeNotesOpen?: PerfumeNotes[]
  perfumeNotesHeart?: PerfumeNotes[]
  perfumeNotesClose?: PerfumeNotes[]
  userPerfume: UserPerfume[]
  userPerfumeComments: UserPerfumeComment[]
  userPerfumeRating: UserPerfumeRating[]
  userPerfumeReview: UserPerfumeReview[]
  userPerfumeWishlist: UserPerfumeWishlist[]
  wishlistNotifications: WishlistNotification[]
  userAlerts: UserAlert[]
}

export interface UserPerfume {
  id: string
  userId: string
  perfumeId: string
  amount: string
  available: string
  price?: string | null
  placeOfPurchase?: string | null
  tradePrice?: string | null
  tradePreference: TradePreference
  tradeOnly: boolean
  createdAt: Date
  type: PerfumeType
  perfume: Perfume
  user: User
  comments: UserPerfumeComment[]
}

export interface UserPerfumeRating {
  id: string
  userId: string
  perfumeId: string
  createdAt: Date
  gender?: number | null
  longevity?: number | null
  overall?: number | null
  priceValue?: number | null
  sillage?: number | null
  updatedAt: Date
  perfume: Perfume
  user: User
}

export interface UserPerfumeReview {
  id: string
  userId: string
  perfumeId: string
  review: string
  createdAt: Date
  perfume: Perfume
  user: User
}

export interface UserPerfumeWishlist {
  id: string
  userId: string
  perfumeId: string
  createdAt: Date
  perfume: Perfume
  user: User
}

export interface UserPerfumeComment {
  id: string
  userId: string
  perfumeId: string
  userPerfumeId: string
  comment: string
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
  perfume: Perfume
  user: User
  userPerfume: UserPerfume
}

export interface PerfumeNotes {
  id: string
  name: string
  createdAt: Date
  perfumeOpenId?: string | null
  perfumeHeartId?: string | null
  perfumeCloseId?: string | null
  perfumeClose?: Perfume | null
  perfumeHeart?: Perfume | null
  perfumeOpen?: Perfume | null
}

export interface WishlistNotification {
  id: string
  userId: string
  perfumeId: string
  notifiedAt: Date
  perfume: Perfume
  user: User
}

export interface UserAlert {
  id: string
  userId: string
  perfumeId: string
  alertType: AlertType
  title: string
  message: string
  isRead: boolean
  isDismissed: boolean
  metadata?: any
  createdAt: Date
  readAt?: Date | null
  dismissedAt?: Date | null
  User: User
  Perfume: Perfume
}

export interface UserAlertPreferences {
  id: string
  userId: string
  wishlistAlertsEnabled: boolean
  decantAlertsEnabled: boolean
  emailWishlistAlerts: boolean
  emailDecantAlerts: boolean
  maxAlerts: number
  user: User
}

export interface PendingSubmission {
  id: string
  submissionType: PendingSubmissionType
  submittedBy?: string | null
  status: PendingSubmissionStatus
  submissionData: Record<string, any>
  adminNotes?: string | null
  reviewedBy?: string | null
  reviewedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  submittedByUser?: {
    id: string
    email: string
    username?: string | null
    firstName?: string | null
    lastName?: string | null
  } | null
  reviewedByUser?: {
    id: string
    email: string
    username?: string | null
  } | null
}

// Re-export enums
export type {
  AlertType,
  HouseType,
  PendingSubmissionStatus,
  PendingSubmissionType,
  PerfumeType,
  TradePreference,
  UserRole,
}

// Utility types for common database operations
export type CreateUserInput = Omit<
  User,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "UserPerfume"
  | "userPerfumeComments"
  | "UserPerfumeRating"
  | "UserPerfumeReview"
  | "UserPerfumeWishlist"
  | "wishlistNotifications"
>

export type UpdateUserInput = Partial<
  Pick<User, "firstName" | "lastName" | "username" | "email" | "role">
>

export type CreatePerfumeInput = Omit<
  Perfume,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "perfumeHouse"
  | "perfumeNotesClose"
  | "perfumeNotesHeart"
  | "perfumeNotesOpen"
  | "userPerfume"
  | "userPerfumeComments"
  | "userPerfumeRating"
  | "userPerfumeReview"
  | "userPerfumeWishlist"
  | "wishlistNotifications"
>

export type UpdatePerfumeInput = Partial<
  Pick<Perfume, "name" | "description" | "image" | "perfumeHouseId">
>

export type CreateUserPerfumeInput = Omit<
  UserPerfume,
  "id" | "createdAt" | "perfume" | "user" | "comments"
>

export type UpdateUserPerfumeInput = Partial<
  Pick<
    UserPerfume,
    | "amount"
    | "available"
    | "price"
    | "placeOfPurchase"
    | "tradePrice"
    | "tradePreference"
    | "tradeOnly"
    | "type"
  >
>

export type CreateUserPerfumeRatingInput = Omit<
  UserPerfumeRating,
  "id" | "createdAt" | "updatedAt" | "perfume" | "user"
>

export type UpdateUserPerfumeRatingInput = Partial<
  Pick<
    UserPerfumeRating,
    "gender" | "longevity" | "overall" | "priceValue" | "sillage"
  >
>

export type CreateUserPerfumeCommentInput = Omit<
  UserPerfumeComment,
  "id" | "createdAt" | "updatedAt" | "perfume" | "user" | "userPerfume"
>

export type UpdateUserPerfumeCommentInput = Partial<
  Pick<UserPerfumeComment, "comment" | "isPublic">
>

// Safe types for client-side use (excluding sensitive data)
export type SafeUser = Omit<User, "password">

export type SafeUserPerfume = Omit<UserPerfume, "user"> & {
  user: SafeUser
}

export type SafeUserPerfumeComment = Omit<UserPerfumeComment, "user"> & {
  user: SafeUser
}

export type SafeUserPerfumeRating = Omit<UserPerfumeRating, "user"> & {
  user: SafeUser
}

export type SafeUserPerfumeReview = Omit<UserPerfumeReview, "user"> & {
  user: SafeUser
}

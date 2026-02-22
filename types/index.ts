/**
 * Global type definitions for the application
 * This file serves as the main entry point for all type definitions
 */

// Re-export all types from specialized modules
export * from "./api"
export * from "./comments"
export * from "./components"
export * from "./database"
export * from "./forms"
export * from "./utils"

// Legacy types for backward compatibility
import type { UserRole } from "@prisma/client"

/**
 * @deprecated Use types from './database' instead
 * Legacy user interface - use SafeUser from database types
 */
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
}

/**
 * @deprecated Use SafeUser from './database' instead
 * Legacy safe user interface
 */
export interface SafeUser {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  role: UserRole
}

/**
 * @deprecated Use createSafeUser from './database' instead
 * Legacy function to create safe user object
 */
export function createSafeUser(user: User | null): SafeUser | null {
  if (!user) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    role: user.role,
  }
}

export type { UserRole }

// Rating System Types - Film Noir Themed
export interface RatingLabels {
  longevity: Record<number, string>
  sillage: Record<number, string>
  gender: Record<number, string>
  priceValue: Record<number, string>
  overall: Record<number, string>
}

export interface UserPerfumeRating {
  id: string
  userId: string
  perfumeId: string
  longevity?: number | null
  sillage?: number | null
  gender?: number | null
  priceValue?: number | null
  overall?: number | null
  createdAt: Date
  updatedAt: Date
}

export interface PerfumeRatingStats {
  perfumeId: string
  totalVotes: number
  averages: {
    longevity: number | null
    sillage: number | null
    gender: number | null
    priceValue: number | null
    overall: number | null
  }
  distribution: {
    longevity: Record<number, number>
    sillage: Record<number, number>
    gender: Record<number, number>
    priceValue: Record<number, number>
    overall: Record<number, number>
  }
}

interface PerfumeHouseI {
  id: string
  name: string
}

export interface PerfumeI {
  id: string
  name: string
  description?: string
  image?: string
  perfumeHouse?: PerfumeHouseI
}

export interface UserPerfumeI {
  id: string
  userId: string
  perfumeId: string
  perfume: PerfumeI
  amount: string
  available: string
  price?: string
  type?: string
  placeOfPurchase?: string
  tradePrice?: string
  tradePreference?: "cash" | "trade" | "both"
  tradeOnly?: boolean
  createdAt?: Date | string
  comments?: {
    id: string
    userId: string
    perfumeId: string
    userPerfumeId: string
    comment: string
    isPublic: boolean
    createdAt: Date | string
    updatedAt: Date | string
  }[]
}

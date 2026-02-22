/**
 * Centralized Validation Schemas
 * Single source of truth for all Zod validation schemas used across the application
 */

import { z } from "zod"

// ============================================================================
// COMMON/PRIMITIVE SCHEMAS
// ============================================================================

/**
 * Common validation schemas for primitive types and patterns
 * These can be composed into more complex schemas
 */
export const commonSchemas = {
  // Identity
  id: z
    .string()
    .min(1, { message: "ID is required" })
    .regex(/^[a-zA-Z0-9-_]+$/, { message: "ID contains invalid characters" }),

  // Contact Information
  email: z
    .string()
    .email({ message: "Please enter a valid email address" })
    .toLowerCase()
    .trim(),

  phone: z
    .string()
    .regex(/^[+]?[1-9][\d]{0,15}$/, {
      message: "Please enter a valid phone number",
    })
    .optional(),

  // URLs
  url: z.string().url({ message: "Please enter a valid URL" }).optional(),

  urlRequired: z.string().url({ message: "Please enter a valid URL" }),

  // Authentication
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .max(128, { message: "Password must be less than 128 characters" })
    .regex(/[a-z]/, {
      message: "Password must contain at least one lowercase letter",
    })
    .regex(/[A-Z]/, {
      message: "Password must contain at least one uppercase letter",
    })
    .regex(/[0-9]/, { message: "Password must contain at least one number" })
    .regex(/[^a-zA-Z0-9]/, {
      message: "Password must contain at least one special character",
    })
    .refine(pwd => !pwd.includes(" "), {
      message: "Password cannot contain spaces",
    }),

  passwordSimple: z.string().min(1, { message: "Password is required" }),

  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(30, { message: "Username must be less than 30 characters" })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: "Username can only contain letters, numbers, and underscores",
    })
    .trim(),

  // Text Content
  name: z
    .string()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name must be less than 100 characters" })
    .trim(),

  firstName: z
    .string()
    .min(1, { message: "First name is required" })
    .max(50, { message: "First name must be less than 50 characters" })
    .trim(),

  lastName: z
    .string()
    .min(1, { message: "Last name is required" })
    .max(50, { message: "Last name must be less than 50 characters" })
    .trim(),

  description: z
    .string()
    .min(10, { message: "Description must be at least 10 characters" })
    .max(1000, { message: "Description must be less than 1000 characters" })
    .trim()
    .optional(),

  descriptionRequired: z
    .string()
    .min(10, { message: "Description must be at least 10 characters" })
    .max(1000, { message: "Description must be less than 1000 characters" })
    .trim(),

  comment: z
    .string()
    .min(1, { message: "Comment is required" })
    .max(1000, { message: "Comment must be less than 1000 characters" })
    .trim(),

  address: z
    .string()
    .min(5, { message: "Address must be at least 5 characters" })
    .max(200, { message: "Address must be less than 200 characters" })
    .optional(),

  country: z
    .string()
    .min(2, { message: "Country must be at least 2 characters" })
    .max(50, { message: "Country must be less than 50 characters" })
    .optional(),

  // Numbers and Ratings
  rating: z
    .number()
    .min(1, { message: "Rating must be at least 1" })
    .max(5, { message: "Rating must be at most 5" })
    .int({ message: "Rating must be a whole number" }),

  ratingOptional: z
    .number()
    .min(1, { message: "Rating must be at least 1" })
    .max(5, { message: "Rating must be at most 5" })
    .int({ message: "Rating must be a whole number" })
    .optional(),

  // Financial
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, {
    message: "Amount must be a positive number with up to 2 decimal places",
  }),

  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message: "Price must be a positive number with up to 2 decimal places",
    })
    .optional(),

  // Temporal
  year: z
    .string()
    .regex(/^(19|20)\d{2}$/, {
      message: "Please enter a valid year (1900-2099)",
    })
    .optional(),

  yearRequired: z.string().regex(/^(19|20)\d{2}$/, {
    message: "Please enter a valid year (1900-2099)",
  }),

  // Pagination
  page: z.number().min(1, { message: "Page must be 1 or greater" }).int(),

  limit: z
    .number()
    .min(1, { message: "Limit must be at least 1" })
    .max(100, { message: "Limit must be at most 100" })
    .int(),

  // Booleans
  boolean: z.boolean(),

  booleanOptional: z.boolean().optional(),

  // Arrays
  stringArray: z.array(z.string()),

  stringArrayOptional: z.array(z.string()).optional(),
} as const

// ============================================================================
// PERFUME HOUSE SCHEMAS
// ============================================================================

export const perfumeHouseSchemas = {
  create: z.object({
    name: commonSchemas.name,
    description: commonSchemas.description,
    image: commonSchemas.url,
    website: commonSchemas.url,
    country: commonSchemas.country,
    founded: commonSchemas.year,
    type: z
      .enum([
"niche", "designer", "indie", "celebrity", "drugstore"
])
      .optional(),
    email: commonSchemas.email.optional(),
    phone: commonSchemas.phone,
    address: commonSchemas.address,
  }),

  update: z.object({
    name: commonSchemas.name.optional(),
    description: commonSchemas.description,
    image: commonSchemas.url,
    website: commonSchemas.url,
    country: commonSchemas.country,
    founded: commonSchemas.year,
    type: z
      .enum([
"niche", "designer", "indie", "celebrity", "drugstore"
])
      .optional(),
    email: commonSchemas.email.optional(),
    phone: commonSchemas.phone,
    address: commonSchemas.address,
  }),
} as const

// ============================================================================
// PERFUME SCHEMAS
// ============================================================================

export const perfumeSchemas = {
  create: z.object({
    name: commonSchemas.name,
    description: commonSchemas.descriptionRequired,
    house: z.string().min(1, { message: "Perfume house is required" }),
    image: commonSchemas.url,
    perfumeId: z.string().optional(),
    notesTop: commonSchemas.stringArrayOptional,
    notesHeart: commonSchemas.stringArrayOptional,
    notesBase: commonSchemas.stringArrayOptional,
  }),

  update: z.object({
    perfumeId: z.string().min(1, { message: "Perfume ID is required" }),
    name: commonSchemas.name.optional(),
    description: commonSchemas.description,
    image: commonSchemas.url,
    house: z.string().min(1, { message: "Perfume house is required" }).optional(),
    notesTop: commonSchemas.stringArrayOptional,
    notesHeart: commonSchemas.stringArrayOptional,
    notesBase: commonSchemas.stringArrayOptional,
  }),

  updateUserPerfume: z.object({
    perfumeId: z.string().min(1, { message: "Perfume ID is required" }),
    amount: commonSchemas.amount,
    available: commonSchemas.amount,
    price: commonSchemas.price,
    placeOfPurchase: z
      .string()
      .max(200, {
        message: "Place of purchase must be less than 200 characters",
      })
      .optional(),
    tradePrice: commonSchemas.price,
    tradePreference: z
      .enum(["cash", "trade", "both"], {
        errorMap: () => ({
          message: "Trade preference must be cash, trade, or both",
        }),
      })
      .optional(),
    tradeOnly: commonSchemas.booleanOptional,
    type: z.string().min(1, { message: "Perfume type is required" }).optional(),
  }),

  search: z.object({
    query: z
      .string()
      .max(100, { message: "Search query must be less than 100 characters" })
      .optional(),
    houseName: z
      .string()
      .max(50, { message: "House name must be less than 50 characters" })
      .optional(),
    type: z.string().optional(),
    priceRange: z
      .object({
        min: z.number().min(0, { message: "Minimum price must be 0 or greater" }),
        max: z.number().min(0, { message: "Maximum price must be 0 or greater" }),
      })
      .optional(),
    ratingRange: z
      .object({
        min: z.number().min(1, { message: "Minimum rating must be 1 or greater" }),
        max: z.number().max(5, { message: "Maximum rating must be 5 or less" }),
      })
      .optional(),
    notes: commonSchemas.stringArrayOptional,
    sortBy: z.enum([
"name", "price", "rating", "createdAt"
]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
} as const

// ============================================================================
// RATING SCHEMAS
// ============================================================================

export const ratingSchemas = {
  create: z
    .object({
      perfumeId: z.string().min(1, { message: "Perfume ID is required" }),
      longevity: commonSchemas.ratingOptional,
      sillage: commonSchemas.ratingOptional,
      gender: commonSchemas.ratingOptional,
      priceValue: commonSchemas.ratingOptional,
      overall: commonSchemas.ratingOptional,
    })
    .refine(
      data => {
        const ratings = [
          data.longevity,
          data.sillage,
          data.gender,
          data.priceValue,
          data.overall,
        ]
        return ratings.some(rating => rating !== undefined)
      },
      {
        message: "At least one rating is required",
        path: ["overall"],
      }
    ),

  update: z.object({
    id: z.string().min(1, { message: "Rating ID is required" }),
    longevity: commonSchemas.ratingOptional,
    sillage: commonSchemas.ratingOptional,
    gender: commonSchemas.ratingOptional,
    priceValue: commonSchemas.ratingOptional,
    overall: commonSchemas.ratingOptional,
  }),
} as const

// ============================================================================
// COMMENT SCHEMAS
// ============================================================================

export const commentSchemas = {
  create: z.object({
    perfumeId: z.string().min(1, { message: "Perfume ID is required" }),
    userPerfumeId: z.string().min(1, { message: "User perfume ID is required" }),
    comment: commonSchemas.comment,
    isPublic: commonSchemas.booleanOptional,
  }),

  update: z.object({
    id: z.string().min(1, { message: "Comment ID is required" }),
    comment: commonSchemas.comment,
    isPublic: commonSchemas.booleanOptional,
  }),
} as const

// ============================================================================
// WISHLIST SCHEMAS
// ============================================================================

export const wishlistSchemas = {
  action: z.object({
    perfumeId: z.string().min(1, { message: "Perfume ID is required" }),
    action: z.enum(["add", "remove", "updateVisibility"], {
      errorMap: () => ({
        message: "Action must be add, remove, or updateVisibility",
      }),
    }),
    isPublic: z
      .string()
      .optional()
      .default("false")
      .transform(val => val === "true"),
  }),
} as const

// ============================================================================
// USER AUTHENTICATION SCHEMAS
// ============================================================================

export const authSchemas = {
  signup: z
    .object({
      email: commonSchemas.email,
      password: commonSchemas.password,
      confirmPassword: z
        .string()
        .min(1, { message: "Confirm Password is required" }),
      firstName: commonSchemas.firstName.optional(),
      lastName: commonSchemas.lastName.optional(),
      username: commonSchemas.username.optional(),
      acceptTerms: z
        .string()
        .optional()
        .transform(val => val === "on" || val === "true")
        .pipe(z.boolean().refine(val => val === true, {
            message: "You must accept the terms and conditions",
          })),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),

  login: z.object({
    email: commonSchemas.email,
    password: commonSchemas.passwordSimple,
    rememberMe: commonSchemas.booleanOptional,
  }),

  changePassword: z
    .object({
      currentPassword: z
        .string()
        .min(1, { message: "Current password is required" }),
      newPassword: commonSchemas.password,
      confirmNewPassword: z
        .string()
        .min(1, { message: "Confirm new password is required" }),
    })
    .refine(data => data.newPassword === data.confirmNewPassword, {
      message: "New passwords do not match",
      path: ["confirmNewPassword"],
    })
    .refine(data => data.currentPassword !== data.newPassword, {
      message: "New password must be different from current password",
      path: ["newPassword"],
    }),

  forgotPassword: z.object({
    email: commonSchemas.email,
  }),

  resetPassword: z
    .object({
      token: z.string().min(1, { message: "Reset token is required" }),
      newPassword: commonSchemas.password,
      confirmNewPassword: z
        .string()
        .min(1, { message: "Confirm new password is required" }),
    })
    .refine(data => data.newPassword === data.confirmNewPassword, {
      message: "New passwords do not match",
      path: ["confirmNewPassword"],
    }),

  updateProfile: z.object({
    firstName: commonSchemas.firstName,
    lastName: commonSchemas.lastName,
    username: commonSchemas.username,
    email: commonSchemas.email,
  }),
} as const

// ============================================================================
// API VALIDATION SCHEMAS
// ============================================================================

export const apiSchemas = {
  pagination: z.object({
    page: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(commonSchemas.page)
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(commonSchemas.limit)
      .optional(),
  }),

  search: z.object({
    q: z.string().max(100, "Search query too long").optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    sortBy: z.enum([
"name", "price", "rating", "createdAt"
]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),

  perfumeId: z.object({
    id: z.string().min(1, "Perfume ID is required"),
  }),

  userAction: z.object({
    action: z.enum(["add", "remove", "update"], {
      errorMap: () => ({ message: "Action must be add, remove, or update" }),
    }),
    perfumeId: z.string().min(1, "Perfume ID is required"),
  }),
} as const

// ============================================================================
// ADMIN SCHEMAS
// ============================================================================

export const adminSchemas = {
  userForm: z.object({
    email: commonSchemas.email,
    firstName: commonSchemas.firstName.optional(),
    lastName: commonSchemas.lastName.optional(),
    username: commonSchemas.username.optional(),
    role: z.enum(["USER", "ADMIN", "MODERATOR"], {
      errorMap: () => ({ message: "Role must be USER, ADMIN, or MODERATOR" }),
    }),
    isActive: commonSchemas.boolean,
  }),

  dataQualityReport: z.object({
    timeframe: z.enum([
"7d", "30d", "90d", "1y", "all"
], {
      errorMap: () => ({
        message: "Timeframe must be 7d, 30d, 90d, 1y, or all",
      }),
    }),
    includeHistory: commonSchemas.boolean,
    exportFormat: z.enum(["csv", "json", "xlsx"], {
      errorMap: () => ({ message: "Export format must be csv, json, or xlsx" }),
    }),
  }),
} as const

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

/**
 * Backward compatibility exports for existing code
 * @deprecated Use specific schema exports instead
 */
export const CreatePerfumeHouseSchema = perfumeHouseSchemas.create
export const UpdatePerfumeHouseSchema = perfumeHouseSchemas.update
export const CreatePerfumeSchema = perfumeSchemas.create
export const UpdatePerfumeSchema = perfumeSchemas.update
export const UpdateUserPerfumeSchema = perfumeSchemas.updateUserPerfume
export const CreateRatingSchema = ratingSchemas.create
export const UpdateRatingSchema = ratingSchemas.update
export const CreateCommentSchema = commentSchemas.create
export const UpdateCommentSchema = commentSchemas.update
export const WishlistActionSchema = wishlistSchemas.action
export const UserFormSchema = authSchemas.signup
export const UserLogInSchema = authSchemas.login
export const ChangePasswordSchema = authSchemas.changePassword
export const ForgotPasswordSchema = authSchemas.forgotPassword
export const ResetPasswordSchema = authSchemas.resetPassword
export const UpdateProfileSchema = authSchemas.updateProfile
export const PerfumeSearchSchema = perfumeSchemas.search
export const AdminUserFormSchema = adminSchemas.userForm
export const DataQualityReportSchema = adminSchemas.dataQualityReport

/**
 * Legacy common validation schemas for backward compatibility
 * @deprecated Use commonSchemas export instead
 */
export const commonValidationSchemas = {
  id: commonSchemas.id,
  email: commonSchemas.email,
  password: commonSchemas.password,
  url: commonSchemas.url,
  phone: commonSchemas.phone,
  year: commonSchemas.year,
  rating: commonSchemas.rating,
  amount: commonSchemas.amount,
  price: commonSchemas.price,
  name: commonSchemas.name,
  description: commonSchemas.description,
  comment: commonSchemas.comment,
  username: commonSchemas.username,
} as const

/**
 * Legacy API schemas for backward compatibility
 * @deprecated Use apiSchemas export instead
 */
export const commonApiSchemas = {
  id: commonSchemas.id,
  email: commonSchemas.email,
  password: commonSchemas.password,
  url: commonSchemas.urlRequired,
  phone: commonSchemas.phone,
  year: commonSchemas.yearRequired,
  rating: commonSchemas.rating,
  amount: commonSchemas.amount,
  pagination: apiSchemas.pagination,
} as const

/**
 * Consolidated validation schemas export
 * Recommended for new code
 */
export const validationSchemas = {
  common: commonSchemas,
  perfumeHouse: perfumeHouseSchemas,
  perfume: perfumeSchemas,
  rating: ratingSchemas,
  comment: commentSchemas,
  wishlist: wishlistSchemas,
  auth: authSchemas,
  api: apiSchemas,
  admin: adminSchemas,
} as const

/**
 * Centralized Validation Schemas
 * Single source of truth for all Zod validation schemas used across the application.
 * Messages are translation keys (validation.*) — pass errors through getTranslatedError(t).
 */

import { z } from "zod"

import { isValidPrismaRecordId } from "@/utils/prisma-record-id"

import { validationKeys as V } from "./validationKeys"

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
    .min(1, { message: V.idRequired })
    .regex(/^[a-zA-Z0-9-_]+$/, { message: V.idInvalid }),

  // Contact Information
  email: z.string().email({ message: V.emailInvalid }).toLowerCase().trim(),

  phone: z
    .string()
    .regex(/^[+]?[1-9][\d]{0,15}$/, { message: V.phoneInvalid })
    .optional(),

  // URLs
  url: z.string().url({ message: V.urlInvalid }).optional(),

  urlRequired: z.string().url({ message: V.urlInvalid }),

  // Authentication
  password: z
    .string()
    .min(8, { message: V.passwordMinLength })
    .max(128, { message: V.passwordMaxLength })
    .regex(/[a-z]/, { message: V.passwordLowercase })
    .regex(/[A-Z]/, { message: V.passwordUppercase })
    .regex(/[0-9]/, { message: V.passwordNumber })
    .regex(/[^a-zA-Z0-9]/, { message: V.passwordSpecial })
    .refine(pwd => !pwd.includes(" "), { message: V.passwordNoSpaces }),

  passwordSimple: z.string().min(1, { message: V.passwordRequired }),

  username: z
    .string()
    .min(3, { message: V.usernameMin })
    .max(30, { message: V.usernameMax })
    .regex(/^[a-zA-Z0-9_]+$/, { message: V.usernameFormatUnderscoreOnly })
    .trim(),

  // Text Content
  name: z
    .string()
    .min(2, { message: V.nameMinTwo })
    .max(100, { message: V.nameMax })
    .trim(),

  firstName: z
    .string()
    .min(1, { message: V.firstNameRequired })
    .max(50, { message: V.firstNameMax })
    .trim(),

  lastName: z
    .string()
    .min(1, { message: V.lastNameRequired })
    .max(50, { message: V.lastNameMax })
    .trim(),

  description: z
    .string()
    .min(10, { message: V.descriptionMin })
    .max(1000, { message: V.descriptionMax })
    .trim()
    .optional(),

  descriptionRequired: z
    .string()
    .min(10, { message: V.descriptionRequired })
    .max(1000, { message: V.descriptionMax })
    .trim(),

  comment: z
    .string()
    .min(1, { message: V.commentRequired })
    .max(1000, { message: V.commentMax })
    .trim(),

  address: z
    .string()
    .min(5, { message: V.addressMin })
    .max(200, { message: V.addressMax })
    .optional(),

  country: z
    .string()
    .min(2, { message: V.countryMin })
    .max(50, { message: V.countryMax })
    .optional(),

  // Numbers and Ratings
  rating: z
    .number()
    .min(1, { message: V.ratingMin })
    .max(5, { message: V.ratingMax })
    .int({ message: V.ratingInt }),

  ratingOptional: z
    .number()
    .min(1, { message: V.ratingMin })
    .max(5, { message: V.ratingMax })
    .int({ message: V.ratingInt })
    .optional(),

  // Financial
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: V.amountFormat }),

  price: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: V.priceFormat }).optional(),

  // Temporal
  year: z
    .string()
    .regex(/^(19|20)\d{2}$/, { message: V.yearInvalid })
    .optional(),

  yearRequired: z.string().regex(/^(19|20)\d{2}$/, { message: V.yearInvalid }),

  // Pagination
  page: z.number().min(1, { message: V.pageMin }).int(),

  limit: z
    .number()
    .min(1, { message: V.limitMin })
    .max(100, { message: V.limitMax })
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
      .enum(["niche", "designer", "indie", "celebrity", "drugstore"])
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
      .enum(["niche", "designer", "indie", "celebrity", "drugstore"])
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
    house: z.string().min(1, { message: V.perfumeHouseRequired }),
    image: commonSchemas.url,
    perfumeId: z.string().optional(),
    notesTop: commonSchemas.stringArrayOptional,
    notesHeart: commonSchemas.stringArrayOptional,
    notesBase: commonSchemas.stringArrayOptional,
  }),

  update: z.object({
    perfumeId: z.string().min(1, { message: V.perfumeIdRequired }),
    name: commonSchemas.name.optional(),
    description: commonSchemas.description,
    image: commonSchemas.url,
    house: z.string().min(1, { message: V.perfumeHouseRequired }).optional(),
    notesTop: commonSchemas.stringArrayOptional,
    notesHeart: commonSchemas.stringArrayOptional,
    notesBase: commonSchemas.stringArrayOptional,
  }),

  updateUserPerfume: z.object({
    perfumeId: z.string().min(1, { message: V.perfumeIdRequired }),
    amount: commonSchemas.amount,
    available: commonSchemas.amount,
    price: commonSchemas.price,
    placeOfPurchase: z.string().max(200, { message: V.placeOfPurchaseMax }).optional(),
    tradePrice: commonSchemas.price,
    tradePreference: z
      .enum(["cash", "trade", "both"], {
        errorMap: () => ({ message: V.tradePreference }),
      })
      .optional(),
    tradeOnly: commonSchemas.booleanOptional,
    type: z.string().min(1, { message: V.perfumeTypeRequired }).optional(),
  }),

  search: z.object({
    query: z.string().max(100, { message: V.searchQueryMax }).optional(),
    houseName: z.string().max(50, { message: V.houseNameMax }).optional(),
    type: z.string().optional(),
    priceRange: z
      .object({
        min: z.number().min(0, { message: V.priceMinZero }),
        max: z.number().min(0, { message: V.priceMaxZero }),
      })
      .optional(),
    ratingRange: z
      .object({
        min: z.number().min(1, { message: V.ratingRangeMin }),
        max: z.number().max(5, { message: V.ratingRangeMax }),
      })
      .optional(),
    notes: commonSchemas.stringArrayOptional,
    sortBy: z.enum(["name", "price", "rating", "createdAt"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
} as const

// ============================================================================
// RATING SCHEMAS
// ============================================================================

export const ratingSchemas = {
  create: z
    .object({
      perfumeId: z.string().min(1, { message: V.perfumeIdRequired }),
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
      { message: V.atLeastOneRating, path: ["overall"] }
    ),

  update: z.object({
    id: z.string().min(1, { message: V.ratingIdRequired }),
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
    perfumeId: z.string().min(1, { message: V.perfumeIdRequired }),
    userPerfumeId: z.string().min(1, { message: V.userPerfumeIdRequired }),
    comment: commonSchemas.comment,
    isPublic: commonSchemas.booleanOptional,
  }),

  update: z.object({
    id: z.string().min(1, { message: V.commentIdRequired }),
    comment: commonSchemas.comment,
    isPublic: commonSchemas.booleanOptional,
  }),
} as const

// ============================================================================
// WISHLIST SCHEMAS
// ============================================================================

export const wishlistSchemas = {
  action: z.object({
    perfumeId: z
      .string()
      .trim()
      .min(1, { message: V.perfumeIdRequired })
      .refine(isValidPrismaRecordId, { message: V.invalidIdFormat }),
    action: z.enum(["add", "remove", "updateVisibility"], {
      errorMap: () => ({ message: V.wishlistAction }),
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
      confirmPassword: z.string().min(1, { message: V.confirmPasswordRequired }),
      firstName: commonSchemas.firstName.optional(),
      lastName: commonSchemas.lastName.optional(),
      username: commonSchemas.username.optional(),
      acceptTerms: z
        .string()
        .optional()
        .transform(val => val === "on" || val === "true")
        .pipe(
          z.boolean().refine(val => val === true, { message: V.acceptTerms })
        ),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: V.passwordsDoNotMatch,
      path: ["confirmPassword"],
    }),

  login: z.object({
    email: commonSchemas.email,
    password: commonSchemas.passwordSimple,
    rememberMe: commonSchemas.booleanOptional,
  }),

  changePassword: z
    .object({
      currentPassword: z.string().min(1, { message: V.currentPasswordRequired }),
      newPassword: commonSchemas.password,
      confirmNewPassword: z.string().min(1, { message: V.confirmNewPasswordRequired }),
    })
    .refine(data => data.newPassword === data.confirmNewPassword, {
      message: V.newPasswordsDoNotMatch,
      path: ["confirmNewPassword"],
    })
    .refine(data => data.currentPassword !== data.newPassword, {
      message: V.newPasswordDifferent,
      path: ["newPassword"],
    }),

  forgotPassword: z.object({
    email: commonSchemas.email,
  }),

  resetPassword: z
    .object({
      token: z.string().min(1, { message: V.resetTokenRequired }),
      newPassword: commonSchemas.password,
      confirmNewPassword: z.string().min(1, { message: V.confirmNewPasswordRequired }),
    })
    .refine(data => data.newPassword === data.confirmNewPassword, {
      message: V.newPasswordsDoNotMatch,
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
    q: z.string().max(100, { message: V.searchQueryMax }).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    sortBy: z.enum(["name", "price", "rating", "createdAt"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),

  perfumeId: z.object({
    id: z.string().min(1, { message: V.perfumeIdRequired }),
  }),

  userAction: z.object({
    action: z.enum(["add", "remove", "update"], {
      errorMap: () => ({ message: V.apiUserAction }),
    }),
    perfumeId: z.string().min(1, { message: V.perfumeIdRequired }),
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
      errorMap: () => ({ message: V.roleInvalid }),
    }),
    isActive: commonSchemas.boolean,
  }),

  dataQualityReport: z.object({
    timeframe: z.enum(["7d", "30d", "90d", "1y", "all"], {
      errorMap: () => ({ message: V.timeframeInvalid }),
    }),
    includeHistory: commonSchemas.boolean,
    exportFormat: z.enum(["csv", "json", "xlsx"], {
      errorMap: () => ({ message: V.exportFormatInvalid }),
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

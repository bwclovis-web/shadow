import { z } from "zod"

import {
  addressOptional,
  amountSchema,
  confirmPasswordRequired,
  countryOptional,
  descriptionOptional,
  descriptionRequired,
  emailSchema,
  firstNameSchema,
  HOUSE_TYPES,
  lastNameSchema,
  nameOptional,
  nameRequired,
  passwordSchema,
  phoneSchema,
  priceSchema,
  ratingSchema,
  requiredUrlSchema,
  sanitizeInput,
  urlSchema,
  usernameSchema,
  yearSchema,
} from "./fieldSchemas"
import { getTranslatedError, validationKeys } from "./validationKeys"

export { getTranslatedError, validationKeys }

const V = validationKeys

// Perfume House
export const CreatePerfumeHouseSchema = z.object({
  name: nameRequired,
  description: descriptionRequired,
  image: urlSchema,
  website: requiredUrlSchema,
  country: countryOptional,
  founded: yearSchema,
  type: z.enum(HOUSE_TYPES).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema,
  address: addressOptional,
})

export const UpdatePerfumeHouseSchema = z.object({
  name: nameOptional,
  description: descriptionOptional,
  image: urlSchema,
  website: urlSchema,
  country: countryOptional,
  founded: yearSchema,
  type: z.enum(HOUSE_TYPES).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema,
  address: addressOptional,
})

// Perfume
export const CreatePerfumeSchema = z.object({
  name: nameRequired,
  description: descriptionRequired,
  house: z.string().min(1, { message: V.perfumeHouseRequired }),
  image: urlSchema,
  perfumeId: z.string().optional(),
  notesTop: z.array(z.string()).optional(),
  notesHeart: z.array(z.string()).optional(),
  notesBase: z.array(z.string()).optional(),
})

export const UpdatePerfumeSchema = z.object({
  perfumeId: z.string().min(1, { message: V.perfumeIdRequired }),
  name: nameOptional,
  description: descriptionOptional,
  image: urlSchema,
  house: z.string().min(1, { message: V.perfumeHouseRequired }).optional(),
  notesTop: z.array(z.string()).optional(),
  notesHeart: z.array(z.string()).optional(),
  notesBase: z.array(z.string()).optional(),
})

export const UpdateUserPerfumeSchema = z.object({
  perfumeId: z.string().min(1, { message: V.perfumeIdRequired }),
  amount: amountSchema,
  available: amountSchema,
  price: priceSchema,
  placeOfPurchase: z.string().max(200, { message: V.placeOfPurchaseMax }).optional(),
  tradePrice: priceSchema,
  tradePreference: z
    .enum(["cash", "trade", "both"], { errorMap: () => ({ message: V.tradePreference }) })
    .optional(),
  tradeOnly: z.boolean().optional(),
  type: z.string().min(1, { message: V.perfumeTypeRequired }).optional(),
})

// Rating
export const CreateRatingSchema = z
  .object({
    perfumeId: z.string().min(1, { message: V.perfumeIdRequired }),
    longevity: ratingSchema.optional(),
    sillage: ratingSchema.optional(),
    gender: ratingSchema.optional(),
    priceValue: ratingSchema.optional(),
    overall: ratingSchema.optional(),
  })
  .refine(
    data =>
      [data.longevity, data.sillage, data.gender, data.priceValue, data.overall].some(
        r => r !== undefined
      ),
    { message: V.atLeastOneRating, path: ["overall"] }
  )

export const UpdateRatingSchema = z.object({
  id: z.string().min(1, { message: V.ratingIdRequired }),
  longevity: ratingSchema.optional(),
  sillage: ratingSchema.optional(),
  gender: ratingSchema.optional(),
  priceValue: ratingSchema.optional(),
  overall: ratingSchema.optional(),
})

// Comment
export const CreateCommentSchema = z.object({
  perfumeId: z.string().min(1, { message: V.perfumeIdRequired }),
  userPerfumeId: z.string().min(1, { message: V.userPerfumeIdRequired }),
  comment: z
    .string()
    .min(1, { message: V.commentRequired })
    .max(1000, { message: V.commentMax })
    .trim(),
  isPublic: z.boolean().optional(),
})

export const UpdateCommentSchema = z.object({
  id: z.string().min(1, { message: V.commentIdRequired }),
  comment: z
    .string()
    .min(1, { message: V.commentRequired })
    .max(1000, { message: V.commentMax })
    .trim(),
  isPublic: z.boolean().optional(),
})

// Wishlist
export const WishlistActionSchema = z.object({
  perfumeId: z.string().trim().min(1, { message: V.perfumeIdRequired }),
  action: z.enum(["add", "remove", "updateVisibility"], {
    errorMap: () => ({ message: V.wishlistAction }),
  }),
  isPublic: z
    .string()
    .optional()
    .default("false")
    .transform(val => val === "true"),
})

// User / Auth
export const UserFormSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: confirmPasswordRequired,
    firstName: firstNameSchema.optional(),
    lastName: lastNameSchema.optional(),
    username: usernameSchema.optional(),
    acceptTerms: z
      .string()
      .optional()
      .transform(val => val === "on" || val === "true")
      .pipe(z.boolean().refine(val => val === true, { message: V.acceptTerms })),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: V.passwordsDoNotMatch,
    path: ["confirmPassword"],
  })

export const UserLogInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: V.passwordRequired }),
  rememberMe: z.boolean().optional(),
})

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: V.currentPasswordRequired }),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, { message: V.confirmNewPasswordRequired }),
  })
  .refine(data => data.newPassword === data.confirmNewPassword, {
    message: V.newPasswordsDoNotMatch,
    path: ["confirmNewPassword"],
  })
  .refine(data => data.currentPassword !== data.newPassword, {
    message: V.newPasswordDifferent,
    path: ["newPassword"],
  })

export const ForgotPasswordSchema = z.object({
  email: emailSchema,
})

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, { message: V.resetTokenRequired }),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, { message: V.confirmNewPasswordRequired }),
  })
  .refine(data => data.newPassword === data.confirmNewPassword, {
    message: V.newPasswordsDoNotMatch,
    path: ["confirmNewPassword"],
  })

export const UpdateProfileSchema = z.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  username: usernameSchema,
  email: emailSchema,
})

// Search
export const PerfumeSearchSchema = z.object({
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
  notes: z.array(z.string()).optional(),
  sortBy: z.enum(["name", "price", "rating", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
})

// Admin
export const AdminUserFormSchema = z.object({
  email: emailSchema,
  firstName: z.string().max(50, { message: V.firstNameMax }).trim().optional(),
  lastName: z.string().max(50, { message: V.lastNameMax }).trim().optional(),
  username: usernameSchema.optional(),
  role: z.enum(["USER", "ADMIN", "MODERATOR"], {
    errorMap: () => ({ message: V.roleInvalid }),
  }),
  isActive: z.boolean(),
})

export const DataQualityReportSchema = z.object({
  timeframe: z.enum(["7d", "30d", "90d", "1y", "all"], {
    errorMap: () => ({ message: V.timeframeInvalid }),
  }),
  includeHistory: z.boolean(),
  exportFormat: z.enum(["csv", "json", "xlsx"], {
    errorMap: () => ({ message: V.exportFormatInvalid }),
  }),
})

// Contact Trader
export const ContactTraderSchema = z.object({
  recipientId: z.string().min(1, { message: V.recipientIdRequired }),
  subject: z
    .string()
    .max(200, { message: V.subjectMax })
    .optional()
    .transform(val => val?.trim() || undefined),
  message: z
    .string()
    .min(10, { message: V.messageMin })
    .max(5000, { message: V.messageMax })
    .transform(sanitizeInput),
})

export const validationSchemas = {
  createPerfumeHouse: CreatePerfumeHouseSchema,
  updatePerfumeHouse: UpdatePerfumeHouseSchema,
  createPerfume: CreatePerfumeSchema,
  updatePerfume: UpdatePerfumeSchema,
  updateUserPerfume: UpdateUserPerfumeSchema,
  createRating: CreateRatingSchema,
  updateRating: UpdateRatingSchema,
  createComment: CreateCommentSchema,
  updateComment: UpdateCommentSchema,
  wishlistAction: WishlistActionSchema,
  userForm: UserFormSchema,
  userLogin: UserLogInSchema,
  changePassword: ChangePasswordSchema,
  forgotPassword: ForgotPasswordSchema,
  resetPassword: ResetPasswordSchema,
  updateProfile: UpdateProfileSchema,
  perfumeSearch: PerfumeSearchSchema,
  adminUserForm: AdminUserFormSchema,
  dataQualityReport: DataQualityReportSchema,
  contactTrader: ContactTraderSchema,
} as const

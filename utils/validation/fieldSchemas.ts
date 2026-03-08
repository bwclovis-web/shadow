import { z } from "zod"

import { validationKeys as V } from "./validationKeys"

/** Sanitize form input to prevent XSS and code injection. */
export const sanitizeInput = (value: string): string =>
  value
    .trim()
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .replace(/[\x00-\x1F\x7F]/g, "")

// Common validation patterns
export const emailSchema = z.string().email({ message: V.emailInvalid })
export const urlSchema = z.string().url({ message: V.urlInvalid }).optional()
export const requiredUrlSchema = z
  .string()
  .url({ message: V.websiteRequired })
  .min(1, { message: V.websiteRequiredShort })
export const phoneSchema = z
  .string()
  .regex(/^[\+]?[1-9][\d]{0,15}$/, { message: V.phoneInvalid })
  .optional()
export const yearSchema = z
  .string()
  .regex(/^(19|20)\d{2}$/, { message: V.yearInvalid })
  .optional()

export const passwordSchema = z
  .string()
  .min(8, { message: V.passwordMinLength })
  .max(128, { message: V.passwordMaxLength })
  .regex(/[a-z]/, { message: V.passwordLowercase })
  .regex(/[A-Z]/, { message: V.passwordUppercase })
  .regex(/[0-9]/, { message: V.passwordNumber })
  .regex(/[^a-zA-Z0-9]/, { message: V.passwordSpecial })
  .refine(pwd => !pwd.includes(" "), { message: V.passwordNoSpaces })

export const ratingSchema = z
  .number()
  .min(1, { message: V.ratingMin })
  .max(5, { message: V.ratingMax })

export const amountSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, {
  message: V.amountFormat,
})
export const priceSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, { message: V.priceFormat })
  .optional()

// Reusable field schemas
export const nameRequired = z
  .string()
  .min(1, { message: V.nameRequired })
  .max(100, { message: V.nameMax })
  .transform(sanitizeInput)
export const nameOptional = z
  .string()
  .min(1, { message: V.nameMin })
  .max(100, { message: V.nameMax })
  .transform(sanitizeInput)
  .optional()
export const descriptionRequired = z
  .string()
  .min(10, { message: V.descriptionRequired })
  .max(1000, { message: V.descriptionMax })
  .transform(sanitizeInput)
export const descriptionOptional = z
  .string()
  .min(10, { message: V.descriptionMin })
  .max(1000, { message: V.descriptionMax })
  .transform(sanitizeInput)
  .optional()
export const countryOptional = z
  .string()
  .min(2, { message: V.countryMin })
  .max(50, { message: V.countryMax })
  .optional()
export const addressOptional = z
  .string()
  .min(5, { message: V.addressMin })
  .max(200, { message: V.addressMax })
  .optional()

export const HOUSE_TYPES = ["niche", "designer", "indie", "celebrity", "drugstore"] as const

// User/auth field schemas
export const confirmPasswordRequired = z.string().min(1, { message: V.confirmPasswordRequired })
export const firstNameSchema = z
  .string()
  .min(1, { message: V.firstNameRequired })
  .max(50, { message: V.firstNameMax })
  .trim()
export const lastNameSchema = z
  .string()
  .min(1, { message: V.lastNameRequired })
  .max(50, { message: V.lastNameMax })
  .trim()
export const usernameSchema = z
  .string()
  .min(3, { message: V.usernameMin })
  .max(30, { message: V.usernameMax })
  .regex(/^[a-zA-Z0-9_\s]+$/, { message: V.usernameFormat })
  .trim()

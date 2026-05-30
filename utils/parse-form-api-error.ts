type ZodLikeIssue = {
  path?: (string | number)[]
  message?: string
}

type FormApiValidationError = {
  field?: string
  message?: string
}

export type FormApiErrorPayload = {
  success?: boolean
  error?: string
  issues?: ZodLikeIssue[]
  errors?: Array<FormApiValidationError | string>
}

export const parseFormApiError = (
  data: FormApiErrorPayload | null | undefined,
  fallback: string
): string => {
  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error
  }

  const issueMessage = data?.issues?.find(issue => issue.message?.trim())?.message
  if (issueMessage) {
    return issueMessage
  }

  const errors = data?.errors
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0]
    if (typeof first === "string" && first.trim()) {
      return first
    }
    if (first && typeof first === "object" && typeof first.message === "string" && first.message.trim()) {
      return first.message
    }
  }

  return fallback
}

export const mapFormApiIssuesToFields = <T extends string>(
  issues: ZodLikeIssue[] | undefined,
  fieldMap: Record<string, T>
): Partial<Record<T, string>> => {
  if (!issues?.length) {
    return {}
  }

  return issues.reduce<Partial<Record<T, string>>>((acc, issue) => {
    const fieldKey = issue.path?.[0]
    if (typeof fieldKey !== "string" || !issue.message?.trim()) {
      return acc
    }

    const mappedField = fieldMap[fieldKey]
    if (mappedField && !acc[mappedField]) {
      acc[mappedField] = issue.message
    }

    return acc
  }, {})
}

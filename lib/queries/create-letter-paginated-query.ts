const LETTER_PATTERN = /^[A-Za-z]$/

export type LetterPaginatedQueryConfig<TResponse extends { success: boolean }> = {
  endpoint: string
  errorLabel: string
}

export const createLetterPaginatedQuery = <TResponse extends { success: boolean }>(
  config: LetterPaginatedQueryConfig<TResponse>
) => {
  const { endpoint, errorLabel } = config

  return async (
    letter: string,
    houseType: string = "all",
    skip: number = 0,
    take: number = 16
  ): Promise<TResponse> => {
    if (!letter || !LETTER_PATTERN.test(letter)) {
      throw new Error("Valid letter parameter is required (single letter A-Z)")
    }

    const params = new URLSearchParams({
      letter: letter.toUpperCase(),
      houseType,
      skip: skip.toString(),
      take: take.toString(),
    })

    const response = await fetch(`${endpoint}?${params}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch ${errorLabel}: ${response.statusText}`)
    }

    const data: TResponse = await response.json()

    if (!data.success) {
      throw new Error(`Failed to fetch ${errorLabel}`)
    }

    return data
  }
}

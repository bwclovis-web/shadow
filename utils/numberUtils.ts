/**
 * Utility functions for handling floating point precision issues
 */

/**
 * Rounds a number to a specified number of decimal places
 * This avoids floating-point precision issues
 */
export const roundToDecimal = (value: number, decimals: number): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Creates a step value that avoids floating-point precision issues
 * For example: createSafeStep(0.1) returns a step for integers internally
 */
export const createSafeStep = (decimalStep: number) => {
  const decimals = decimalStep.toString().split(".")[1]?.length ?? 0
  const factor = 10 ** decimals

  return {
    step: 1,
    factor,
    toInternal: (val: number) => Math.round(val * factor),
    fromInternal: (val: number) => roundToDecimal(val / factor, decimals),
  }
}

const priceFormatters = new Map<string, Intl.NumberFormat>()

const getPriceFormatter = (locale: string, currency: string): Intl.NumberFormat => {
  const key = `${locale}-${currency}`
  let formatter = priceFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency })
    priceFormatters.set(key, formatter)
  }
  return formatter
}

export const formatPrice = (amount: number, locale = "en-US", currency = "USD"): string =>
  getPriceFormatter(locale, currency).format(amount)

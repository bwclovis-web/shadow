/**
 * Calculates a relevance score for a name against a search term.
 * Used to rank search results (e.g. perfumes, houses) by how well they match.
 *
 * @param name - The string to score (e.g. perfume name, house name)
 * @param term - The search term to match against
 * @returns A numeric score; higher is more relevant
 */
export function calculateRelevanceScore(name: string, term: string): number {
  const normalizedName = name.toLowerCase()
  const normalizedTerm = term.toLowerCase()

  let score = 0

  // Exact match gets highest score
  if (normalizedName === normalizedTerm) {
    score += 150
  }
  // Starts with gets high score
  else if (normalizedName.startsWith(normalizedTerm)) {
    score += 100

    // Bonus for "name - " pattern (search term followed by space and hyphen)
    // Prioritizes specific versions, flankers, or house branches
    if (
      normalizedName.startsWith(normalizedTerm + " -") ||
      normalizedName.startsWith(normalizedTerm + " –") ||
      normalizedName.startsWith(normalizedTerm + " —")
    ) {
      score += 45
    } else if (normalizedName.startsWith(normalizedTerm + "-")) {
      // Smaller bonus for hyphen without space
      score += 20
    }
  }
  // Contains gets medium score
  else if (normalizedName.includes(normalizedTerm)) {
    score += 40
  }

  // Bonus for shorter names (more specific matches)
  score += Math.max(0, 20 - normalizedName.length)

  // Bonus for matches at word boundaries
  const wordBoundaryRegex = new RegExp(`\\b${normalizedTerm}`, "i")
  if (wordBoundaryRegex.test(normalizedName)) {
    score += 20
  }

  return score
}

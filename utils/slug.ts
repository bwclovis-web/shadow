/**
 * Utility functions for creating URL-friendly slugs
 */

export const createUrlSlug = (name: string): string => {
  if (!name || typeof name !== "string") {
    return ""
  }

  return (
    name
      // First decode any URL-encoded characters
      .replace(/%20/g, " ")
      // Normalize Unicode characters (NFD = Canonical Decomposition)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\u2013\u2014]/g, "-") // en dash, em dash → hyphen
      .replace(/[\u2018\u2019]/g, "'") // smart single quotes
      .replace(/[\u201C\u201D]/g, '"') // smart double quotes
      .replace(/[\u2026]/g, "...") // ellipsis
      // Remove any remaining non-ASCII printable characters
      .replace(/[^\x20-\x7E]/g, "")
      // Replace spaces with hyphens
      .replace(/\s+/g, "-")
      // Replace underscores with hyphens
      .replace(/_/g, "-")
      // Remove any non-alphanumeric characters except hyphens
      .replace(/[^a-zA-Z0-9-]/g, "")
      // Remove multiple consecutive hyphens
      .replace(/-+/g, "-")
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, "")
      // Convert to lowercase
      .toLowerCase()
  )
}

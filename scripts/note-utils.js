/**
 * Shared utility functions for note cleaning and duplicate detection
 * Used by clean-notes.js and apply-ai-recommendations.js
 */

/**
 * Normalize note name (lowercase, trim)
 */
export function normalizeName(name) {
  return name.trim().toLowerCase()
}

/**
 * Normalize note name for duplicate detection (handles space/hyphen variations)
 * Examples: "lily of the valley" and "lily-of-the-valley" both normalize to "lily-of-the-valley"
 */
export function normalizeForDuplicateDetection(name) {
  const normalized = normalizeName(name)
  // Convert spaces to hyphens for duplicate detection
  // This makes "lily of the valley" and "lily-of-the-valley" match
  return normalized.replace(/\s+/g, '-')
}

/**
 * Find existing note by normalized matching (handles case-insensitive and space/hyphen variations)
 * @param {Array} allNotes - Array of note objects with 'name' property
 * @param {string} targetName - The note name to find
 * @returns {Object|null} - The matching note or null if not found
 */
export function findNoteByNormalizedMatch(allNotes, targetName) {
  const normalizedTarget = normalizeForDuplicateDetection(targetName)
  return allNotes.find(note => 
    normalizeForDuplicateDetection(note.name) === normalizedTarget
  ) || null
}

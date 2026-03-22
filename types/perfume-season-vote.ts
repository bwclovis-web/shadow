export const SEASON_KEYS = ["winter", "spring", "summer", "fall"] as const
export type SeasonKey = (typeof SEASON_KEYS)[number]
export type SeasonSelection = Record<SeasonKey, boolean>

export function emptySeasonSelection(): SeasonSelection {
  return { winter: false, spring: false, summer: false, fall: false }
}

export function hasAnySeasonSelected(s: SeasonSelection): boolean {
  return s.winter || s.spring || s.summer || s.fall
}

export type SeasonRankEntry = {
  season: SeasonKey
  count: number
  /** % of voters who included this season; null when totalVoters is 0 */
  percent: number | null
}

export type SeasonVoteAggregates = {
  counts: Record<SeasonKey, number>
  totalVoters: number
  ranked: SeasonRankEntry[]
}

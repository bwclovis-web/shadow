import type { SeasonKey } from "@/types/perfume-season-vote"

/** Calendar season from month (1–12). Spring Mar–May, summer Jun–Aug, fall Sep–Nov, winter Dec–Feb. */
export const getCurrentSeasonKey = (date: Date = new Date()): SeasonKey => {
  const month = date.getMonth() + 1
  if (month >= 3 && month <= 5) return "spring"
  if (month >= 6 && month <= 8) return "summer"
  if (month >= 9 && month <= 11) return "fall"
  return "winter"
}

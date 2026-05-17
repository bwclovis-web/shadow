import type { HouseType } from "@prisma/client"

import { SEASON_KEYS, type SeasonKey } from "@/types/perfume-season-vote"

import { classifyNoteNameToFamily, type NoteFamilyId } from "./note-families"

export type TopNoteFamily = {
  family: NoteFamilyId
  weight: number
  percent: number
}

export type HouseTypeBreakdown = {
  indie: number
  niche: number
  designer: number
}

export type ScentDnaSnapshot = {
  topFamilies: TopNoteFamily[]
  seasonAffinity: Record<SeasonKey, number>
  houseBreakdown: HouseTypeBreakdown | null
  hasNoteProfile: boolean
  hasSeasonVotes: boolean
  hasHouseData: boolean
}

export const computeTopNoteFamilies = (
  noteWeights: Record<string, number>,
  noteNameById: ReadonlyMap<string, string>,
  limit = 3
): TopNoteFamily[] => {
  const totals = new Map<NoteFamilyId, number>()

  for (const [noteId, rawWeight] of Object.entries(noteWeights)) {
    const weight = Number(rawWeight)
    if (!Number.isFinite(weight) || weight <= 0) continue
    const name = noteNameById.get(noteId)
    if (!name) continue
    const family = classifyNoteNameToFamily(name)
    if (!family) continue
    totals.set(family, (totals.get(family) ?? 0) + weight)
  }

  const grandTotal = [...totals.values()].reduce((sum, value) => sum + value, 0)
  if (grandTotal <= 0) return []

  return [...totals.entries()]
    .map(([family, weight]) => ({
      family,
      weight,
      percent: Math.round((weight / grandTotal) * 100),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
}

export const computeSeasonAffinity = (
  votes: ReadonlyArray<{
    winter: boolean
    spring: boolean
    summer: boolean
    fall: boolean
  }>
): Record<SeasonKey, number> => {
  const counts: Record<SeasonKey, number> = {
    winter: 0,
    spring: 0,
    summer: 0,
    fall: 0,
  }

  for (const vote of votes) {
    for (const season of SEASON_KEYS) {
      if (vote[season]) counts[season] += 1
    }
  }

  const total = SEASON_KEYS.reduce((sum, season) => sum + counts[season], 0)
  if (total === 0) {
    return { winter: 0, spring: 0, summer: 0, fall: 0 }
  }

  const affinity = {} as Record<SeasonKey, number>
  for (const season of SEASON_KEYS) {
    affinity[season] = Math.round((counts[season] / total) * 100)
  }
  return affinity
}

export const computeHouseTypeBreakdown = (
  houseTypes: ReadonlyArray<HouseType | null | undefined>
): HouseTypeBreakdown | null => {
  const counts: HouseTypeBreakdown = { indie: 0, niche: 0, designer: 0 }
  let total = 0

  for (const type of houseTypes) {
    if (type === "indie" || type === "niche" || type === "designer") {
      counts[type] += 1
      total += 1
    }
  }

  if (total === 0) return null

  return {
    indie: Math.round((counts.indie / total) * 100),
    niche: Math.round((counts.niche / total) * 100),
    designer: Math.round((counts.designer / total) * 100),
  }
}

export const buildScentDnaSnapshot = (input: {
  noteWeights: Record<string, number>
  noteNameById: ReadonlyMap<string, string>
  seasonVotes: ReadonlyArray<{
    winter: boolean
    spring: boolean
    summer: boolean
    fall: boolean
  }>
  houseTypes: ReadonlyArray<HouseType | null | undefined>
}): ScentDnaSnapshot => {
  const topFamilies = computeTopNoteFamilies(
    input.noteWeights,
    input.noteNameById
  )
  const seasonAffinity = computeSeasonAffinity(input.seasonVotes)
  const houseBreakdown = computeHouseTypeBreakdown(input.houseTypes)

  const hasSeasonVotes = input.seasonVotes.some((vote) =>
    SEASON_KEYS.some((season) => vote[season])
  )

  return {
    topFamilies,
    seasonAffinity,
    houseBreakdown,
    hasNoteProfile: topFamilies.length > 0,
    hasSeasonVotes,
    hasHouseData: houseBreakdown !== null,
  }
}

export const isScentDnaEmpty = (snapshot: ScentDnaSnapshot): boolean =>
  !snapshot.hasNoteProfile && !snapshot.hasSeasonVotes && !snapshot.hasHouseData

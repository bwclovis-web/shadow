import { prisma } from "@/lib/db"
import {
  hasAnySeasonSelected,
  SEASON_KEYS,
  type SeasonKey,
  type SeasonRankEntry,
  type SeasonSelection,
  type SeasonVoteAggregates,
} from "@/types/perfume-season-vote"

export { SEASON_KEYS, type SeasonKey, type SeasonRankEntry, type SeasonSelection, type SeasonVoteAggregates }

function emptyCounts(): Record<SeasonKey, number> {
  return { winter: 0, spring: 0, summer: 0, fall: 0 }
}

export function selectionFromVoteRow(row: {
  winter: boolean
  spring: boolean
  summer: boolean
  fall: boolean
}): SeasonSelection {
  return {
    winter: row.winter,
    spring: row.spring,
    summer: row.summer,
    fall: row.fall,
  }
}

export async function getUserSeasonVote(userId: string, perfumeId: string) {
  return prisma.userPerfumeSeasonVote.findUnique({
    where: {
      userId_perfumeId: { userId, perfumeId },
    },
  })
}

export async function upsertSeasonVote(
  userId: string,
  perfumeId: string,
  selection: SeasonSelection
) {
  if (!hasAnySeasonSelected(selection)) {
    throw new Error("Select at least one season")
  }

  return prisma.userPerfumeSeasonVote.upsert({
    where: {
      userId_perfumeId: { userId, perfumeId },
    },
    create: {
      userId,
      perfumeId,
      winter: selection.winter,
      spring: selection.spring,
      summer: selection.summer,
      fall: selection.fall,
    },
    update: {
      winter: selection.winter,
      spring: selection.spring,
      summer: selection.summer,
      fall: selection.fall,
    },
  })
}

export async function clearSeasonVote(userId: string, perfumeId: string) {
  await prisma.userPerfumeSeasonVote.deleteMany({
    where: {
      userId,
      perfumeId,
    },
  })
}

export async function getSeasonVoteAggregates(perfumeId: string): Promise<SeasonVoteAggregates> {
  const votes = await prisma.userPerfumeSeasonVote.findMany({
    where: { perfumeId },
    select: {
      winter: true,
      spring: true,
      summer: true,
      fall: true,
    },
  })

  const counts = emptyCounts()
  for (const v of votes) {
    if (v.winter) counts.winter += 1
    if (v.spring) counts.spring += 1
    if (v.summer) counts.summer += 1
    if (v.fall) counts.fall += 1
  }

  const totalVoters = votes.length
  const ranked: SeasonRankEntry[] = SEASON_KEYS.map(season => ({
    season,
    count: counts[season],
    percent:
      totalVoters > 0 ? Math.round((counts[season] / totalVoters) * 1000) / 10 : null,
  })).sort((a, b) => b.count - a.count || SEASON_KEYS.indexOf(a.season) - SEASON_KEYS.indexOf(b.season))

  return { counts, totalVoters, ranked }
}

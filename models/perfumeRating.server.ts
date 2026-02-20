import { prisma } from "@/lib/db"
import { updateScentProfileFromBehavior } from "@/models/scent-profile.server"

export async function createPerfumeRating(data: {
  userId: string
  perfumeId: string
  longevity?: number | null
  sillage?: number | null
  gender?: number | null
  priceValue?: number | null
  overall?: number | null
}) {
  const rating = await prisma.userPerfumeRating.create({
    data: {
      userId: data.userId,
      perfumeId: data.perfumeId,
      longevity: data.longevity,
      sillage: data.sillage,
      gender: data.gender,
      priceValue: data.priceValue,
      overall: data.overall,
    },
  })

  if (rating.overall != null) {
    try {
      await updateScentProfileFromBehavior(data.userId, {
        type: "rating",
        perfumeId: data.perfumeId,
        overall: rating.overall,
      })
    } catch (error) {
      console.error("Error updating scent profile from behavior:", error)
      // Don't fail the operation if scent profile update fails
    }
  }

  return rating
}

export async function updatePerfumeRating(
  ratingId: string,
  updates: {
    longevity?: number | null
    sillage?: number | null
    gender?: number | null
    priceValue?: number | null
    overall?: number | null
  }
) {
  const updatedRating = await prisma.userPerfumeRating.update({
    where: { id: ratingId },
    data: updates,
  })

  // Only update scent profile when overall was part of this update.
  // The ratings API sends one category per call (longevity, sillage, etc.);
  // using updatedRating.overall would re-trigger on every category change
  // and repeatedly increment note weights.
  if ("overall" in updates && updates.overall != null) {
    try {
      await updateScentProfileFromBehavior(updatedRating.userId, {
        type: "rating",
        perfumeId: updatedRating.perfumeId,
        overall: updates.overall,
      })
    } catch (error) {
      console.error("Error updating scent profile from behavior:", error)
      // Don't fail the operation if scent profile update fails
    }
  }

  return updatedRating
}

export async function getUserPerfumeRating(userId: string, perfumeId: string) {
  const rating = await prisma.userPerfumeRating.findFirst({
    where: {
      userId,
      perfumeId,
    },
  })

  return rating
}

export async function getPerfumeRatings(perfumeId: string) {
  const ratings = await prisma.userPerfumeRating.findMany({
    where: { perfumeId },
  })

  // Calculate averages
  const categories = [
    "longevity",
    "sillage",
    "gender",
    "priceValue",
    "overall",
  ] as const
  const averages: Record<string, number | null> = {}

  categories.forEach(category => {
    const validRatings = ratings
      .map(rating => rating[category])
      .filter((value): value is number => value !== null)

    if (validRatings.length > 0) {
      const sum = validRatings.reduce((acc, val) => acc + val, 0)
      averages[category] = Math.round((sum / validRatings.length) * 10) / 10
    } else {
      averages[category] = null
    }
  })

  return {
    userRatings: ratings,
    averageRatings: {
      longevity: averages.longevity,
      sillage: averages.sillage,
      gender: averages.gender,
      priceValue: averages.priceValue,
      overall: averages.overall,
      totalRatings: ratings.length,
    },
  }
}

export async function deletePerfumeRating(ratingId: string): Promise<void> {
  await prisma.userPerfumeRating.delete({
    where: { id: ratingId },
  })
}

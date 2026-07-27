import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { deleteFromR2, getR2KeyFromPublicUrl } from "@/lib/r2"

export const deletePerfumeImageFromR2 = async (imageUrl: string | null | undefined): Promise<void> => {
  if (!imageUrl) return

  const r2Key = getR2KeyFromPublicUrl(imageUrl)
  if (!r2Key) return

  try {
    await deleteFromR2(r2Key)
  } catch (err) {
    console.error("[deletePerfume] Failed to delete image from R2:", r2Key, err)
  }
}

export const deletePerfumeRelatedRecords = async (
  perfumeId: string,
  tx: Prisma.TransactionClient
): Promise<void> => {
  const userPerfumeRows = await tx.userPerfume.findMany({
    where: { perfumeId },
    select: { id: true },
  })
  const userPerfumeIds = userPerfumeRows.map(row => row.id)

  await tx.userAlert.updateMany({
    where: { perfumeId },
    data: { perfumeId: null },
  })

  await tx.userFollow.deleteMany({ where: { followingPerfumeId: perfumeId } })
  await tx.wishlistNotification.deleteMany({ where: { perfumeId } })
  await tx.userPerfumeWishlist.deleteMany({ where: { perfumeId } })
  await tx.userPerfumeReview.deleteMany({ where: { perfumeId } })
  await tx.userPerfumeSeasonVote.deleteMany({ where: { perfumeId } })
  await tx.userPerfumeRating.deleteMany({ where: { perfumeId } })
  await tx.userPerfumeComment.deleteMany({ where: { perfumeId } })

  if (userPerfumeIds.length > 0) {
    await tx.tradeLineItem.deleteMany({
      where: { userPerfumeId: { in: userPerfumeIds } },
    })

    await tx.decantSplit.deleteMany({
      where: {
        OR: [
          { sourceUserPerfumeId: { in: userPerfumeIds } },
          { perfumeId },
        ],
      },
    })
  } else {
    await tx.decantSplit.deleteMany({ where: { perfumeId } })
  }

  await tx.userPerfume.deleteMany({ where: { perfumeId } })
  await tx.perfume.deleteMany({ where: { id: perfumeId } })
}

export const deletePerfumeWithRelatedData = async (perfumeId: string): Promise<void> => {
  const perfume = await prisma.perfume.findUnique({
    where: { id: perfumeId },
    select: { image: true },
  })

  await deletePerfumeImageFromR2(perfume?.image)

  await prisma.$transaction(async tx => {
    await deletePerfumeRelatedRecords(perfumeId, tx)
  })
}

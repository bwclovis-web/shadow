import { prisma } from "@/lib/db" 
import { sanitizeReviewHtml } from "@/utils/sanitize"

export interface CreateReviewData {
  userId: string
  perfumeId: string
  review: string
}

export interface UpdateReviewData {
  review: string
}

export interface ReviewFilters {
  isApproved?: boolean
  userId?: string
  perfumeId?: string
}

export interface PaginationOptions {
  page?: number
  limit?: number
}

/**
 * Create a new perfume review
 */
export async function createPerfumeReview(data: CreateReviewData) {
  const sanitizedReview = sanitizeReviewHtml(data.review)

  const review = await prisma.userPerfumeReview.create({
    data: {
      userId: data.userId,
      perfumeId: data.perfumeId,
      review: sanitizedReview,
      isApproved: false, // Require moderation approval before showing publicly
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  return review
}

/**
 * Update an existing perfume review
 */
export async function updatePerfumeReview(
  reviewId: string,
  data: UpdateReviewData,
  userId: string
) {
  const sanitizedReview = sanitizeReviewHtml(data.review)

  // Verify the user owns this review
  const existingReview = await prisma.userPerfumeReview.findFirst({
    where: {
      id: reviewId,
      userId: userId,
    },
  })

  if (!existingReview) {
    throw new Error("Review not found or you do not have permission to edit it")
  }

  const review = await prisma.userPerfumeReview.update({
    where: { id: reviewId },
    data: {
      review: sanitizedReview,
      updatedAt: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  return review
}

/**
 * Delete a perfume review
 */
export async function deletePerfumeReview(
  reviewId: string,
  userId: string,
  userRole?: string
) {
  // Check if user owns the review or is admin/editor
  const existingReview = await prisma.userPerfumeReview.findFirst({
    where: {
      id: reviewId,
      OR: [
        { userId: userId }, // User owns the review
        ...(userRole === "admin" || userRole === "editor" ? [{}] : []), // Admin/editor can delete any review
      ],
    },
  })

  if (!existingReview) {
    throw new Error("Review not found or you do not have permission to delete it")
  }

  await prisma.userPerfumeReview.delete({
    where: { id: reviewId },
  })

  return { success: true }
}

/**
 * Get reviews for a specific perfume with pagination
 */
export async function getPerfumeReviews(
  perfumeId: string,
  filters: ReviewFilters = {},
  pagination: PaginationOptions = {}
) {
  const { page = 1, limit = 10 } = pagination
  const skip = (page - 1) * limit

  const where = {
    perfumeId,
    ...filters,
  }

  const [reviews, totalCount] = await Promise.all([
    prisma.userPerfumeReview.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.userPerfumeReview.count({ where }),
  ])

  return {
    reviews,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page * limit < totalCount,
      hasPrevPage: page > 1,
    },
  }
}

/**
 * Get a specific review by ID
 */
export async function getPerfumeReview(reviewId: string) {
  const review = await prisma.userPerfumeReview.findUnique({
    where: { id: reviewId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  return review
}

/**
 * Get user's review for a specific perfume
 */
export async function getUserPerfumeReview(userId: string, perfumeId: string) {
  const review = await prisma.userPerfumeReview.findFirst({
    where: {
      userId,
      perfumeId,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  return review
}

/**
 * Get all reviews by a specific user
 */
export async function getUserReviews(
  userId: string,
  pagination: PaginationOptions = {}
) {
  const { page = 1, limit = 10 } = pagination
  const skip = (page - 1) * limit

  const [reviews, totalCount] = await Promise.all([
    prisma.userPerfumeReview.findMany({
      where: { userId },
      include: {
        perfume: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            perfumeHouse: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.userPerfumeReview.count({ where: { userId } }),
  ])

  return {
    reviews,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page * limit < totalCount,
      hasPrevPage: page > 1,
    },
  }
}

/**
 * Approve or disapprove a review (admin/editor only)
 */
export async function moderatePerfumeReview(reviewId: string, isApproved: boolean) {
  const review = await prisma.userPerfumeReview.update({
    where: { id: reviewId },
    data: { isApproved },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  return review
}

/**
 * Get pending reviews for moderation (admin/editor only)
 */
export async function getPendingReviews(pagination: PaginationOptions = {}) {
  const { page = 1, limit = 10 } = pagination
  const skip = (page - 1) * limit

  const [reviews, totalCount] = await Promise.all([
    prisma.userPerfumeReview.findMany({
      where: { isApproved: false },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        perfume: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.userPerfumeReview.count({ where: { isApproved: false } }),
  ])

  return {
    reviews,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page * limit < totalCount,
      hasPrevPage: page > 1,
    },
  }
}

import { prisma } from "@/lib/db"

export const getAllFeatures = async () => prisma.perfumeHouse.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      country: true,
      founded: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 1000, // Limit to prevent large responses
  })

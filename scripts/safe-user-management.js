const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

/**
 * Safe user management functions - NO DATA DELETION
 */

// Soft delete a user (mark as inactive)
async function softDeleteUser(userId) {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        role: "user", // Keep as user but mark for review
        email: `deleted_${Date.now()}_${user.email}`,
        username: user.username ? `deleted_${Date.now()}_${user.username}` : null,
        // You could add a deletedAt field to track when it was "deleted"
      },
    })
    console.log("User soft deleted:", user.email)
    return user
  } catch (error) {
    console.error("Error soft deleting user:", error)
    throw error
  }
}

// Deactivate a user (keep data but make inactive)
async function deactivateUser(userId) {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        role: "user", // or create a new 'inactive' role
        // Add any other fields to mark as inactive
      },
    })
    console.log("User deactivated:", user.email)
    return user
  } catch (error) {
    console.error("Error deactivating user:", error)
    throw error
  }
}

// Get user with all related data counts
async function getUserWithDataCounts(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            UserPerfume: true,
            UserPerfumeRating: true,
            UserPerfumeReview: true,
            UserPerfumeWishlist: true,
            userPerfumeComments: true,
            userAlerts: true,
            SecurityAuditLog: true,
          },
        },
      },
    })

    if (user) {
      console.log(`User: ${user.email}`)
      console.log(`- Perfumes: ${user._count.UserPerfume}`)
      console.log(`- Ratings: ${user._count.UserPerfumeRating}`)
      console.log(`- Reviews: ${user._count.UserPerfumeReview}`)
      console.log(`- Wishlist: ${user._count.UserPerfumeWishlist}`)
      console.log(`- Comments: ${user._count.userPerfumeComments}`)
      console.log(`- Alerts: ${user._count.userAlerts}`)
      console.log(`- Security Logs: ${user._count.SecurityAuditLog}`)
    }

    return user
  } catch (error) {
    console.error("Error getting user data:", error)
    throw error
  }
}

// List all users with their data counts
async function listUsersWithCounts() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            UserPerfume: true,
            UserPerfumeRating: true,
            UserPerfumeReview: true,
            UserPerfumeWishlist: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    console.log("Users with data counts:")
    users.forEach(user => {
      const totalData =
        user._count.UserPerfume +
        user._count.UserPerfumeRating +
        user._count.UserPerfumeReview +
        user._count.UserPerfumeWishlist

      console.log(`${user.email} (${user.role}) - ${totalData} total records`)
    })

    return users
  } catch (error) {
    console.error("Error listing users:", error)
    throw error
  }
}

// Export functions for use
module.exports = {
  softDeleteUser,
  deactivateUser,
  getUserWithDataCounts,
  listUsersWithCounts,
}

// If run directly, show usage
if (require.main === module) {
  console.log("Safe User Management Script")
  console.log("Usage:")
  console.log("  node scripts/safe-user-management.js list")
  console.log("  node scripts/safe-user-management.js info <userId>")
  console.log("  node scripts/safe-user-management.js soft-delete <userId>")
  console.log("  node scripts/safe-user-management.js deactivate <userId>")

  const command = process.argv[2]
  const userId = process.argv[3]

  switch (command) {
    case "list":
      listUsersWithCounts()
      break
    case "info":
      if (userId) {
        getUserWithDataCounts(userId)
      } else {
        console.log("Please provide a userId")
      }
      break
    case "soft-delete":
      if (userId) {
        softDeleteUser(userId)
      } else {
        console.log("Please provide a userId")
      }
      break
    case "deactivate":
      if (userId) {
        deactivateUser(userId)
      } else {
        console.log("Please provide a userId")
      }
      break
    default:
      console.log("Unknown command. Use: list, info, soft-delete, or deactivate")
  }
}

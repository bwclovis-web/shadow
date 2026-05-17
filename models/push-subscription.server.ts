import { prisma } from "@/lib/db"

export type PushSubscriptionKeys = {
  endpoint: string
  p256dh: string
  auth: string
}

export const upsertPushSubscription = async (
  userId: string,
  keys: PushSubscriptionKeys
) => {
  const subscription = await prisma.userPushSubscription.upsert({
    where: { endpoint: keys.endpoint },
    update: {
      userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    create: {
      userId,
      endpoint: keys.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  })

  await prisma.userAlertPreferences.upsert({
    where: { userId },
    update: { pushEnabled: true },
    create: {
      userId,
      pushEnabled: true,
    },
  })

  return subscription
}

export const deletePushSubscription = async (userId: string, endpoint: string) => {
  await prisma.userPushSubscription.deleteMany({
    where: { userId, endpoint },
  })

  const remaining = await prisma.userPushSubscription.count({
    where: { userId },
  })

  if (remaining === 0) {
    await prisma.userAlertPreferences.updateMany({
      where: { userId },
      data: { pushEnabled: false },
    })
  }
}

export const deletePushSubscriptionByEndpoint = async (endpoint: string) =>
  prisma.userPushSubscription.deleteMany({
    where: { endpoint },
  })

export const getPushSubscriptionsForUser = async (userId: string) =>
  prisma.userPushSubscription.findMany({
    where: { userId },
  })

import { PrismaClient } from '@prisma/client'

/** Bump when the Prisma schema changes so dev hot-reload picks up a fresh client. */
const PRISMA_CLIENT_VERSION = 4

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaClientVersion: number | undefined
}

const resolveDatabaseUrl = (): string | undefined => {
  if (process.env.NODE_ENV !== 'production' && process.env.LOCAL_DATABASE_URL) {
    return process.env.LOCAL_DATABASE_URL
  }
  return process.env.DATABASE_URL
}

const createPrismaClient = () => {
  const url = resolveDatabaseUrl()
  return url
    ? new PrismaClient({ datasources: { db: { url } } })
    : new PrismaClient()
}

export const prisma =
  globalForPrisma.prismaClientVersion === PRISMA_CLIENT_VERSION &&
  globalForPrisma.prisma
    ? globalForPrisma.prisma
    : createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaClientVersion = PRISMA_CLIENT_VERSION
}
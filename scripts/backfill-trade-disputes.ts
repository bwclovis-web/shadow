/**
 * One-off backfill: trade-linked UserReport rows → TradeDispute (if legacy tradeId column existed).
 * Run after push #1 (TradeDispute exists, UserReport.tradeId still present).
 * Idempotent: skips when a dispute already exists for the same tradeId + initiator.
 *
 * Current schema no longer has UserReport.tradeId — this script is a no-op unless you restore
 * the column temporarily for migration. Kept for staging/prod cutover documentation.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const main = async () => {
  console.log("backfill-trade-disputes: no legacy UserReport.tradeId in schema; nothing to migrate.")
  const count = await prisma.tradeDispute.count()
  console.log(`TradeDispute rows in database: ${count}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

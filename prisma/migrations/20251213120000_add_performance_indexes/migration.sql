-- Add performance indexes
-- (CONCURRENTLY not used: Prisma runs migrations in a transaction where CONCURRENTLY is not allowed)

-- Perfume indexes
CREATE INDEX IF NOT EXISTS "idx_perfume_slug" ON "Perfume"("slug");
CREATE INDEX IF NOT EXISTS "idx_perfume_house_created" ON "Perfume"("perfumeHouseId", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_perfume_name" ON "Perfume"("name");

-- UserPerfume indexes
CREATE INDEX IF NOT EXISTS "idx_user_perfume_user_available" ON "UserPerfume"("userId", "available");
CREATE INDEX IF NOT EXISTS "idx_user_perfume_perfume_available" ON "UserPerfume"("perfumeId", "available");
-- Partial index for marketplace queries (only indexes rows where available != '0')
CREATE INDEX IF NOT EXISTS "idx_user_perfume_available" ON "UserPerfume"("available") WHERE "available" != '0';

-- UserPerfumeWishlist indexes
CREATE INDEX IF NOT EXISTS "idx_wishlist_user_created" ON "UserPerfumeWishlist"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_wishlist_perfume" ON "UserPerfumeWishlist"("perfumeId");

-- UserPerfumeRating indexes
CREATE INDEX IF NOT EXISTS "idx_rating_perfume_overall" ON "UserPerfumeRating"("perfumeId", "overall");

-- UserPerfumeReview indexes
CREATE INDEX IF NOT EXISTS "idx_review_perfume_created" ON "UserPerfumeReview"("perfumeId", "createdAt" DESC);

-- PerfumeHouse indexes
CREATE INDEX IF NOT EXISTS "idx_house_type_name" ON "PerfumeHouse"("type", "name");

-- PerfumeNoteRelation composite index
CREATE INDEX IF NOT EXISTS "idx_note_relation_note_type" ON "PerfumeNoteRelation"("noteId", "noteType");










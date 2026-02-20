-- Add performance indexes using CONCURRENTLY to avoid table locking
-- These indexes are read-only metadata structures and will NOT modify any data
-- CONCURRENTLY ensures zero downtime and no blocking of queries

-- Perfume indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_perfume_slug" ON "Perfume"("slug");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_perfume_house_created" ON "Perfume"("perfumeHouseId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_perfume_name" ON "Perfume"("name");

-- UserPerfume indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_user_perfume_user_available" ON "UserPerfume"("userId", "available");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_user_perfume_perfume_available" ON "UserPerfume"("perfumeId", "available");
-- Partial index for marketplace queries (only indexes rows where available != '0')
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_user_perfume_available" ON "UserPerfume"("available") WHERE "available" != '0';

-- UserPerfumeWishlist indexes
-- Note: DESC ordering for createdAt to optimize wishlist sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_wishlist_user_created" ON "UserPerfumeWishlist"("userId", "createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_wishlist_perfume" ON "UserPerfumeWishlist"("perfumeId");

-- UserPerfumeRating indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_rating_perfume_overall" ON "UserPerfumeRating"("perfumeId", "overall");

-- UserPerfumeReview indexes
-- Note: DESC ordering for createdAt to optimize review listings
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_review_perfume_created" ON "UserPerfumeReview"("perfumeId", "createdAt" DESC);

-- PerfumeHouse indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_house_type_name" ON "PerfumeHouse"("type", "name");

-- PerfumeNoteRelation composite index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_note_relation_note_type" ON "PerfumeNoteRelation"("noteId", "noteType");










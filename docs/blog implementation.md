# Blog Implementation Checklist

Implementation checklist for adding a Prisma-backed blog to perfumer's hollow.

## 1) Foundation: Data Model + Schema

- [ ] Add `BlogPost` model to `prisma/schema.prisma`
  - [ ] Required fields: `id`, `slug`, `title`, `excerpt`, `content`, `status`, `authorId`, `createdAt`, `updatedAt`
  - [ ] Optional fields: `coverImageUrl`, `publishedAt`
  - [ ] Add unique index on `slug`
- [ ] Add `BlogTag` model to `prisma/schema.prisma`
  - [ ] Fields: `id`, `name`, `slug`, `createdAt`, `updatedAt`
  - [ ] Add unique index on `slug`
- [ ] Add `BlogPostTag` join model for many-to-many relation
  - [ ] Composite unique index on `(postId, tagId)`
- [ ] Add relation from `BlogPost.authorId` to existing user model
- [ ] Run Prisma migration with a descriptive name
- [ ] Confirm Prisma client regeneration succeeds

## 2) Server Layer: Blog Model APIs

- [ ] Create `models/blog.server.ts`
- [ ] Add public read APIs:
  - [ ] `getPublishedPosts({ page, tag, query })`
  - [ ] `getPublishedPostBySlug(slug)`
  - [ ] `getRelatedPosts(postId, tagIds)`
- [ ] Add admin write APIs:
  - [ ] `createPost(input)`
  - [ ] `updatePost(id, input)`
  - [ ] `setPostStatus(id, status)`
  - [ ] `deletePost(id)`
  - [ ] `upsertTags(postId, tags)`
- [ ] Enforce slug uniqueness checks in write flows
- [ ] Ensure deterministic sorting (`publishedAt DESC`, fallback `createdAt DESC`)

## 3) Public Blog Routes

- [ ] Add `app/blog/page.tsx`
  - [ ] Fetch published posts on server
  - [ ] Handle pagination/filter query params
  - [ ] Add empty state UI
  - [ ] Implement `generateMetadata()` for index
- [ ] Add `app/blog/[slug]/page.tsx`
  - [ ] Fetch one published post by slug
  - [ ] Return `notFound()` for missing/unpublished posts
  - [ ] Fetch and render related posts
  - [ ] Implement per-post `generateMetadata()`

## 4) Blog UI Components

- [ ] Add `components/Organisms/BlogPostCard/BlogPostCard.tsx`
- [ ] Add `components/Molecules/BlogTagPills/BlogTagPills.tsx`
- [ ] Add `components/Organisms/BlogPostHeader/BlogPostHeader.tsx`
- [ ] Add `components/Organisms/BlogPostContent/BlogPostContent.tsx`
- [ ] Keep styles aligned with existing design tokens in `app/globals.css`
- [ ] Add loading/empty states consistent with app patterns

## 5) Admin Authoring Workflow

- [ ] Add `app/admin/blog/page.tsx` (list + status filters)
- [ ] Add `app/admin/blog/new/page.tsx`
- [ ] Add `app/admin/blog/[id]/edit/page.tsx`
- [ ] Add `components/Organisms/BlogAdminPostForm/BlogAdminPostForm.tsx`
  - [ ] Fields: title, slug, excerpt, content, cover image URL, status, tags
  - [ ] Client-side validation + server-side validation
- [ ] Add role checks so only admins can access blog admin routes/actions

## 6) Navigation + Discovery Integration

- [ ] Update `data/navigation.ts` with a `blog` main nav item
- [ ] Ensure active nav styles work for `/blog` and `/blog/[slug]`
- [ ] Verify desktop nav in `components/Molecules/GlobalNavigation/GlobalNavigation.tsx`
- [ ] Verify mobile nav behavior in `components/Molecules/MobileBottomNavigation/MobileBottomNavigation.tsx`
- [ ] Optionally include blog link in `AboutDropdown` if desired
- [ ] Add contextual post CTAs to `/the-vault` and `/the-exchange`

## 7) i18n

- [ ] Add `navigation.blog` key to all locale files:
  - [ ] `messages/en.json`
  - [ ] `messages/es.json`
  - [ ] `messages/fr.json`
  - [ ] `messages/it.json`
- [ ] Add `blog` namespace in all locale files:
  - [ ] `blog.meta.title`
  - [ ] `blog.meta.description`
  - [ ] `blog.list.*`
  - [ ] `blog.post.*`
  - [ ] `blog.admin.*`
- [ ] Keep post content single-language (v1) and localize UI shell only

## 8) SEO + Safety

- [ ] Add Open Graph and Twitter metadata for blog pages
- [ ] Add canonical URL generation for post pages
- [ ] Add JSON-LD `BlogPosting` schema on post detail pages
- [ ] Add content sanitization/allowlist before rendering post content
- [ ] Validate and normalize slugs consistently

## 9) Testing

- [ ] Add model tests for blog query/write behavior
  - [ ] published-only filtering
  - [ ] slug uniqueness
  - [ ] related-post selection
- [ ] Add page/component tests:
  - [ ] blog index render + empty state
  - [ ] blog detail render + `notFound` behavior
  - [ ] admin form validation/status transitions
- [ ] Update impacted nav tests after adding blog item

## 10) Launch Readiness Checklist

- [ ] Manual QA for desktop + mobile nav and route transitions
- [ ] Verify draft posts are not publicly accessible
- [ ] Verify metadata output in page source for index and post detail
- [ ] Verify localization fallback behavior
- [ ] Run full validation (`typecheck` + `test`)
- [ ] Seed at least 3 published posts and 1 draft post for smoke testing

## Phase Milestones

- [ ] Phase 1: Schema + model layer complete
- [ ] Phase 2: Public blog pages complete
- [ ] Phase 3: Admin workflow complete
- [ ] Phase 4: SEO, tests, and launch checks complete

## Definition of Done

- [ ] `/blog` and `/blog/[slug]` are live and indexable
- [ ] Blog admin CRUD is restricted to admins and functional
- [ ] Navigation includes Blog and active states are correct
- [ ] i18n keys exist across all supported locales
- [ ] Tests pass and no new lint/type regressions are introduced

# Cloudflare R2 Image Migration — Implementation Plan

> **Overview:** Migrate image URLs stored in the database (`PerfumeHouse.image`, `Perfume.image`) from external hosts to Cloudflare R2. Download from source URLs, upload to R2, and update records with new CDN URLs. Includes one-time migration plus optional future file-upload flow.

---

## Table of Contents

1. [Current State](#current-state)
2. [Target Architecture](#target-architecture)
3. [Prerequisites](#prerequisites)
4. [Environment Configuration](#environment-configuration)
5. [Implementation Steps](#implementation-steps)
6. [Migration Script Details](#migration-script-details)
7. [Optional: File Upload Flow](#optional-file-upload-flow)
8. [Verification & Testing](#verification--testing)
9. [Rollback Plan](#rollback-plan)
10. [Implementation Checklist](#implementation-checklist)
11. [Long-Term Costs](#long-term-costs)

---

## Current State

| Item | Details |
|------|---------|
| **Schema** | `PerfumeHouse.image` and `Perfume.image` are `String?` columns |
| **Source hosts** | `images.unsplash.com`, `galehayman.com`, `sites.create-cdn.net`, `mysterymodernmark.com` |
| **Update flow** | Image URL set via text input; no file upload |
| **UI** | `next/image` with `remotePatterns` in `next.config.ts` |
| **Form components** | `InfoFieldset.tsx` (houses), `PerfumeForm.tsx` (perfumes) — both use "Image URL" text input |

**Relevant files:**
- `prisma/schema.prisma` — `PerfumeHouse.image`, `Perfume.image`
- `next.config.ts` — `images.remotePatterns`
- `components/Containers/Forms/Partials/InfoFieldset.tsx` — house image input
- `components/Containers/Forms/PerfumeForm.tsx` — perfume image input
- `utils/styleUtils.ts` — `validImageRegex` (legacy placeholder URLs)

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BEFORE:  DB → External URLs (unsplash, galehayman, create-cdn, etc.)   │
│           → next/image                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  AFTER:   DB → R2 bucket → Cloudflare CDN → next/image                  │
│           All images served from your own domain/R2 public URL           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- [ ] **Cloudflare account** with R2 enabled
- [ ] **Node.js** (project already uses Node)
- [ ] **Database backup** capability (e.g. `pg_dump` for PostgreSQL)
- [ ] **tsx** or **ts-node** for running TypeScript scripts (check `package.json`)

---

## Environment Configuration

### Required Variables

Add to `.env` (do **not** commit values; add to `.gitignore`):

```env
# Cloudflare R2 (S3-compatible)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=shadows-images
R2_PUBLIC_URL=https://your-bucket-domain.r2.dev
```

### `.env.example` (commit this, no secrets)

```env
# Cloudflare R2 (S3-compatible API)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=shadows-images
R2_PUBLIC_URL=
```

### Where to Get Values

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2 Object Storage**
2. Create bucket → name it `shadows-images` (or your choice)
3. **Manage R2 API Tokens** → **Create API token**
   - Permissions: **Object Read & Write**
   - Copy: `Access Key ID`, `Secret Access Key`, `Account ID`
4. **Public access** or **Custom domain** → note the base URL (e.g. `https://pub-xxx.r2.dev` or `https://images.yourdomain.com`)

---

## Implementation Steps

### Step 1: Create R2 Bucket and API Token

| Task | Details |
|------|---------|
| Create bucket | Name: `shadows-images` (or similar) |
| Enable public access | If using R2 public URL; otherwise configure custom domain |
| Create API token | Permissions: Object Read & Write |
| Record | Account ID, Access Key ID, Secret Access Key |

**Checklist:**
- [ ] Bucket created
- [ ] Public access or custom domain configured
- [ ] API token created and stored securely
- [ ] Public URL format known (e.g. `https://pub-xxx.r2.dev/` or `https://images.example.com/`)

---

### Step 2: Add Environment Variables

| Task | Action |
|------|--------|
| Update `.env` | Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` |
| Create/update `.env.example` | Same keys, empty values |
| Verify `.gitignore` | Ensure `.env` is ignored |

**Checklist:**
- [ ] `.env` updated with real values (local/dev only)
- [ ] `.env.example` updated for team reference
- [ ] No secrets committed to git

---

### Step 3: Install Dependency

```bash
npm install @aws-sdk/client-s3
```

**Checklist:**
- [ ] `@aws-sdk/client-s3` added to `package.json`
- [ ] `npm install` runs without errors

---

### Step 4: Create R2 Client Utility

**File:** `lib/r2.ts` (or `utils/r2.ts`)

**Responsibilities:**
- Initialize S3 client with R2 endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `uploadBuffer(key: string, buffer: Buffer, contentType?: string): Promise<void>`
- `getPublicUrl(key: string): string` → `R2_PUBLIC_URL + key`

**Checklist:**
- [x] Create `lib/r2.ts`
- [x] Use `S3Client`, `PutObjectCommand` from `@aws-sdk/client-s3`
- [x] Endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
- [x] Region: `auto` (R2 requirement)
- [x] Validate env vars at runtime; throw clear error if missing
- [x] Export `uploadToR2` and `getR2PublicUrl`

---

### Step 5: Create Migration Script

**File:** `scripts/migrate-images-to-r2.ts`

**Logic:**

1. Fetch all `PerfumeHouse` and `Perfume` where `image` is not null
2. For each record:
   - **Skip** if `image` already starts with `R2_PUBLIC_URL` (idempotency)
   - **Download** image via `fetch(url)` → `response.arrayBuffer()`
   - **Content-Type** from `response.headers.get('content-type')` or infer from URL
   - **Extension** from URL path or Content-Type (e.g. `.jpg`, `.png`, `.webp`)
   - **Key** format: `houses/{id}.{ext}` or `perfumes/{id}.{ext}`
   - **Upload** to R2 with `putObject`
   - **Update** DB with `getR2PublicUrl(key)`
3. **Logging:** Success/fail per record; summary at end
4. **Retry:** Optional retry (e.g. 2 retries) for transient fetch/upload errors
5. **Dry-run:** `--dry-run` flag to log actions without DB updates

**Checklist:**
- [x] Create `scripts/migrate-images-to-r2.ts`
- [x] Use Prisma to fetch `PerfumeHouse` and `Perfume`
- [x] Implement skip logic for existing R2 URLs
- [x] Handle fetch errors (404, timeout, etc.)
- [x] Support `--dry-run`
- [x] Add `package.json` script: `"migrate:images": "tsx scripts/migrate-images-to-r2.ts"`

---

### Step 6: Add R2 Host to Next.js Config

**File:** `next.config.ts`

Add to `images.remotePatterns`:

```ts
{
  protocol: 'https',
  hostname: 'your-bucket-domain.r2.dev',  // or custom domain hostname
  pathname: '/**',
}
```

**Checklist:**
- [ ] Hostname matches `R2_PUBLIC_URL` (without `https://`)
- [ ] `pathname: '/**'` allows all paths under the bucket
- [ ] Restart Next.js dev server to pick up changes

---

### Step 7: Backup Database

Before running the migration:

```bash
# PostgreSQL example
pg_dump -h <host> -U <user> -d <dbname> -F c -f backup_before_r2_migration.dump
```

**Checklist:**
- [ ] Database backup completed
- [ ] Backup file stored safely and can be restored if needed

---

### Step 8: Run Migration

1. **Dry-run first:**
   ```bash
   npx tsx scripts/migrate-images-to-r2.ts --dry-run
   ```
2. **Run migration:**
   ```bash
   npx tsx scripts/migrate-images-to-r2.ts
   ```
3. **Verify** a sample of records in DB and in the UI

**Checklist:**
- [ ] Dry-run executed; output reviewed
- [ ] Migration script run without errors
- [ ] Spot-check 5–10 PerfumeHouse and Perfume records in DB
- [ ] Spot-check images in browser (house pages, perfume pages)

---

## Migration Script Details

### Key Design Decisions

| Topic | Decision |
|------|----------|
| **Key naming** | `houses/{id}.{ext}` and `perfumes/{id}.{ext}` — deterministic, no collisions |
| **Idempotency** | Skip URLs already pointing at `R2_PUBLIC_URL` |
| **Legacy URLs** | Skip or handle `o.NNNNN.jpg` (validImageRegex placeholders) — document behavior |
| **Rate limits** | Optional delay between fetches (e.g. 100ms) to avoid hammering source hosts |
| **CORS** | Configure R2 bucket CORS if loading images from your app domain |
| **Transactions** | Consider batching DB updates (e.g. `prisma.$transaction`) for large datasets |

### Error Handling

- Log failed URLs and continue
- Exit with non-zero code if any failures (optional)
- Save failed URLs to `migration-failures.json` for manual review (optional)

---

## Optional: File Upload Flow

For future create/edit flows to upload files to R2 instead of pasting URLs:

### API Route

**File:** `app/api/upload-image/route.ts`

- Accept `multipart/form-data` with `file` field
- Validate: max size (e.g. 5MB), allowed MIME types (`image/jpeg`, `image/png`, `image/webp`)
- Generate key: `uploads/{timestamp}-{random}.{ext}`
- Upload to R2 via `lib/r2.ts`
- Return JSON: `{ url: string }` (public URL)

### Form Changes

| File | Change |
|------|--------|
| `InfoFieldset.tsx` | Replace "Image URL" text input with file input + preview; on change, call upload API, set hidden input with returned URL |
| `PerfumeForm.tsx` | Same pattern for perfume image |

### Validation

- Max file size: 5MB (or per project requirements)
- Allowed types: `image/jpeg`, `image/png`, `image/webp`
- Client and server validation

**Checklist (optional):**
- [ ] Create `app/api/upload-image/route.ts`
- [ ] Update `InfoFieldset.tsx` with file upload
- [ ] Update `PerfumeForm.tsx` with file upload
- [ ] Add client-side validation (size, type)
- [ ] Add server-side validation in API route
- [ ] Consider auth: restrict upload API to authenticated editors/admins

---

## Verification & Testing

| Test | How |
|------|-----|
| R2 connection | Upload a test file via script or API |
| Migration idempotency | Run migration twice; second run should skip all |
| Image display | Browse house and perfume pages; images load |
| next/image | No 400/403 from Next.js image optimization |
| Legacy URLs | If any `o.NNNNN.jpg` exist, document skip/placeholder behavior |

---

## Rollback Plan

1. Restore database from backup (before migration)
2. Optionally keep old `image` values in a backup column during rollout:
   - Add `image_backup` (or `image_legacy`) via Prisma migration
   - Copy `image` → `image_backup` before migration
   - If rollback needed: `image = image_backup`
3. Remove backup column after validation period

---

## Implementation Checklist

Use this as the main tracking checklist.

### Phase 1: Setup

- [ ] Create Cloudflare R2 bucket
- [ ] Enable public access (or configure custom domain)
- [ ] Create R2 API token
- [ ] Add env vars to `.env` and `.env.example`
- [x] Install `@aws-sdk/client-s3`

### Phase 2: Code

- [x] Create `lib/r2.ts` (or `utils/r2.ts`) — R2 client
- [x] Create `scripts/migrate-images-to-r2.ts` — migration script
- [ ] Add R2 host to `next.config.ts` `images.remotePatterns`
- [x] Add `migrate:images` script to `package.json`

### Phase 3: Migration

- [ ] Backup database
- [ ] Run migration in dry-run mode
- [ ] Review dry-run output
- [ ] Run migration
- [ ] Spot-check DB records
- [ ] Spot-check images in UI
- [ ] Document any failed URLs for manual handling

### Phase 4: Validation

- [ ] Verify house images load
- [ ] Verify perfume images load
- [ ] Verify next/image optimization works with R2 URLs
- [ ] Test migration idempotency (optional re-run)

### Phase 5: Optional Upload Flow

- [ ] Create `/api/upload-image` route
- [ ] Update `InfoFieldset.tsx` for file upload
- [ ] Update `PerfumeForm.tsx` for file upload
- [ ] Add auth/authorization if required
- [ ] Test create/edit flows

---

## Long-Term Costs

R2 has **no egress fees**.

| Item | Rate |
|------|------|
| Storage (Standard) | $0.015/GB-month |
| Class A ops (writes) | $4.50/million |
| Class B ops (reads) | $0.36/million |
| Egress | Free |

### Free Tier (monthly)

- 10 GB storage  
- 1M Class A operations  
- 10M Class B operations  
- Unlimited egress  

### Example Estimates

**Small** (500 houses + 2,000 perfumes, ~500MB, ~50K views/month): **~$0.05/month** (often within free tier)

**Medium** (~2GB, ~500K views): **~$0.60/month**

**Large** (~10GB, ~2M views): **~$3/month**

---

## Notes

- **Legacy `o.NNNNN.jpg` URLs:** `utils/styleUtils.ts` may treat these as invalid. Migration can skip them or document placeholder behavior.
- **CORS:** Configure R2 bucket CORS if images are loaded from your app domain.
- **Rate limits:** Add small delays between fetches if external hosts rate-limit.

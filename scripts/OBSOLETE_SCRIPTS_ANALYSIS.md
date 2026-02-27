# Scripts Analysis - Potentially Obsolete Scripts

This document lists scripts in the `scripts/` folder that appear to be no longer needed or have been superseded by other scripts.

## High Confidence - Likely No Longer Needed

### 1. Duplicate Migration Scripts
- ~~**`migrate-to-accelerate.js`**~~ - ✅ **REMOVED** - Was superseded by `migrate-to-accelerate-fixed.js`
  - The "fixed" version is the corrected/improved version
  - The original has hardcoded credentials and appears to be an earlier attempt

### 2. Duplicate Cleanup Script
- ~~**`cleanup-duplicate-notes.js`**~~ - ✅ **REMOVED** - Was superseded by `merge-duplicate-notes.js`
  - `merge-duplicate-notes.js` has better functionality:
    - Dry-run support
    - More sophisticated merging logic
    - Better handling of perfume relationships
  - `cleanup-duplicate-notes.js` is simpler and appears to be an earlier version

### 3. One-Time Import Scripts (Brand-Specific)
These appear to be one-time use scripts for importing specific perfume brands. After initial import, they're likely no longer needed. The reusable import script is `import-csv-noir.ts` which is in package.json.

- ~~**`import-andreamaack.js`**~~ - ✅ **REMOVED** - One-time import for Andrea Maack brand
- ~~**`import-paintboxsoapworks.ts`**~~ - ✅ **REMOVED** - One-time import for Paintbox Soapworks brand
- ~~**`import-imaginary-authors.ts`**~~ - ✅ **REMOVED** - One-time import for Imaginary Authors brand
- ~~**`import-mdafrags.ts`**~~ - ✅ **REMOVED** - One-time import for MD&A Frags brand
- ~~**`import-poesie-perfume-and-tea.ts`**~~ - ✅ **REMOVED** - One-time import for Poesie Perfume and Tea brand
- ~~**`import-prinlomros.ts`**~~ - ✅ **REMOVED** - One-time import for Prin Lomros brand
- ~~**`import-the-little-book-eater.ts`**~~ - ✅ **REMOVED** - One-time import for The Little Book Eater brand
- ~~**`import-the-moon-in-bloom.ts`**~~ - ✅ **REMOVED** - One-time import for The Moon in Bloom brand

### 4. One-Time Migration/Fix Scripts
- ~~**`fix-slugs.js`**~~ - ✅ **REMOVED** - One-time script to fix existing slugs in the database
  - Appears to be a migration/fix script run once
  - Not referenced in package.json
  - No longer needed if migration was completed

### 5. Broken References in package.json
~~These scripts are referenced in `package.json` but don't exist in the scripts folder:~~
- ~~`push_to_prisma_accelerate.js` (referenced in `db:migrate:accelerate`)~~ ✅ **REMOVED**
- ~~`migrate_data_to_accelerate.js` (referenced in `db:migrate:accelerate` and `db:migrate:accelerate:data`)~~ ✅ **REMOVED**
- ~~`push_local_to_remote_db.js` (referenced in `db:push:remote`)~~ ✅ **REMOVED**
- ~~`push_local_to_remote_db_working.js` (referenced in `db:push:remote:env`)~~ ✅ **REMOVED**
- ~~`import_s_and_s_complete.js` (referenced in `import:s&s`)~~ ✅ **REMOVED**

✅ **COMPLETED** - All broken references have been removed from `package.json`

**Note:** `db:push:remote:cli` was kept because `push_local_to_remote_db_cli.js` exists.

## Medium Confidence - Review Before Removing

### 6. Utility/One-Time Analysis Scripts
- **`count-unattached-notes.js`** - Utility script to count notes not attached to any perfume
  - Could be useful for data quality checks
  - Consider keeping if used for maintenance/debugging

### 7. Migration Scripts
- **`migrate-to-accelerate-fixed.js`** - May be a one-time migration script
  - Check if the migration has been completed
  - If migration is complete, this can likely be removed
  - However, it might still be needed for future migrations or rollbacks

## Summary Count

**High Confidence (Remove):**
- ~~1 duplicate migration script (`migrate-to-accelerate.js`)~~ ✅ **REMOVED**
- ~~1 duplicate cleanup script (`cleanup-duplicate-notes.js`)~~ ✅ **REMOVED**
- ~~8 brand-specific import scripts~~ ✅ **ALL REMOVED**
- ~~1 one-time fix script (`fix-slugs.js`)~~ ✅ **REMOVED**
- **Total: 0 scripts remaining** (All 11 scripts have been removed)

**Broken References:**
- ~~5 scripts referenced in package.json that don't exist~~ ✅ **ALL REMOVED**
- All broken npm script references have been cleaned up from `package.json`

## Recommendation

1. **Immediate Actions:**
   - ~~Remove broken script references from `package.json`~~ ✅ **COMPLETED**
   - ~~Archive or remove the 11 scripts listed under "High Confidence"~~ ✅ **COMPLETED**

2. **Review:**
   - Verify that brand imports have been completed
   - Confirm that migrations have been completed
   - Check if `count-unattached-notes.js` is used for ongoing maintenance

3. **Archive Before Deleting:**
   - Consider moving obsolete scripts to an `archive/` folder before deleting
   - This preserves history in case they're needed for reference





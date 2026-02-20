# Remote Database Migration Instructions

## ⚠️ IMPORTANT: This migration is SAFE and NON-DESTRUCTIVE
- **NO data will be deleted**
- **NO data will be modified**
- **ONLY new structures will be added** (tables, columns, indexes, constraints)

## What This Migration Does

This migration syncs your remote/production database structure with the local schema by adding:

### New Tables
1. `PerfumeNoteRelation` - Junction table for perfume notes
2. `TraderFeedback` - Trader rating and feedback system
3. `SecurityAuditLog` - Security audit logging
4. `UserAlert` - User notification system
5. `UserAlertPreferences` - Alert preferences
6. `PendingSubmission` - User submissions for review
7. `TraderContactMessage` - Trader messaging system
8. `MigrationState` - Migration tracking

### New Enums
- `PerfumeNoteType` (open, heart, base)
- `SecurityAuditAction` (various security events)
- `SecurityAuditSeverity` (low, info, warning, error, critical)
- `PendingSubmissionType` (perfume, perfume_house)
- `PendingSubmissionStatus` (pending, approved, rejected)

### New Columns
- `updatedAt` fields added to several tables where missing

### New Indexes
- Performance indexes for all new tables
- Additional indexes for existing tables

## How to Apply the Migration

### Option 1: Using psql (Recommended)

```bash
# Connect to your remote database
psql "YOUR_REMOTE_DATABASE_URL"

# Run the migration file
\i prisma/migrations/APPLY_TO_REMOTE_DB.sql

# Verify it completed successfully
# You should see "✅ Migration completed successfully!" at the end
```

### Option 2: Using a Database GUI Tool
1. Open your favorite PostgreSQL GUI tool (pgAdmin, DBeaver, TablePlus, etc.)
2. Connect to your remote database
3. Open `APPLY_TO_REMOTE_DB.sql`
4. Execute the entire script
5. Check for success message

### Option 3: Using Prisma (If you have direct access)

```bash
# ONLY if your Vercel/remote database allows direct Prisma access
prisma db push --schema=prisma/schema.prod.prisma
```

## Verification

After running the migration, verify it worked by checking:

```sql
-- Check new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'PerfumeNoteRelation',
    'TraderFeedback',
    'SecurityAuditLog',
    'UserAlert',
    'UserAlertPreferences',
    'PendingSubmission',
    'TraderContactMessage',
    'MigrationState'
);

-- Check new enums exist
SELECT typname 
FROM pg_type 
WHERE typtype = 'e' 
AND typname IN (
    'PerfumeNoteType',
    'SecurityAuditAction',
    'SecurityAuditSeverity',
    'PendingSubmissionType',
    'PendingSubmissionStatus'
);
```

## Rollback (If Needed)

If you need to rollback, the safest approach is:
1. The migration is wrapped in a transaction, so if it fails midway, it will automatically rollback
2. If it completed but you want to undo it, you would need to manually drop the new tables/enums

**However**, since this migration only ADDS structures and doesn't modify existing data, rollback should rarely be needed.

## After Migration

1. **Redeploy your application** - Vercel will automatically use the new schema
2. **Test the features** - Try adding a perfume to your collection
3. **Monitor logs** - Check Vercel logs for any remaining errors

## Troubleshooting

### If you see "enum already exists"
This is normal! The script checks for existing structures and skips them. You'll see NOTICE messages like:
```
NOTICE: PerfumeNoteType enum already exists, skipping
```

### If you see constraint errors
Make sure your database has all the prerequisite tables (User, Perfume, PerfumeNotes, etc.). If you're missing base tables, you may need to run earlier migrations first.

### If the transaction fails
The entire migration will rollback automatically. Check the error message and fix any issues before trying again.

## Need Help?

If you encounter any issues:
1. Check the error message carefully
2. Verify your database connection string is correct
3. Make sure you have sufficient permissions on the database
4. Check if tables already exist (they might from a previous partial migration)

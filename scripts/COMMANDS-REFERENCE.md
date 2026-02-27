# Note Cleaning Commands Reference

## Quick Summary

| Command | JavaScript Rules | AI Extraction | AI Applied | Duplicates Re-checked | Database Changes |
|---------|-----------------|---------------|------------|----------------------|------------------|
| `npm run clean:notes:complete` | ✅ Dry-run | ✅ Analysis only | ❌ No | ❌ No | ❌ **NO** |
| `npm run clean:notes:complete:apply` | ✅ **ACTUAL** | ✅ Analysis only | ❌ No | ❌ No | ✅ **YES** (JS rules only) |
| `npm run clean:notes:complete:full` | ✅ **ACTUAL** | ✅ Analysis | ✅ **YES** | ✅ **YES** | ✅ **YES** (All changes) |

---

## Detailed Breakdown

### `npm run clean:notes:complete` (Dry-Run)

**What it does:**
1. ✅ Runs JavaScript rule-based cleaning in **DRY-RUN mode** (preview only)
2. ✅ Extracts ambiguous notes from the report
3. ✅ Runs AI extraction (analysis only - generates recommendations)
4. ✅ Generates combined markdown report

**Database Changes:** ❌ **NONE** - This is a preview only

**Output:**
- `reports/complete-note-cleaning-{timestamp}.md` - Combined report
- `reports/clean-notes-dry-run-{timestamp}.md` - JavaScript rule-based report
- `reports/ai-note-extraction-{timestamp}.md` - AI recommendations (if ambiguous notes found)

---

### `npm run clean:notes:complete:apply` (Apply JS Rules Only)

**What it does:**
1. ✅ Runs JavaScript rule-based cleaning in **ACTUAL mode** (applies changes to database)
2. ✅ Extracts ambiguous notes from the report
3. ✅ Runs AI extraction (analysis only - generates recommendations)
4. ✅ Generates combined markdown report

**Safety gates (enforced):**
- Requires explicit apply confirmation (`--confirm-apply`) via npm script
- Requires a recent backup manifest in `backups/` (created by `npm run db:backup`)

**Database Changes:** ✅ **YES** - JavaScript rule-based changes are applied

**What gets modified:**
- ✅ Duplicate notes merged
- ✅ Invalid characters cleaned
- ✅ Stopwords removed
- ✅ Simple phrase extractions applied

**What does NOT get auto-applied:**
- ⚠️ AI extraction recommendations (these are in the report for manual review)
- ⚠️ Duplicate detection after AI (must be run separately)

**Output:**
- `reports/complete-note-cleaning-{timestamp}.md` - Combined report
- `reports/clean-notes-dry-run-{timestamp}.md` - JavaScript rule-based report  
- `reports/ai-note-extraction-{timestamp}.md` - AI recommendations (if ambiguous notes found)

---

### `npm run clean:notes:complete:full` (Apply Everything - Recommended)

**What it does:**
1. ✅ Runs JavaScript rule-based cleaning in **ACTUAL mode** (applies changes to database)
2. ✅ Extracts ambiguous notes from the report
3. ✅ Runs AI extraction (analysis)
4. ✅ **Automatically applies AI recommendations** to database
5. ✅ **Re-runs duplicate detection** to merge any duplicates created by AI
6. ✅ Generates combined markdown report

**Safety gates (enforced):**
- Requires explicit apply confirmation (`--confirm-apply`) via npm script
- Requires a recent backup manifest in `backups/` (created by `npm run db:backup`)

**Database Changes:** ✅ **YES** - All changes are applied (JS rules + AI recommendations + duplicate cleanup)

**What gets modified:**
- ✅ Duplicate notes merged (initial pass)
- ✅ Invalid characters cleaned
- ✅ Stopwords removed
- ✅ Simple phrase extractions applied
- ✅ AI-extracted notes created and relations reassociated
- ✅ Duplicate notes merged again (post-AI cleanup)

**This is the complete workflow that handles everything automatically!**

**Output:**
- `reports/complete-note-cleaning-{timestamp}.md` - Combined report
- `reports/clean-notes-dry-run-{timestamp}.md` - JavaScript rule-based report  
- `reports/ai-note-extraction-{timestamp}.md` - AI recommendations (if ambiguous notes found)

---

## Important Notes

### ⚠️ Before Running `clean:notes:complete:apply`

1. **Always run dry-run first:**
   ```bash
   npm run clean:notes:complete
   ```

2. **Review the markdown report:**
   - Open `reports/complete-note-cleaning-{timestamp}.md`
   - Verify all changes look correct

3. **Backup your database:**
   ```bash
   npm run db:backup
   ```
   - This creates a backup manifest required by the apply workflow safety check

4. **Then apply (choose one):**
   
   **Option A: Apply JS rules only (manual AI application):**
   ```bash
   npm run clean:notes:complete:apply
   # Then manually apply AI recommendations and re-check duplicates
   ```
   
   **Option B: Apply everything automatically (recommended):**
   ```bash
   npm run clean:notes:complete:full
   # This applies JS rules, AI recommendations, and re-checks duplicates
   ```

### 🤖 About AI Recommendations

The AI extraction step **always** runs in analysis mode - it generates recommendations but doesn't automatically apply them to the database. This is by design for safety.

### Known Bad Phrase Policy (now handled explicitly)

Rule-based cleanup now explicitly classifies recurring bad phrases:
- Delete as noise: `few`, `no name`, `two differences 1`, `limited time only`
- Extract obvious note noun: `coffee in your hand` -> `coffee`
- Extract conservative fallback for patisserie phrase variants: `...purrfect patisserie` -> `patisserie`
- Strip slug/ID suffixes: e.g. `lemon-adamo-8du3rk` -> `lemon` (when the part after the first hyphen contains digits or looks like an id)

Review these outcomes in dry-run reports before apply.

**To apply AI recommendations:**

1. **Review the AI recommendations:**
   - Check `reports/ai-note-extraction-{timestamp}.md`
   - Verify all extractions look correct

2. **Dry-run the application:**
   ```bash
   node scripts/apply-ai-recommendations.js reports/ai-note-extraction-{timestamp}.json --dry-run
   ```

3. **Backup database:**
   ```bash
   npm run db:backup
   ```

4. **Apply the recommendations:**
   ```bash
   node scripts/apply-ai-recommendations.js reports/ai-note-extraction-{timestamp}.json
   ```

**Or use the npm script:**
```bash
# Dry-run
npm run clean:notes:apply-ai reports/ai-note-extraction-{timestamp}.json --dry-run

# Apply (after backup!)
npm run clean:notes:apply-ai reports/ai-note-extraction-{timestamp}.json
```

---

## Workflow Examples

### Recommended: Full Automated Workflow

```bash
# Step 1: Preview changes (dry-run)
npm run clean:notes:complete

# Step 2: Review the report
# Open: reports/complete-note-cleaning-{timestamp}.md

# Step 3: Backup database
npm run db:backup

# Step 4: Apply everything automatically (JS rules + AI + duplicate cleanup)
npm run clean:notes:complete:full
```

This single command will:
- ✅ Apply all JavaScript rule-based changes
- ✅ Apply all AI recommendations
- ✅ Re-run duplicate detection to merge any duplicates created by AI

### Manual Step-by-Step Workflow

If you prefer more control:

```bash
# Step 1: Preview changes (dry-run)
npm run clean:notes:complete

# Step 2: Review the report
# Open: reports/complete-note-cleaning-{timestamp}.md

# Step 3: Backup database
npm run db:backup

# Step 4: Apply JavaScript rule-based changes only
npm run clean:notes:complete:apply

# Step 5: Review AI recommendations
# Open: reports/ai-note-extraction-{timestamp}.md

# Step 6: Apply AI recommendations (dry-run first)
node scripts/apply-ai-recommendations.js reports/ai-note-extraction-{timestamp}.json --dry-run

# Step 7: Apply AI recommendations (actual)
node scripts/apply-ai-recommendations.js reports/ai-note-extraction-{timestamp}.json

# Step 8: Re-check for duplicates created by AI
npm run clean:notes
```

---

## Individual Commands (Alternative)

If you want to run parts separately:

```bash
# JavaScript only (dry-run)
npm run clean:notes:dry-run

# JavaScript only (apply)
npm run clean:notes

# AI extraction only (always analysis)
python scripts/clean-notes-ai.py --input reports/ambiguous-notes.json --dry-run
```

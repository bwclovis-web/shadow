# Complete Note Cleaning Workflow

This workflow combines rule-based cleaning (JavaScript) with AI-powered extraction (LangGraph) to comprehensively clean perfume notes.

## Quick Start (One Command)

### Dry-Run (Preview Changes)

Run the complete workflow in dry-run mode to preview all changes:

```bash
npm run clean:notes:complete
```

This will:
1. ✅ Run JavaScript rule-based cleaning (dry-run)
2. ✅ Extract ambiguous notes automatically
3. ✅ Run AI extraction on ambiguous notes
4. ✅ Generate a comprehensive markdown report

**Output:** `reports/complete-note-cleaning-{timestamp}.md`

### Apply Changes (After Review)

⚠️ **IMPORTANT:** Always backup first and review the dry-run report!

```bash
# 1. Backup database
npm run db:backup

# 2. Review the dry-run report
# Open reports/complete-note-cleaning-{timestamp}.md

# 3. Apply changes
npm run clean:notes:complete:apply
```

The apply command now enforces:
- explicit apply confirmation via script flags
- a recent backup manifest check in `backups/`

This will:
1. ✅ Apply JavaScript rule-based cleaning (actual changes)
2. ✅ Extract ambiguous notes automatically
3. ✅ Run AI extraction (analysis only - generates recommendations)
4. ✅ Generate a comprehensive markdown report

**Note:** The AI extraction step only generates recommendations - you'll need to manually apply those or integrate them into the JavaScript script.

---

## Setup

**Recommended:** Use the project venv so the AI step uses a consistent Python and deps:

```bash
npm run clean:notes:ai:setup
```

This creates `.venv-ai` and installs `scripts/requirements-ai.txt` (LangGraph, langchain-openai). The full workflow (`npm run clean:notes:complete:full`) will use this venv automatically when present. LangGraph works with Python 3.10+ (no numpy build issues).

**Alternative:** Install into your current Python:

```bash
pip install -r scripts/requirements-ai.txt
```

2. **Set up OpenAI API key in `.env`:**

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini  # or gpt-4o for better accuracy
```

## Usage

### Step 1: Run JavaScript Dry-Run

First, run the JavaScript script in dry-run mode to generate a report:

```bash
node scripts/clean-notes.js --dry-run
```

This creates a markdown report in `reports/clean-notes-dry-run-{timestamp}.md`

### Step 2: Extract Ambiguous Notes

Use the helper script to automatically extract ambiguous notes from the dry-run report:

```bash
node scripts/extract-ambiguous-notes.js reports/clean-notes-dry-run-{timestamp}.md
```

This creates `reports/ambiguous-notes.json` with notes that might benefit from AI extraction.

**Or manually create a JSON file:**

```json
[
  {
    "name": "petites madeleines soaked in black tea"
  },
  {
    "name": "the fabulous vanilla bean orchid"
  }
]
```

### Step 3: Run AI Extraction (Dry-Run)

Run the AI extraction script in dry-run mode to see what it would extract:

```bash
python scripts/clean-notes-ai.py --input reports/ambiguous-notes.json --dry-run
```

This will:
- Process each ambiguous note using LangGraph
- Generate a markdown report: `reports/ai-note-extraction-{timestamp}.md`
- Generate a JSON file: `reports/ai-note-extraction-{timestamp}.json`
- **No changes are made to the database**

### Step 4: Review the Markdown Report

Open the generated markdown report to review:
- Which notes were successfully extracted
- Which notes are marked for deletion
- Which notes need manual review

### Step 5: Apply Changes (Optional)

After reviewing and approving the results, you can manually apply them or integrate them back into the JavaScript script.

### 3. Review Results

Results are saved to `reports/ai-note-extraction-{timestamp}.json`:

```json
[
  {
    "original_phrase": "petites madeleines soaked in black tea",
    "note_id": "note_id_1",
    "extracted_notes": ["black tea"],
    "should_delete": false,
    "reasoning": "Extracted 'black tea' from the phrase"
  }
]
```

### 4. Apply Results

You can then use the results to update the database or feed them back into the JavaScript script.

## Workflow

```
┌─────────────────────────────────┐
│  JavaScript Rule-Based Script   │
│  (handles clear cases)          │
└──────────────┬──────────────────┘
               │
               ▼
      ┌────────────────┐
      │ Ambiguous Notes│
      │   Identified   │
      └────────┬───────┘
               │
               ▼
┌──────────────────────────────┐
│  AI Extraction Script       │
│  (handles complex cases)     │
└──────────────┬───────────────┘
               │
               ▼
      ┌────────────────┐
      │  Results JSON  │
      └────────┬───────┘
               │
               ▼
      ┌────────────────┐
      │  Manual Review │
      │  & Apply       │
      └────────────────┘
```

## Cost Considerations

- **gpt-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **gpt-4o**: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens

For ~1000 ambiguous notes:
- **gpt-4o-mini**: ~$0.50-1.00
- **gpt-4o**: ~$5-10

## When to Use AI Extraction

Use AI extraction for:
- ✅ Complex phrases with multiple potential notes
- ✅ Ambiguous cases where rules fail
- ✅ Phrases with unusual structure
- ✅ Cases requiring context understanding

Use rule-based extraction for:
- ✅ Clear duplicates
- ✅ Slash-separated notes
- ✅ Simple stopword removal
- ✅ Obvious pattern matches
- ✅ Known bad/noise phrases (e.g., `few`, `no name`, `limited time only`)
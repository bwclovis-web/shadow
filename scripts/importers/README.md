# Perfume Data Importers

This directory contains scripts for importing perfume data from CSV files into the database.

## Usage

Each importer script is designed to import perfumes from a specific brand/house that lives in the `csv/` directory. Use these importers for non-noir uploads instead of the generic `import-csv-noir.ts` script.

The scripts:

1. Read CSV files from the `csv/` directory
2. Create or update the perfume house in the database
3. Import perfume records with their notes (open, heart, base)
4. Skip duplicates based on perfume slug

## Running an Importer

```bash
# Run from the project root
node scripts/importers/import-[brand-name].js
```

## Examples

```bash
# Import Abu Haashir perfumes
node scripts/importers/import-abuhaashir.js

# Import Blood Moon Botanica perfumes
node scripts/importers/import-blood-moon-botanica.js

# Import Jinx perfumes
node scripts/importers/import-jinx.js

# Import Ambrosia perfumes
node scripts/importers/import-ambrosia.js
```

## CSV File Format

Each importer expects a CSV file in the `csv/` directory with the following columns:

- `name` - Perfume name (required)
- `description` - Perfume description (optional)
- `image` - Image URL (optional)
- `openNotes` - Top notes as JSON array or comma-separated string (optional)
- `heartNotes` - Heart notes as JSON array or comma-separated string (optional)
- `baseNotes` - Base notes as JSON array or comma-separated string (optional)

## Notes

- All importers use Prisma to interact with the database
- Duplicate perfumes (same slug) are automatically skipped
- Notes are normalized to lowercase and stored in the `PerfumeNotes` table
- Each importer creates the perfume house if it doesn't exist
- For CSVs in `csv_noir/`, continue to use `npm run import:csv-noir`; for everything else in `csv/`, use or create a dedicated importer in this directory.

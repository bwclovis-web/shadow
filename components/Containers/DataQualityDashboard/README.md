# Data Quality Dashboard

A modular, refactored dashboard to monitor and track the quality of perfume data in the database.

## Features

- 📊 Visual representation of missing data and duplicates
- 🏷️ Breakdown by brand for quick identification of problem areas
- 📈 Historical tracking of progress over time
- 🔄 Real-time data refresh with debouncing
- 📥 CSV download and upload for bulk data management
- 🏠 Track perfume houses with missing information
- Integration with data analysis scripts

## Architecture

This component has been refactored from a 628-line monolithic component into a modular architecture with:

- **9 focused UI components** - each with a single responsibility
- **2 utility modules** - for chart data preparation and configuration
- **1 custom hook** - for data fetching with caching and debouncing
- **Main component** - just 50 lines orchestrating everything

### File Structure

```
DataQualityDashboard/
├── components/           # Presentational components
│   ├── AdminCSVControls.tsx      # CSV upload/download controls
│   ├── ChartVisualizations.tsx   # Bar charts for data issues
│   ├── DashboardContent.tsx      # Main content orchestrator
│   ├── ErrorDisplay.tsx          # Error message display
│   ├── HousesWithNoPerfumes.tsx  # Table of houses with no perfumes
│   ├── LoadingIndicator.tsx      # Loading spinner
│   ├── SummaryStats.tsx          # Summary statistics cards
│   ├── TimeframeSelector.tsx     # Week/Month/All selector
│   └── TrendChart.tsx            # Line chart for trends
├── hooks/                # Custom hooks
│   └── useFetchDataQualityStats.ts  # Data fetching with caching
├── utils/                # Utility functions
│   ├── chartConfig.ts             # Chart.js configuration
│   └── chartDataUtils.ts          # Data preparation functions
├── bones/                # Handler functions
│   └── csvHandlers/               # CSV download/upload logic
└── DataQualityDashboardRefactored.tsx  # Main component (50 lines)
```

## Usage

### Viewing the Dashboard

Access the dashboard at `/admin/data-quality`. This page is restricted to administrators.

### Features Available

#### Summary Statistics

- Total missing information count
- Total duplicate entries
- Missing house info count
- Houses with no perfumes

#### Data Visualizations

- Top 10 brands with missing data (bar chart)
- Top 10 brands with duplicates (bar chart)
- Top 10 houses missing info (bar chart with breakdown)
- Historical trends (line chart)

#### Admin Controls

- **Download CSV**: Export house information for editing
- **Upload CSV**: Bulk update house information
- **Refresh Data**: Manually trigger data refresh

#### Timeframe Selection

- Last Week
- Last Month (default)
- All Time

### Generating Reports

Reports can be generated manually by running the report generation script:

```bash
node scripts/generate_data_quality_reports.js
```

This will create markdown, CSV, and JSON reports in the `docs/reports` directory.

### Scheduled Reports

Set up a cron job to run the report generation script regularly:

```bash
# Run daily at midnight
0 0 * * * cd /path/to/project && node scripts/generate_data_quality_reports.js
```

## Implementation Details

### Main Component (`DataQualityDashboardRefactored.tsx`)

The main component is now just 50 lines and handles:

- Timeframe state management
- Data fetching via custom hook
- Upload completion callbacks
- Conditional rendering based on state

### Custom Hook (`useFetchDataQualityStats`)

Manages all data fetching logic:

- **Debouncing**: Prevents excessive API calls (5-second cooldown)
- **Cache busting**: Ensures fresh data on refresh
- **Error handling**: Catches and displays API errors
- **Force refresh**: Allows manual data regeneration

### Components

All components are pure and focused:

- **Presentational components**: Display data, no business logic
- **Reusable**: Can be used in other parts of the application
- **Testable**: Easy to unit test in isolation
- **Memoizable**: Can be optimized with React.memo if needed

### Data Flow

```
User Action → DataQualityDashboard
              ↓
        useFetchDataQualityStats (hook)
              ↓
        API: /api/data-quality
              ↓
        Chart Data Utils (prepare data)
              ↓
        DashboardContent → Child Components
```

### API Endpoint

The `/api/data-quality` endpoint:

- Accepts `timeframe` parameter (week/month/all)
- Accepts `force=true` for immediate regeneration
- Returns data quality statistics in JSON format
- Runs Python analysis scripts in the background

### CSV Handlers

Located in `bones/csvHandlers/`:

- **csvDownload**: Exports current house data
- **csvUploader**: Validates and imports CSV updates
- Uses CSRF tokens for security
- Triggers dashboard refresh after upload

## Dependencies

- **chart.js** (^4.x): Core charting library
- **react-chartjs-2** (^5.x): React wrapper for Chart.js
- **react** (^18.x): UI framework
- Python analysis scripts in the `scraper` directory

## Testing

See `DataQualityDashboard.test.tsx` for component tests.

### Test Coverage

- Unit tests for utility functions
- Component integration tests
- Hook behavior tests
- CSV upload/download tests

## Performance

The refactored architecture provides several performance benefits:

- **Debouncing**: Prevents API spam
- **Code splitting**: Components can be lazy-loaded
- **Memoization**: Individual components can be memoized
- **Smaller bundles**: Tree-shaking friendly

## Future Enhancements

- Add more chart types (pie charts, heatmaps)
- Export reports directly from dashboard
- Real-time updates via WebSocket
- Drill-down views for specific brands
- Data quality score calculation

## See Also

- `REFACTORING_SUMMARY.md` - Details about the refactoring process
- `DataQualityDashboard.test.tsx` - Test suite
- `/api/data-quality` - API endpoint documentation

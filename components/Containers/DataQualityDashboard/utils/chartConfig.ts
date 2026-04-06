export const createChartConfig = (titleText = "Data Quality Metrics") => ({
  responsive: true,
  plugins: {
    legend: {
      position: "top" as const,
    },
    title: {
      display: true,
      text: titleText,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
    },
  },
})

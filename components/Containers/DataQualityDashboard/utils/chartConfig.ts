export const createChartConfig = () => ({
  responsive: true,
  plugins: {
    legend: {
      position: "top" as const,
    },
    title: {
      display: true,
      text: "Data Quality Metrics",
    },
  },
  scales: {
    y: {
      beginAtZero: true,
    },
  },
})

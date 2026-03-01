"use client"

interface StatsJsonPageProps {
  title: string
  stats: unknown
  timestamp: string
}

export const StatsJsonPage = ({ title, stats, timestamp }: StatsJsonPageProps) => (
  <div className="min-h-screen bg-gray-50 p-8">
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-sm text-gray-500 mb-4">
        Last updated: {new Date(timestamp).toLocaleString()}
      </p>
      <pre className="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto text-sm font-mono">
        {JSON.stringify({ stats, timestamp }, null, 2)}
      </pre>
    </div>
  </div>
)

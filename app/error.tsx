"use client"

import { useEffect } from "react"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

const Error = ({ error, reset }: ErrorProps) => {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-4xl font-bold text-noir-gold mb-4">
        Something went wrong
      </h1>
      <p className="text-noir-gold-100 text-lg mb-8 max-w-md">
        An unexpected error occurred. Please try again, or contact us if the
        problem persists.
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 bg-noir-gold text-noir-black font-semibold rounded hover:bg-noir-gold/80 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}

export default Error

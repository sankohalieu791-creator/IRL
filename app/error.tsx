'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-red-400">Something went wrong</h1>
        <p className="text-zinc-400">An error occurred while loading the app.</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-cyan-500 text-black rounded-lg font-semibold"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
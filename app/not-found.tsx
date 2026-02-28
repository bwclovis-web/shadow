import Link from "next/link"

const NotFound = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
    <h1 className="text-8xl font-bold text-noir-gold mb-4">404</h1>
    <h2 className="text-2xl text-noir-gold-100 mb-4">Page not found</h2>
    <p className="text-noir-gold-100/70 text-lg mb-8 max-w-md">
      The page you&apos;re looking for doesn&apos;t exist or has been moved.
    </p>
    <Link
      href="/"
      className="px-6 py-3 bg-noir-gold text-noir-black font-semibold rounded hover:bg-noir-gold/80 transition-colors"
    >
      Back to home
    </Link>
  </div>
)

export default NotFound

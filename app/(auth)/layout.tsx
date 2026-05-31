import Image from "next/image"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex flex-col items-center min-h-dvh px-4 pb-24 md:pb-12 bg-noir-gold-500/30 justify-center">
      <Image
        src="/images/new/sign-in.webp"
        alt=""
        width={1200}
        height={800}
        fetchPriority="high"
        loading="eager"
        className="hero-image absolute inset-0 object-cover w-full h-full filter grayscale-[100%] sepia-[0.2]"
        sizes="100vw"
      />
      <div className="absolute inset-0 md:mask-radial-from-45% mask-radial-to-64%" />
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-0">
        {children}
      </div>
    </div>
  )
}

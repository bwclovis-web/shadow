import Image from "next/image"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-8 items-center justify-center min-h-screen px-4 bg-noir-gold-500/30">
      <Image
        src="/images/new/sign-in.webp"
        alt=""
        width={1200}
        height={800}
        fetchPriority="high"
        loading="eager"
        className="hero-image absolute object-cover w-full h-full filter grayscale-[100%] sepia-[0.2]"
        sizes="100vw"
      />
      <div className="absolute inset-0 md:mask-radial-from-45% mask-radial-to-64%" />
      <div className="relative w-full flex flex-col items-center justify-around gap-4 md:gap-8 mx-auto top-40">
        {children}
      </div>
    </div>
  )
}

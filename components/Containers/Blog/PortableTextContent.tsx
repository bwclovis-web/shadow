import { PortableText, type PortableTextComponents } from "@portabletext/react"
import type { PortableTextBlock } from "@portabletext/types"
import Image from "next/image"

import { urlForImage } from "@/lib/sanity/image"
import type { SanityImageAsset } from "@/lib/sanity/types"

const portableTextComponents: PortableTextComponents = {
  block: {
    h2: ({ children }) => (
      <h2 className="font-headline text-noir-gold text-2xl md:text-3xl mt-10 mb-4">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-headline text-noir-gold text-xl md:text-2xl mt-8 mb-3">{children}</h3>
    ),
    normal: ({ children }) => (
      <p className="text-noir-light text-lg leading-relaxed mb-4">{children}</p>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-noir-gold pl-4 my-6 text-noir-gold-100 italic">
        {children}
      </blockquote>
    ),
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold text-noir-gold">{children}</strong>,
    em: ({ children }) => <em>{children}</em>,
    link: ({ children, value }) => {
      const href = typeof value?.href === "string" ? value.href : "#"
      const external = href.startsWith("http")
      return (
        <a
          href={href}
          className="text-blue-200 underline hover:text-noir-gold"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {children}
        </a>
      )
    },
  },
  types: {
    image: ({ value }: { value?: SanityImageAsset }) => {
      if (!value?.asset) return null
      const src = urlForImage(value).width(1200).auto("format").url()
      if (!src) return null
      return (
        <figure className="my-8">
          <Image
            src={src}
            alt={value.alt ?? ""}
            width={1200}
            height={800}
            className="w-full h-auto rounded-lg border-2 border-noir-gold/40"
            sizes="(min-width: 1024px) 800px, 100vw"
          />
          {value.alt ? (
            <figcaption className="mt-2 text-sm text-noir-gray text-center">{value.alt}</figcaption>
          ) : null}
        </figure>
      )
    },
  },
}

type PortableTextContentProps = {
  value: PortableTextBlock[]
}

export const PortableTextContent = ({ value }: PortableTextContentProps) => (
  <div className="article-body max-w-3xl mx-auto">
    <PortableText value={value} components={portableTextComponents} />
  </div>
)

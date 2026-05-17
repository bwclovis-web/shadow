import type { PortableTextBlock } from "@portabletext/types"

export type SanityImageAsset = {
  _type: "image"
  asset?: { _ref: string; _type: "reference" }
  alt?: string
}

export type ArticleListItem = {
  _id: string
  title: string
  slug: string
  publishedAt: string
  author: string
  excerpt?: string | null
  coverImage?: SanityImageAsset | null
  tags?: string[] | null
}

export type ArticleDetail = ArticleListItem & {
  body: PortableTextBlock[]
  perfumeRefs?: string[] | null
  houseRefs?: string[] | null
}

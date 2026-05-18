const articleFields = `
  _id,
  title,
  "slug": slug.current,
  publishedAt,
  author,
  excerpt,
  coverImage,
  tags
`

export const articlesIndexQuery = `
  *[_type == "article" && defined(slug.current) && publishedAt <= now()]
  | order(publishedAt desc) {
    ${articleFields}
  }
`

export const articlesIndexWithRefsQuery = `
  *[_type == "article" && defined(slug.current) && publishedAt <= now()]
  | order(publishedAt desc) {
    ${articleFields},
    perfumeRefs,
    houseRefs
  }
`

export const articleBySlugQuery = `
  *[_type == "article" && slug.current == $slug && publishedAt <= now()][0] {
    ${articleFields},
    body,
    perfumeRefs,
    houseRefs
  }
`

export const articlesByPerfumeSlugQuery = `
  *[_type == "article" && $slug in perfumeRefs && publishedAt <= now()]
  | order(publishedAt desc)[0...6] {
    ${articleFields}
  }
`

export const articlesByHouseSlugQuery = `
  *[_type == "article" && $slug in houseRefs && publishedAt <= now()]
  | order(publishedAt desc)[0...6] {
    ${articleFields}
  }
`

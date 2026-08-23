const articleFields = `
  _id,
  title,
  "slug": slug.current,
  publishedAt,
  author,
  excerpt,
  featured,
  language,
  coverImage,
  tags
`

/** Matches locale, or legacy docs with no language when asking for English. */
const languageFilter = `(
  language == $language
  || (!defined(language) && $language == "en")
)`

export const articlesIndexQuery = `
  *[_type == "article" && defined(slug.current) && publishedAt <= now() && ${languageFilter}]
  | order(publishedAt desc) {
    ${articleFields}
  }
`

export const articlesIndexWithRefsQuery = `
  *[_type == "article" && defined(slug.current) && publishedAt <= now() && ${languageFilter}]
  | order(publishedAt desc) {
    ${articleFields},
    perfumeRefs,
    houseRefs
  }
`

/** All published articles (sitemap / static params). */
export const articlesIndexAllLanguagesQuery = `
  *[_type == "article" && defined(slug.current) && publishedAt <= now()]
  | order(publishedAt desc) {
    ${articleFields}
  }
`

export const articleBySlugQuery = `
  *[_type == "article" && slug.current == $slug && publishedAt <= now() && ${languageFilter}][0] {
    ${articleFields},
    body,
    perfumeRefs,
    houseRefs
  }
`

export const articlesByPerfumeSlugQuery = `
  *[_type == "article" && $slug in perfumeRefs && publishedAt <= now() && ${languageFilter}]
  | order(publishedAt desc)[0...6] {
    ${articleFields}
  }
`

export const articlesByHouseSlugQuery = `
  *[_type == "article" && $slug in houseRefs && publishedAt <= now() && ${languageFilter}]
  | order(publishedAt desc)[0...6] {
    ${articleFields}
  }
`

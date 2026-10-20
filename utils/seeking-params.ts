import {
  DEFAULT_SEEKING_VIEW,
  DEFAULT_SEEKING_VISIBILITY,
  normalizeSeekingSearch,
  SEEKING_VIEWS,
  SEEKING_VISIBILITY_FILTERS,
  type SeekingView,
  type SeekingVisibilityFilter,
} from "@/utils/seeking-constants"

export const SEEKING_QUERY = {
  q: "q",
  visibility: "vis",
  view: "view",
  availablePage: "pgAvail",
  seekingPage: "pgSeek",
  /** Public shared Seeking list page. */
  publicPage: "pg",
} as const

export type SeekingSearchParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

/** URL + navigation state for the owned Seeking page. */
export type SeekingOwnedUrlState = {
  search: string
  visibility: SeekingVisibilityFilter
  view: SeekingView
  availablePage: number
  seekingPage: number
}

/**
 * Cache / identity key for data-affecting Seeking params (excludes `view`).
 * Include this in any client query key so a grid/list toggle does not share
 * the wrong page payload, and so search/visibility changes invalidate cleanly.
 */
export const seekingDataQueryKeyParts = (
  state: Pick<
    SeekingOwnedUrlState,
    "search" | "visibility" | "availablePage" | "seekingPage"
  >
): readonly [string, SeekingVisibilityFilter, number, number] => [
  state.search,
  state.visibility,
  state.availablePage,
  state.seekingPage,
]

export const seekingOwnedQueryKey = (
  ownerUserId: string,
  state: SeekingOwnedUrlState
) =>
  [
    "seeking",
    "owned",
    ownerUserId,
    ...seekingDataQueryKeyParts(state),
    state.view,
  ] as const

const readParam = (params: SeekingSearchParams, key: string): string => {
  if (params instanceof URLSearchParams) return params.get(key) ?? ""
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value) ?? ""
}

const pickOne = <T extends string>(
  raw: string,
  allowed: readonly T[],
  fallback: T
): T => ((allowed as readonly string[]).includes(raw) ? (raw as T) : fallback)

export const parseSeekingPage = (raw: string): number => {
  const page = Number.parseInt(raw, 10)
  return Number.isFinite(page) && page > 1 ? page : 1
}

export const parseSeekingOwnedState = (
  params: SeekingSearchParams
): SeekingOwnedUrlState => ({
  search: normalizeSeekingSearch(readParam(params, SEEKING_QUERY.q)),
  visibility: pickOne(
    readParam(params, SEEKING_QUERY.visibility),
    SEEKING_VISIBILITY_FILTERS,
    DEFAULT_SEEKING_VISIBILITY
  ),
  view: pickOne(
    readParam(params, SEEKING_QUERY.view),
    SEEKING_VIEWS,
    DEFAULT_SEEKING_VIEW
  ),
  availablePage: parseSeekingPage(readParam(params, SEEKING_QUERY.availablePage)),
  seekingPage: parseSeekingPage(readParam(params, SEEKING_QUERY.seekingPage)),
})

const withQuery = (path: string, params: URLSearchParams): string => {
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

/**
 * Build owned Seeking href. Defaults omitted.
 * Callers that change `search` or `visibility` should pass pages as 1
 * (see {@link withSeekingFilterChange}).
 */
export const buildSeekingOwnedHref = (
  path: string,
  state: SeekingOwnedUrlState
): string => {
  const params = new URLSearchParams()
  if (state.search) params.set(SEEKING_QUERY.q, state.search)
  if (state.visibility !== DEFAULT_SEEKING_VISIBILITY) {
    params.set(SEEKING_QUERY.visibility, state.visibility)
  }
  if (state.view !== DEFAULT_SEEKING_VIEW) {
    params.set(SEEKING_QUERY.view, state.view)
  }
  if (state.availablePage > 1) {
    params.set(SEEKING_QUERY.availablePage, String(state.availablePage))
  }
  if (state.seekingPage > 1) {
    params.set(SEEKING_QUERY.seekingPage, String(state.seekingPage))
  }
  return withQuery(path, params)
}

/** Search or visibility change: reset both group pages to 1. */
export const withSeekingFilterChange = (
  state: SeekingOwnedUrlState,
  patch: Partial<Pick<SeekingOwnedUrlState, "search" | "visibility">>
): SeekingOwnedUrlState => ({
  ...state,
  ...patch,
  availablePage: 1,
  seekingPage: 1,
})

/** View-only change: preserve both group pages. */
export const withSeekingViewChange = (
  state: SeekingOwnedUrlState,
  view: SeekingView
): SeekingOwnedUrlState => ({
  ...state,
  view,
})

export const withSeekingAvailablePage = (
  state: SeekingOwnedUrlState,
  availablePage: number
): SeekingOwnedUrlState => ({
  ...state,
  availablePage: Math.max(1, availablePage),
})

export const withSeekingSeekingPage = (
  state: SeekingOwnedUrlState,
  seekingPage: number
): SeekingOwnedUrlState => ({
  ...state,
  seekingPage: Math.max(1, seekingPage),
})

/** URL + navigation state for the public shared Seeking list. */
export type SeekingPublicUrlState = {
  page: number
}

export const parseSeekingPublicState = (
  params: SeekingSearchParams
): SeekingPublicUrlState => ({
  page: parseSeekingPage(readParam(params, SEEKING_QUERY.publicPage)),
})

export const buildSeekingPublicHref = (
  path: string,
  state: SeekingPublicUrlState
): string => {
  const params = new URLSearchParams()
  if (state.page > 1) {
    params.set(SEEKING_QUERY.publicPage, String(state.page))
  }
  return withQuery(path, params)
}

export const withSeekingPublicPage = (
  state: SeekingPublicUrlState,
  page: number
): SeekingPublicUrlState => ({
  ...state,
  page: Math.max(1, page),
})

export const seekingPublicQueryKey = (
  ownerUserId: string,
  state: SeekingPublicUrlState
) => ["seeking", "public", ownerUserId, state.page] as const

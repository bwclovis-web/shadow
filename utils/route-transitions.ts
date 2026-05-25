export type RouteTransitionVariant =
  | "default"
  | "list-to-detail"
  | "detail-to-list"

const ROUTE_TRANSITION_ATTRIBUTE = "data-route-transition"
const ROUTE_TRANSITION_RESET_MS = 1200

let resetTimerId: number | null = null

const DETAIL_ROUTE_PATTERNS = [/^\/perfume\/[^/]+$/, /^\/houses\/[^/]+$/]
const LIST_ROUTE_PATTERNS = [/^\/the-archive(?:\/[^/]+)?$/, /^\/houses$/]

const matchesAny = (pathname: string, patterns: RegExp[]): boolean =>
  patterns.some(pattern => pattern.test(pathname))

export const inferRouteTransitionVariant = (
  fromPathname: string,
  toPathname: string
): RouteTransitionVariant => {
  if (
    matchesAny(fromPathname, LIST_ROUTE_PATTERNS) &&
    matchesAny(toPathname, DETAIL_ROUTE_PATTERNS)
  ) {
    return "list-to-detail"
  }

  if (
    matchesAny(fromPathname, DETAIL_ROUTE_PATTERNS) &&
    matchesAny(toPathname, LIST_ROUTE_PATTERNS)
  ) {
    return "detail-to-list"
  }

  return "default"
}

export const setRouteTransitionVariant = (
  variant: RouteTransitionVariant
): void => {
  if (typeof document === "undefined") {
    return
  }

  const root = document.documentElement

  if (variant === "default") {
    root.removeAttribute(ROUTE_TRANSITION_ATTRIBUTE)
    return
  }

  root.setAttribute(ROUTE_TRANSITION_ATTRIBUTE, variant)

  if (resetTimerId !== null) {
    window.clearTimeout(resetTimerId)
  }

  resetTimerId = window.setTimeout(() => {
    if (root.getAttribute(ROUTE_TRANSITION_ATTRIBUTE) === variant) {
      root.removeAttribute(ROUTE_TRANSITION_ATTRIBUTE)
    }
    resetTimerId = null
  }, ROUTE_TRANSITION_RESET_MS)
}

export const prepareRouteTransition = (
  toPathname: string,
  variant?: RouteTransitionVariant
): void => {
  if (typeof window === "undefined") {
    return
  }

  const nextVariant =
    variant ?? inferRouteTransitionVariant(window.location.pathname, toPathname)

  setRouteTransitionVariant(nextVariant)
}

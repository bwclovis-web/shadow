import {
  type RefObject,
  useEffect,
  useLayoutEffect,
} from "react"

const TABBABLE_SELECTOR = [
  "a[href]:not([tabindex='-1'])",
  "button:not([disabled]):not([tabindex='-1'])",
  "input:not([disabled]):not([type='hidden']):not([tabindex='-1'])",
  "select:not([disabled]):not([tabindex='-1'])",
  "textarea:not([disabled]):not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']:not([tabindex='-1'])",
].join(",")

const isAriaHidden = (el: HTMLElement) =>
  el.closest("[aria-hidden='true']") !== null

const isFocusableSurface = (el: HTMLElement) => {
  const style = window.getComputedStyle(el)
  if (style.visibility === "hidden" || style.display === "none") {
    return false
  }
  return true
}

/** Portaled typeahead listboxes mark themselves so traps can include them. */
export const FOCUS_TRAP_PORTAL_ATTR = "data-focus-trap-portal"

/** Returns focusable descendants of `container` in tab order (document order). */
export const getTabbableElements = (container: HTMLElement): HTMLElement[] => {
  const nodes = container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)
  return Array.from(nodes).filter(el => {
    if (!container.contains(el)) {
      return false
    }
    if (el.hasAttribute("disabled")) {
      return false
    }
    if (isAriaHidden(el)) {
      return false
    }
    return isFocusableSurface(el)
  })
}

const getOpenFocusTrapPortals = (): HTMLElement[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>(`[${FOCUS_TRAP_PORTAL_ATTR}]`)
  )

const getTrapTabbables = (container: HTMLElement): HTMLElement[] => {
  const portals = getOpenFocusTrapPortals()
  return [container, ...portals].flatMap(root => getTabbableElements(root))
}

const isExpandedCombobox = (el: HTMLElement | null): boolean =>
  Boolean(
    el &&
      el.getAttribute("role") === "combobox" &&
      el.getAttribute("aria-expanded") === "true"
  )

const isInsideFocusTrapPortal = (el: HTMLElement | null): boolean =>
  Boolean(el?.closest(`[${FOCUS_TRAP_PORTAL_ATTR}]`))

export type UseFocusTrapOptions = {
  active: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  onEscape?: () => void
}

/**
 * Keeps keyboard focus inside `containerRef` while `active`, optionally moves
 * initial focus when activated, and calls `onEscape` on Escape.
 * Includes open `[data-focus-trap-portal]` nodes (e.g. typeahead listboxes).
 * Reusable for Modal and any other overlay.
 */
export const useFocusTrap = (
  containerRef: RefObject<HTMLElement | null>,
  { active, initialFocusRef, onEscape }: UseFocusTrapOptions
) => {
  useLayoutEffect(() => {
    if (!active || !containerRef.current) {
      return
    }

    const container = containerRef.current
    const initial =
      initialFocusRef?.current && container.contains(initialFocusRef.current)
        ? initialFocusRef.current
        : getTabbableElements(container)[0]

    initial?.focus()
  }, [active, containerRef, initialFocusRef])

  useEffect(() => {
    if (!active) {
      return
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null

      if (e.key === "Escape" && onEscape) {
        // Let open combobox / portaled listbox dismiss before closing the host.
        if (isExpandedCombobox(activeEl) || isInsideFocusTrapPortal(activeEl)) {
          return
        }
        e.preventDefault()
        e.stopPropagation()
        onEscape()
        return
      }

      if (e.key !== "Tab" || !containerRef.current) {
        return
      }

      const container = containerRef.current
      const tabbables = getTrapTabbables(container)
      if (tabbables.length === 0) {
        return
      }

      const first = tabbables[0]!
      const last = tabbables[tabbables.length - 1]!

      if (!e.shiftKey && activeEl === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && activeEl === first) {
        e.preventDefault()
        last.focus()
      } else if (
        activeEl &&
        !container.contains(activeEl) &&
        !isInsideFocusTrapPortal(activeEl)
      ) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [active, containerRef, onEscape])
}

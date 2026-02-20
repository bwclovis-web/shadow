import { renderHook, waitFor } from "@testing-library/react"
import { act } from "react"
import { describe, expect, it, vi } from "vitest"

import {
  usePaginatedNavigation,
  usePreserveScrollPosition,
} from "./usePaginatedNavigation"

const noopBuildPath = (page: number) => `/path?page=${page}`

describe("usePaginatedNavigation", () => {
  it("navigates to the next page when available", () => {
    const navigate = vi.fn()
    const buildPath = vi.fn(noopBuildPath)

    const { result } = renderHook(props => usePaginatedNavigation(props), {
      initialProps: {
        currentPage: 1,
        hasNextPage: true,
        hasPrevPage: false,
        navigate,
        buildPath,
        navigateOptions: { replace: false },
      },
    })

    act(() => {
      result.current.handleNextPage()
    })

    expect(buildPath).toHaveBeenCalledWith(2)
    expect(navigate).toHaveBeenCalledWith("/path?page=2", { replace: false })
  })

  it("does not navigate past the last page when hasNextPage is false", () => {
    const navigate = vi.fn()

    const { result } = renderHook(props => usePaginatedNavigation(props), {
      initialProps: {
        currentPage: 3,
        hasNextPage: false,
        hasPrevPage: true,
        navigate,
        buildPath: noopBuildPath,
      },
    })

    act(() => {
      result.current.handleNextPage()
    })

    expect(navigate).not.toHaveBeenCalled()
  })

  it("clamps the target page to one or greater", () => {
    const navigate = vi.fn()

    const { result } = renderHook(props => usePaginatedNavigation(props), {
      initialProps: {
        currentPage: 1,
        hasNextPage: true,
        hasPrevPage: true,
        navigate,
        buildPath: noopBuildPath,
      },
    })

    act(() => {
      result.current.handlePrevPage()
    })

    expect(navigate).toHaveBeenCalledWith("/path?page=1", {
      preventScrollReset: true,
    })
  })
})

describe("usePreserveScrollPosition", () => {
  it("restores scroll position when loading is true", async () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 150,
    })

    const { rerender } = renderHook(loading => usePreserveScrollPosition(loading))

    rerender(true)

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(0, 150)
    })

    scrollToSpy.mockRestore()
  })
})


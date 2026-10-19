import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useDebouncedSearch } from "@/hooks/useDebouncedSearch"

describe("useDebouncedSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("debounces and returns results", async () => {
    const searchFn = vi.fn(async (q: string) => [{ id: q, name: q }])
    const { result } = renderHook(() =>
      useDebouncedSearch(searchFn, { delay: 300, minLength: 2 })
    )

    act(() => {
      result.current.setSearchValue("ro")
    })

    expect(searchFn).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(searchFn).toHaveBeenCalledWith("ro")
    expect(result.current.results).toEqual([{ id: "ro", name: "ro" }])
  })

  it("ignores stale responses when the query changes quickly", async () => {
    let resolveSlow: ((value: { id: string; name: string }[]) => void) | null =
      null
    const searchFn = vi.fn((q: string) => {
      if (q === "ab") {
        return new Promise<{ id: string; name: string }[]>(resolve => {
          resolveSlow = resolve
        })
      }
      return Promise.resolve([{ id: q, name: q }])
    })

    const { result } = renderHook(() =>
      useDebouncedSearch(searchFn, { delay: 100, minLength: 2 })
    )

    act(() => {
      result.current.setSearchValue("ab")
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    act(() => {
      result.current.setSearchValue("abc")
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    expect(result.current.results).toEqual([{ id: "abc", name: "abc" }])

    await act(async () => {
      resolveSlow?.([{ id: "ab", name: "stale" }])
    })

    expect(result.current.results).toEqual([{ id: "abc", name: "abc" }])
  })
})

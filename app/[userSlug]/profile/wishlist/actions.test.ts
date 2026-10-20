import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { revalidatePath } from "next/cache"

import { revalidateWishlistPage } from "./actions"

describe("revalidateWishlistPage", () => {
  beforeEach(() => {
    vi.mocked(revalidatePath).mockReset()
  })

  it("invalidates owned Seeking and the public shared list", async () => {
    await revalidateWishlistPage("collector-slug", "user-42")

    expect(revalidatePath).toHaveBeenCalledWith("/collector-slug/profile/wishlist")
    expect(revalidatePath).toHaveBeenCalledWith("/wishlist/user-42")
    expect(revalidatePath).toHaveBeenCalledTimes(2)
  })
})

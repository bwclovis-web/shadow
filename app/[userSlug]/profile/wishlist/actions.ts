"use server"

import { revalidatePath } from "next/cache"

/**
 * Revalidates owned Seeking and the public shared list so visibility /
 * remove / preference changes refresh both surfaces.
 */
export const revalidateWishlistPage = async (
  userSlug: string,
  userId: string
): Promise<void> => {
  revalidatePath(`/${userSlug}/profile/wishlist`)
  revalidatePath(`/wishlist/${userId}`)
}

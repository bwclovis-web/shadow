"use server"

import { revalidatePath } from "next/cache"

/**
 * Revalidates the wishlist page so server components refetch fresh data.
 * Call after wishlist mutations (e.g. remove item) so the page shows the updated list.
 */
export async function revalidateWishlistPage(userSlug: string): Promise<void> {
  revalidatePath(`/${userSlug}/profile/wishlist`)
}

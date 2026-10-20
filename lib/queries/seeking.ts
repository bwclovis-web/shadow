import type {
  SeekingOwnedUrlState,
  SeekingPublicUrlState,
} from "@/utils/seeking-params"
import {
  seekingDataQueryKeyParts,
  seekingOwnedQueryKey,
  seekingPublicQueryKey,
} from "@/utils/seeking-params"

/**
 * TanStack Query key factory for Seeking.
 * Owned page data is server-rendered today; keys exist so any future client
 * fetch (or invalidation after mutations) includes every data-affecting param
 * and never confuses view-only toggles with a different page payload.
 */
export const seekingQueryKeys = {
  all: ["seeking"] as const,
  owned: (ownerUserId: string, state: SeekingOwnedUrlState) =>
    seekingOwnedQueryKey(ownerUserId, state),
  ownedData: (
    ownerUserId: string,
    state: Pick<
      SeekingOwnedUrlState,
      "search" | "visibility" | "availablePage" | "seekingPage"
    >
  ) =>
    ["seeking", "owned-data", ownerUserId, ...seekingDataQueryKeyParts(state)] as const,
  public: (ownerUserId: string, state: SeekingPublicUrlState) =>
    seekingPublicQueryKey(ownerUserId, state),
}

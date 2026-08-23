/** Shared E2E credentials — used by seed script and Playwright fixtures. */
export const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? "E2eTestPass1!"

export const E2E_USERS = {
  free: {
    email: "e2e-free@example.com",
    username: "e2e_free",
  },
  premium: {
    email: "e2e-premium@example.com",
    username: "e2e_premium",
  },
  admin: {
    email: "e2e-admin@example.com",
    username: "e2e_admin",
  },
} as const

export const E2E_PERFUME_SLUGS = ["e2e-amber-smoke", "e2e-citrus-breeze"] as const
export const E2E_HOUSE_SLUG = "e2e-test-house"

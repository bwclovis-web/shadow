import { describe, expect, it } from "vitest"

import type { UserWithCounts } from "@/models/admin.server"

import { filterUsers, getUserDisplayName } from "./userAdminFilters"

const baseUser = (overrides: Partial<UserWithCounts>): UserWithCounts => ({
  id: "u1",
  email: "alice@example.com",
  firstName: "Alice",
  lastName: "Smith",
  username: "alice",
  role: "user",
  strikeCount: 0,
  isBanned: false,
  twoFactorEnabledAt: null,
  createdAt: new Date(),
  _count: {
    UserPerfume: 0,
    UserPerfumeRating: 0,
    UserPerfumeSeasonVote: 0,
    UserPerfumeReview: 0,
    UserPerfumeWishlist: 0,
    userPerfumeComments: 0,
    UserAlert: 0,
    SecurityAuditLog: 0,
  },
  ...overrides,
})

describe("userAdminFilters", () => {
  const users = [
    baseUser({ id: "u1", email: "alice@example.com", role: "user", strikeCount: 0 }),
    baseUser({
      id: "u2",
      email: "bob@example.com",
      firstName: "Bob",
      lastName: null,
      username: "bob",
      role: "editor",
      strikeCount: 1,
    }),
    baseUser({
      id: "u3",
      email: "carol@example.com",
      firstName: null,
      lastName: null,
      username: "carol",
      role: "admin",
      strikeCount: 3,
      isBanned: true,
    }),
  ]

  it("getUserDisplayName prefers full name", () => {
    expect(getUserDisplayName(users[0])).toBe("Alice Smith")
    expect(getUserDisplayName(users[1])).toBe("Bob")
  })

  it("filters by search query across display name, email, username", () => {
    const result = filterUsers(users, "bob", "all", "all")
    expect(result.map((u) => u.id)).toEqual(["u2"])
  })

  it("filters by role and strike filters together", () => {
    const banned = filterUsers(users, "", "all", "banned")
    expect(banned.map((u) => u.id)).toEqual(["u3"])

    const oneStrike = filterUsers(users, "", "all", "1")
    expect(oneStrike.map((u) => u.id)).toEqual(["u2"])
  })
})

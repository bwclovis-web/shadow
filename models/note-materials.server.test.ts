import { beforeEach, describe, expect, it, vi } from "vitest"

const { findManyMocks } = vi.hoisted(() => ({
  findManyMocks: {
    noteMaterial: vi.fn(),
    noteMaterialAlias: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    noteMaterial: { findMany: findManyMocks.noteMaterial },
    noteMaterialAlias: { findMany: findManyMocks.noteMaterialAlias },
  },
}))

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => async () => {
    const result = await fn()
    return JSON.parse(JSON.stringify(result)) as unknown
  },
}))

import { getNoteMaterialIndex } from "./note-materials.server"

describe("getNoteMaterialIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findManyMocks.noteMaterial.mockResolvedValue([
      { id: "mat-bergamot", slug: "bergamot", name: "Bergamot" },
    ])
    findManyMocks.noteMaterialAlias.mockResolvedValue([
      { materialId: "mat-bergamot", noteId: "note-italian-berg" },
    ])
  })

  it("rebuilds Maps after unstable_cache JSON round-trip", async () => {
    const index = await getNoteMaterialIndex()

    expect(index.materialIdByNoteId.get("note-italian-berg")).toBe("mat-bergamot")
    expect(index.materialBySlug.get("bergamot")?.id).toBe("mat-bergamot")
    expect(index.noteIdsByMaterialId.get("mat-bergamot")?.has("note-italian-berg")).toBe(
      true
    )
  })
})

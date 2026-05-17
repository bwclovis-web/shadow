import type { StructureResolver } from "sanity/structure"

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Behind the Bottle")
    .items([
      S.listItem()
        .title("Articles")
        .schemaType("article")
        .child(S.documentTypeList("article").title("Articles").defaultOrdering([{ field: "publishedAt", direction: "desc" }])),
    ])

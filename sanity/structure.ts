import type { StructureResolver } from "sanity/structure"

import { JOURNAL_LOCALE_LABELS, JOURNAL_LOCALES } from "../lib/sanity/locales"

export const structure: StructureResolver = S =>
  S.list()
    .title("Behind the Bottle")
    .items([
      S.listItem()
        .title("Articles")
        .child(
          S.list()
            .title("Articles")
            .items([
              S.listItem()
                .title("All languages")
                .child(
                  S.documentTypeList("article")
                    .title("All articles")
                    .defaultOrdering([{ field: "publishedAt", direction: "desc" }])
                ),
              S.divider(),
              ...JOURNAL_LOCALES.map(locale =>
                S.listItem()
                  .title(JOURNAL_LOCALE_LABELS[locale])
                  .child(
                    S.documentTypeList("article")
                      .title(JOURNAL_LOCALE_LABELS[locale])
                      .filter('_type == "article" && language == $language')
                      .params({ language: locale })
                      .defaultOrdering([{ field: "publishedAt", direction: "desc" }])
                      .initialValueTemplates([
                        S.initialValueTemplateItem(`article-${locale}`),
                      ])
                  )
              ),
            ])
        ),
    ])

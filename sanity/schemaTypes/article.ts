import { defineArrayMember, defineField, defineType } from "sanity"

import {
  JOURNAL_LOCALE_LABELS,
  JOURNAL_LOCALES,
  type JournalLocale,
} from "../../lib/sanity/locales"

export const article = defineType({
  name: "article",
  title: "Article",
  type: "document",
  fields: [
    defineField({
      name: "language",
      title: "Language",
      type: "string",
      description:
        "Create one article document per language. Prefer the same slug across translations of the same story.",
      options: {
        list: JOURNAL_LOCALES.map(id => ({
          title: JOURNAL_LOCALE_LABELS[id],
          value: id,
        })),
        layout: "radio",
      },
      initialValue: "en",
      validation: rule => rule.required(),
    }),
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: rule => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: rule => rule.required(),
      description:
        "URL path under /journal/[slug]. Reuse the same slug for each language version of a story.",
    }),
    defineField({
      name: "publishedAt",
      title: "Published at",
      type: "datetime",
      validation: rule => rule.required(),
    }),
    defineField({
      name: "author",
      title: "Author",
      type: "string",
      validation: rule => rule.required(),
    }),
    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "featured",
      title: "Featured",
      type: "boolean",
      description:
        "Show this article in the featured slot on /journal for this language. Prefer only one featured article per language.",
      initialValue: false,
    }),
    defineField({
      name: "coverImage",
      title: "Cover image",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt text",
          type: "string",
        }),
      ],
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      of: [
        defineArrayMember({
          type: "block",
          styles: [
            { title: "Normal", value: "normal" },
            { title: "H2", value: "h2" },
            { title: "H3", value: "h3" },
            { title: "Quote", value: "blockquote" },
          ],
          marks: {
            decorators: [
              { title: "Strong", value: "strong" },
              { title: "Emphasis", value: "em" },
            ],
            annotations: [
              {
                name: "link",
                type: "object",
                title: "Link",
                fields: [
                  defineField({
                    name: "href",
                    type: "url",
                    title: "URL",
                    validation: rule =>
                      rule.uri({ allowRelative: true, scheme: ["http", "https", "mailto"] }),
                  }),
                ],
              },
            ],
          },
        }),
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alt text",
              type: "string",
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: "perfumeRefs",
      title: "Perfume slugs",
      description: "Slugs from /perfume/[slug] for cross-linking on the site.",
      type: "array",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "houseRefs",
      title: "House slugs",
      description: "Slugs from /houses/[slug] for cross-linking on the site.",
      type: "array",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
    }),
  ],
  orderings: [
    {
      title: "Published date, newest",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
  preview: {
    select: { title: "title", author: "author", language: "language", media: "coverImage" },
    prepare: ({ title, author, language, media }) => {
      const langLabel =
        language && language in JOURNAL_LOCALE_LABELS
          ? JOURNAL_LOCALE_LABELS[language as JournalLocale]
          : language || "English"
      return {
        title,
        subtitle: [langLabel, author].filter(Boolean).join(" · "),
        media,
      }
    },
  },
})

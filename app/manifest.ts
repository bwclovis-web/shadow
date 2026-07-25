import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "perfumer's hollow",
    short_name: "perfumer's hollow",
    description:
      "Perfume archive, fragrance notes, houses, and a community trader exchange.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d0d",
    theme_color: "#c9a227",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}

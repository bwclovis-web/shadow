import { ImageResponse } from "next/og"

import { getPerfumeBySlug } from "@/models/perfume.server"

export const alt = "Perfume on perfumer's hollow"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

type Props = {
  params: Promise<{ perfumeSlug: string }>
}

const noirGradient = "linear-gradient(135deg, #0d0d0d 0%, #1a1508 50%, #0d0d0d 100%)"
const brandLabel = "perfumer's hollow"

const fallbackImage = (title: string, subtitle?: string) =>
  new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 64,
        background: noirGradient,
        color: "#c9a227",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ fontSize: 28, opacity: 0.85, marginBottom: 16 }}>{brandLabel}</div>
      <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>{title}</div>
      {subtitle ? (
        <div style={{ fontSize: 32, marginTop: 20, color: "#e8d5a3" }}>{subtitle}</div>
      ) : null}
    </div>,
    { ...size }
  )

const PerfumeOpenGraphImage = async ({ params }: Props) => {
  const { perfumeSlug } = await params
  const perfume = await getPerfumeBySlug(perfumeSlug)

  if (!perfume) {
    return fallbackImage("Perfume not found")
  }

  const houseName = perfume.perfumeHouse?.name
  const hasBottle = Boolean(perfume.image?.startsWith("https://"))

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: noirGradient,
        color: "#c9a227",
        fontFamily: "Georgia, serif",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 64,
          paddingRight: hasBottle ? 32 : 64,
        }}
      >
        <div style={{ fontSize: 26, opacity: 0.85, marginBottom: 20 }}>{brandLabel}</div>
        <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.15, maxWidth: 720 }}>
          {perfume.name}
        </div>
        {houseName ? (
          <div style={{ fontSize: 30, marginTop: 20, color: "#e8d5a3" }}>{houseName}</div>
        ) : null}
      </div>
      {hasBottle && perfume.image ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 420,
            padding: 48,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={perfume.image}
            alt=""
            width={320}
            height={480}
            style={{
              objectFit: "contain",
              maxHeight: "100%",
              filter: "drop-shadow(0 12px 32px rgba(0,0,0,0.6))",
            }}
          />
        </div>
      ) : null}
    </div>,
    { ...size }
  )
}

export default PerfumeOpenGraphImage

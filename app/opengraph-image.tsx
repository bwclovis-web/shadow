import { ImageResponse } from "next/og"

export const alt = "perfumer's hollow"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const noirGradient = "linear-gradient(135deg, #0d0d0d 0%, #1a1508 50%, #0d0d0d 100%)"

const OpenGraphImage = () =>
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
      <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>
        perfumer&apos;s hollow
      </div>
      <div style={{ fontSize: 30, marginTop: 24, color: "#e8d5a3", maxWidth: 900, lineHeight: 1.35 }}>
        Perfume archive, fragrance notes, houses, and a community trader exchange.
      </div>
    </div>,
    { ...size },
  )

export default OpenGraphImage

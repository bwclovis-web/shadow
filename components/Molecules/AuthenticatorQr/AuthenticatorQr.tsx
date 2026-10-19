"use client"

import { useEffect, useRef, useState } from "react"

type AuthenticatorQrProps = {
  otpauthUri: string
  alt: string
}

const AuthenticatorQr = ({ otpauthUri, alt }: AuthenticatorQrProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawFailed, setDrawFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    setDrawFailed(false)
    import("qrcode")
      .then((QRCode) => {
        if (cancelled) return
        return QRCode.toCanvas(canvas, otpauthUri, {
          width: 240,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        })
      })
      .catch(() => {
        if (!cancelled) setDrawFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [otpauthUri])

  return (
    <div className="mx-auto w-fit rounded bg-white p-3">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={alt}
        width={240}
        height={240}
        className="block h-60 w-60"
      />
      {drawFailed && (
        <p className="mt-2 max-w-60 text-center text-xs text-noir-black">
          QR code could not be drawn. Enter the manual key in your authenticator app.
        </p>
      )}
    </div>
  )
}

export default AuthenticatorQr

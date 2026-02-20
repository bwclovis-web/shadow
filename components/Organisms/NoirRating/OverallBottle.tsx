import React from "react"

const OverallBottle = ({
  filled,
  rating,
  liquidRef,
}: {
  filled: boolean
  rating: number
  liquidRef: React.RefObject<SVGRectElement | null>
}) => (
  <g>
    {/* Main bottle outline - elegant shape */}
    <path
      d="M12 8c0-1 1-2 3-2s3 1 3 2v20c0 2-1 3-3 3s-3-1-3-3V8z"
      fill="none"
      stroke={filled ? "#D4AF37" : "#4A4A4A"}
      strokeWidth="2"
      filter="url(#shadow-overall)"
    />

    {/* Bottle neck */}
    <rect
      x="13.5"
      y="4"
      width="3"
      height="4"
      fill={filled ? "#F4E4BC" : "#2D2D2D"}
      stroke={filled ? "#D4AF37" : "#4A4A4A"}
      strokeWidth="1"
    />

    {/* Liquid inside bottle - animated fill */}
    <rect
      ref={liquidRef}
      x="13"
      y="26"
      width="4"
      height="0"
      rx="1"
      fill="url(#liquid-gradient)"
      opacity="0"
    />

    {/* Golden cap */}
    <rect
      x="13.5"
      y="2"
      width="3"
      height="2"
      rx="1.5"
      fill="url(#cap-gradient)"
      stroke={filled ? "#D4AF37" : "#4A4A4A"}
      strokeWidth="1"
    />

    {/* Cap highlight */}
    <ellipse
      cx="15"
      cy="3"
      rx="1"
      ry="0.5"
      fill={filled ? "#FFFFFF" : "#1A1A1A"}
      opacity="0.6"
    />

    {/* Bottle reflection */}
    <ellipse cx="14" cy="15" rx="0.8" ry="5" fill="#FFFFFF" opacity="0.15" />

    {/* Liquid surface shimmer - only show when filled */}
    {filled && (
      <line
        x1="13.5"
        y1="9"
        x2="16.5"
        y2="9"
        stroke="#F4E4BC"
        strokeWidth="0.8"
        opacity="0.8"
      />
    )}
  </g>
)

export default OverallBottle

import React from "react"

const PerfumeBottle = ({
  filled,
  category,
}: {
  filled: boolean
  category: string
}) => {
  // Elegant perfume bottle shapes with consistent proportions
  const getBottlePath = () => {
    switch (category) {
      case "longevity":
        // Tall, slender bottle for longevity
        return "M12 8c0-1 1-2 3-2s3 1 3 2v20c0 2-1 3-3 3s-3-1-3-3V8z"
      case "sillage":
        // Wider bottle for projection/sillage
        return "M10 8c0-1 2-2 5-2s5 1 5 2v20c0 2-2 3-5 3s-5-1-5-3V8z"
      case "gender":
        // Curved bottle with waist for gender appeal
        return "M11 8c0-1 1.5-2 4-2s4 1 4 2v6c0 1-1 2-2 2h-4c-1 0-2-1-2-2V8z M10 18c0-1 2-2 5-2s5 1 5 2v10c0 2-2 3-5 3s-5-1-5-3V18z"
      case "priceValue":
        // Classic rectangular bottle for value
        return "M11 8c0-1 1-2 4-2s4 1 4 2v20c0 2-1 3-4 3s-4-1-4-3V8z"
      default:
        // Default elegant bottle
        return "M12 8c0-1 1-2 3-2s3 1 3 2v20c0 2-1 3-3 3s-3-1-3-3V8z"
    }
  }

  return (
    <g>
      {/* Main bottle body with elegant curves */}
      <path
        d={getBottlePath()}
        fill={`url(#gradient-${category}-${filled ? "filled" : "empty"})`}
        stroke={filled ? "#D4AF37" : "#4A4A4A"}
        strokeWidth="1.5"
        filter={`url(#shadow-${category})`}
      />

      {/* Golden neck section */}
      <rect
        x="13.5"
        y="4"
        width="3"
        height="4"
        fill={filled ? "#F4E4BC" : "#2D2D2D"}
        stroke={filled ? "#D4AF37" : "#4A4A4A"}
        strokeWidth="1"
      />

      {/* Bottle cap/stopper */}
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

      {/* Cap highlight for luxury effect */}
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
    </g>
  )
}

export default PerfumeBottle

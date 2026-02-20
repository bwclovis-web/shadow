import React from "react"

const NoirGradients = ({
  filled,
  category,
}: {
  filled: boolean
  category: string
}) => (
  <defs>
    {/* Main bottle gradient */}
    <linearGradient id={`gradient-${category}-${filled ? "filled" : "empty"}`}>
      {filled ? (
        <>
          <stop offset="0%" stopColor="#F4E4BC" />
          <stop offset="50%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#B8860B" />
        </>
      ) : (
        <>
          <stop offset="0%" stopColor="#2D2D2D" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#1A1A1A" stopOpacity="0.6" />
        </>
      )}
    </linearGradient>

    {/* Golden cap gradient */}
    <linearGradient id="cap-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#F4E4BC" />
      <stop offset="50%" stopColor="#D4AF37" />
      <stop offset="100%" stopColor="#B8860B" />
    </linearGradient>

    {/* Liquid gradient for overall bottles */}
    {category === "overall" && (
      <linearGradient id="liquid-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#F4E4BC" stopOpacity="0.9" />
        <stop offset="25%" stopColor="#D4AF37" stopOpacity="0.8" />
        <stop offset="75%" stopColor="#B8860B" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#8B7355" stopOpacity="0.6" />
      </linearGradient>
    )}
  </defs>
)

export default NoirGradients

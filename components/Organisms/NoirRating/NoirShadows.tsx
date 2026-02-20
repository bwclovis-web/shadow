import React from "react"

const NoirShadows = ({
  category,
  animated,
}: {
  category: string
  animated: boolean
}) => (
  <defs>
    {/* Elegant drop shadow */}
    <filter id={`shadow-${category}`}>
      <feDropShadow
        dx="1.5"
        dy="2"
        stdDeviation="1.2"
        floodColor="#000"
        floodOpacity="0.6"
      />
    </filter>

    {/* Animated smoke effect for special interactions */}
    {animated && (
      <filter id={`smoke-${category}`}>
        <feTurbulence baseFrequency="0.08" numOctaves="2" result="turbulence" />
        <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="2" />
      </filter>
    )}
  </defs>
)

export default NoirShadows

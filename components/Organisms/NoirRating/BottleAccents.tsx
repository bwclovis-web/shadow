const BottleAccents = ({ category }: { category: string }) => (
  <>
    {/* Elegant bottle label */}
    <rect
      x="13"
      y="14"
      width="4"
      height="8"
      rx="0.5"
      fill="#F4E4BC"
      opacity="0.2"
      stroke="#D4AF37"
      strokeWidth="0.5"
    />

    {/* Category-specific decorative elements */}
    {category === "longevity" && (
      <>
        <circle cx="15" cy="17" r="0.6" fill="#F4E4BC" opacity="0.8" />
        <circle cx="15" cy="19" r="0.4" fill="#D4AF37" opacity="0.6" />
      </>
    )}

    {category === "sillage" && (
      <>
        <circle cx="14" cy="16" r="0.3" fill="#F4E4BC" opacity="0.6" />
        <circle cx="15" cy="18" r="0.4" fill="#F4E4BC" opacity="0.7" />
        <circle cx="16" cy="20" r="0.3" fill="#F4E4BC" opacity="0.5" />
      </>
    )}

    {category === "gender" && (
      <rect x="14.5" y="16" width="1" height="5" fill="#F4E4BC" opacity="0.7" />
    )}

    {category === "priceValue" && (
      <text
        x="15"
        y="19"
        fontSize="2.2"
        textAnchor="middle"
        fill="#D4AF37"
        opacity="0.9"
        fontWeight="bold"
      >
        $
      </text>
    )}
  </>
)

export default BottleAccents

import { type ReactNode } from "react"

interface ImagePlaceholderProps {
  width?: number | string
  height?: number | string
  className?: string
  variant?: "skeleton" | "icon" | "gradient"
  icon?: ReactNode
  animate?: boolean
}

const ImagePlaceholder = ({
  width = "100%",
  height = "100%",
  className = "",
  variant = "skeleton",
  icon,
  animate = true,
}: ImagePlaceholderProps) => {
  const baseClasses = "flex items-center justify-center bg-gray-200 dark:bg-gray-700"
  const animateClasses = animate ? "animate-pulse" : ""

  if (variant === "icon" && icon) {
    return (
      <div
        className={`${baseClasses} ${animateClasses} ${className}`}
        style={{ width, height }}
      >
        <div className="text-gray-400 dark:text-gray-500 text-4xl">{icon}</div>
      </div>
    )
  }

  if (variant === "gradient") {
    return (
      <div
        className={`${baseClasses} bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 ${animateClasses} ${className}`}
        style={{ width, height }}
      />
    )
  }
  return (
    <div
      className={`${baseClasses} ${animateClasses} ${className}`}
      style={{ width, height }}
    />
  )
}

export default ImagePlaceholder
